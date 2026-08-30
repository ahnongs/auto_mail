from fastapi import APIRouter, HTTPException, Cookie
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from typing import Any, Dict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from auth import get_uid, get_valid_credentials
from storage import load_user, load_scheduled, save_scheduled, add_scheduled, delete_scheduled, add_sent_mail, get_sent_mails
import base64
import uuid
import re
import mimetypes

# 일부 시스템 mimetypes 에 없는 이미지 포맷 보강 (아이폰 HEIC 등)
mimetypes.add_type("image/heic", ".heic")
mimetypes.add_type("image/heif", ".heif")
mimetypes.add_type("image/webp", ".webp")


def _build_attachment_part(att):
    """첨부파일 MIME 파트 생성.

    Content-Type 을 정확히 1개만 설정한다. (기존 버그: MIMEBase 가 만든
    application/octet-stream 헤더 위에 add_header 로 두 번째 Content-Type 을
    덧붙여, 메일 클라이언트가 첫 헤더인 octet-stream 을 읽고 이미지를
    정체불명 파일로 표시하는 문제가 있었음)
    """
    name = att.get("name") or "attachment"
    # 브라우저가 타입을 못 잡으면(type='') 파일명 확장자로 추론
    ctype = att.get("type") or mimetypes.guess_type(name)[0] or "application/octet-stream"
    maintype, _, subtype = ctype.partition("/")
    if not subtype:
        maintype, subtype = "application", "octet-stream"

    part = MIMEBase(maintype, subtype)
    part.set_payload(base64.b64decode(att["data"]))
    encoders.encode_base64(part)
    # filename= 키워드로 넘겨 한글 등 비ASCII 파일명도 올바르게 인코딩
    part.add_header("Content-Disposition", "attachment", filename=name)
    return part

router = APIRouter()


def _clean_header(value: str) -> str:
    """메일 헤더 인젝션 방지: 값에 섞인 CR/LF 를 제거한다.

    to/cc/subject 에 사용자 입력이 들어가므로, 개행을 통해 Bcc 등 추가 헤더를
    주입하는 것을 막는다."""
    if not value:
        return value
    return value.replace("\r", " ").replace("\n", " ").strip()


def _enforce_test_mode(to: str, cc: str, test_mode: bool, test_email: str):
    """테스트 모드 서버측 2차 방어선.

    프론트엔드(api.js)가 이미 to/cc 를 교체하지만, 실수(settings 인자 누락,
    새 발송 경로 추가 등)로 실제 수신자(대표/파트장/본부장 등)에게 나가는 것을
    서버에서 한 번 더 막는다. 테스트 모드면 to 를 테스트 이메일로 강제하고
    cc 를 제거하며, 테스트 이메일이 유효하지 않으면 발송을 거부한다.
    """
    if not test_mode:
        return to, cc
    if not test_email or "@" not in test_email:
        raise HTTPException(status_code=400, detail="테스트 모드에서는 유효한 테스트 이메일이 필요합니다.")
    return test_email, ""


# ── 설정 ──

