from .config import supabase, SETTINGS_FILE, SENT_FILE, SCHEDULED_FILE
import json
import os


# ── 유저 설정 ──

def load_user(uid: str) -> dict:
    if supabase:
        try:
            res = supabase.table("user_settings").select("data").eq("uid", uid).execute()
            if res.data:
                return res.data[0]["data"] or {}
        except Exception:
            pass
    return _load_all_file().get(uid, {})

def save_user(uid: str, data: dict):
    if supabase:
        try:
            supabase.table("user_settings").upsert({"uid": uid, "data": data}).execute()
            return
        except Exception:
            pass
    all_data = _load_all_file()
    all_data[uid] = data
    _save_all_file(all_data)

def _load_all_file() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        return {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_all_file(data: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── 예약 메일 ──

def load_scheduled() -> list:
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

def save_scheduled(data: list):
    if not supabase:
        with open(SCHEDULED_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def add_scheduled(item: dict):
    if supabase:
        try:
            supabase.table("scheduled_mails").insert({
                "id": item["id"], "uid": item["uid"], "data": item
            }).execute()
            return
        except Exception as e:
            print(f"[Supabase] scheduled insert error: {e}")
    items = load_scheduled()
    items.append(item)
    save_scheduled(items)

def delete_scheduled(schedule_id: str, uid: str):
    if supabase:
        try:
            supabase.table("scheduled_mails").delete().eq("id", schedule_id).eq("uid", uid).execute()
            return
        except Exception as e:
            print(f"[Supabase] scheduled delete error: {e}")
    items = load_scheduled()
    save_scheduled([s for s in items if not (s["id"] == schedule_id and s["uid"] == uid)])


# ── 발송 이력 ──

def add_sent_mail(item: dict):
    if supabase:
        try:
            supabase.table("sent_mails").insert({"id": item["id"], "uid": item["uid"], "data": item}).execute()
            return
        except Exception as e:
            print(f"[Supabase] sent_mails insert error: {e}")
    records = _load_sent_file()
    records.append(item)
    with open(SENT_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

def get_sent_mails(uid: str, limit: int = 50) -> list:
    if supabase:
        try:
            res = supabase.table("sent_mails").select("data").eq("uid", uid).order("data->>sent_at", desc=True).limit(limit).execute()
            return [r["data"] for r in (res.data or [])]
        except Exception as e:
            print(f"[Supabase] sent_mails select error: {e}")
    records = _load_sent_file()
    user_records = [r for r in records if r.get("uid") == uid]
    user_records.sort(key=lambda r: r.get("sent_at", ""), reverse=True)
    return user_records[:limit]

def _load_sent_file() -> list:
    if not os.path.exists(SENT_FILE):
        return []
    try:
        with open(SENT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []
