# 사내 메일 자동화 서비스 - 작업 로그

> 여러 환경에서 이어서 작업할 수 있도록 진행 현황과 기술 메모를 기록합니다.

---

## 서비스 개요

- **프론트**: React (Vite) SPA — 페이지 상태 기반 라우팅 (React Router 미사용)
- **백엔드**: FastAPI + Google OAuth 2.0 + Gmail API + Google Sheets API
- **인증**: JWT 세션 쿠키 (httpOnly, samesite=lax, 30일 만료)
- **DB**: Supabase (PostgreSQL) — 없으면 로컬 JSON 파일로 폴백
- **예약 발송**: APScheduler (1분 간격 폴링)
- **배포**: Vercel (프론트) + Railway 또는 기타 (백엔드), main 브랜치 자동 배포

---

## 개발 브랜치

| 브랜치 | 용도 |
|--------|------|
| `main` | 배포 브랜치 (Vercel 연결) |
| `claude/content-revision-GAtTB` | 기능 개발 브랜치 |

> 현재 `main`에 모든 변경사항 병합 완료 (최신 커밋: `816d7db`)

---

## 완료된 작업

### ✅ 보안 개선 — JWT에서 access_token 제거 (`151b04f`)
- **변경 전**: JWT 페이로드에 Google access_token 포함 → 쿠키 탈취 시 토큰 노출
- **변경 후**: JWT에는 uid/email/name/picture만 포함, access_token은 서버 DB에 저장
- `_get_valid_credentials(uid)` 함수 추가 — 만료 5분 전에 refresh_token으로 자동 갱신
- 관련 파일: `backend/main.py`

### ✅ 발송 이력 기능 추가 (`5004f5f`, `816d7db`)
- 메일 발송 성공 시 Supabase `sent_mails` 테이블에 기록 (폴백: `sent_mails.json`)
- `GET /mail/history` 엔드포인트 — 사용자별 최근 50건 반환
- `HistoryPage.jsx` 신규 추가 — 타입별 필터 탭, Gmail 링크, 빈 상태 처리
- 홈 헤더에 `📋 이력` 버튼 추가
- 관련 파일: `backend/main.py`, `frontend/src/pages/HistoryPage.jsx`, `frontend/src/pages/Home.jsx`, `frontend/src/App.jsx`, `frontend/src/api.js`

### ✅ 지출결의서 다중 파일 첨부 (`19a6483`, `c81ee08`)
- `MultiFileDropZone.jsx` 신규 컴포넌트 — 이미지 썸네일 그리드 + 문서 리스트
- 이미지 → 본문 인라인 CID (`body_img_0`, `body_img_1`...), 문서 → 첨부파일
- 파일 피커: `<label htmlFor={inputId}>` 방식 (button.click() 보다 신뢰성 높음)
- stale closure 방지: `onChange(prev => [...prev, ...arr])` 함수형 업데이트
- 관련 파일: `frontend/src/components/MultiFileDropZone.jsx`, `frontend/src/pages/ExpenseRequest.jsx`

### ✅ mailType 추가 — 이력 분류용
- 전체 메일 페이지에 `mailType` 파라미터 추가
- 타입 목록: `vacation`, `expense`, `payment`, `payment2`, `clockfix`, `interview`, `repair`

### ✅ Gmail 첨부파일 목록 노출 버그 수정 (`983db88`)
- CID 인라인 이미지에 `Content-Disposition: inline` 추가 시 Gmail이 별도 첨부로 표시하는 문제
- 해결: `Content-Disposition` 헤더 제거

### ✅ 예약 발송 개선
- 발송 취소 시 브라우저 `confirm()` → 커스텀 모달로 변경 (`b4a6978`)
- 예약 데이터 Supabase 마이그레이션 (`aec0e12`)
- 테스트 모드에서도 수신자 올바르게 처리

### ✅ Google Sheets 자동 기록
- 지출결의서 발송 시 Google Sheets에 자동 행 삽입
- `sheetItems`, `sheetUserName`, `sheetDept`, `sheetBank`, `sheetAccount`, `sheetAccountHolder` 파라미터 사용

---

## 남은 작업

### ✅ #2 다중 파일 첨부 — 완료
- MultiFileDropZone 컴포넌트 정상 동작 확인
- JSX 주석 내 `*/*` 특수문자로 인한 Vercel 빌드 에러가 원인이었음 (`6c72742`로 수정)

### 🔲 #3 초안 자동저장 (미시작)
- 각 메일 폼 상태를 `localStorage`에 자동 저장
- 구현 방향:
  - `useLocalDraft(key, initialState)` 커스텀 훅 작성
  - 페이지 진입 시 저장된 초안 감지 → "이전에 작성하던 내용이 있어요. 불러올까요?" 알림
  - 발송 성공 시 초안 삭제
  - 각 메일 페이지별 고유 key 사용 (예: `draft_expense`, `draft_vacation`)

