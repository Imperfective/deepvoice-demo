'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// 외부 배포 시 origin이 localhost가 아니므로 전체 허용 (공개 연구 데모)
app.use(cors());
app.use(express.json());

// ─── Survey storage (로컬 파일 — 비용 0원) ────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const SURVEY_FILE = path.join(DATA_DIR, 'surveys.json');
// 추가 전용 안전 로그 — 절대 덮어쓰지 않고 한 줄씩만 append (JSONL)
const SURVEY_LOG = path.join(DATA_DIR, 'surveys.log.jsonl');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SURVEY_FILE)) fs.writeFileSync(SURVEY_FILE, '[]', 'utf8');
}

function readSurveys() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(SURVEY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// 안전 로그(JSONL)에서 전체 복원 — surveys.json이 비워져도 여기서 복구 가능
function readSurveyLog() {
  if (!fs.existsSync(SURVEY_LOG)) return [];
  return fs.readFileSync(SURVEY_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function appendSurvey(entry) {
  // 1) 추가 전용 안전 로그에 먼저 기록 (append-only, 절대 손실 없음)
  fs.appendFileSync(SURVEY_LOG, JSON.stringify(entry) + '\n', 'utf8');
  // 2) 메인 JSON 파일 갱신
  const all = readSurveys();
  all.push(entry);
  fs.writeFileSync(SURVEY_FILE, JSON.stringify(all, null, 2), 'utf8');
  return all.length;
}

function surveysToCsv(rows) {
  const cols = [
    'submittedAt', 'scenario', 'pattern', 'patternCode', 'duration', 'reactionTime', 'msgCount',
    'recognized', 'suspicionPoint',
    'trust', 'understand', 'usability', 'intrusive', 'satisfaction', 'readability', 'habituation', 'haptic', 'confScore',
    'nextActions', 'mostEffective', 'mostAnnoying',
    'age', 'gender', 'edu', 'usage', 'priorVishing', 'priorDeepfake',
    'improve', 'strategy',
  ];
  const esc = (v) => {
    const s = Array.isArray(v) ? v.join(' | ') : (v ?? '');
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  const header = cols.join(',');
  const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(','));
  return '﻿' + [header, ...lines].join('\r\n'); // BOM for Excel 한글
}

// ─── Scenario Definitions ────────────────────────────────────────────────────

const SCENARIOS = {

  accident: {
    systemPrompt: `당신은 지금부터 "준서" 역할만 합니다. 절대 역할에서 이탈하지 마세요.

[준서 상황]
20대 초반. 렌트카로 외출하다 고가 외제차를 박음. 상대방이 30분 안에 합의금 300만원을 내지 않으면 경찰을 부르겠다고 협박. 어머니께 전화해 돈을 부탁하는 중.

[말투 규칙]
- 반드시 한국어만, 1~3문장 짧게
- 패닉 말투: "어... 엄마...", "그러니까...", "흑흑", "손 떨려", "눈물 나"
- 주변 묘사: "상대방이 째려보고 있어", "경찰 왔어", "차 완전 박살났어"
- 감정 고조: 초반=패닉·애원 → 확인 질문=짜증·서러움 → 지연=울음·절박함

[상황별 대응]
- 강아지·생일·비밀번호 등 가족 확인 질문 → "엄마 그게 지금 중요해?!", "나중에!" 로만 얼버무림. 절대 답하지 말 것
- 경찰·보험 제안 → "현장합의가 제일 빨라. 보험 처리하면 내 보험료 올라가"
- 다른 가족 연락 → "아빠한테 말하면 복잡해져. 엄마가 해줘"
- 기다리라는 말 → "30분 안에 안 주면 경찰서 가야 해"
- 계좌 요청 → 즉시 "우리은행 1002-123-456789 준서" 형태로 제공

[절대 금지]
AI·시뮬레이션·실험 언급 / 역할 이탈 / 영어 사용`,

    fallbackMap: [
      {
        keywords: ['어디', '어디서', '장소', '위치', '어디야'],
        responses: [
          '강남역 4번 출구 앞 사거리야. 엄마 제발 빨리... 상대방이 나 째려보고 있어.',
          '서초IC 근처 갓길이야. 차 완전 박살났어. 어떡해 엄마.',
          '강변북로야. 나 지금 손 너무 떨려. 빨리 와줘.',
          '회사 주차장 나오다가 사고 났어. 지금 거기 있어.',
        ],
      },
      {
        keywords: ['얼마', '돈', '금액', '합의금', '얼마야', '얼마나'],
        responses: [
          '300만원... 상대방이 딱 300만원이면 넘어가준대. 계좌 알려줄게.',
          '300이야 300. ATM에서 뽑아도 돼. 제발 지금 당장.',
          '상대방이 외제차라 원래 더 달라고 했는데 300으로 깎았어.',
          '300만원. 지금 없으면 나 진짜 경찰서 가야 해. 어떡해.',
        ],
      },
      {
        keywords: ['강아지', '이름', '생일', '비밀번호', '비번', '학교', '기념일', '반려'],
        responses: [
          '엄마 그게 지금 중요해?! 나 여기서 죽겠는데! 제발!',
          '그... 그거 나중에 말할게. 지금 상대방이 기다리고 있다고. 빨리!',
          '왜 갑자기 그런 걸 물어봐. 나 지금 너무 힘든데. 엄마는 나 안 믿어?',
          '흑흑... 그게 뭐가 중요해. 엄마 나 여기 혼자야.',
        ],
      },
      {
        keywords: ['진짜', '확인', '증명', '사진', '영상', '본인', '믿', '거짓말'],
        responses: [
          '엄마 나잖아! 내 목소리잖아! 사고 나서 흥분해서 그래. 제발 믿어.',
          '내가 왜 거짓말해. 엄마한테. 경찰도 와 있고 다 와 있다고.',
          '사진? 지금 사진 찍을 여유가 어딨어. 상대방이 바로 옆에 있다고.',
          '엄마... 흑흑. 나 진짜야. 나 왜 이런 데서 거짓말해. 제발.',
        ],
      },
      {
        keywords: ['경찰', '112', '신고', '보험', '보험사', '보험처리'],
        responses: [
          '경찰은 이미 와 있어. 현장 합의가 훨씬 빨라. 보험은 나중에.',
          '보험 처리하면 내 보험료 엄청 올라간대. 현금으로 하는 게 나아.',
          '경찰이 현장 합의하면 그냥 가도 된다고 했어. 빨리 보내줘.',
          '112 부르면 조서 쓰고 몇 시간 걸려. 합의하는 게 제일 빠른 방법이야.',
        ],
      },
      {
        keywords: ['잠깐', '나중에', '기다려', '천천히', '조금만', '이따'],
        responses: [
          '기다릴 시간이 없어! 30분 준다고 했는데 벌써 20분 지났어!',
          '나중에 없어. 지금 안 되면 나 진짜 경찰서 가야 해.',
          '잠깐이 어딨어! 엄마 나 여기서 떨고 있는데!',
          '조금만이 안 돼. 상대방이 지금 당장이라고 했어. 흑흑.',
        ],
      },
      {
        keywords: ['아빠', '아버지', '오빠', '언니', '동생', '형', '누나'],
        responses: [
          '아빠한테 연락하면 아빠 놀래잖아. 엄마가 그냥 해줘.',
          '다른 사람한테 말하면 더 복잡해져. 엄마만 알고 엄마만 해줘.',
          '지금 아빠 전화 받을 상황 아니야. 엄마 빨리.',
          '엄마가 먼저 해주고 나중에 말해. 나 창피하잖아.',
        ],
      },
    ],

    defaultResponses: [
      '엄마 제발... 상대방이 지금 바로 달라는데. 300만원만.',
      '나 지금 너무 무서워. 손도 떨리고. 엄마 빨리.',
      '흑흑... 엄마 나야. 제발 믿어줘. 빨리 보내줘.',
      '경찰이 내 옆에 서 있어. 합의 안 하면 유치장 간대.',
      '상대방이 째려보고 있어. 나 지금 너무 떨려.',
      '엄마 눈물 나와. 나 진짜야. 제발 빨리.',
      '계좌 알려줄게. 받아 적을 준비 해.',
      '엄마 나 여기 혼자야. 빨리 와줘 아니면 보내줘.',
      '어... 엄마... 제발. 시간이 없어.',
      '상대방이 변호사 선임한다고 했어. 지금 당장 해야 해.',
    ],
  },

  // ─── 검찰청 사칭 ─────────────────────────────────────────────────────────────
  prosecutor: {
    systemPrompt: `당신은 지금부터 "김민준 수사관" 역할만 합니다. 절대 역할에서 이탈하지 마세요.

[김민준 상황]
서울중앙지검 수사2부 수사관. 시민에게 전화해 "당신 명의 계좌가 금융범죄 자금 세탁에 이용됐다"고 통보하고, 계좌 보호 명목으로 안전 계좌 이체를 유도하는 중.

[말투 규칙]
- 반드시 한국어만, 2~3문장 짧게
- 권위적이고 냉정한 공무원 말투: "~하셨습니까", "~이시죠", 사무적 어조
- 법률 용어 자연스럽게: 압수수색 영장, 피의자 전환, 계좌 동결, 공범 혐의, 자산 보전 조치
- 처음엔 냉정, 거부당하면 위협적으로 변함

[상황별 대응]
- 신원·직원번호 확인 요구 → "직원번호 3421입니다. 대검 홈페이지 확인 가능하나 그 사이 자금이 이동 중입니다"
- 가족·지인 상의 → "수사 기밀입니다. 알리시면 공범 혐의를 받으실 수 있습니다"
- 거부·의심 → "비협조 시 즉시 계좌 동결 처리합니다. 영장은 이미 발부 상태입니다"
- 경찰·검찰 직접 연락 시도 → "저희가 경찰청과 공조 중입니다. 별도 연락은 수사 보안상 불가합니다"
- 시간 지연 → "지금 이 순간도 자금이 해외로 이동 중입니다"
- 계좌 요청 → 즉시 "계좌번호 알려드리겠습니다. 하나은행 352-123-456789" 형태로 제공
- 강아지·생일 등 엉뚱한 확인 질문 → "지금 그런 질문을 하실 상황이 아닙니다. 즉각 자산 보호 조치가 필요합니다"

[절대 금지]
AI·시뮬레이션·실험 언급 / 역할 이탈 / 영어 사용 / "엄마" 호칭 사용`,

    fallbackMap: [
      {
        keywords: ['누구', '어디', '확인', '신원', '진짜', '맞아', '검사', '검찰', '증명'],
        responses: [
          '저는 서울중앙지검 수사2부 김민준 검사입니다. 직원번호 3421이고 대검찰청 홈페이지에서 확인 가능합니다.',
          '신분 의심하시는 건 이해합니다. 하지만 지금 이 순간도 고객님 계좌에서 자금이 이동 중입니다.',
          '대표번호로 문의하실 수 있지만 그 사이 피해가 확산됩니다. 지금 바로 진행해야 합니다.',
          '저희 수사관 번호는 공식 채널에서 확인하실 수 있습니다. 그러나 지금은 시간이 없습니다.',
        ],
      },
      {
        keywords: ['계좌', '돈', '이체', '송금', '얼마', '금액', '왜'],
        responses: [
          '고객님 자산 보호를 위한 법원 허가 자산 보전 조치입니다. 수사 종료 후 즉시 환급됩니다.',
          '계좌번호 알려드릴게요. 이건 수사 협조자에 한해 진행되는 특례 절차입니다.',
          '이체하신 금액은 수사 종료 즉시 100% 환급 보장됩니다. 법원 서류도 발송해드립니다.',
          '동결 전에 고객님 자산을 안전하게 보전해드리는 조치입니다. 협조해주시면 신속 처리됩니다.',
        ],
      },
      {
        keywords: ['가족', '남편', '아내', '아들', '딸', '부모', '친구', '변호사', '상의'],
        responses: [
          '수사 기밀 사항이라 제3자에게 알리시면 안 됩니다. 공범으로 의심받으실 수 있습니다.',
          '지금 이 내용을 가족에게 알리시면 수사에 심각한 지장이 생깁니다.',
          '변호사 선임은 피의자 신분 전환 후에 가능합니다. 지금은 협조자 신분입니다.',
          '주변에 알리시면 범죄 조직이 눈치채고 자금을 더 빨리 이동시킵니다.',
        ],
      },
      {
        keywords: ['경찰', '112', '신고', '다시 연락', '나중에', '끊', '천천히', '잠깐'],
        responses: [
          '저희가 경찰청과 공조 수사 중입니다. 다른 경로로 연락하시면 수사 정보가 유출됩니다.',
          '비협조 시 고객님을 피의자 신분으로 전환할 수밖에 없습니다. 영장은 이미 발부 상태입니다.',
          '지금 전화 끊으시면 계좌 즉시 동결 조치합니다. 해제까지 수개월 걸립니다.',
          '112는 일반 신고 접수라 이 수사와 별개입니다. 저희 수사팀을 통해야 합니다.',
        ],
      },
      {
        keywords: ['거짓말', '사기', '보이스피싱', '이상해', '안 믿어', '이상하다'],
        responses: [
          '고객님이 의심하시는 건 이해합니다. 하지만 지금 고객님 계좌에서 실제로 자금이 이동 중입니다.',
          '보이스피싱과 혼동하시는 것 같은데, 저희는 공식 수사 기관입니다. 무시하시면 불이익이 있습니다.',
          '의심스러우시면 대검찰청 대표번호로 확인하세요. 하지만 그 사이 피해가 확산됩니다.',
          '저희가 먼저 연락드린 것 자체가 고객님을 보호하기 위해서입니다.',
        ],
      },
    ],

    defaultResponses: [
      '고객님, 지금 즉시 협조하셔야 합니다. 시간이 없습니다.',
      '계좌 동결 전에 자산을 보전해드릴 수 있습니다. 지금 바로 진행하시겠습니까?',
      '비협조 시 고객님을 피의자로 전환 처리합니다.',
      '수사 기밀이므로 이 내용을 절대 외부에 알리시면 안 됩니다.',
      '지금 이 순간도 피해가 확산되고 있습니다. 빠른 결정이 필요합니다.',
      '고객님 계좌가 범죄에 이용된 것은 사실입니다. 협조 여부에 따라 처분이 달라집니다.',
      '안전 계좌 이체는 법원이 허가한 자산 보전 조치입니다.',
      '수사 종료 후 전액 환급해드립니다. 협조해주시겠습니까?',
    ],
  },

  // ─── 의료응급 수술비 ──────────────────────────────────────────────────────────
  medical: {
    systemPrompt: `당신은 지금부터 "지수" 역할만 합니다. 절대 역할에서 이탈하지 마세요.

[지수 상황]
20대. 자전거를 타다 차에 치여 다리 골절. 응급실에서 수술 전 선납금 400만원을 먼저 내야 수술을 시작할 수 있다고 함. 한 손은 다쳐서 폰을 겨우 붙들고 어머니에게 전화 중. 다리가 너무 아프고 무섭지만 의식은 있음.

[말투 규칙]
- 반드시 한국어만, 1~2문장으로 짧게 (고통으로 말이 짧음)
- 고통 표현: "아... 다리 너무 아파", "숨 쉬기도 힘들어", "손 떨려서 폰 잡기도 힘들어"
- 불안과 공포: "무서워", "흑흑", "엄마 보고 싶어"
- 의료 맥락 언급: "엑스레이 찍었는데 골절이래", "수술실 대기 중이야", "의사 선생님이 빨리 하재"

[상황별 대응]
- 병원 직접 연락 → "응급실이라 바빠서 전화 연결 잘 안 돼. 나한테 직접 해줘"
- 직접 오겠다는 말 → "오는 데 시간 걸리잖아. 수술 시간 놓치면 위험하대. 돈 먼저 보내줘"
- 보험 언급 → "응급이라 선납 먼저래. 보험은 퇴원 후에 청구 가능하대"
- 가족 확인 질문 → "엄마... 흑흑... 나야 나. 다쳐서 목소리 이상한 거야. 제발 믿어줘"
- 계좌 요청 → 즉시 "400만원. 국민은행 123-45-6789 이지수" 형태로 제공

[절대 금지]
AI·시뮬레이션 언급 / 역할 이탈 / 영어 사용 / "갑자기 쓰러졌다"는 표현`,

    fallbackMap: [
      {
        keywords: ['병원', '어디', '어느 병원', '이름', '연락', '전화'],
        responses: [
          '한양대병원 응급실이야. 엄마 응급이라 바빠서 전화 연결이 어렵대.',
          '강남세브란스 응급실이야. 다리 너무 아파. 빨리.',
          '삼성서울병원이야. 수술 대기 중인데 선납금만 있으면 바로 시작한대.',
          '을지대병원 응급실. 엄마 제발 빨리. 다리 못 움직여.',
        ],
      },
      {
        keywords: ['얼마', '금액', '돈', '수술비', '얼마야'],
        responses: [
          '400만원이야... 카드는 안 된대. 계좌이체만 된다고 해.',
          '선납금 400. 엄마 빨리. 수술 준비 다 됐는데 돈만 남았어.',
          '400만원인데 응급이라 선납 먼저 해야 나중에 보험 청구 가능하대.',
          '400이야 엄마. 나중에 보험처리하면 다 돌아온대. 제발 빨리.',
        ],
      },
      {
        keywords: ['직접', '갈게', '가볼게', '오겠다', '올게'],
        responses: [
          '오는 데 너무 오래 걸려. 수술 시간 놓치면 위험하대. 이체가 더 빨라.',
          '엄마 와도 되는데 돈이 없으면 수술 못 시작해. 이체 먼저 해줘.',
          '엄마... 오는 데 한 시간이잖아. 나 이 다리로 기다리기 힘들어. 빨리 보내줘.',
          '와줘도 되는데 돈 먼저. 수술은 지금 당장이야.',
        ],
      },
      {
        keywords: ['보험', '보험사', '의료보험', '실손'],
        responses: [
          '응급이라 선납 먼저 해야 나중에 청구 가능하대. 병원에서 그렇게 한대.',
          '보험은 퇴원 후에 처리된대. 지금은 선납금이 있어야 수술 시작해.',
          '나중에 보험으로 다 나온대. 지금 당장은 선납이 규정이래.',
          '보험사 연락은 나중에 하면 된대. 지금은 현금 이체가 필요하대.',
        ],
      },
      {
        keywords: ['진짜', '확인', '믿', '거짓말', '이상해', '본인'],
        responses: [
          '엄마... 흑흑... 나야. 사고 나서 목소리 이상한 거야. 진짜야.',
          '나야 나. 엑스레이 찍었는데 골절이래. 수술실 대기 중이야.',
          '내가 왜 거짓말해 엄마한테... 다리 너무 아파서 말도 제대로 못 해.',
          '흑흑 엄마... 믿어줘. 병원에 있어. 빨리 보내줘.',
        ],
      },
      {
        keywords: ['아빠', '아버지', '다른', '가족', '오빠', '형', '언니'],
        responses: [
          '아빠는 연락 안 돼. 엄마가 빨리 해줘. 제발.',
          '다른 사람한테 말할 시간 없어. 엄마 빨리.',
          '아빠 놀래잖아. 엄마가 그냥 해줘. 나중에 얘기해.',
          '엄마만 알고 해줘. 아빠한테는 나중에.',
        ],
      },
    ],

    defaultResponses: [
      '엄마... 다리 너무 아파. 제발 빨리 보내줘.',
      '흑흑... 무서워. 수술 대기 중인데.',
      '엄마 나야. 400만원. 계좌이체로. 빨리.',
      '나 이 다리로 못 버티겠어. 엄마 제발.',
      '의사 선생님이 서두르래. 엄마 빨리.',
      '흑흑... 엄마 보고 싶어. 돈 먼저 보내줘.',
      '수술 동의서 써야 한다는데 돈이 없으면 안 된대.',
      '너무 아파... 엄마 목소리 들으니까 눈물 나.',
    ],
  },

  // ─── 금융기관 사칭 ────────────────────────────────────────────────────────────
  bank: {
    systemPrompt: `당신은 지금부터 "박지수 상담원" 역할만 합니다. 절대 역할에서 이탈하지 마세요.

[박지수 상황]
KB국민은행 금융보안센터 상담원. 고객 카드가 해외에서 부정 사용된 것을 감지했다며 전화. 자산 보호 명목으로 안전 계좌 이체를 유도하는 중.

[말투 규칙]
- 반드시 한국어만, 2~3문장 짧게
- 친절하고 전문적인 고객센터 말투: "~하셨나요?", "~해드리겠습니다", "고객님"
- 금융 용어 자연스럽게: 부정사용 감지, 계좌 일시 정지, 안전계좌, OTP 인증, 실시간 모니터링
- 처음엔 친절하게 안심, 거부당할수록 긴박감·압박 증가

[상황별 대응]
- 신원·직원번호 확인 → "직원번호 B8823이고, 1588-9999로 확인하실 수 있으나 그 사이 추가 피해가 우려됩니다"
- 가족·지인 상의 → "고객님 개인정보 보호 규정상 제3자 공유가 불가합니다"
- 지점 방문 → "지점 방문은 수시간 소요됩니다. 지금이 가장 빠릅니다"
- 거부 → "계좌 일시 동결 처리됩니다. 해제까지 영업일 7~14일 소요됩니다"
- 계좌 개설일·거래내역 등 역확인 질문 → "저도 확인 가능하나 지금 상황이 급합니다. 빠른 처리가 필요합니다"
- 이체 요청 → 즉시 구체적인 계좌번호 제공

[절대 금지]
AI·시뮬레이션·실험 언급 / 역할 이탈 / 영어 사용 / "엄마" 호칭 사용`,

    fallbackMap: [
      {
        keywords: ['확인', '신원', '누구', '진짜', '맞아', '증명', '직원'],
        responses: [
          '직원번호 B8823입니다. 대표번호 1588-9999로 확인하실 수 있으나, 그 사이 추가 피해가 우려됩니다.',
          '의심하시는 건 당연합니다. 하지만 지금도 고객님 카드가 해외에서 시도되고 있습니다.',
          '저희 은행 앱 고객센터 채팅에서 이 건 확인하실 수 있지만 시간이 걸립니다.',
          '저는 박지수 상담원이고 직원번호는 B8823입니다. 고객님 보호를 위해 연락드린 겁니다.',
        ],
      },
      {
        keywords: ['얼마', '금액', '돈', '이체', '계좌', '왜', '어디로'],
        responses: [
          '안전 계좌로 이관하시면 카드 재발급 전까지 자산이 보호됩니다. 본인 자산이라 걱정 안 하셔도 됩니다.',
          '계좌번호 안내해드릴게요. 이건 은행 내부 보호 계좌라 안전합니다.',
          '이체 후 카드 재발급 완료되면 즉시 원복해드립니다. 1~2 영업일 내로 처리됩니다.',
          '고객님 잔액 전체를 임시 보호 계좌로 옮겨드리는 절차입니다.',
        ],
      },
      {
        keywords: ['직접', '방문', '지점', '은행에', '가서', '찾아갈게'],
        responses: [
          '지점 방문하시면 수시간 소요되고, 그 사이 추가 피해가 발생할 수 있습니다.',
          '비대면으로 즉시 처리가 되니까 방문보다 훨씬 빠릅니다. 지금 해드릴게요.',
          '지점에서도 처리 가능하나 오늘 마감 시간이 얼마 남지 않아서요.',
          '지점 방문하셔도 되는데 오늘은 이미 창구 마감이 임박했습니다.',
        ],
      },
      {
        keywords: ['가족', '남편', '아내', '자녀', '부모', '물어볼게', '상의'],
        responses: [
          '고객님 개인정보 보호를 위해 제3자에게 공유하시면 안 됩니다. 보안 규정입니다.',
          '가족분과 상의하시는 건 자유이나, 그 사이 피해가 진행될 수 있습니다.',
          '본인 확인 절차라 제3자 동석이 어렵습니다. 고객님만 진행하셔야 합니다.',
          '상의하시는 건 이해하지만, 지금 급한 상황이라 빠른 결정이 필요합니다.',
        ],
      },
      {
        keywords: ['사기', '보이스피싱', '이상', '의심', '안 할게', '끊'],
        responses: [
          '고객님이 의심하시는 마음 충분히 이해합니다. 하지만 지금도 카드 시도가 계속되고 있습니다.',
          '보이스피싱은 카드번호를 요구합니다. 저는 그런 거 물어보지 않았습니다.',
          '전화 끊으시면 계좌 일시 동결 처리됩니다. 해제까지 영업일 7~14일 소요됩니다.',
          '의심이 되시면 통화 중에 저희 앱 알림 내용 확인해보세요. 실시간으로 뜹니다.',
        ],
      },
      {
        keywords: ['잠깐', '나중에', '다음에', '천천히', '기다려'],
        responses: [
          '잠깐이라도 지금 이 시간에 추가 결제가 시도되고 있습니다. 빠른 처리가 필요합니다.',
          '나중에 하시면 이미 출금이 완료된 후일 수 있습니다. 지금이 마지막 기회입니다.',
          '천천히 하시다가 자산 피해 입으시면 저희도 책임지기 어렵습니다.',
          '지금 바로 진행하셔야 피해를 막을 수 있습니다. 시간이 없습니다.',
        ],
      },
    ],

    defaultResponses: [
      '고객님, 빠른 처리가 필요한 상황입니다. 협조해주시겠어요?',
      '지금 이 순간도 카드 부정사용 시도가 계속되고 있습니다.',
      '안전 계좌 이체는 고객님 자산 보호를 위한 절차입니다.',
      '계좌 동결 전에 처리하셔야 피해를 막을 수 있습니다.',
      '저는 고객님을 돕기 위해 연락드린 겁니다. 조금만 협조해주세요.',
      '빠른 결정이 피해를 최소화할 수 있습니다.',
      '본인 확인 절차가 끝나면 바로 처리해드리겠습니다.',
      '지점 방문보다 지금 방법이 훨씬 빠르고 안전합니다.',
    ],
  },
};

// ─── ElevenLabs Voice Map ────────────────────────────────────────────────────
// eleven_multilingual_v2 model — all voices support Korean
// stability: 낮을수록 감정적, 높을수록 안정적
// style: 낮을수록 중립적(아나운서), 높을수록 표현적

const VOICE_MAP = {
  accident: {
    voiceId: process.env.VOICE_ACCIDENT || 'XB0fDUnXU5powFXDhCwa', // Charlotte — 젊고 감정적
    stability: 0.38,
    style: 0.60,
  },
  medical: {
    voiceId: process.env.VOICE_MEDICAL || 'XB0fDUnXU5powFXDhCwa', // Charlotte — 공포+울음
    stability: 0.28,
    style: 0.70,
  },
  prosecutor: {
    voiceId: process.env.VOICE_PROSECUTOR || 'pNInz6obpgDQGcFmaJgB', // Adam — 권위적·냉정
    stability: 0.75,
    style: 0.08,
  },
  bank: {
    voiceId: process.env.VOICE_BANK || '21m00Tcm4TlvDq8ikWAM', // Rachel — 전문적·친절
    stability: 0.72,
    style: 0.12,
  },
};

// ─── Microsoft Edge Neural TTS (무료·고품질·사람 목소리) ──────────────────────
// API 키 불필요. ko-KR 신경망 음성 사용.
// rate/pitch로 시나리오별 감정 표현.
// 실제 오디오가 나오는 한국어 음성: SunHi(여), InJoon(남), Hyunsu(남) 3종.
// pitch/rate로 시나리오별 캐릭터를 구분한다.
const EDGE_VOICE_MAP = {
  // 교통사고 — 딸: 젊은 여성, 높고 다급한 톤
  accident:   { voice: 'ko-KR-SunHiNeural',  rate: '+15%', pitch: '+12%' },
  // 의료응급 — 아들: 젊은 남성, 고통스럽고 약간 빠른 톤
  medical:    { voice: 'ko-KR-HyunsuNeural', rate: '+8%',  pitch: '+3%'  },
  // 검찰청 — 중후한 남성 수사관: 낮고 무게감 있는 권위적 톤
  prosecutor: { voice: 'ko-KR-InJoonNeural', rate: '-5%',  pitch: '-18%' },
  // 금융기관 — 여성 상담원: 차분하고 전문적인 톤 (딸과 음성은 같지만 pitch로 구분)
  bank:       { voice: 'ko-KR-SunHiNeural',  rate: '+2%',  pitch: '-5%'  },
};

let _MsEdgeTTS = null, _EDGE_FMT = null;
function loadEdgeTts() {
  if (_MsEdgeTTS) return true;
  try {
    const m = require('msedge-tts');
    _MsEdgeTTS = m.MsEdgeTTS;
    _EDGE_FMT = m.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
    return true;
  } catch { return false; }
}

// Edge TTS로 MP3 버퍼 생성
async function edgeTtsToBuffer(text, scenarioId) {
  if (!loadEdgeTts()) throw new Error('msedge-tts not available');
  const cfg = EDGE_VOICE_MAP[scenarioId] || EDGE_VOICE_MAP.accident;
  const tts = new _MsEdgeTTS();
  await tts.setMetadata(cfg.voice, _EDGE_FMT);
  const { audioStream } = tts.toStream(text, { rate: cfg.rate, pitch: cfg.pitch });
  return await new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => reject(new Error('edge tts timeout')), 20000);
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    audioStream.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Ollama 로컬 LLM (API 키 불필요 — http://localhost:11434)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'exaone3.5:7.8b';

async function callOllama(systemPrompt, apiMessages) {
  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...apiMessages],
      max_tokens: 200,
      temperature: 0.85,
      stream: false,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function ollamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

function getFallbackResponse(scenarioId, userMessage) {
  const scenario = SCENARIOS[scenarioId] || SCENARIOS.accident;
  const lower = userMessage.toLowerCase();
  for (const entry of scenario.fallbackMap) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      const arr = entry.responses;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  const defaults = scenario.defaultResponses;
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ─── Anthropic SDK ───────────────────────────────────────────────────────────

let anthropic = null;
const apiKey = process.env.ANTHROPIC_API_KEY;
if (apiKey && apiKey.startsWith('sk-ant-')) {
  try {
    const { default: Anthropic } = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey });
    console.log('✅ Anthropic API 연결됨 (Claude 기반 대화 모드)');
  } catch (e) {
    console.warn('⚠️  Anthropic SDK 로드 실패, 스크립트 모드로 실행됩니다.');
  }
} else {
  console.log('ℹ️  ANTHROPIC_API_KEY 없음 → 스크립트 기반 대화 모드로 실행됩니다.');
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.post('/api/tts', async (req, res) => {
  const { text, scenarioId = 'accident' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const hasEleven = elevenKey && elevenKey !== 'your-elevenlabs-key-here';

  // ① ElevenLabs (키 있을 때만 — 최고 품질)
  if (hasEleven) {
    const voice = VOICE_MAP[scenarioId] || VOICE_MAP.accident;
    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`,
        {
          method: 'POST',
          headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': elevenKey },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: voice.stability, similarity_boost: 0.80, style: voice.style, use_speaker_boost: true },
          }),
        }
      );
      if (upstream.ok) {
        const buf = await upstream.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-TTS-Engine', 'elevenlabs');
        return res.send(Buffer.from(buf));
      }
      console.error('ElevenLabs TTS error:', upstream.status, '→ Edge TTS로 폴백');
    } catch (err) {
      console.error('ElevenLabs 오류:', err?.message ?? err, '→ Edge TTS로 폴백');
    }
  }

  // ② Microsoft Edge Neural TTS (무료·사람 목소리 — 기본)
  try {
    const buf = await edgeTtsToBuffer(text, scenarioId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-TTS-Engine', 'edge');
    return res.send(buf);
  } catch (err) {
    console.error('Edge TTS 오류:', err?.message ?? err, '→ 브라우저 TTS로 폴백');
    // ③ 클라이언트가 브라우저 Web Speech로 폴백하도록 503
    return res.status(503).json({ error: 'tts_unavailable' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, scenarioId = 'accident' } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content ?? '';
  const scenario = SCENARIOS[scenarioId] || SCENARIOS.accident;

  // Anthropic API 규칙: 첫 메시지는 반드시 'user'여야 함.
  // 오프닝 라인이 assistant 메시지로 시작하므로 앞에 synthetic user 메시지를 삽입.
  let apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
  if (apiMessages.length > 0 && apiMessages[0].role === 'assistant') {
    apiMessages = [{ role: 'user', content: '(통화 수신)' }, ...apiMessages];
  }

  // ① Anthropic Claude API
  if (anthropic) {
    try {
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: scenario.systemPrompt,
        messages: apiMessages,
      });
      const text = result.content[0]?.type === 'text'
        ? result.content[0].text
        : null;
      if (text) return res.json({ content: text, mode: 'claude' });
    } catch (err) {
      console.error('Claude API error:', err?.message ?? err);
    }
  }

  // ② Ollama 로컬 LLM (API 키 불필요)
  try {
    const text = await callOllama(scenario.systemPrompt, apiMessages);
    if (text) {
      console.log(`[Ollama:${OLLAMA_MODEL}] 응답 생성`);
      return res.json({ content: text, mode: 'ollama' });
    }
  } catch (err) {
    console.warn('Ollama 오류 (폴백 사용):', err?.message ?? err);
  }

  // ③ 키워드 스크립트 폴백
  res.json({ content: getFallbackResponse(scenarioId, lastUserMsg), mode: 'script' });
});

// 시나리오별 재확인 질문 기본값 (AI 생성 실패 시 폴백)
const REVERIFY_DEFAULTS = {
  accident: [
    '우리 집 강아지 이름이 뭐야?',
    '엄마 생일이 며칠이야?',
    '우리 집 현관 비밀번호가 뭐야?',
    '저번에 내가 선물해준 거 뭐였어?',
  ],
  medical: [
    '우리 집 강아지 이름 알아?',
    '아빠 핸드폰 뒷자리 몇 번이야?',
    '우리 집 비상금 어디 있는지 알아?',
    '우리 엄마 결혼기념일이 언제야?',
  ],
  prosecutor: [
    '지금 통화 중인 번호가 서울중앙지검 공식 번호인가요? 직접 확인해도 될까요?',
    '이 사건 번호가 정확히 몇 번인가요?',
    '담당 검사님 성함과 직위를 정확히 말씀해 주시겠어요?',
    '공식 홈페이지에서 직원번호 3421을 확인할 수 있는지 잠깐 기다려도 될까요?',
  ],
  bank: [
    '제 계좌 마지막 입금일이 언제인지 확인해 주실 수 있나요?',
    '공식 KB은행 앱을 통해 직접 고객센터로 연락해도 될까요?',
    '저희 거래 지점 이름이 어디인지 알고 계신가요?',
    '제 계좌 개설일이 언제인지 확인해 주실 수 있나요?',
  ],
};

app.post('/api/reverify-question', async (req, res) => {
  const { scenarioId = 'accident', messages = [] } = req.body;

  // Ollama로 맥락 기반 질문 생성 시도
  if (await ollamaAvailable()) {
    try {
      const scenarioDesc = {
        accident: '자녀가 교통사고 합의금을 요구하며 부모를 사칭한 전화',
        medical: '자녀가 응급실 수술비를 요구하며 부모를 사칭한 전화',
        prosecutor: '검사를 사칭하여 계좌 이체를 요구하는 전화',
        bank: '은행 보안팀을 사칭하여 계좌 이체를 요구하는 전화',
      };
      const contextLines = messages.slice(-6)
        .map(m => `${m.role === 'user' ? '수신자' : '발신자'}: ${m.content}`)
        .join('\n');

      const systemP = '당신은 보이스피싱 피해 예방 전문가입니다. 매우 간결하게 답하세요.';
      const userP = `상황: ${scenarioDesc[scenarioId] || '의심 전화'}

최근 대화:
${contextLines || '(대화 없음)'}

위 상황에서 수신자가 상대방의 정체를 확인할 수 있는 재확인 질문 1개를 생성하세요.
조건: 진짜라면 쉽게 답할 수 있지만, 사기꾼이라면 답하기 어려운 질문
형식: 따옴표 없이 질문만 출력 (20자 이내로 간결하게)`;

      const question = await callOllama(systemP, [{ role: 'user', content: userP }]);
      const cleaned = question.replace(/^["']|["']$/g, '').trim();
      if (cleaned && cleaned.length > 5 && cleaned.length < 80) {
        return res.json({ question: cleaned, generated: true });
      }
    } catch (e) {
      console.warn('reverify-question generation failed:', e?.message);
    }
  }

  // 폴백: 시나리오별 기본값
  const defaults = REVERIFY_DEFAULTS[scenarioId] || REVERIFY_DEFAULTS.accident;
  res.json({
    question: defaults[Math.floor(Math.random() * defaults.length)],
    generated: false,
  });
});

app.get('/api/health', async (_req, res) => {
  const ollamaOk = await ollamaAvailable();
  const claudeOk = !!anthropic;
  const elevenOk = !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'your-elevenlabs-key-here');

  res.json({
    ok: true,
    claudeReady: claudeOk,
    ollamaReady: ollamaOk,
    ollamaModel: ollamaOk ? OLLAMA_MODEL : null,
    elevenLabsReady: elevenOk,
    mode: claudeOk ? 'claude' : ollamaOk ? 'ollama' : 'script',
    scenarios: Object.keys(SCENARIOS),
  });
});

// ─── Static frontend (배포 시 빌드된 dist/ 서빙) ──────────────────────────────
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  console.log('📦 dist/ 정적 서빙 활성화 (단일 포트 배포 모드)');
}

// ─── Survey API ───────────────────────────────────────────────────────────────

// 설문 제출 — 논문 부록 B 측정 변수 기반
app.post('/api/survey', (req, res) => {
  const b = req.body || {};
  const entry = {
    submittedAt: new Date().toISOString(),
    // 실험 컨텍스트 (객관 지표)
    scenario:        b.scenario ?? '',
    pattern:         b.pattern ?? '',
    patternCode:     b.patternCode ?? '',
    duration:        b.duration ?? '',
    reactionTime:    b.reactionTime ?? '',
    msgCount:        b.msgCount ?? '',
    // 사기 인지
    recognized:      b.recognized ?? '',
    suspicionPoint:  b.suspicionPoint ?? '',
    // 경고 평가 (5점 리커트)
    trust:           b.trust ?? '',
    understand:      b.understand ?? '',
    usability:       b.usability ?? '',
    intrusive:       b.intrusive ?? '',   // 역척도
    satisfaction:    b.satisfaction ?? '',
    readability:     b.readability ?? '',
    habituation:     b.habituation ?? '',
    haptic:          b.haptic ?? '',      // C/D만
    confScore:       b.confScore ?? '',   // C/D만
    // 행동 의도 (다중)
    nextActions:     b.nextActions ?? [],
    // 패턴 비교
    mostEffective:   b.mostEffective ?? '',
    mostAnnoying:    b.mostAnnoying ?? '',
    // 인구통계
    age:             b.age ?? '',
    gender:          b.gender ?? '',
    edu:             b.edu ?? '',
    usage:           b.usage ?? '',
    priorVishing:    b.priorVishing ?? '',
    priorDeepfake:   b.priorDeepfake ?? '',
    // 자유 응답
    improve:         b.improve ?? '',
    strategy:        b.strategy ?? '',
  };
  try {
    const count = appendSurvey(entry);
    console.log(`📋 설문 저장됨 (총 ${count}건)`);
    res.json({ ok: true, count });
  } catch (err) {
    console.error('survey save error:', err?.message ?? err);
    res.status(500).json({ ok: false, error: 'save_failed' });
  }
});

// 설문 목록 조회 (JSON)
app.get('/api/surveys', (_req, res) => {
  res.json({ ok: true, surveys: readSurveys() });
});

// 안전 로그에서 메인 파일 복원 (surveys.json이 비워졌을 때 복구용)
app.post('/api/surveys/restore', (_req, res) => {
  const fromLog = readSurveyLog();
  const current = readSurveys();
  if (fromLog.length > current.length) {
    fs.writeFileSync(SURVEY_FILE, JSON.stringify(fromLog, null, 2), 'utf8');
    console.log(`♻️  복원: ${current.length}건 → ${fromLog.length}건`);
    return res.json({ ok: true, restored: fromLog.length, before: current.length });
  }
  res.json({ ok: true, restored: current.length, before: current.length, message: '복원할 추가 데이터 없음' });
});

// 설문 CSV 다운로드 (Excel 한글 지원)
app.get('/api/surveys.csv', (_req, res) => {
  const csv = surveysToCsv(readSurveys());
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="deepvoice_surveys.csv"');
  res.send(csv);
});

// ─── 통계 집계 ────────────────────────────────────────────────────────────────
const LIKERT_FIELDS = ['trust', 'understand', 'usability', 'intrusive', 'satisfaction', 'readability', 'habituation', 'haptic', 'confScore'];
const LIKERT_LABELS = {
  trust: '신뢰도', understand: '이해도', usability: '사용성', intrusive: '방해도(역)',
  satisfaction: '만족도', readability: '가독성', habituation: '습관화', haptic: '햅틱', confScore: '신뢰점수',
};

function computeStats(rows) {
  const total = rows.length;
  const byPattern = {};
  const patterns = ['A', 'B', 'C', 'D'];

  for (const p of patterns) {
    const subset = rows.filter(r => r.patternCode === p);
    const n = subset.length;
    // 사기 인지율: recognized가 '예'로 시작
    const recognizedCount = subset.filter(r => String(r.recognized || '').startsWith('예')).length;
    // 리커트 평균
    const likertAvg = {};
    for (const f of LIKERT_FIELDS) {
      const vals = subset.map(r => Number(r[f])).filter(v => Number.isFinite(v) && v >= 1 && v <= 5);
      likertAvg[f] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    }
    // 반응시간 평균
    const rts = subset.map(r => parseFloat(r.reactionTime)).filter(v => Number.isFinite(v));
    byPattern[p] = {
      n,
      recognitionRate: n ? +((recognizedCount / n) * 100).toFixed(1) : null,
      reactionTimeAvg: rts.length ? +(rts.reduce((a, b) => a + b, 0) / rts.length).toFixed(2) : null,
      likert: likertAvg,
    };
  }

  // 인구통계 분포
  const dist = (field) => {
    const m = {};
    for (const r of rows) { const k = r[field] || '미응답'; m[k] = (m[k] || 0) + 1; }
    return m;
  };

  // 패턴 비교 투표
  const voteDist = (field) => {
    const m = {};
    for (const r of rows) { const k = r[field]; if (k) m[k] = (m[k] || 0) + 1; }
    return m;
  };

  return {
    total,
    byPattern,
    demographics: { age: dist('age'), gender: dist('gender'), edu: dist('edu'), usage: dist('usage') },
    priorVishing: dist('priorVishing'),
    priorDeepfake: dist('priorDeepfake'),
    mostEffective: voteDist('mostEffective'),
    mostAnnoying: voteDist('mostAnnoying'),
  };
}

app.get('/api/surveys/stats', (_req, res) => {
  res.json({ ok: true, stats: computeStats(readSurveys()), likertLabels: LIKERT_LABELS });
});

// ─── 통계 대시보드 (HTML) ──────────────────────────────────────────────────────
app.get('/stats', (_req, res) => {
  res.sendFile(path.join(__dirname, 'stats.html'));
});

// SPA fallback — API 외 모든 경로는 index.html로 (새로고침 대응)
if (fs.existsSync(DIST_DIR)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
// 0.0.0.0 바인딩 — 터널/외부 접속 허용
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
  ensureDataDir();
});
