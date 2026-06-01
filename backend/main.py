from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from .config import FRONTEND_URL
from .auth import router as auth_router
from .mail import router as mail_router, do_send_scheduled

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(mail_router)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@app.on_event("startup")
async def startup():
    scheduler.add_job(
        do_send_scheduled,
        "interval",
        minutes=1,
        next_run_time=datetime.now(),
    )
    scheduler.start()
    print("[Scheduler] 시작됨 (1분 간격, 즉시 첫 실행)")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
