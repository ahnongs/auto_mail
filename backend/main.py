from fastapi import FastAPI, HTTPException, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from jose import jwt, JWTError
from dotenv import load_dotenv
from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Any, Dict
import base64
import os
import json
import httpx

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
        max_age=3600,
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


SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "user_settings.json")

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
    return _load_all().get(uid, {})


@app.post("/settings")
def save_settings(body: Dict[str, Any], session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    uid = _get_uid(session)
    data = _load_all()
    data[uid] = body
    _save_all(data)
    return {"status": "ok"}


@app.get("/auth/logout")
def logout():
    response = RedirectResponse(url=FRONTEND_URL)
    response.delete_cookie("session")
    return response


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
                parts.append('<br><img src="cid:body_img" style="max-width:100%;border:1px solid #eee;border-radius:8px;margin-top:8px">')
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
                    bimg_part.add_header("Content-Disposition", "inline")
                    content.attach(bimg_part)
                if has_logo:
                    img_data = base64.b64decode(req.signatureImageData)
                    img_part = MIMEImage(img_data, _subtype=req.signatureImageType.split("/")[-1])
                    img_part.add_header("Content-ID", "<signature_img>")
                    img_part.add_header("Content-Disposition", "inline")
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
            part = MIMEBase("application", "octet-stream")
            part.set_payload(base64.b64decode(req.attachmentData))
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{req.attachmentName}"')
            part.add_header("Content-Type", req.attachmentType or "application/octet-stream")
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
        service.users().messages().send(userId="me", body={"raw": raw}).execute()

        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
