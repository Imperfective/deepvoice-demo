# 딥보이스 보이스피싱 경고 UX 연구 프로토타입

> **A Study on Warning UX Design to Prevent Deepvoice-based Vishing Attacks**

AI 합성 음성(딥보이스) 기반 보이스피싱에 대응하는 **통화 화면 경고 UX**의 효과를 측정하기 위한
React + Node.js 기반 인터랙티브 연구 프로토타입입니다. 실제처럼 동작하는 통화 시뮬레이션 위에
네 가지 경고 패턴을 구현하고, 체험 직후 설문으로 사용자 반응을 수집합니다.

---

## 🎯 연구 배경

생성형 음성 합성(WaveNet, Tacotron 2, VALL-E 등)의 발전으로 단 몇 초의 음성만으로
가족·지인의 목소리를 복제할 수 있게 되면서, 가족 사칭형 보이스피싱이 빠르게 확산되고 있습니다.
음성 딥페이크 **탐지** 연구(AASIST 등)는 활발하지만, **탐지된 의심 신호를 통화 중 사용자에게
어떻게 경고할 것인가**라는 UX 차원의 실증 연구는 부족합니다. 본 프로토타입은 그 공백을 메우기 위한
실험 도구입니다.

---

## ✨ 주요 기능

### 4가지 보이스피싱 시나리오
| 시나리오 | 사칭 대상 | 핵심 전술 |
|----------|-----------|-----------|
| 교통사고 합의금 | 자녀(딸) | 긴박감·창피함으로 판단력 마비 |
| 검찰청 사칭 | 수사관 | 공권력·법적 협박으로 순응 유도 |
| 의료응급 수술비 | 자녀(아들) | 극도의 공포와 시간압박 |
| 금융기관 사칭 | 은행 보안팀 | 친절함으로 경계 낮춰 이체 유도 |

### 4가지 경고 패턴 (논문 실험 변수)
- **Pattern A** — 단순 텍스트 경고
- **Pattern B** — 컬러 + 아이콘 경고
- **Pattern C** — 멀티모달 경고 (시각 + 청각 + 햅틱 + 신뢰도 점수)
- **Pattern D** — 행동 유도형 경고 (통화 종료 / AI 생성 재확인 질문)

### 실시간 AI 대화
- **Ollama 로컬 LLM**(`exaone3.5:7.8b`)로 사용자 응답에 자연스럽게 반응 — API 키·비용 0원
- 우선순위 폴백: Claude API(키 있을 때) → Ollama → 키워드 스크립트

### 사람 목소리 TTS
- **Microsoft Edge Neural TTS**로 시나리오별 어울리는 음성 자동 배정 — 무료
  - 딸: 젊은 여성 / 아들: 젊은 남성 / 수사관: 중후한 남성 / 상담원: 차분한 여성
- 전화 음질 필터(대역통과 + 라인 노이즈)로 실제 통화 느낌 재현
- 우선순위: ElevenLabs(키 있을 때) → Edge TTS → 브라우저 TTS

### 설문 & 데이터 수집
- 논문 부록 B 기반 설문(사기 인지율, 7개 리커트 차원, 행동 의도, 인구통계 등)
- 통화 객관 지표(반응 시간·통화 시간) 자동 연동
- 로컬 파일 저장 + **추가 전용 백업 로그**(데이터 손실 방지)
- 실시간 통계 대시보드 + CSV 내보내기

---

## 🚀 빠른 시작

```bash
# 1. 내려받기
git clone https://github.com/Imperfective/deepvoice-demo.git
cd deepvoice-demo
npm install

# 2. AI 엔진 (무료, 최초 1회 ~5GB)
ollama serve &
ollama pull exaone3.5:7.8b

# 3. 실행
npm run dev      # 개발 모드 (Vite + 서버)
#   또는
npm start        # 프로덕션 (빌드 후 단일 포트 3001)
```

접속: 개발 모드 `http://localhost:5173` / 프로덕션 `http://localhost:3001`

> 📘 Windows·Mac 상세 설치법: **[SETUP.md](SETUP.md)**
> 🌐 외부 공개(Cloudflare 터널) 방법: **[DEPLOY.md](DEPLOY.md)**

---

## 📊 데이터 확인

| 용도 | 주소 |
|------|------|
| 통계 대시보드 | `/stats` |
| CSV 다운로드 (Excel·통계분석용) | `/api/surveys.csv` |
| JSON 원본 | `/api/surveys` |
| 백업 복원 | `POST /api/surveys/restore` |

> 설문 데이터는 `data/surveys.json` + `data/surveys.log.jsonl`(백업)에 저장되며,
> Git에는 포함되지 않습니다(연구 데이터 보호).

---

## 🛠 기술 스택

- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS
- **백엔드**: Node.js + Express
- **AI 대화**: Ollama (`exaone3.5:7.8b`) / Anthropic Claude API (선택)
- **음성**: Microsoft Edge Neural TTS / ElevenLabs (선택)
- **음성 인식**: Web Speech API (Chrome)
- **배포**: Cloudflare Tunnel (무료 공개 URL)

---

## 📁 프로젝트 구조

```
deepvoice-demo/
├── server.cjs              # Express 서버 (대화·TTS·설문·통계 API)
├── src/
│   ├── App.tsx             # 메인 앱 (통화 시뮬레이션 + 경고 패턴)
│   ├── Survey.tsx          # 설문 화면 (논문 부록 B 기반)
│   ├── icons.tsx           # SVG 아이콘 (디자인 시스템)
│   ├── hooks/
│   │   ├── useTTS.ts        # TTS 재생 + 전화 음질 필터
│   │   └── useWarningBeep.ts# 경고음·링톤·햅틱
│   └── index.css           # 디자인 토큰 + 애니메이션
├── stats.html              # 통계 대시보드
├── SETUP.md                # Windows·Mac 설치 가이드
├── DEPLOY.md               # 외부 배포 가이드
└── data/                   # 설문 데이터 (git 제외)
```

---

## ⚙️ 환경변수 (선택)

`.env.example`을 `.env`로 복사 후 필요한 값만 채웁니다. **Ollama만 쓰면 `.env` 없이도 동작합니다.**

```bash
ANTHROPIC_API_KEY=sk-ant-...     # Claude API 사용 시 (선택)
ELEVENLABS_API_KEY=...           # ElevenLabs TTS 사용 시 (선택)
OLLAMA_MODEL=exaone3.5:7.8b      # 기본값
PORT=3001                        # 기본값
```

---

## ⚠️ 안내

- 본 프로토타입은 **학술 연구·보안 교육 목적**으로 제작되었습니다.
- 모든 시나리오는 시뮬레이션이며, 실제 전화번호·기관과 무관합니다.
- 설문 응답은 익명으로 수집되며 연구 분석 목적으로만 사용됩니다.

---

## 📄 라이선스

학술 연구용 프로토타입. 인용·재사용 시 연구 맥락을 밝혀 주세요.