@router.get("/settings")
def get_settings(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = get_uid(session)
    return load_user(uid)


@router.post("/settings")
def save_settings(body: Dict[str, Any], session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    from storage import save_user
    uid = get_uid(session)
    existing = load_user(uid)
    existing.update(body)
    save_user(uid, existing)
    return {"status": "ok"}


# ── 발송 이력 ──

@router.get("/mail/history")
def get_mail_history(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = get_uid(session)
    return get_sent_mails(uid)


# ── 메일 발송 ──

class MailRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: str = ""
    attachmentData: str = ""
    attachmentName: str = ""
    attachmentType: str = ""
    bodyImageData: str = ""
    bodyImageType: str = ""
    bodyImages: list = []
    attachments: list = []
    signatureImageData: str = ""
    signatureImageType: str = ""
    signatureText: str = ""
    signatureHtml: str = ""
    bodyHtml: str = ""
    mailType: str = ""
    sheetItems: list = []
    sheetUserName: str = ""
    sheetDept: str = ""
    sheetBank: str = ""
    sheetAccount: str = ""
    sheetAccountHolder: str = ""
    testMode: bool = False
    testEmail: str = ""


def build_mime_message(req: MailRequest) -> MIMEMultipart:
    all_body_images = []
    if req.bodyImageData:
        all_body_images.append({"data": req.bodyImageData, "type": req.bodyImageType})
    all_body_images.extend(req.bodyImages)

    all_attachments = []
    if req.attachmentData:
        all_attachments.append({"data": req.attachmentData, "name": req.attachmentName, "type": req.attachmentType})
    all_attachments.extend(req.attachments)

    has_logo      = bool(req.signatureImageData)
    has_body_imgs = bool(all_body_images)
    has_html_sig  = bool(req.signatureHtml or req.signatureImageData)
    needs_html    = has_html_sig or bool(req.bodyHtml) or has_body_imgs
    has_attachments = bool(all_attachments)

    def build_html():
        if req.bodyHtml:
            body_content = req.bodyHtml
        else:
            body_escaped = (req.body
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;"))
            body_content = (
                f'<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">'
                f'{body_escaped}</div>'
            )
        parts = [body_content]
        for i in range(len(all_body_images)):
            parts.append(f'<br><img src="cid:body_img_{i}" style="width:600px;max-width:100%;border:1px solid #eee;border-radius:8px;margin-top:8px">')
        if req.signatureHtml:
            parts.append('<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0">' + req.signatureHtml)
        elif req.signatureText:
            sig = req.signatureText.replace("\n", "<br>")
            parts.append(f'<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0"><div style="font-size:13px;color:#555">{sig}</div>')
        return "".join(parts)

    if needs_html:
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(req.body, "plain", "utf-8"))
        alt.attach(MIMEText(build_html(), "html", "utf-8"))

        if has_logo or has_body_imgs:
            content = MIMEMultipart("related")
            content.attach(alt)
            for i, img in enumerate(all_body_images):
                bimg_part = MIMEImage(base64.b64decode(img["data"]), _subtype=img["type"].split("/")[-1])
                bimg_part.add_header("Content-ID", f"<body_img_{i}>")
                content.attach(bimg_part)
            if has_logo:
                img_part = MIMEImage(base64.b64decode(req.signatureImageData), _subtype=req.signatureImageType.split("/")[-1])
                img_part.add_header("Content-ID", "<signature_img>")
                content.attach(img_part)
        else:
            content = alt

        msg = MIMEMultipart("mixed") if has_attachments else content
        if has_attachments:
            msg.attach(content)
    elif has_attachments:
        msg = MIMEMultipart()
        msg.attach(MIMEText(req.body, "plain", "utf-8"))
    else:
        msg = MIMEText(req.body, "plain", "utf-8")

    for att in all_attachments:
        part = _build_attachment_part(att)
        if not isinstance(msg, MIMEMultipart):
            outer = MIMEMultipart()
            outer.attach(msg)
            msg = outer
        msg.attach(part)

    msg["to"] = _clean_header(req.to)
    msg["subject"] = _clean_header(req.subject)
    if req.cc:
        msg["cc"] = _clean_header(req.cc)

    return msg


@router.post("/mail/send")
def send_mail(req: MailRequest, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    uid = get_uid(session)
    creds = get_valid_credentials(uid)

    # 테스트 모드 2차 방어선: 실제 수신자에게 나가지 않도록 서버에서 강제
    req.to, req.cc = _enforce_test_mode(req.to, req.cc, req.testMode, req.testEmail)

    try:
        service = build("gmail", "v1", credentials=creds)
        msg = build_mime_message(req)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        result = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        sheet_error = None
        if req.sheetItems:
            try:
                write_expense_to_sheets(
                    access_token=creds.token,
                    items=req.sheetItems,
                    user_name=req.sheetUserName,
                    dept=req.sheetDept,
                    bank=req.sheetBank,
                    account=req.sheetAccount,
                    account_holder=req.sheetAccountHolder,
                )
            except Exception as sheet_err:
                sheet_error = str(sheet_err)
                print(f"[Sheets] 기록 실패: {sheet_err}")

        # 테스트 발송은 '보낸 메일' 이력에 남기지 않는다 (실제 발송과 혼동 방지)
        if not req.testMode:
            try:
                add_sent_mail({
                    "id": str(uuid.uuid4()),
                    "uid": uid,
                    "type": req.mailType,
                    "subject": req.subject,
                    "to": req.to,
                    "sent_at": datetime.now().isoformat(),
                    "message_id": result.get("id", ""),
                })
            except Exception as hist_err:
                print(f"[History] 기록 실패: {hist_err}")

        return {"status": "ok", "message_id": result.get("id", ""), "sheet_error": sheet_error}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Google Sheets ──

EXPENSE_SHEET_ID   = "178YnlC8kKpSKeKm500tgaSkRmEIJzmEw0FSmfdNA9XM"
EXPENSE_SHEET_NAME = "개인카드 지출내역('26)"
EXPENSE_SHEET_GID  = 681510774

def write_expense_to_sheets(access_token, items, user_name, dept, bank, account, account_holder):
    creds = Credentials(token=access_token)
    service = build("sheets", "v4", credentials=creds)

    sheet_ref = EXPENSE_SHEET_NAME.replace("'", "''")
    ac_values = service.spreadsheets().values().get(
        spreadsheetId=EXPENSE_SHEET_ID,
        range=f"'{sheet_ref}'!A18:C"
    ).execute().get("values", [])

    last_no = 0
    last_data_row_0idx = 17

    for i, row in enumerate(ac_values):
        date_val = row[2].strip() if len(row) > 2 and row[2] else ""
        if date_val:
            last_data_row_0idx = 17 + i
            if row and row[0]:
                try:
                    last_no = max(last_no, int(str(row[0]).strip()))
                except Exception:
                    pass

    insert_at = last_data_row_0idx + 1
    dept_clean = re.sub(r'\s*파트\s*$', '', dept).strip()
    account_clean = account.replace("-", "")

    rows = []
    for i, item in enumerate(items):
        date_str = item.get("date", "")
        try:
            d = datetime.fromisoformat(date_str) if date_str else datetime.now()
            month_str = f"{str(d.year)[2:]}년 {str(d.month).zfill(2)}월"
        except Exception:
            now = datetime.now()
            month_str = f"{str(now.year)[2:]}년 {str(now.month).zfill(2)}월"

        amount_raw = str(item.get("amount", "0")).replace(",", "")
        try:
            amount = int(amount_raw)
        except Exception:
            amount = 0

        rows.append([
            last_no + i + 1,
            month_str,
            date_str,
            item.get("category", "").replace("(", " ("),
            f"{user_name} {item.get('detail', '')}".strip(),
            amount,
            user_name,
            dept_clean,
            bank,
            account_clean,
            account_holder,
        ])

    service.spreadsheets().batchUpdate(
        spreadsheetId=EXPENSE_SHEET_ID,
        body={"requests": [{"insertDimension": {
            "range": {"sheetId": EXPENSE_SHEET_GID, "dimension": "ROWS",
                      "startIndex": insert_at, "endIndex": insert_at + len(rows)},
            "inheritFromBefore": True,
        }}]}
    ).execute()

    service.spreadsheets().values().update(
        spreadsheetId=EXPENSE_SHEET_ID,
        range=f"'{sheet_ref}'!A{insert_at + 1}",
        valueInputOption="USER_ENTERED",
        body={"values": rows}
    ).execute()

    print(f"[Sheets] {len(rows)}행 삽입 완료 (row {insert_at + 1})")


# ── 예약 메일 ──

class ScheduleMailRequest(BaseModel):
    send_at: str
    to: str
    cc: str = ""
    subject: str
    body: str
    cover_body: str = ""
    original_message_id: str = ""
    fwd_body_image_data: str = ""
    fwd_body_image_type: str = ""
    signatureHtml: str = ""
    signatureImageData: str = ""
    signatureImageType: str = ""
    testMode: bool = False
    testEmail: str = ""


@router.post("/mail/schedule")
def schedule_mail(req: ScheduleMailRequest, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = get_uid(session)
    # 테스트 모드 2차 방어선: 저장 시점에 수신자를 강제 교체
    req.to, req.cc = _enforce_test_mode(req.to, req.cc, req.testMode, req.testEmail)
    item = {
        "id": str(uuid.uuid4()),
        "uid": uid,
        "send_at": req.send_at,
        "to": req.to,
        "cc": req.cc,
        "test_mode": req.testMode,
        "test_email": req.testEmail,
        "subject": req.subject,
        "body": req.body,
        "cover_body": req.cover_body,
        "original_message_id": req.original_message_id,
        "fwd_body_image_data": req.fwd_body_image_data,
        "fwd_body_image_type": req.fwd_body_image_type,
        "signatureHtml": req.signatureHtml,
        "signatureImageData": req.signatureImageData,
        "signatureImageType": req.signatureImageType,
        "created_at": datetime.now().isoformat(),
    }
    add_scheduled(item)
    return {"status": "ok", "id": item["id"]}


@router.get("/mail/scheduled")
def get_scheduled(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = get_uid(session)
    return [
        {"id": s["id"], "send_at": s["send_at"], "to": s["to"], "subject": s["subject"]}
        for s in load_scheduled() if s["uid"] == uid
    ]


@router.delete("/mail/scheduled/{schedule_id}")
def delete_scheduled_mail(schedule_id: str, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = get_uid(session)
    delete_scheduled(schedule_id, uid)
    return {"status": "ok"}


# ── 스케줄러 발송 로직 ──

async def do_send_scheduled():
    # 예약 시각(send_at)은 KST 기준 naive 문자열이므로 KST 로 통일해 비교한다.
    # (서버 로컬 TZ 가 UTC 여도 밀리지 않도록)
    kst = ZoneInfo("Asia/Seoul")
    now = datetime.now(kst)
    pending = load_scheduled()
    remaining = []

    for item in pending:
        try:
            send_at = datetime.fromisoformat(item["send_at"])
            if send_at.tzinfo is None:
                send_at = send_at.replace(tzinfo=kst)
        except Exception:
            continue

        if send_at > now:
            remaining.append(item)
            continue

        uid = item["uid"]
        refresh_token = load_user(uid).get("refresh_token")
        if not refresh_token:
            print(f"[Scheduler] refresh_token 없음 uid={uid}")
            delete_scheduled(item["id"], item["uid"])
            continue

        try:
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=GOOGLE_CLIENT_ID,
                client_secret=GOOGLE_CLIENT_SECRET,
            )
            creds.refresh(GoogleRequest())
            service = build("gmail", "v1", credentials=creds)

            sig_html      = item.get("signatureHtml", "")
            sig_img_data  = item.get("signatureImageData", "")
            sig_img_type  = item.get("signatureImageType", "")
            fwd_img_data  = item.get("fwd_body_image_data", "")
            fwd_img_type  = item.get("fwd_body_image_type", "")
            original_id   = item.get("original_message_id", "")
            cover_body    = item.get("cover_body") or item.get("body", "")
            plain_body    = item.get("body", "")
            html_body     = None

            if original_id:
                try:
                    orig = service.users().messages().get(userId="me", id=original_id, format="full").execute()
                    orig_headers = {h["name"]: h["value"] for h in orig["payload"]["headers"]}

                    def get_plain(payload):
                        if payload.get("mimeType") == "text/plain":
                            data = payload.get("body", {}).get("data", "")
                            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace") if data else ""
                        for part in payload.get("parts", []):
                            r = get_plain(part)
                            if r: return r
                        return ""

                    orig_plain = get_plain(orig["payload"])
                    orig_from  = orig_headers.get("From", "")
                    orig_date  = orig_headers.get("Date", "")
                    orig_subj  = orig_headers.get("Subject", "")
                    orig_to_h  = orig_headers.get("To", "")

                    plain_body = (
                        f"{cover_body}\n\n"
                        f"---------- Forwarded message ----------\n"
                        f"보낸사람: {orig_from}\n날짜: {orig_date}\n제목: {orig_subj}\n받는사람: {orig_to_h}\n\n"
                        f"{orig_plain}"
                    )

                    def esc(s):
                        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

                    fwd_img_tag = '<br><img src="cid:fwd_body_img" style="width:600px;max-width:100%;border:1px solid #eee;border-radius:8px;margin-top:8px">' if fwd_img_data else ''
                    html_body = (
                        f'<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">{esc(cover_body).replace(chr(10), "<br>")}</div>'
                        f'<br><br>'
                        f'<div style="border-left:3px solid #ccc;padding-left:12px;color:#555;font-size:13px;">'
                        f'<div style="margin-bottom:8px;">---------- Forwarded message ----------<br>'
                        f'보낸사람: {esc(orig_from)}<br>날짜: {esc(orig_date)}<br>제목: {esc(orig_subj)}<br>받는사람: {esc(orig_to_h)}</div>'
                        f'<pre style="white-space:pre-wrap;font-family:sans-serif;margin:0">{esc(orig_plain)}</pre>'
                        f'{fwd_img_tag}</div>'
                    )
                except Exception as e:
                    print(f"[Scheduler] 원본 메일 조회 실패: {e}")

            if html_body or sig_html:
                if html_body is None:
                    def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    html_body = f'<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">{esc(plain_body)}</div>'
                if sig_html:
                    html_body += '<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0">' + sig_html

                alt = MIMEMultipart("alternative")
                alt.attach(MIMEText(plain_body, "plain", "utf-8"))
                alt.attach(MIMEText(html_body, "html", "utf-8"))

                if fwd_img_data or sig_img_data:
                    msg = MIMEMultipart("related")
                    msg.attach(alt)
                    if fwd_img_data:
                        fi_part = MIMEImage(base64.b64decode(fwd_img_data), _subtype=fwd_img_type.split("/")[-1])
                        fi_part.add_header("Content-ID", "<fwd_body_img>")
                        msg.attach(fi_part)
                    if sig_img_data:
                        img_part = MIMEImage(base64.b64decode(sig_img_data), _subtype=sig_img_type.split("/")[-1])
                        img_part.add_header("Content-ID", "<signature_img>")
                        msg.attach(img_part)
                else:
                    msg = alt
            else:
                msg = MIMEText(plain_body, "plain", "utf-8")

            # 테스트 모드 최종 방어선: 예약 발송 시점에도 실제 수신자로 나가지 않도록 강제
            send_to, send_cc = _enforce_test_mode(
                item["to"], item.get("cc", ""),
                item.get("test_mode", False), item.get("test_email", ""),
            )

            msg["to"] = _clean_header(send_to)
            msg["subject"] = _clean_header(item["subject"])
            if send_cc:
                msg["cc"] = _clean_header(send_cc)

            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": raw}).execute()
            print(f"[Scheduler] 발송 완료: {item['subject']}")

        except Exception as e:
            print(f"[Scheduler] 발송 실패: {e}")

        delete_scheduled(item["id"], item["uid"])

    save_scheduled(remaining)
