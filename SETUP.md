# 다른 PC에서 서버 띄우기 (이전 가이드)

이 프로젝트를 새 컴퓨터(집 PC 등)로 옮겨 서버로 띄우는 방법입니다.
**Windows**와 **Mac** 두 가지로 나눠 설명합니다.

> 구성: 프론트엔드 + 백엔드(설문 저장 포함)가 **단일 포트(3001)** 에서 동작하고,
> AI 대화는 **Ollama(로컬·무료)**, 외부 공개는 **Cloudflare 터널**로 합니다.

---

## 0. 공통 준비물

새 PC에 아래 3가지를 설치해야 합니다. (OS별 설치법은 아래 참고)
1. **Node.js** (18 이상) — 서버 실행
2. **Ollama** + 한국어 모델 — AI 대화 엔진
3. **cloudflared** — 외부 공개 URL
4. **Git** — 소스 내려받기

---

## 🪟 Windows에서 설치

### 1) 프로그램 설치
- **Node.js**: https://nodejs.org 에서 LTS 버전 다운로드 → 설치
- **Git**: https://git-scm.com/download/win → 설치
- **Ollama**: https://ollama.com/download/windows → 설치
- **cloudflared**: https://github.com/cloudflare/cloudflared/releases 에서
  `cloudflared-windows-amd64.exe` 다운로드 → `cloudflared.exe`로 이름 변경 후
  편한 폴더(예: `C:\cloudflared\`)에 둠

### 2) 소스 내려받기 (PowerShell 또는 명령 프롬프트)
```powershell
git clone https://github.com/<your-id>/deepvoice-demo.git
cd deepvoice-demo
npm install
```

### 3) AI 모델 받기 (최초 1회, 약 5GB)
```powershell
ollama pull exaone3.5:7.8b
```

### 4) 빌드 & 서버 실행
```powershell
npm run build
node server.cjs
```
→ 브라우저에서 `http://localhost:3001` 접속되면 성공

### 5) 외부 공개 (새 PowerShell 창에서)
```powershell
C:\cloudflared\cloudflared.exe tunnel --url http://localhost:3001
```
→ 출력되는 `https://xxxx.trycloudflare.com` 주소를 참여자에게 공유

---

## 🍎 Mac에서 설치

### 1) 프로그램 설치 (Homebrew 사용)
```bash
# Homebrew 없으면 먼저 설치: https://brew.sh
brew install node git ollama cloudflared
```

### 2) 소스 내려받기
```bash
git clone https://github.com/<your-id>/deepvoice-demo.git
cd deepvoice-demo
npm install
```

### 3) AI 모델 받기 (최초 1회, 약 5GB)
```bash
ollama serve &              # Ollama 백그라운드 실행
ollama pull exaone3.5:7.8b
```

### 4) 빌드 & 서버 실행
```bash
npm run build
node server.cjs
```
→ `http://localhost:3001` 접속 확인

### 5) 외부 공개 (새 터미널에서)
```bash
cloudflared tunnel --url http://localhost:3001
```

---

## 실행 순서 요약 (양 OS 공통)

서버를 켤 때마다 **3개**가 떠 있어야 합니다:
1. **Ollama** — `ollama serve` (Windows는 설치 시 자동 실행됨)
2. **서버** — `node server.cjs`
3. **터널** — `cloudflared tunnel --url http://localhost:3001`

---

## 데이터·설정 관련 주의

- **`.env` 파일은 GitHub에 올라가지 않습니다.** (API 키 보호)
  ElevenLabs 등 키를 쓰려면 새 PC에서 `.env.example`을 복사해 `.env`로 만들고 키를 채우세요.
  (Ollama만 쓸 거면 `.env` 없어도 동작합니다.)
- **설문 데이터(`data/`)도 GitHub에 올라가지 않습니다.** 각 PC에 따로 쌓입니다.
  → 즉, 맥에서 모은 설문과 새 PC에서 모은 설문은 **별개 파일**입니다. 옮기려면 `data/` 폴더를 직접 복사하세요.

---

## 설문 데이터 확인 (어느 OS든 동일)

| 용도 | 주소 |
|------|------|
| 통계 대시보드 | `http://localhost:3001/stats` |
| CSV 다운로드 | `http://localhost:3001/api/surveys.csv` |
| 복원 (메인 파일 비었을 때) | `POST http://localhost:3001/api/surveys/restore` |

공개 URL이면 `localhost:3001` 대신 `https://xxxx.trycloudflare.com` 사용.
