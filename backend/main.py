from fastapi import FastAPI, HTTPException, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from jose import jwt, JWTError
from dotenv import load_dotenv
from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Any, Dict
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import uuid
import base64
import os
import json
import re
import httpx

try:
    from supabase import create_client
    _sb_url = os.getenv("SUPABASE_URL")
    _sb_key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(_sb_url, _sb_key) if _sb_url and _sb_key else None
except Exception:
    supabase = None

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]


def create_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )


@app.get("/auth/google")
def google_login():
    flow = create_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@app.get("/auth/callback")
async def google_callback(code: str):
    flow = create_flow()
    flow.fetch_token(code=code)

    credentials = flow.credentials

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
    user_info = resp.json()

    # refresh_token 저장 (예약 발송 시 사용)
    if credentials.refresh_token:
        uid = user_info["id"]
        existing = _load_user(uid)
        existing["refresh_token"] = credentials.refresh_token
        _save_user(uid, existing)

    token = jwt.encode(
        {
            "sub": user_info["id"],
            "email": user_info["email"],
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
            "access_token": credentials.token,
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    response = RedirectResponse(url=f"{FRONTEND_URL}?login=success")
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=FRONTEND_URL.startswith("https://"),
        max_age=60 * 60 * 24 * 30,  # 30일
    )
    return response


@app.get("/auth/me")
def get_me(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = jwt.decode(session, SECRET_KEY, algorithms=["HS256"])
        return {
            "email": payload["email"],
            "name": payload["name"],
            "picture": payload["picture"],
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")


_DATA_DIR = os.getenv("DATA_DIR", os.path.dirname(__file__))
SETTINGS_FILE = os.path.join(_DATA_DIR, "user_settings.json")
SCHEDULED_FILE = os.path.join(_DATA_DIR, "scheduled_emails.json")

# ── 유저 설정 로드 (Supabase 우선, 파일 폴백) ──
def _load_user(uid: str) -> dict:
    if supabase:
        try:
            res = supabase.table("user_settings").select("data").eq("uid", uid).execute()
            if res.data:
                return res.data[0]["data"] or {}
        except Exception:
            pass
    return _load_all().get(uid, {})

def _save_user(uid: str, data: dict):
    if supabase:
        try:
            supabase.table("user_settings").upsert({"uid": uid, "data": data}).execute()
            return
        except Exception:
            pass
    all_data = _load_all()
    all_data[uid] = data
    _save_all(all_data)

def _load_all():
    if not os.path.exists(SETTINGS_FILE):
        return {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_all(data: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _load_scheduled():
    if supabase:
        try:
            res = supabase.table("scheduled_mails").select("data").execute()
            return [r["data"] for r in (res.data or [])]
        except Exception as e:
            print(f"[Supabase] scheduled load error: {e}")
    if not os.path.exists(SCHEDULED_FILE):
        return []
    try:
        with open(SCHEDULED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_scheduled(data: list):
    if not supabase:
        with open(SCHEDULED_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def _add_scheduled_item(item: dict):
    if supabase:
        try:
            supabase.table("scheduled_mails").insert({
                "id": item["id"], "uid": item["uid"], "data": item
            }).execute()
            return
        except Exception as e:
            print(f"[Supabase] scheduled insert error: {e}")
    scheduled = _load_scheduled()
    scheduled.append(item)
    _save_scheduled(scheduled)

def _delete_scheduled_item(schedule_id: str, uid: str):
    if supabase:
        try:
            supabase.table("scheduled_mails").delete().eq("id", schedule_id).eq("uid", uid).execute()
            return
        except Exception as e:
            print(f"[Supabase] scheduled delete error: {e}")
    scheduled = _load_scheduled()
    _save_scheduled([s for s in scheduled if not (s["id"] == schedule_id and s["uid"] == uid)])


def _get_uid(session: str):
    try:
        return jwt.decode(session, SECRET_KEY, algorithms=["HS256"])["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")


@app.get("/settings")
def get_settings(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    return _load_user(uid)


@app.post("/settings")
def save_settings(body: Dict[str, Any], session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    existing = _load_user(uid)
    existing.update(body)
    _save_user(uid, existing)
    return {"status": "ok"}


@app.get("/auth/logout")
def logout():
    response = RedirectResponse(url=FRONTEND_URL)
    response.delete_cookie("session")
    return response


EXPENSE_SHEET_ID = "178YnlC8kKpSKeKm500tgaSkRmEIJzmEw0FSmfdNA9XM"
EXPENSE_SHEET_NAME = "개인카드 지출내역('26)"
EXPENSE_SHEET_GID = 681510774  # gid from URL

def write_expense_to_sheets(access_token: str, items: list, user_name: str, dept: str, bank: str, account: str, account_holder: str):
    creds = Credentials(token=access_token)
    service = build("sheets", "v4", credentials=creds)

    # 시트 이름 따옴표 이스케이프
    sheet_ref = EXPENSE_SHEET_NAME.replace("'", "''")

    # 사용일자(C열) 기준으로 마지막 실제 데이터 행 찾기
    # A열은 빈 행에도 NO가 미리 채워져 있어서 C열(날짜)로 판단
    ac_values = service.spreadsheets().values().get(
        spreadsheetId=EXPENSE_SHEET_ID,
        range=f"'{sheet_ref}'!A18:C"
    ).execute().get("values", [])

    last_no = 0
    last_data_row_0idx = 17  # 0-indexed, 기본값 = row 18 (헤더 다음)

    for i, row in enumerate(ac_values):
        # C열(index 2)에 날짜 값이 있는 행만 실제 데이터로 인정
        date_val = row[2].strip() if len(row) > 2 and row[2] else ""
        if date_val:
            last_data_row_0idx = 17 + i
            # A열에서 NO 추적 (다음 번호 계산용)
            if row and row[0]:
                try:
                    last_no = max(last_no, int(str(row[0]).strip()))
                except Exception:
                    pass

    insert_at = last_data_row_0idx + 1  # 삽입할 위치 (0-indexed)

    # 부서: " 파트" 제거, 계좌: "-" 제거
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

        category = item.get("category", "").replace("(", " (")
        detail = f"{user_name} {item.get('detail', '')}".strip()
        amount_raw = str(item.get("amount", "0")).replace(",", "")
        try:
            amount = int(amount_raw)
        except Exception:
            amount = 0

        rows.append([
            last_no + i + 1,  # NO
            month_str,         # 월별
            date_str,          # 사용일자
            category,          # 계정과목
            detail,            # 세부내용
            amount,            # 결제금액
            user_name,         # 사용자
            dept_clean,        # 부서
            bank,              # 은행명
            account_clean,     # 계좌번호
            account_holder,    # 예금주명
        ])

    # 정확한 위치에 행 삽입
    service.spreadsheets().batchUpdate(
        spreadsheetId=EXPENSE_SHEET_ID,
        body={"requests": [{
            "insertDimension": {
                "range": {
                    "sheetId": EXPENSE_SHEET_GID,
                    "dimension": "ROWS",
                    "startIndex": insert_at,
                    "endIndex": insert_at + len(rows)
                },
                "inheritFromBefore": True
            }
        }]}
    ).execute()

    # 삽입된 행에 데이터 쓰기
    service.spreadsheets().values().update(
        spreadsheetId=EXPENSE_SHEET_ID,
        range=f"'{sheet_ref}'!A{insert_at + 1}",  # 1-indexed
        valueInputOption="USER_ENTERED",
        body={"values": rows}
    ).execute()

    print(f"[Sheets] {len(rows)}행 삽입 완료 (row {insert_at + 1})")


class MailRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: str = ""
    attachmentData: str = ""
    attachmentName: str = ""
    attachmentType: str = ""
    signatureImageData: str = ""
    signatureImageType: str = ""
    signatureText: str = ""
    signatureHtml: str = ""
    bodyHtml: str = ""
    bodyImageData: str = ""
    bodyImageType: str = ""
    sheetItems: list = []
    sheetUserName: str = ""
    sheetDept: str = ""
    sheetBank: str = ""
    sheetAccount: str = ""
    sheetAccountHolder: str = ""


@app.post("/mail/send")
def send_mail(req: MailRequest, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = jwt.decode(session, SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")

    access_token = payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="액세스 토큰이 없습니다. 다시 로그인해주세요.")

    try:
        from email.mime.image import MIMEImage

        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)

        has_logo = bool(req.signatureImageData)
        has_body_img = bool(req.bodyImageData)
        has_html_sig = bool(req.signatureHtml or req.signatureImageData)
        needs_html = has_html_sig or bool(req.bodyHtml) or has_body_img
        has_attachment = bool(req.attachmentData)

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
            # 본문 이미지는 서명 위에
            if has_body_img:
                parts.append('<br><img src="cid:body_img" style="width:600px;max-width:100%;border:1px solid #eee;border-radius:8px;margin-top:8px">')
            if req.signatureHtml:
                parts.append(
                    '<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0">'
                    + req.signatureHtml
                )
            elif req.signatureText:
                sig = req.signatureText.replace("\n", "<br>")
                parts.append(
                    f'<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0">'
                    f'<div style="font-size:13px;color:#555">{sig}</div>'
                )
            # 로고는 signatureHtml 안에 이미 포함되어 있으므로 별도 추가 안 함
            return "".join(parts)

        if needs_html:
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(req.body, "plain", "utf-8"))
            alt.attach(MIMEText(build_html(), "html", "utf-8"))

            if has_logo or has_body_img:
                content = MIMEMultipart("related")
                content.attach(alt)
                if has_body_img:
                    bimg_data = base64.b64decode(req.bodyImageData)
                    bimg_part = MIMEImage(bimg_data, _subtype=req.bodyImageType.split("/")[-1])
                    bimg_part.add_header("Content-ID", "<body_img>")
                    content.attach(bimg_part)
                if has_logo:
                    img_data = base64.b64decode(req.signatureImageData)
                    img_part = MIMEImage(img_data, _subtype=req.signatureImageType.split("/")[-1])
                    img_part.add_header("Content-ID", "<signature_img>")
                    content.attach(img_part)
            else:
                content = alt

            if has_attachment:
                msg = MIMEMultipart("mixed")
                msg.attach(content)
            else:
                msg = content
        elif has_attachment:
            msg = MIMEMultipart()
            msg.attach(MIMEText(req.body, "plain", "utf-8"))
        else:
            msg = MIMEText(req.body, "plain", "utf-8")

        if has_attachment:
            att_type = req.attachmentType or "application/octet-stream"
            main_type, sub_type = att_type.split("/", 1)
            part = MIMEBase(main_type, sub_type)
            part.set_payload(base64.b64decode(req.attachmentData))
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{req.attachmentName}"')
            if not isinstance(msg, MIMEMultipart):
                outer = MIMEMultipart()
                outer.attach(msg)
                msg = outer
            msg.attach(part)

        msg["to"] = req.to
        msg["subject"] = req.subject
        if req.cc:
            msg["cc"] = req.cc

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        result = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        # 지출결의서 시트 자동 기록 (sheetItems가 있을 때만)
        sheet_error = None
        if req.sheetItems:
            try:
                write_expense_to_sheets(
                    access_token=access_token,
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

        return {"status": "ok", "message_id": result.get("id", ""), "sheet_error": sheet_error}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# 예약 메일
# ─────────────────────────────────────────────

class ScheduleMailRequest(BaseModel):
    send_at: str  # "2026-05-20T09:00:00"
    to: str
    cc: str = ""
    subject: str
    body: str
    cover_body: str = ""           # 전달 메일의 새 본문 (커버 텍스트)
    original_message_id: str = ""  # 진짜 전달용 Gmail 원본 메시지 ID
    fwd_body_image_data: str = ""  # 원본 첨부 이미지 (플렉스 캡처)
    fwd_body_image_type: str = ""
    signatureHtml: str = ""
    signatureImageData: str = ""
    signatureImageType: str = ""


@app.post("/mail/schedule")
def schedule_mail(req: ScheduleMailRequest, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    item = {
        "id": str(uuid.uuid4()),
        "uid": uid,
        "send_at": req.send_at,
        "to": req.to,
        "cc": req.cc,
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
    _add_scheduled_item(item)
    return {"status": "ok", "id": item["id"]}


@app.get("/mail/scheduled")
def get_scheduled(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    return [
        {"id": s["id"], "send_at": s["send_at"], "to": s["to"], "subject": s["subject"]}
        for s in _load_scheduled() if s["uid"] == uid
    ]


@app.delete("/mail/scheduled/{schedule_id}")
def delete_scheduled(schedule_id: str, session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    _delete_scheduled_item(schedule_id, uid)
    return {"status": "ok"}


# ─────────────────────────────────────────────
# 스케줄러 (10분마다 예약 메일 확인 후 발송)
# ─────────────────────────────────────────────

async def do_send_scheduled():
    from email.mime.image import MIMEImage
    now = datetime.now()
    pending = _load_scheduled()
    remaining = []
    for item in pending:
        try:
            send_at = datetime.fromisoformat(item["send_at"])
        except Exception:
            continue

        if send_at > now:
            remaining.append(item)
            continue

        # 발송 시도 후 Supabase에서 삭제 (성공/실패 무관하게 만료된 항목 제거)

        uid = item["uid"]
        refresh_token = _load_user(uid).get("refresh_token")
        if not refresh_token:
            print(f"[Scheduler] refresh_token 없음 uid={uid}")
            _delete_scheduled_item(item["id"], item["uid"])
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

            sig_html = item.get("signatureHtml", "")
            sig_img_data = item.get("signatureImageData", "")
            sig_img_type = item.get("signatureImageType", "")
            fwd_img_data = item.get("fwd_body_image_data", "")
            fwd_img_type = item.get("fwd_body_image_type", "")
            original_message_id = item.get("original_message_id", "")
            cover_body = item.get("cover_body") or item.get("body", "")

            plain_body = item.get("body", "")
            html_body = None

            # ── 진짜 Gmail 전달 ──
            if original_message_id:
                try:
                    orig = service.users().messages().get(
                        userId="me", id=original_message_id, format="full"
                    ).execute()
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

                    # plain text
                    plain_body = (
                        f"{cover_body}\n\n"
                        f"---------- Forwarded message ----------\n"
                        f"보낸사람: {orig_from}\n"
                        f"날짜: {orig_date}\n"
                        f"제목: {orig_subj}\n"
                        f"받는사람: {orig_to_h}\n\n"
                        f"{orig_plain}"
                    )

                    # HTML
                    def esc(s):
                        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

                    fwd_img_data = item.get("fwd_body_image_data", "")
                    cover_html = esc(cover_body).replace("\n", "<br>")
                    orig_html  = esc(orig_plain)
                    fwd_img_tag = '<br><img src="cid:fwd_body_img" style="width:600px;max-width:100%;border:1px solid #eee;border-radius:8px;margin-top:8px">' if fwd_img_data else ''
                    html_body = (
                        f'<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">{cover_html}</div>'
                        f'<br><br>'
                        f'<div style="border-left:3px solid #ccc;padding-left:12px;color:#555;font-size:13px;">'
                        f'<div style="margin-bottom:8px;">---------- Forwarded message ----------<br>'
                        f'보낸사람: {esc(orig_from)}<br>'
                        f'날짜: {esc(orig_date)}<br>'
                        f'제목: {esc(orig_subj)}<br>'
                        f'받는사람: {esc(orig_to_h)}</div>'
                        f'<pre style="white-space:pre-wrap;font-family:sans-serif;margin:0">{orig_html}</pre>'
                        f'{fwd_img_tag}'
                        f'</div>'
                    )

                except Exception as e:
                    print(f"[Scheduler] 원본 메일 조회 실패: {e} → 텍스트 포맷으로 대체")

            # ── MIME 메시지 빌드 ──
            if html_body or sig_html:
                if html_body is None:
                    def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    html_body = (
                        f'<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">'
                        f'{esc(plain_body)}</div>'
                    )
                if sig_html:
                    html_body += '<br><hr style="border:none;border-top:1px solid #eee;margin:16px 0">' + sig_html

                alt = MIMEMultipart("alternative")
                alt.attach(MIMEText(plain_body, "plain", "utf-8"))
                alt.attach(MIMEText(html_body, "html", "utf-8"))

                if fwd_img_data or sig_img_data:
                    msg = MIMEMultipart("related")
                    msg.attach(alt)
                    if fwd_img_data:
                        fi = base64.b64decode(fwd_img_data)
                        fi_part = MIMEImage(fi, _subtype=fwd_img_type.split("/")[-1])
                        fi_part.add_header("Content-ID", "<fwd_body_img>")
                        msg.attach(fi_part)
                    if sig_img_data:
                        img_data = base64.b64decode(sig_img_data)
                        img_part = MIMEImage(img_data, _subtype=sig_img_type.split("/")[-1])
                        img_part.add_header("Content-ID", "<signature_img>")
                        msg.attach(img_part)
                else:
                    msg = alt
            else:
                msg = MIMEText(plain_body, "plain", "utf-8")

            msg["to"] = item["to"]
            msg["subject"] = item["subject"]
            if item.get("cc"):
                msg["cc"] = item["cc"]

            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": raw}).execute()
            print(f"[Scheduler] 발송 완료: {item['subject']}")

        except Exception as e:
            print(f"[Scheduler] 발송 실패: {e}")

        _delete_scheduled_item(item["id"], item["uid"])

    _save_scheduled(remaining)


scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@app.on_event("startup")
async def startup():
    scheduler.add_job(
        do_send_scheduled,
        "interval",
        minutes=1,
        next_run_time=datetime.now(),  # 시작 즉시 첫 실행
    )
    scheduler.start()
    print("[Scheduler] 시작됨 (1분 간격, 즉시 첫 실행)")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