### 🔲 #5 백엔드 코드 구조 리팩토링 (미시작)
- 현재 `backend/main.py` 단일 파일이 너무 커짐 (~900줄)
- 분리 방향:
  ```
  backend/
    main.py          # FastAPI 앱 초기화 + CORS만
    routers/
      auth.py        # /auth/* 엔드포인트
      mail.py        # /mail/* 엔드포인트
      settings.py    # /settings/* 엔드포인트
    services/
      gmail.py       # Gmail API 연동
      sheets.py      # Google Sheets 연동
      token.py       # 토큰 관리 (_get_valid_credentials)
    storage/
      users.py       # _load_user, _save_user
      scheduled.py   # 예약 발송 CRUD
      sent.py        # 발송 이력 CRUD
  ```

### 🔲 #6 테스트 코드 작성 (미시작)
- **백엔드** (pytest):
  - `/auth/me` — 유효/만료 세션 처리
  - `/mail/send` — 필수 필드 누락, 인증 없음
  - `/mail/history` — 사용자별 분리 확인
  - `_get_valid_credentials` — 토큰 만료 시 갱신 흐름
- **프론트엔드** (Vitest + Testing Library):
  - `MultiFileDropZone` — 파일 추가/삭제
  - `useUndoSend` 훅 — schedule/cancel/sendNow
  - 각 메일 폼 — 필수 입력 검증

---

## 주요 파일 구조

```
auto_mail/
├── backend/
│   └── main.py                    # FastAPI 전체 (인증, 메일 발송, 이력, 설정)
├── frontend/src/
│   ├── App.jsx                    # 페이지 라우팅 (page state 방식)
│   ├── api.js                     # axios 래퍼, sendMail, getMailHistory 등
│   ├── config/
│   │   └── recipients.js          # R.request 등 수신자 상수
│   ├── utils/
│   │   └── signature.js           # buildSignatureHtml()
│   ├── hooks/
│   │   └── useUndoSend.js         # 발송 전 10초 취소 훅
│   ├── components/
│   │   ├── FileDropZone.jsx       # 단일 파일 드롭존
│   │   ├── MultiFileDropZone.jsx  # 다중 파일 드롭존 (이미지+문서)
│   │   └── SendPendingScreen.jsx  # 발송 대기 화면
│   └── pages/
│       ├── Home.jsx               # 메인 화면 + 설정 모달
│       ├── HistoryPage.jsx        # 발송 이력 페이지
│       ├── Login.jsx
│       ├── VacationRequest.jsx    # 휴가신청
│       ├── ExpenseRequest.jsx     # 지출결의서
│       ├── PaymentRequest.jsx     # 입금요청
│       ├── OnlinePaymentRequest.jsx # 온라인결제요청
│       ├── ClockFixRequest.jsx    # 출퇴근 정정
│       ├── InterviewRequest.jsx   # 면접 안내
│       ├── RepairRequest.jsx      # 수리요청
│       └── DesignRequest.jsx      # (미완성)
└── WORKLOG.md                     # 이 파일
```

---

## 기술 메모

### 이메일 MIME 구조
```
MIMEMultipart("mixed")          ← 첨부파일 있을 때 최외곽
  MIMEMultipart("related")      ← CID 인라인 이미지 있을 때
    MIMEMultipart("alternative")
      MIMEText(plain)
      MIMEText(html)
    MIMEImage(body_img_0)       ← Content-ID: <body_img_0>  (Disposition 없음!)
    MIMEImage(signature_img)    ← Content-ID: <signature_img>
  MIMEBase(attachment)          ← 일반 첨부파일
```
> **주의**: CID 이미지에 `Content-Disposition: inline` 추가하면 Gmail이 별도 첨부로 표시함

### Supabase 테이블 구조
| 테이블 | 컬럼 | 용도 |
|--------|------|------|
| `user_settings` | `uid`, `data` (jsonb) | 사용자 설정 + 토큰 |
| `scheduled_mails` | `id`, `uid`, `data` (jsonb) | 예약 발송 |
| `sent_mails` | `uid`, `type`, `subject`, `to`, `sent_at`, `message_id` | 발송 이력 |

### 환경 변수 (backend/.env)
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIRECT_URI=
SECRET_KEY=
FRONTEND_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
DATA_DIR=          # 로컬 파일 저장 경로 (Supabase 없을 때)
```

---

## 커밋 히스토리 요약

| 커밋 | 내용 |
|------|------|
| `816d7db` | 발송 이력 홈에서 분리 → 별도 HistoryPage |
| `5004f5f` | 발송 이력 기능 추가 (DB + API + UI) |
| `c81ee08` | MultiFileDropZone 파일 피커/다중 추가 수정 |
| `b0a6f70` | 다중 파일 stale closure 버그 수정 |
| `19a6483` | 지출결의서 다중 파일 첨부 지원 |
| `151b04f` | JWT에서 access_token 제거 (보안) |
| `983db88` | CID 이미지 Content-Disposition 제거 (Gmail 버그 수정) |
| `b4a6978` | 예약 취소 confirm → 커스텀 모달 |
| `aec0e12` | 예약 발송 내역 홈 화면에 표시 |
