// 피험자내(within-subjects) 실험 러너 화면들 — 논문 3장 Methods 일치
// 동의 → 인구통계(+enroll) → [4패턴 trial은 App의 통화엔진] → 패턴별 설문 → 비교설문 → 완료
import { useState, useRef, useEffect } from 'react';
import {
  DS, StatusBar, SectionTitle, QLabel, Likert, Choice, MultiChoice, TextArea,
  GENDER_OPTS, EDU_OPTS, USAGE_OPTS, YESNO_OPTS, NEXT_ACTION_OPTS,
} from './Survey';

export type Pattern = 'A' | 'B' | 'C' | 'D';

export interface ExpDemographics {
  ageGroup: string; gender: string; edu: string; usage: string;
  priorVishing: string; priorDeepfake: string;
}

export type ExpScenarioId = 'accident' | 'prosecutor' | 'medical' | 'bank';

// 통화 1건 기록 (참여자당 16건 = 4 UI × 4 시나리오) — 객관 지표만(통화별 설문 없음)
export interface CallRecord {
  blockOrder: number;        // UI 제시 순서 1..4
  pattern: Pattern;          // 이 블록의 경고 UI
  scenarioPos: number;       // 블록 내 시나리오 순서 1..4
  scenario: ExpScenarioId;   // 이 통화의 시나리오
  terminationAttempted: 0 | 1;
  reactionTimeSec: number | null;
  durationSec: number;
}

// UI(경고 패턴) 1개 평가 (참여자당 4건) — 4개 시나리오 경험 후 1회
export interface UiEvaluation {
  blockOrder: number; pattern: Pattern;
  // 경고 알림 UI 상세 평가 (연구 핵심)
  recogSufficient: number;   // ① 경고 알림만으로 딥보이스 인식이 충분했는가
  promptedHangup: number;    // ② 경고 알림만 보고 끊어야겠다고 느꼈는가
  timingOk: number;          // ③ 경고 알림 등장 속도/시점이 적절했는가
  // 일반 사용성 평가
  trust: number; comprehension: number; usability: number;
  intrusive: number; satisfaction: number;
}

export interface ExpComparison {
  mostEffective: string; mostAnnoying: string;
  habituation: number | null; readability: number | null;
  hapticOk: number | null; confScoreHelpful: number | null;
}

// ── 실험 공통 타이밍 ──
export const EXP_WARN_AT_SEC = 10;     // 경고 UI 노출 시점(초)
export const EXP_MAX_DURATION_SEC = 90; // 안전망: 사용자가 오래 방치할 때만 자동 종료(초). 정상은 '평가하기' 버튼으로 진행

export interface ExpScenario {
  id: ExpScenarioId; label: string; callerName: string; callerNumber: string;
  lines: string[];              // 공격자 고정 대본(순차 재생)
  reverifyQuestion: string;     // Pattern D 행동 유도 카드 문구
}

// ── 4개 고정 시나리오(표준 자극) — 모든 참여자가 동일한 대본을 들음 ──
export const EXP_SCENARIOS: Record<ExpScenarioId, ExpScenario> = {
  accident: {
    id: 'accident', label: '교통사고 합의금(자녀 사칭)', callerName: '엄마', callerNumber: '010-3942-7715',
    lines: [
      '엄마, 나야... 나 사고 났어. 휴대폰 액정이 깨져서 친구 폰으로 전화하는 거야.',
      '상대방 차가 외제차인데 합의금 300만원을 지금 당장 안 보내면 경찰서 간대. 엄마 제발 빨리 좀.',
      '엄마 왜 말이 없어... 시간 없단 말이야. 계좌번호 불러줄 테니까 지금 바로 보내줘. 응?',
    ],
    reverifyQuestion: '가족만 아는 것을 되물어 확인하세요 — 예: “우리 집 강아지 이름이 뭐야?”',
  },
  prosecutor: {
    id: 'prosecutor', label: '검찰청 사칭', callerName: '서울중앙지검', callerNumber: '02-530-0114',
    lines: [
      '안녕하십니까. 서울중앙지검 첨단범죄수사부 김민준 검사입니다. 본인 확인 절차를 진행하겠습니다.',
      '귀하 명의 계좌가 대포통장으로 금융사기에 연루되었습니다. 즉시 안전계좌로 자금을 이체해 보호 조치하셔야 합니다.',
      '이 통화는 수사 기밀이라 누설 시 처벌됩니다. 지금 불러드리는 계좌로 바로 송금하십시오.',
    ],
    reverifyQuestion: '수사기관은 전화로 계좌이체를 요구하지 않습니다. 끊고 검찰 대표번호 1301로 직접 확인하세요.',
  },
  medical: {
    id: 'medical', label: '의료응급 수술비(자녀 사칭)', callerName: '아들', callerNumber: '010-8821-4470',
    lines: [
      '엄마... 나야. 나 계단에서 굴러서 다리가 부러졌어. 지금 응급실인데 너무 아파.',
      '수술을 바로 해야 하는데 선납금 400만원이 없으면 수술을 못 시작한대. 엄마 빨리 좀 보내줘.',
      '엄마 나 손이 떨려서 통화도 힘들어... 시간 없어, 제발 지금 바로 보내줘.',
    ],
    reverifyQuestion: '평소 번호로 자녀에게 직접 전화해 확인하세요 — 예: “어릴 때 다닌 학교 이름이 뭐야?”',
  },
  bank: {
    id: 'bank', label: '금융기관 사칭(보안팀)', callerName: 'KB국민은행 보안센터', callerNumber: '1599-9999',
    lines: [
      '안녕하세요, 고객님. KB국민은행 금융보안센터 박지수입니다. 본인 확인 도와드리겠습니다.',
      '고객님 카드가 방금 해외에서 부정 사용 시도가 감지됐습니다. 계좌 보호를 위해 보안 승인 절차가 필요합니다.',
      '알려드리는 안전계좌로 잔액을 이체하시면 즉시 보호됩니다. 지금 바로 진행해 드릴게요.',
    ],
    reverifyQuestion: '은행은 전화로 자금 이체를 요구하지 않습니다. 끊고 카드 뒷면 대표번호로 직접 확인하세요.',
  },
};

