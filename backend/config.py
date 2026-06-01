from dotenv import load_dotenv
import os

load_dotenv()

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI         = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
SECRET_KEY           = os.getenv("SECRET_KEY", "dev-secret-key")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]

_DATA_DIR      = os.getenv("DATA_DIR", os.path.dirname(__file__))
SETTINGS_FILE  = os.path.join(_DATA_DIR, "user_settings.json")
SENT_FILE      = os.path.join(_DATA_DIR, "sent_mails.json")
SCHEDULED_FILE = os.path.join(_DATA_DIR, "scheduled_emails.json")

try:
    from supabase import create_client
    _sb_url = os.getenv("SUPABASE_URL")
    _sb_key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(_sb_url, _sb_key) if _sb_url and _sb_key else None
except Exception:
    supabase = None
