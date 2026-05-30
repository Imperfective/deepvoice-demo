# 외부 배포 가이드

이 앱은 **단일 포트(3001)** 에서 프론트엔드 + API + 설문 저장을 모두 처리합니다.
설문 데이터는 `data/surveys.json` 로컬 파일에 저장됩니다 (외부 DB·비용 0원).

---

## 1. 프로덕션 실행 (로컬)

```bash
npm install
npm start          # = npm run build && node server.cjs
```

→ http://localhost:3001 접속

> 개발 중에는 `npm run dev` (Vite 5173 + API 3001) 사용

---

## 2. AI 대화 엔진 (둘 중 하나)

| 방식 | 설정 | 비용 |
|------|------|------|
| **Ollama (로컬)** | `ollama serve` + `ollama pull exaone3.5:7.8b` | 0원 |
| **Claude API** | `.env`에 `ANTHROPIC_API_KEY=sk-ant-...` | 사용량 과금 |

둘 다 없으면 키워드 스크립트 모드로 자동 폴백됩니다.

---

## 3. 외부 DNS로 공개하기

### 방법 A — Cloudflare Tunnel (권장, 무료 + 내 도메인)

내 PC에서 Ollama를 그대로 쓰면서 공개 URL을 얻는 가장 저렴한 방법.

```bash
# 1. cloudflared 설치
brew install cloudflared

# 2. 앱 실행 (3001 포트)
npm start

# 3. 빠른 임시 URL (도메인 불필요)
cloudflared tunnel --url http://localhost:3001
#   → https://random-name.trycloudflare.com 발급

# 4. 내 도메인 연결 (Cloudflare에 도메인 등록된 경우)
cloudflared tunnel login
cloudflared tunnel create deepvoice
cloudflared tunnel route dns deepvoice demo.내도메인.com
cloudflared tunnel run --url http://localhost:3001 deepvoice
```

### 방법 B — ngrok (가장 간단, 임시 URL)

```bash
brew install ngrok
npm start
ngrok http 3001        # → https://xxxx.ngrok-free.app 발급
```

### 방법 C — 클라우드 서버 (VPS) 상시 운영

PC를 꺼도 동작해야 한다면 VPS(예: AWS Lightsail, Vultr)에 배포:

```bash
# 서버에서
git clone <repo> && cd deepvoice-demo
npm install && npm run build
# Ollama 설치 후 모델 pull, 또는 .env에 ANTHROPIC_API_KEY 설정
PORT=3001 node server.cjs
# 80/443 포트는 nginx 리버스 프록시 또는 Caddy로 연결
```

> ⚠️ Ollama는 메모리 8GB+ 권장. 저사양 VPS면 Claude API 방식이 낫습니다.

---

## 4. 설문 데이터 확인

| 경로 | 설명 |
|------|------|
| `GET /api/surveys` | 전체 응답 JSON |
| `GET /api/surveys.csv` | Excel용 CSV 다운로드 (한글 BOM 포함) |
| `data/surveys.json` | 원본 파일 (서버 디스크) |

브라우저에서 `https://<배포주소>/api/surveys.csv` 열면 바로 다운로드됩니다.

> 🔒 설문 조회 경로에 인증이 없으므로, 공개 운영 시 `/api/surveys*` 경로를
> 별도 비밀번호로 보호하거나 신뢰된 사람에게만 주소를 공유하세요.

---

## 5. 환경변수 정리 (.env)

```
# AI 대화 (선택)
ANTHROPIC_API_KEY=sk-ant-...        # Claude API 쓸 때만
OLLAMA_MODEL=exaone3.5:7.8b         # 기본값, 변경 가능

# 음성 (선택, 없으면 브라우저 TTS)
ELEVENLABS_API_KEY=...

# 포트 (선택, 기본 3001)
PORT=3001
```