const AGE_GROUP_OPTS = ['청년 (20~30대)', '중년 (40~50대)', '노년 (60대 이상)'];

function Shell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  // 화면 진입 시 항상 맨 위부터 보이도록 스크롤 초기화
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    window.scrollTo(0, 0);
  }, [title, subtitle]);
  return (
    <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <StatusBar />
      <div style={{ background: DS.primary, padding: '18px 20px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
      {footer && <div style={{ padding: '12px 16px 28px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)' }}>{footer}</div>}
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children, color = DS.success }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="dv-btn" style={{
      width: '100%', background: disabled ? '#cbd5d3' : color, color: '#fff', border: 'none', borderRadius: 14,
      padding: '16px', fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-body)', boxShadow: disabled ? 'none' : '0 6px 20px rgba(46,158,91,0.30)', transition: 'all 0.2s',
    }}>{children}</button>
  );
}

// ── 1. 연구 동의 ─────────────────────────────────────────────────────────────
export function ExpConsent({ onAgree, onDemo }: { onAgree: () => void; onDemo: () => void }) {
  return (
    <Shell title="딥보이스 경고 UX 연구" subtitle="피험자내 실험 · 약 7~10분 소요">
      <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${DS.primaryLight}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: DS.primary, marginBottom: 8 }}>연구 참여 안내</div>
        <div style={{ fontSize: 12.5, color: DS.sub, lineHeight: 1.6, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #eee' }}>
          본 연구는 <strong style={{ color: DS.primary200 }}>숭실대학교 일반대학원 미디어학과 인공지능 전공 박사과정 김민규</strong>
          (<a href="mailto:kimminkyu@soongsil.ac.kr" style={{ color: DS.primary, textDecoration: 'underline' }}>kimminkyu@soongsil.ac.kr</a>)가 수행하는 학술 연구입니다.
        </div>
        <p style={{ fontSize: 13, color: DS.sub, lineHeight: 1.65, margin: 0 }}>
          본 연구는 <strong>딥보이스(AI 합성 음성) 보이스피싱</strong> 통화 화면의
          <strong> 경고 UX(사용자 경험)</strong>가 사용자의 사기 인지와 대처에 미치는 효과를 측정하는 학술 실험입니다.
          잠시 후 다음 <strong>네 가지 유형의 보이스피싱 전화</strong>를 받게 됩니다 —
          ① 교통사고 합의금(자녀 사칭), ② 검찰청 사칭(수사관), ③ 의료응급 수술비(자녀 사칭), ④ 금융기관 사칭(보안 상담원).
          <strong> 실제로 그런 상황에 처했다고 가정</strong>하고 평소처럼 자연스럽게 반응해 주세요.
        </p>
        <div style={{ marginTop: 12, padding: '11px 13px', background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.22)', borderRadius: 10, fontSize: 12, color: '#9b1c1c', lineHeight: 1.6 }}>
          📌 통화 속 목소리는 <strong>딥보이스(AI)로 합성된 가짜 목소리</strong>라는 가정 하에,
          기계음으로 변조해 들려드립니다. 이 실험의 핵심은
          <strong> 화면에 나타나는 경고 UI를 보고 “이 통화가 딥보이스 보이스피싱임”을 알아차릴 수 있는가</strong>입니다.
        </div>
        <div style={{ marginTop: 10, padding: '11px 13px', background: 'rgba(0,79,89,0.06)', border: `1px solid ${DS.primaryLight}`, borderRadius: 10, fontSize: 12, color: DS.primary200, lineHeight: 1.6 }}>
          🔊 <strong>반드시 소리를 켜 주세요.</strong> 통화 음성과 함께 <strong>경고음</strong>도 평가 대상입니다.
          멀티모달·행동 유도형 경고에서는 <strong>진동</strong>이 울립니다(일부 기기는 미지원).
          진동이 없는 기기에서는 <strong>화면이 흔들려</strong> 진동을 대신 표현하니, 그 느낌으로 평가해 주세요.
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['1', '먼저 간단한 응답자 정보를 입력합니다.'],
            ['2', '한 가지 경고 방식으로 4가지 보이스피싱 통화를 받고, 통화마다 “사기였는지”를 짧게 답합니다.'],
            ['3', '4통화를 마치면 그 경고 방식을 평가합니다. 이 과정을 4가지 경고 방식(총 16통화)으로 반복합니다.'],
          ].map(([n, t]) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: DS.primary, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</span>
              <span style={{ fontSize: 13, color: DS.ink, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#F9F9F9', borderRadius: 10, fontSize: 11.5, color: DS.muted, lineHeight: 1.6 }}>
          모든 응답은 <strong>익명</strong>으로 수집되며 개인을 식별하는 정보는 저장하지 않습니다.
          수집된 데이터는 오직 본 연구 분석 목적으로만 사용되며, 참여는 자발적이고 언제든 중단할 수 있습니다.
        </div>
      </div>
      <PrimaryBtn onClick={onAgree}>동의하고 실험 시작</PrimaryBtn>
      <button onClick={onDemo} className="dv-btn" style={{
        width: '100%', background: '#fff', color: DS.primary, border: `1.5px solid ${DS.primary}`, borderRadius: 14,
        padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
      }}>실험 대신 자유 체험(데모) 하기</button>
    </Shell>
  );
}

// ── 2. 인구통계 (실험 시작 전 1회) ───────────────────────────────────────────
export function ExpDemographicsForm({ onSubmit }: { onSubmit: (d: ExpDemographics) => void }) {
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [edu, setEdu] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [priorVishing, setPriorVishing] = useState<string | null>(null);
  const [priorDeepfake, setPriorDeepfake] = useState<string | null>(null);
  const ok = ageGroup && gender && edu && usage && priorVishing && priorDeepfake;
  return (
    <Shell title="응답자 정보" subtitle="실험 시작 전 한 번만 입력합니다"
      footer={<PrimaryBtn onClick={() => ok && onSubmit({ ageGroup: ageGroup!, gender: gender!, edu: edu!, usage: usage!, priorVishing: priorVishing!, priorDeepfake: priorDeepfake! })} disabled={!ok}>실험 시작하기</PrimaryBtn>}>
      <SectionTitle>인구통계</SectionTitle>
      <div><QLabel text="연령대" /><Choice options={AGE_GROUP_OPTS} value={ageGroup} onChange={setAgeGroup} /></div>
      <div><QLabel text="성별" /><Choice options={GENDER_OPTS} value={gender} onChange={setGender} /></div>
      <div><QLabel text="최종 학력" /><Choice options={EDU_OPTS} value={edu} onChange={setEdu} /></div>
      <div><QLabel text="일평균 스마트폰 사용 시간" /><Choice options={USAGE_OPTS} value={usage} onChange={setUsage} /></div>
      <SectionTitle>사전 경험</SectionTitle>
      <div><QLabel text="보이스피싱 피해·시도를 경험한 적이 있습니까?" /><Choice options={YESNO_OPTS} value={priorVishing} onChange={setPriorVishing} /></div>
      <div><QLabel text="딥페이크·AI 합성 음성에 대해 들어본 적이 있습니까?" /><Choice options={YESNO_OPTS} value={priorDeepfake} onChange={setPriorDeepfake} /></div>
    </Shell>
  );
}

// ── UI(경고 패턴) 이름 ──
const PATTERN_NAME: Record<Pattern, string> = {
  A: '단순 텍스트 경고', B: '컬러·아이콘 경고', C: '멀티모달 경고', D: '행동 유도형 경고',
};

// ── UI(경고 방식) 평가 — 4개 시나리오 연속 체험 후, UI당 1회(총 4회) ──────────
export function ExpUiEval({ blockNumber, totalBlocks, pattern, onSubmit }: {
  blockNumber: number; totalBlocks: number; pattern: Pattern;
  onSubmit: (v: { recogSufficient: number; promptedHangup: number; timingOk: number; trust: number; comprehension: number; usability: number; intrusive: number; satisfaction: number }) => void;
}) {
  const [recogSufficient, setRecogSufficient] = useState<number | null>(null);
  const [promptedHangup, setPromptedHangup] = useState<number | null>(null);
  const [timingOk, setTimingOk] = useState<number | null>(null);
  const [trust, setTrust] = useState<number | null>(null);
  const [comprehension, setComprehension] = useState<number | null>(null);
  const [usability, setUsability] = useState<number | null>(null);
  const [intrusive, setIntrusive] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const ok = recogSufficient && promptedHangup && timingOk && trust && comprehension && usability && intrusive && satisfaction;
  return (
    <Shell title="경고 방식 평가" subtitle={`${blockNumber} / ${totalBlocks} · ${PATTERN_NAME[pattern]}`}
      footer={<PrimaryBtn disabled={!ok} onClick={() => ok && onSubmit({
        recogSufficient: recogSufficient!, promptedHangup: promptedHangup!, timingOk: timingOk!,
        trust: trust!, comprehension: comprehension!, usability: usability!, intrusive: intrusive!, satisfaction: satisfaction!,
      })}>{blockNumber < totalBlocks ? '다음 경고 방식으로' : '종합 설문으로'}</PrimaryBtn>}>
      <div style={{ fontSize: 13, color: DS.sub, lineHeight: 1.6, background: '#F9F9F9', borderRadius: 10, padding: '11px 13px' }}>
        방금 <b>{PATTERN_NAME[pattern]}</b> 방식으로 <b>4가지 통화</b>를 연달아 경험하셨습니다. 이 <b>경고 알림(UI)</b>을 평가해 주세요.
      </div>
      <SectionTitle>경고 알림(UI) 평가 — 핵심</SectionTitle>
      <div><QLabel text="① 인식 — 경고 알림만으로 ‘딥보이스 보이스피싱’임을 충분히 알아차릴 수 있었습니까?" /><Likert value={recogSufficient} onChange={setRecogSufficient} lowLabel="전혀 못 알아챔" highLabel="충분히 알아챔" /></div>
      <div><QLabel text="② 행동 유도 — 경고 알림만 보고도 ‘바로 통화를 끊어야겠다’고 느꼈습니까?" /><Likert value={promptedHangup} onChange={setPromptedHangup} lowLabel="전혀 아니다" highLabel="매우 그렇다" /></div>
      <div><QLabel text="③ 속도·시점 — 경고 알림이 나타나는 속도(시점)가 적절했습니까?" hint="너무 늦거나 빠르지 않고 적절했는지" /><Likert value={timingOk} onChange={setTimingOk} lowLabel="전혀 부적절" highLabel="매우 적절" /></div>
      <SectionTitle>경고 방식 평가 — 일반</SectionTitle>
      <div><QLabel text="④ 신뢰도 — 경고가 보여준 정보를 신뢰하였습니까?" /><Likert value={trust} onChange={setTrust} /></div>
      <div><QLabel text="⑤ 이해도 — 경고의 의미를 즉시 이해하셨습니까?" /><Likert value={comprehension} onChange={setComprehension} /></div>
      <div><QLabel text="⑥ 사용성 — 경고에 따라 행동하기 쉬웠습니까?" /><Likert value={usability} onChange={setUsability} /></div>
      <div>
        <QLabel text="⑦ 방해도 — 경고가 통화에 지나치게 방해되었습니까?" hint="점수가 높을수록 방해가 컸음 (역척도)" />
        <Likert value={intrusive} onChange={setIntrusive} lowLabel="전혀 방해 안 됨" highLabel="매우 방해됨" />
      </div>
      <div><QLabel text="⑧ 만족도 — 이러한 경고가 실제로 적용되길 원하십니까?" /><Likert value={satisfaction} onChange={setSatisfaction} /></div>
    </Shell>
  );
}

// ── 4. 종합 비교 설문 (B-3 + B-4) — 4 trial 종료 후 1회 ──────────────────────
const PATTERN_PICK = ['A 단순 텍스트', 'B 컬러·아이콘', 'C 멀티모달', 'D 행동 유도형'];
const PICK_CODE: Record<string, string> = { 'A 단순 텍스트': 'A', 'B 컬러·아이콘': 'B', 'C 멀티모달': 'C', 'D 행동 유도형': 'D' };

export function ExpFinalSurvey({ onSubmit, submitting }: {
  onSubmit: (v: { comparison: ExpComparison; nextActions: string[]; improve: string; strategy: string }) => void;
  submitting: boolean;
}) {
  const [mostEffective, setMostEffective] = useState<string | null>(null);
  const [mostAnnoying, setMostAnnoying] = useState<string | null>(null);
  const [habituation, setHabituation] = useState<number | null>(null);
  const [readability, setReadability] = useState<number | null>(null);
  const [hapticOk, setHapticOk] = useState<number | null>(null);
  const [confScoreHelpful, setConfScoreHelpful] = useState<number | null>(null);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [improve, setImprove] = useState('');
  const [strategy, setStrategy] = useState('');
  const toggle = (v: string) => setNextActions((p) => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const ok = mostEffective && mostAnnoying && habituation && readability && hapticOk && confScoreHelpful && nextActions.length > 0;
  return (
    <Shell title="종합 비교 설문" subtitle="네 가지 경고를 모두 체험한 뒤 평가"
      footer={<PrimaryBtn disabled={!ok || submitting} onClick={() => ok && onSubmit({
        comparison: {
          mostEffective: PICK_CODE[mostEffective!] ?? mostEffective!,
          mostAnnoying: PICK_CODE[mostAnnoying!] ?? mostAnnoying!,
          habituation, readability, hapticOk, confScoreHelpful,
        },
        nextActions, improve, strategy,
      })}>{submitting ? '제출 중...' : '실험 완료 · 제출하기'}</PrimaryBtn>}>
      <SectionTitle>패턴 비교</SectionTitle>
      <div><QLabel text="가장 효과적이라고 느낀 경고는?" /><Choice options={PATTERN_PICK} value={mostEffective} onChange={setMostEffective} /></div>
      <div><QLabel text="가장 거슬렸던(방해된) 경고는?" /><Choice options={PATTERN_PICK} value={mostAnnoying} onChange={setMostAnnoying} /></div>
      <SectionTitle>추가 평가 (5점)</SectionTitle>
      <div><QLabel text="습관화 — 같은 경고가 반복되면 무시하게 될 것 같습니까?" /><Likert value={habituation} onChange={setHabituation} /></div>
      <div><QLabel text="가독성 — 글자 크기·색 대비가 충분하였습니까?" /><Likert value={readability} onChange={setReadability} /></div>
      <div><QLabel text="햅틱 적절성 — 진동의 강도·지속이 적절하였습니까?" /><Likert value={hapticOk} onChange={setHapticOk} /></div>
      <div><QLabel text="신뢰도 점수 — 신뢰도 점수(%) 표시가 판단에 도움이 되었습니까?" /><Likert value={confScoreHelpful} onChange={setConfScoreHelpful} /></div>
      <SectionTitle>행동 의도</SectionTitle>
      <div>
        <QLabel text="앞으로 의심스러운 통화를 받으면 어떻게 하시겠습니까? (복수 선택)" />
        <MultiChoice options={NEXT_ACTION_OPTS} values={nextActions} onToggle={toggle} />
      </div>
      <SectionTitle>자유 응답 (선택)</SectionTitle>
      <div><QLabel text="경고 UX 개선 의견을 자유롭게 적어 주세요." required={false} /><TextArea value={improve} onChange={setImprove} placeholder="예: 경고가 더 크면 좋겠다 등" /></div>
      <div><QLabel text="가족 목소리 사칭에 대한 본인만의 대응 전략이 있다면?" required={false} /><TextArea value={strategy} onChange={setStrategy} placeholder="예: 가족끼리 정한 암호 질문이 있다 등" /></div>
    </Shell>
  );
}

// ── 5. 완료 ──────────────────────────────────────────────────────────────────
export function ExpDone({ participantId, onRestart }: { participantId: string; onRestart: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <StatusBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: DS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 10px 24px rgba(46,158,91,0.30)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: DS.ink, letterSpacing: '-0.4px' }}>실험이 완료되었습니다</div>
        <div style={{ fontSize: 14, color: DS.sub, marginTop: 8, lineHeight: 1.6 }}>
          소중한 참여에 감사드립니다.<br />참여자 번호 <strong>{participantId}</strong>로 안전하게 저장되었습니다.
        </div>
        <button onClick={onRestart} style={{
          marginTop: 32, width: '100%', maxWidth: 320, background: DS.primary, color: '#fff', border: 'none', borderRadius: 14,
          padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>처음으로</button>
      </div>
    </div>
  );
}
