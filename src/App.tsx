import { useState, useRef, useEffect, useCallback } from 'react';
import { useWarningBeep, triggerHaptic } from './hooks/useWarningBeep';
import { useTTS } from './hooks/useTTS';
import {
  IcPerson, IcWarningTri, IcWarningTriColor, IcVibrate, IcSound,
  IcPhoneEnd, IcPhoneUp, IcMic, IcMicOff, IcKeypad, IcSpeaker,
  IcAddPerson, IcVideo, IcRecording, IcShield, IcQuestion,
  IcBook, IcLock, IcClipboard, IcSearch, IcAlert,
} from './icons';
import Survey, { type SurveyContext } from './Survey';
import {
  EXP_SCENARIOS, EXP_WARN_AT_SEC, EXP_MAX_DURATION_SEC,
  ExpConsent, ExpDemographicsForm, ExpUiEval, ExpFinalSurvey, ExpDone,
  type ExpDemographics, type CallRecord, type UiEvaluation, type ExpComparison, type ExpScenarioId,
} from './Experiment';

type Pattern    = 'A' | 'B' | 'C' | 'D';
type Phase      = 'setup' | 'ringing' | 'calling' | 'ended' | 'survey'
  | 'exp-consent' | 'exp-demographics' | 'exp-call-recognition' | 'exp-ui-eval' | 'exp-final' | 'exp-done';

// 실험 세션 — 참여자 1명의 진행 상태(완전요인: 4 UI × 4 시나리오 = 16통화)
interface ExpSession {
  participantId: string;
  seq: number;
  order: Pattern[];                 // UI 블록 순서 (4)
  scenarioOrders: ExpScenarioId[][]; // 블록별 시나리오 순서 (4×4)
  demographics: ExpDemographics;
  callRecords: CallRecord[];
  uiEvaluations: UiEvaluation[];
}
function order_at(session: ExpSession | null, i: number): Pattern {
  return session && session.order[i] ? session.order[i] : 'A';
}
type ScenarioId = 'accident' | 'prosecutor' | 'medical' | 'bank';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface ApiStatus {
  claudeReady: boolean;
  ollamaReady: boolean;
  ollamaModel: string | null;
  elevenLabsReady: boolean;
  mode: 'claude' | 'ollama' | 'script';
}

// ─── Android status bar ───────────────────────────────────────────────────────
function AndroidStatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#1c1c1c';
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'relative', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--font-number)', fontSize: 14, fontWeight: 600, color: c }}>{time}</span>
      {/* camera punch-hole */}
      <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#1a1a1a' }} />
      {/* right icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {/* wifi */}
        <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
          <path d="M8.5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill={c}/>
          <path d="M4.5 7.5C5.8 6 7 5.5 8.5 5.5s2.7.5 4 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          <path d="M1.5 4.5C3.5 2 5.8 1 8.5 1s5 1 7 3.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.5"/>
        </svg>
        {/* signal bars */}
        <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
          <rect x="1" y="9" width="3" height="4" rx="0.5" fill={c}/>
          <rect x="5.5" y="6" width="3" height="7" rx="0.5" fill={c}/>
          <rect x="10" y="3" width="3" height="10" rx="0.5" fill={c}/>
          <rect x="14.5" y="0" width="2" height="13" rx="0.5" fill={c} opacity="0.3"/>
        </svg>
        {/* battery */}
        <svg width="25" height="13" viewBox="0 0 25 13" fill="none">
          <rect x="0.5" y="0.5" width="21" height="12" rx="2.5" stroke={c} strokeOpacity="0.35" strokeWidth="1"/>
          <rect x="2" y="2" width="16" height="9" rx="1.5" fill={c}/>
          <path d="M23 4.5v4c1-.7 1-3.3 0-4Z" fill={c} opacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Design tokens (mirror CSS variables) ────────────────────────────────────
const DS = {
  red:      '#D32F2F',
  redDark:  '#B71C1C',
  redDeep:  '#8E1414',
  primary:  '#004F59',
  primaryLight: '#D3E6E8',
  success:  '#2E9E5B',
  callBg:   '#fbfdfc',
  chipBg:   '#eef2f1',
  ink:      '#1c1c1c',
  sub:      '#555',
  muted:    '#9aa0a0',
};

// ─── Pattern UI ───────────────────────────────────────────────────────────────
const PATTERN_INFO: Record<Pattern, { label: string; desc: string }> = {
  A: { label: 'Pattern A', desc: '단순 텍스트 경고' },
  B: { label: 'Pattern B', desc: '컬러+아이콘 경고' },
  C: { label: 'Pattern C', desc: '멀티모달 경고' },
  D: { label: 'Pattern D', desc: '행동 유도형 경고' },
};

// ─── Scenario UI ──────────────────────────────────────────────────────────────
interface ScenarioUI {
  label: string; shortDesc: string; tactic: string;
  callerName: string; callerNumber: string; color: string;
  openingLines: string[];
}
const SCENARIO_UI: Record<ScenarioId, ScenarioUI> = {
  accident: {
    label: '교통사고 합의금', shortDesc: '자녀 사칭', tactic: '긴박감·창피함으로 판단력 마비',
    callerName: '저장되지 않은 번호', callerNumber: '010-9999-9999',
    color: '#b45309',
    openingLines: [
      '엄마... 나야. 나 사고 났어. 흑흑. 렌트카 몰다가 외제차 박았는데 합의금 300만원 지금 당장 내야 한대. 엄마 제발 빨리.',
      '엄마! 나야 나. 나 지금 큰일 났어. 차 사고 났는데 상대방이 30분 안에 300만원 안 주면 경찰 부른대. 어떡해 엄마, 제발.',
      '엄마 나야... 흑흑. 나 지금 강변북로에서 사고 났어. 손 너무 떨려. 상대방이 300만원 안 주면 고소한다고 해. 제발.',
      '엄마 나 좀 도와줘. 주차장 나오다 차 박았는데 상대방이 완전 난리야. 합의금 300만원. 엄마 지금 보내줄 수 있어?',
    ],
  },
  prosecutor: {
    label: '검찰청 사칭', shortDesc: '수사관 사칭', tactic: '공권력·법적 협박으로 순응 유도',
    callerName: '서울중앙지검', callerNumber: '02-0000-0000',
    color: '#1e3a5f',
    openingLines: [
      '안녕하십니까, 서울중앙지검 수사2부 김민준 검사입니다. 지금 통화 가능하십니까? 고객님 명의 계좌가 금융 범죄에 연루된 것이 확인되어 연락드렸습니다.',
      '여보세요, 서울중앙검찰청입니다. 고객님 명의 계좌가 보이스피싱 자금 세탁에 이용된 정황이 포착돼서 확인 차 연락드렸습니다.',
      '안녕하세요, 금융범죄수사대 이재원 수사관입니다. 고객님 계좌와 관련해서 긴급하게 확인할 사항이 있어서 연락드렸습니다.',
    ],
  },
  medical: {
    label: '의료응급 수술비', shortDesc: '자녀 사칭', tactic: '극도의 공포와 시간압박',
    callerName: '저장되지 않은 번호', callerNumber: '010-0000-0000',
    color: '#9b1c1c',
    openingLines: [
      '엄마... 나야. 나 자전거 타다 차에 치였어. 다리 골절이래. 수술 바로 해야 하는데 선납금 400만원 없으면 수술 못 한대. 엄마 제발 빨리.',
      '엄마! 나야. 계단에서 굴렀어. 팔 골절이래. 응급실인데 수술 전에 선납금 400만원 내야 한다고 해. 한 손밖에 못 써. 엄마 빨리.',
      '엄마 나야... 운동하다 넘어져서 다리 뼈 부러졌어. 수술 안 하면 안 된대. 근데 선납금 400만원 없으면 수술 못 시작한대. 어떡해 엄마.',
    ],
  },
  bank: {
    label: '금융기관 사칭', shortDesc: '보안팀 사칭', tactic: '친절함으로 경계 낮춰 이체 유도',
    callerName: 'KB국민은행 보안센터', callerNumber: '1999-9999',
    color: '#1a4b8a',
    openingLines: [
      '안녕하세요, 고객님. KB국민은행 금융보안센터 박지수 상담원입니다. 고객님 카드가 오늘 오전 중국 광저우에서 부정 사용된 것이 감지됐습니다. 지금 통화 가능하신가요?',
      '여보세요, KB국민은행 사기피해대응팀입니다. 고객님 계좌에서 오늘 새벽 해외 IP를 통한 비정상적인 접근이 감지되어 긴급 연락드렸습니다.',
      '안녕하세요. 국민은행 보안센터입니다. 방금 고객님 명의 카드로 해외에서 150만원 결제 시도가 있었는데요, 고객님이 하신 거 맞으세요?',
    ],
  },
};

const DETECTION_CONFIDENCE = 12;

function pickOpeningLine(sid: ScenarioId) {
  const lines = SCENARIO_UI[sid].openingLines;
  return lines[Math.floor(Math.random() * lines.length)];
}

function formatDuration(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

async function fetchAIResponse(messages: Message[], scenarioId: ScenarioId): Promise<string> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })), scenarioId }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.content ?? '잠깐만요...';
  } catch {
    return '잠깐만요...';
  }
}

// ─── Design-spec warning pattern components ───────────────────────────────────

/** Pattern A — passive text strip */
function PatternA() {
  return (
    <div className="animate-slideDown" style={{
      borderTop: '1px solid rgba(34,34,34,0.12)',
      borderBottom: '1px solid rgba(34,34,34,0.12)',
      padding: '13px 16px',
      background: '#fff',
    }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: DS.ink, letterSpacing: '-0.3px', fontFamily: 'var(--font-body)' }}>
        주의: 의심 통화
      </span>
    </div>
  );
}

/** Pattern B — color + icon banner */
function PatternB() {
  return (
    <div className="animate-slideDown" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: DS.red, color: '#fff',
      padding: '15px 16px', borderRadius: 14,
      boxShadow: '0 6px 16px rgba(211,47,47,0.30)',
      margin: '0 0 4px',
    }}>
      <IcWarningTriColor size={26} />
      <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
        AI 합성 음성 가능성
      </span>
    </div>
  );
}

function RippleHalo() {
  return (
    <span style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="dv-ripple" style={{ animationDelay: `${i * 0.74}s` }} />
      ))}
    </span>
  );
}

function WarnIcon() {
  return (
    <span style={{ position: 'relative', width: 44, height: 44, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <RippleHalo />
      <span style={{
        width: 44, height: 44, borderRadius: '50%', background: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1,
      }}>
        <IcWarningTri size={26} color={DS.red} />
      </span>
    </span>
  );
}

function ChannelBadges() {
  const badge = (Icon: React.FC<{size?: number; color?: string}>, label: string, key: string) => (
    <span key={key} className="dv-pulse" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)',
      borderRadius: 20, padding: '5px 11px 5px 9px',
    }}>
      <Icon size={17} color="#fff" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', letterSpacing: '-0.2px', fontFamily: 'var(--font-body)' }}>{label}</span>
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {badge(IcVibrate, '진동', 'v')}
      {badge(IcSound, '경고음', 's')}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', fontFamily: 'var(--font-body)' }}>신뢰도 점수</span>
        <span style={{ fontFamily: 'var(--font-number)', fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {value}<span style={{ fontSize: 12 }}>%</span>
        </span>
      </div>
      <div style={{ height: 9, borderRadius: 5, background: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, borderRadius: 5, background: '#fff' }} />
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.2px', marginTop: 5, fontFamily: 'var(--font-body)' }}>
        낮을수록 합성 음성 의심
      </div>
    </div>
  );
}

function RedCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-slideDown" style={{
      background: DS.red, color: '#fff', borderRadius: 16, padding: 16,
      boxShadow: '0 10px 26px rgba(211,47,47,0.34)',
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      {children}
    </div>
  );
}

/** Pattern C — multimodal */
function PatternC() {
  return (
    <RedCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WarnIcon />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>합성 음성으로 판별됨</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>AASIST 탐지 모델 분석 결과</div>
        </div>
      </div>
      <ConfidenceBar value={DETECTION_CONFIDENCE} />
      <ChannelBadges />
    </RedCard>
  );
}

/** Pattern D — action guiding */
function PatternD({ onHangup, onReverify, reverifyQuestion, reverifyLoading }: {
  onHangup: () => void;
  onReverify: () => void;
  reverifyQuestion: string;
  reverifyLoading: boolean;
}) {
  return (
    <RedCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WarnIcon />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>합성 음성으로 판별됨</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>즉시 확인이 필요합니다</div>
        </div>
      </div>
      <ConfidenceBar value={DETECTION_CONFIDENCE} />
      <ChannelBadges />
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 9, marginTop: 1 }}>
        <button onClick={onHangup} className="dv-btn" style={{
          background: '#fff', color: DS.red, fontWeight: 800, fontSize: 15,
          border: 'none', borderRadius: 12, padding: '13px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          letterSpacing: '-0.3px', boxShadow: '0 4px 10px rgba(0,0,0,0.16)', fontFamily: 'var(--font-body)',
        }}>
          <IcPhoneEnd size={18} color={DS.red} /> 지금 통화 종료
        </button>
        <button onClick={onReverify} className="dv-btn" style={{
          background: DS.redDark, color: '#fff', fontWeight: 700, fontSize: 15,
          border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, padding: '13px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          letterSpacing: '-0.3px', fontFamily: 'var(--font-body)',
        }}>
          <IcQuestion size={18} color="#fff" /> 재확인 질문
        </button>
      </div>
      {/* AI 생성 재확인 질문 팁 카드 */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        background: DS.redDeep, borderRadius: 12, padding: '12px 13px',
      }}>
        <IcQuestion size={20} color="#fff" />
        <div style={{ fontSize: 13, lineHeight: 1.5, letterSpacing: '-0.2px', fontFamily: 'var(--font-body)', flex: 1 }}>
          {reverifyLoading ? (
            <span style={{ opacity: 0.7 }}>AI가 상황에 맞는 질문을 생성 중...</span>
          ) : reverifyQuestion ? (
            <>이런 질문으로 확인해 보세요 —{' '}
              <strong style={{ fontWeight: 800 }}>"{reverifyQuestion}"</strong>
            </>
          ) : (
            <>상대방이 모를 만한 정보를 물어보세요.</>
          )}
        </div>
      </div>
    </RedCard>
  );
}

// ─── Caller header (design spec) ─────────────────────────────────────────────
function CallerHeader({ scenarioInfo, duration, isSpeaking, isLoading, mini = false }: {
  scenarioInfo: ScenarioUI; duration: number; isSpeaking: boolean; isLoading: boolean; mini?: boolean;
}) {
  const avatar = (sz: number) => (
    <div style={{
      width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(160deg,#e6efed,#d4e2de)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <IcPerson size={sz * 0.72} color="#9aa8a3" />
    </div>
  );

  if (mini) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 8 }}>
        {avatar(46)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-number)', fontSize: 18, fontWeight: 700, color: DS.ink, letterSpacing: '0.2px', lineHeight: 1.1 }}>
            {scenarioInfo.callerNumber}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            {isSpeaking ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} className="wave-bar" style={{ width: 3, background: DS.success, borderRadius: 2, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            ) : (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: DS.success, display: 'inline-block' }} />
            )}
            <span style={{ fontFamily: 'var(--font-number)', fontSize: 13, color: DS.sub }}>{formatDuration(duration)}</span>
            {isLoading && <span style={{ fontSize: 11, color: '#F47D30', fontFamily: 'var(--font-body)' }}>응답 중...</span>}
            <span style={{ fontSize: 11, color: DS.muted, letterSpacing: '-0.2px', fontFamily: 'var(--font-body)' }}>· {scenarioInfo.callerName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, paddingBottom: 16 }}>
      {avatar(96)}
      <div style={{ fontFamily: 'var(--font-number)', fontSize: 26, fontWeight: 700, color: DS.ink, letterSpacing: '0.2px', marginTop: 14 }}>
        {scenarioInfo.callerNumber}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
        {isSpeaking ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="wave-bar" style={{ width: 3, background: DS.success, borderRadius: 2, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: DS.success, display: 'inline-block' }} />
        )}
        <span style={{ fontFamily: 'var(--font-number)', fontSize: 15, color: DS.sub, letterSpacing: '0.3px' }}>
          {formatDuration(duration)}
        </span>
        {isLoading && <span style={{ fontSize: 12, color: '#F47D30', fontFamily: 'var(--font-body)' }}>● 응답 중</span>}
      </div>
      <div style={{ fontSize: 12.5, color: DS.muted, marginTop: 3, letterSpacing: '-0.2px', fontFamily: 'var(--font-body)' }}>
        {scenarioInfo.callerName} · 휴대전화
      </div>
    </div>
  );
}

// ─── Call controls (design spec) ─────────────────────────────────────────────
function CallControls({ onHangup, onMute, hidden = false, readonly = false }: {
  onHangup: () => void; onMute: () => void; hidden?: boolean; readonly?: boolean;
}) {
  const [muted, setMuted] = useState(false);
  if (hidden) return null;

  const chip = (
    Icon: React.FC<{size?: number; color?: string}>,
    label: string,
    onClick?: () => void,
    active?: boolean,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button onClick={onClick} className="dv-btn" style={{
        width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: active ? '#d1d5db' : DS.chipBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? 'inset 0 2px 4px rgba(0,0,0,0.12)' : 'none',
      }}>
        <Icon size={24} color="#3a3f3e" />
      </button>
      <span style={{ fontSize: 11.5, color: '#5a5f5e', letterSpacing: '-0.2px', fontFamily: 'var(--font-body)' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: 4 }}>
      {/* 6-chip grid — 2 rows × 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', rowGap: 18, justifyItems: 'center', marginBottom: readonly ? 4 : 22 }}>
        {/* readonly(실험모드): 아이콘만 표시, 기능 없음 */}
        {chip(muted ? IcMicOff : IcMic, '음소거', readonly ? undefined : () => { setMuted(m => !m); onMute(); }, muted)}
        {chip(IcKeypad, '키패드')}
        {chip(IcSpeaker, '스피커')}
        {chip(IcAddPerson, '통화 추가')}
        {chip(IcVideo, '영상통화')}
        {chip(IcRecording, '녹음')}
      </div>
      {!readonly && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onHangup} aria-label="통화 종료" className="dv-btn" style={{
            width: 66, height: 66, borderRadius: '50%', background: '#DC3545', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(220,53,69,0.40)',
          }}>
            <IcPhoneEnd size={30} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [pattern, setPattern]   = useState<Pattern>('A');
  const [scenario, setScenario] = useState<ScenarioId>('accident');
  const [phase, setPhase]       = useState<Phase>('exp-consent');
  const [duration, setDuration] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [reverifyOpen, setReverifyOpen] = useState(false);
  const [reverifyQuestion, setReverifyQuestion] = useState<string>('');
  const [reverifyLoading, setReverifyLoading] = useState(false);
  const [hungUp, setHungUp]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [shake, setShake] = useState(false); // 진동 대체 화면 흔들림(멀티모달·행동유도형)
  const [micStatus, setMicStatus] = useState<string>(''); // 마이크 인식 상태/에러 안내
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  // 마지막 통화 결과 — 설문에 함께 저장
  const [surveyContext, setSurveyContext] = useState<SurveyContext | null>(null);

  // ── 실험(완전요인) 상태 ──
  const [expSession, setExpSession]   = useState<ExpSession | null>(null);
  const [blockIndex, setBlockIndex]   = useState(0);   // 현재 UI 블록 0..3
  const [scenarioIdx, setScenarioIdx] = useState(0);   // 블록 내 시나리오 0..3
  const [scriptDone, setScriptDone] = useState(false); // 대본(마지막 음성)까지 재생 완료
  const [callNonce, setCallNonce] = useState(0); // 통화마다 증가 — 같은 'calling' 단계에서도 타이머 재시작
  const [expSubmitting, setExpSubmitting] = useState(false);
  const expMode = expSession !== null;
  const expTerminatedRef = useRef<boolean>(false); // 이번 통화에서 종료를 시도했는지
  const expEndedRef = useRef<boolean>(false);      // 통화 종료 중복 방지
  const reactionMsRef = useRef<number | null>(null); // 경고→첫 반응 시간(ms); 무반응이면 null 유지
  const blockIndexRef = useRef<number>(0);          // 비동기 종료에서 최신 블록 index
  const scenarioIdxRef = useRef<number>(0);         // 비동기 종료에서 최신 시나리오 index
  const callTokenRef = useRef<number>(0);           // 통화 토큰 — 대본 순차재생 안전 가드(겹침·이월 방지)
  const expSessionRef = useRef<ExpSession | null>(null); // 콜백에서 최신 세션 동기 참조
  const durationRef = useRef<number>(0);            // 종료 시점 통화 길이 동기 참조
  const expScenarioRef = useRef<ExpScenarioId>('accident'); // 현재 통화의 시나리오

  const warningTriggerRef  = useRef<number | null>(null);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef         = useRef<HTMLDivElement | null>(null);
  const stopRingtoneRef    = useRef<(() => void) | null>(null);
  const sessionIdRef       = useRef<number>(0);
  const recognitionRef     = useRef<any>(null);
  // 경고가 이미 발동됐는지 동기 플래그 — async state보다 먼저 체크해 중복 실행 방지
  const warningFiredRef    = useRef<boolean>(false);
  // messages 최신값을 ref로 유지 — warning effect deps에서 messages 제거용
  const messagesRef        = useRef<Message[]>([]);

  const { play: playBeep, playRingtone } = useWarningBeep();
  const { speak, cancel: cancelTTS } = useTTS();

  // API status
  useEffect(() => {
    fetch('/api/health').then(r => r.json())
      .then(d => setApiStatus(d))
      .catch(() => setApiStatus({ claudeReady: false, ollamaReady: false, ollamaModel: null, elevenLabsReady: false, mode: 'script' }));
  }, []);

  // messagesRef를 항상 최신 messages로 동기화
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (phase === 'calling' && !hungUp) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, hungUp, callNonce]); // callNonce: 통화 전환 시(같은 calling 단계) 타이머 재시작

  useEffect(() => { durationRef.current = duration; }, [duration]);

  // 실험모드: 통화가 최대 길이에 도달하면 자동 종료 (대본은 순차 재생)
  useEffect(() => {
    if (!expMode || phase !== 'calling') return;
    if (duration >= EXP_MAX_DURATION_SEC) endExpCall(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, expMode, phase]);

  // 경고 트리거 시점(초) — 데모·실험 공통 5초
  const warnAtSec = expMode ? EXP_WARN_AT_SEC : 5;
  useEffect(() => {
    // warningFiredRef: async state보다 먼저 체크 → 중복 실행 완전 차단
    if (duration === warnAtSec && !warningFiredRef.current && phase === 'calling') {
      warningFiredRef.current = true;
      setWarningVisible(true);
      warningTriggerRef.current = Date.now();
      if (pattern === 'C' || pattern === 'D') {
        playBeep(1200);
        triggerHaptic([200, 100, 200, 100, 200, 100, 200]);
        // 진동 미지원 기기 대체: 화면 흔들림 (~1초)
        setShake(true);
        window.setTimeout(() => setShake(false), 1050);
      }
      if (expMode) {
        // 실험모드: 현재 시나리오의 고정 재확인 질문(표준 자극) — AI 호출 없음
        setReverifyQuestion(EXP_SCENARIOS[scenario as ExpScenarioId].reverifyQuestion);
        setReverifyLoading(false);
      } else {
        // 데모모드: 대화 맥락으로 AI 재확인 질문 생성
        setReverifyLoading(true);
        fetch('/api/reverify-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId: scenario, messages: messagesRef.current }),
        })
          .then(r => r.json())
          .then(d => { setReverifyQuestion(d.question || ''); setReverifyLoading(false); })
          .catch(() => { setReverifyLoading(false); });
      }
    }
  // messages·warningVisible 제거: messagesRef·warningFiredRef로 대체
  }, [duration, phase, pattern, playBeep, scenario, warnAtSec, expMode]);

  const recordReactionTime = useCallback(() => {
    if (warningTriggerRef.current && reactionMsRef.current === null) {
      const ms = Date.now() - warningTriggerRef.current;
      reactionMsRef.current = ms;
      setReactionTime(ms);
    }
  }, []);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content: text, ts: Date.now() }]);
  }, []);

  const speakAsAttacker = useCallback((text: string, onDone?: () => void, scenarioId?: string) => {
    cancelTTS(); // 이전 발화 중단 — 목소리 겹침 방지(특히 실험모드 다중 대본)
    setIsSpeaking(true);
    speak(text, {
      rate: 1.1, pitch: 0.92, scenarioId: scenarioId ?? scenario, // 명시 전달 우선(stale 방지)
      onStart: () => setIsSpeaking(true),
      onEnd: () => { setIsSpeaking(false); onDone?.(); },
    });
  }, [speak, scenario, cancelTTS]);

  const startCall = useCallback(() => {
    stopRingtoneRef.current?.();
    sessionIdRef.current += 1;
    warningFiredRef.current = false; // 새 통화 시작 — 경고 플래그 초기화

    setPhase('ringing'); setDuration(0); setWarningVisible(false);
    setMessages([]); setHungUp(false); setReactionTime(null);
    setReverifyOpen(false); setReverifyQuestion(''); setReverifyLoading(false);
    warningTriggerRef.current = null;

    const cancelRingtone = playRingtone(() => {
      stopRingtoneRef.current = null;
      setPhase('calling');
      const opening = pickOpeningLine(scenario);
      setMessages([{ role: 'assistant', content: opening, ts: Date.now() }]);
      speakAsAttacker(opening);
    });
    stopRingtoneRef.current = cancelRingtone;
  }, [playRingtone, speakAsAttacker, scenario]);

  // ── 실험: 고정 대본 순차 재생 — 토큰 가드로 통화 이월·겹침 방지(견고) ──
  const playCallLines = useCallback((token: number, lines: string[], idx: number, scenarioId: string) => {
    if (token !== callTokenRef.current) return; // 다음 통화로 넘어갔으면 중단
    if (idx >= lines.length) {
      if (token === callTokenRef.current) setScriptDone(true); // 마지막 음성까지 끝남 → 평가 진행 가능
      return;
    }
    addAssistantMessage(lines[idx]);
    speakAsAttacker(lines[idx], () => {
      if (token !== callTokenRef.current) return;
      window.setTimeout(() => playCallLines(token, lines, idx + 1, scenarioId), 600);
    }, scenarioId); // 시나리오를 명시 전달 → 통화마다 올바른 음성
  }, [addAssistantMessage, speakAsAttacker]);

  // 진행 중 점진 저장 — 중도 이탈해도 서버에 보존(fire-and-forget)
  const saveProgress = useCallback((session: ExpSession) => {
    fetch('/api/experiment/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: session.participantId, seq: session.seq, order: session.order,
        scenarioOrders: session.scenarioOrders, demographics: session.demographics,
        callRecords: session.callRecords, uiEvaluations: session.uiEvaluations,
      }),
    }).catch(() => {});
  }, []);

  // ── 실험: 통화 시작 (블록=UI, 시나리오 — 고정 스크립트, AI 없음) ──
  const startExpCall = useCallback((blockIdx: number, scenIdx: number) => {
    const session = expSessionRef.current;
    if (!session) return;
    const pat = session.order[blockIdx];
    const scn = session.scenarioOrders[blockIdx][scenIdx];
    sessionIdRef.current += 1;
    warningFiredRef.current = false;
    expEndedRef.current = false;
    expTerminatedRef.current = false;
    reactionMsRef.current = null;
    blockIndexRef.current = blockIdx;
    scenarioIdxRef.current = scenIdx;
    expScenarioRef.current = scn;
    setBlockIndex(blockIdx); setScenarioIdx(scenIdx);
    setPattern(pat);
    setScenario(scn as ScenarioId); // 시나리오별 발신자 표시
    setDuration(0); setWarningVisible(false); setScriptDone(false);
    setMessages([]); setHungUp(false); setReactionTime(null);
    setReverifyOpen(false); setReverifyQuestion(''); setReverifyLoading(false);
    warningTriggerRef.current = null;
    cancelTTS();
    const token = ++callTokenRef.current;
    setPhase('calling');
    setCallNonce(n => n + 1); // 같은 'calling' 단계여도 duration 타이머·경고 재시작
    window.setTimeout(() => playCallLines(token, EXP_SCENARIOS[scn].lines, 0, scn), 350);
  }, [playCallLines, cancelTTS]);

  // ── 실험: 통화 종료 → 객관 지표(CallRecord) 기록 후 바로 다음 통화 / UI 평가로 ──
  const endExpCall = useCallback((terminated: boolean) => {
    if (expEndedRef.current) return; // 중복(자동종료+수동종료) 방지
    expEndedRef.current = true;
    if (terminated) expTerminatedRef.current = true;
    callTokenRef.current += 1; // 진행 중 대본 재생 중단
    cancelTTS();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSpeaking(false);
    const session = expSessionRef.current;
    if (!session) return;
    const rec: CallRecord = {
      blockOrder: blockIndexRef.current + 1,
      pattern: order_at(session, blockIndexRef.current),
      scenarioPos: scenarioIdxRef.current + 1,
      scenario: expScenarioRef.current,
      terminationAttempted: expTerminatedRef.current ? 1 : 0,
      reactionTimeSec: reactionMsRef.current != null ? +(reactionMsRef.current / 1000).toFixed(2) : null,
      durationSec: durationRef.current,
    };
    const updated: ExpSession = { ...session, callRecords: [...session.callRecords, rec] };
    expSessionRef.current = updated;
    setExpSession(updated);
    saveProgress(updated);
    const nextScen = scenarioIdxRef.current + 1;
    if (nextScen < session.scenarioOrders[blockIndexRef.current].length) {
      startExpCall(blockIndexRef.current, nextScen); // 같은 UI, 다음 시나리오
    } else {
      setPhase('exp-ui-eval'); // 4 시나리오 끝 → 이 UI 평가
    }
  }, [cancelTTS, saveProgress, startExpCall]);

  // ── 실험: 등록(enroll) + 첫 통화 시작 ──
  const enrollAndStart = useCallback(async (demographics: ExpDemographics) => {
    try {
      const res = await fetch('/api/experiment/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageGroup: demographics.ageGroup }),
      });
      const d = await res.json();
      const order: Pattern[] = (d && Array.isArray(d.order)) ? d.order : ['A', 'B', 'C', 'D'];
      const FIXED: ExpScenarioId[] = ['accident', 'prosecutor', 'medical', 'bank'];
      const scenarioOrders: ExpScenarioId[][] = (d && Array.isArray(d.scenarioOrders)) ? d.scenarioOrders
        : [FIXED, FIXED, FIXED, FIXED];
      const session: ExpSession = { participantId: d.participantId, seq: d.seq, order, scenarioOrders, demographics, callRecords: [], uiEvaluations: [] };
      expSessionRef.current = session;
      setExpSession(session);
      startExpCall(0, 0);
    } catch {
      alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, [startExpCall]);

  // ── 실험: UI(경고 방식) 평가 완료 → 다음 블록 또는 종합설문 ──
  const onUiEvalDone = useCallback((s: { recogSufficient: number; promptedHangup: number; timingOk: number; trust: number; comprehension: number; usability: number; intrusive: number; satisfaction: number }) => {
    const session = expSessionRef.current;
    if (!session) return;
    const ev: UiEvaluation = { blockOrder: blockIndexRef.current + 1, pattern: order_at(session, blockIndexRef.current), ...s };
    const updated: ExpSession = { ...session, uiEvaluations: [...session.uiEvaluations, ev] };
    expSessionRef.current = updated;
    setExpSession(updated);
    saveProgress(updated); // UI 평가마다 즉시 저장
    const nextBlock = blockIndexRef.current + 1;
    if (nextBlock < session.order.length) startExpCall(nextBlock, 0); // 다음 UI, 첫 시나리오
    else setPhase('exp-final');
  }, [startExpCall, saveProgress]);

  // ── 실험: 종합 비교 설문 완료 → 서버 제출 ──
  const onFinalDone = useCallback(async (payload: { comparison: ExpComparison; nextActions: string[]; improve: string; strategy: string }) => {
    const session = expSessionRef.current;
    if (!session) return;
    setExpSubmitting(true);
    try {
      await fetch('/api/experiment/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: session.participantId, seq: session.seq, order: session.order,
          scenarioOrders: session.scenarioOrders,
          demographics: session.demographics, callRecords: session.callRecords, uiEvaluations: session.uiEvaluations,
          comparison: payload.comparison,
          free: { nextActions: payload.nextActions, improve: payload.improve, strategy: payload.strategy },
        }),
      });
      setPhase('exp-done');
    } catch {
      alert('제출에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
    } finally {
      setExpSubmitting(false);
    }
  }, []);

  const restartExp = useCallback(() => {
    expSessionRef.current = null;
    setExpSession(null); setBlockIndex(0); setScenarioIdx(0);
    blockIndexRef.current = 0; scenarioIdxRef.current = 0;
    setPhase('exp-consent');
  }, []);

  const handleHangup = useCallback(() => {
    if (expSessionRef.current) { recordReactionTime(); endExpCall(true); return; }
    recordReactionTime(); cancelTTS();
    if (timerRef.current) clearInterval(timerRef.current);
    // 통화 결과를 설문 컨텍스트로 저장 (반응시간은 ref에서 직접 계산)
    const rt = reactionTime ?? (warningTriggerRef.current ? Date.now() - warningTriggerRef.current : null);
    setSurveyContext({
      scenario: SCENARIO_UI[scenario].label,
      pattern: `${PATTERN_INFO[pattern].label} (${PATTERN_INFO[pattern].desc})`,
      patternCode: pattern,
      duration,
      reactionTime: rt,
      msgCount: messages.filter(m => m.role === 'user').length,
    });
    setHungUp(true); setPhase('ended'); setIsSpeaking(false);
  }, [recordReactionTime, cancelTTS, reactionTime, scenario, pattern, duration, messages, endExpCall]);

  const handleReverify = useCallback(() => {
    recordReactionTime(); setReverifyOpen(true);
  }, [recordReactionTime]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? userInput).trim();
    if (!content || isLoading || hungUp) return;
    recordReactionTime();

    const sessionSnapshot = sessionIdRef.current; // 현재 세션 기록
    const userMsg: Message = { role: 'user', content, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated); setUserInput(''); setIsLoading(true);

    const aiText = await fetchAIResponse(updated, scenario);
    setIsLoading(false);

    // 세션이 바뀌었거나(resetExperiment/startCall) 통화가 종료됐으면 무시
    if (sessionIdRef.current !== sessionSnapshot || hungUp) return;
    addAssistantMessage(aiText);
    speakAsAttacker(aiText);
  }, [userInput, isLoading, hungUp, messages, scenario, recordReactionTime, addAssistantMessage, speakAsAttacker]);

  const startListening = useCallback(() => {
    // 이미 듣는 중이면 토글로 중지
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      return;
    }
    const SRA = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRA) {
      setMicStatus('⚠ 이 브라우저는 음성 인식을 지원하지 않습니다. Chrome·Edge에서 열어주세요.');
      return;
    }
    // 보안 컨텍스트(HTTPS/localhost)가 아니면 마이크 자체가 차단됨
    if (!window.isSecureContext) {
      setMicStatus('⚠ 보안 연결(HTTPS)에서만 마이크가 동작합니다. https:// 주소로 접속해 주세요.');
      return;
    }
    // 공격자 음성이 재생 중이면 멈추고 듣기 시작 (마이크가 TTS를 받아쓰지 않도록)
    cancelTTS();
    setIsSpeaking(false);
    const recognition = new SRA();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;   // 말하는 즉시 입력창에 텍스트 표시
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';
    let gotAnyResult = false;
    setMicStatus('🎙 마이크 켜는 중…');

    recognition.onstart = () => setMicStatus('🎙 듣는 중… 말씀하세요');
    recognition.onspeechstart = () => setMicStatus('🎙 음성 감지됨…');
    recognition.onresult = (e: any) => {
      gotAnyResult = true;
      let interim = '';
      finalText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setUserInput(finalText || interim); // 실시간 받아쓰기
      setMicStatus(finalText ? '' : '✍️ 받아쓰는 중…');
      recordReactionTime();
    };
    recognition.onerror = (e: any) => {
      const err = e?.error;
      const MSG: Record<string, string> = {
        'not-allowed': '⚠ 마이크 권한이 차단됨 → 주소창 왼쪽 🔒 → 마이크 → "허용" 후 새로고침',
        'service-not-allowed': '⚠ 마이크 권한이 차단됨 → 주소창 왼쪽 🔒 → 마이크 → "허용" 후 새로고침',
        'audio-capture': '⚠ 마이크를 찾을 수 없습니다. 마이크 연결을 확인해 주세요.',
        'network': '⚠ 음성 인식 서버에 연결할 수 없습니다(network). 인터넷 연결을 확인해 주세요.',
        'no-speech': '음성이 감지되지 않았어요. 마이크 버튼을 다시 눌러 말씀해 주세요.',
        'aborted': '',
      };
      setMicStatus(MSG[err] ?? `⚠ 음성 인식 오류: ${err}`);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) {
        setMicStatus('');
        handleSend(text); // 말이 끝나면 자동 전송
      } else if (!gotAnyResult) {
        // 결과가 한 번도 안 왔는데 에러 메시지도 없으면 일반 안내
        setMicStatus((s) => s || '인식된 음성이 없습니다. 다시 시도해 주세요.');
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (_) {
      // 이미 시작된 인스턴스가 있을 때의 InvalidStateError 방지
      setIsListening(false);
      recognitionRef.current = null;
      setMicStatus('');
    }
  }, [handleSend, recordReactionTime, cancelTTS]);

  const resetExperiment = useCallback(() => {
    // 링톤 타임아웃 체인 즉시 중단
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    sessionIdRef.current += 1;
    warningFiredRef.current = false; // 리셋 — 다음 통화에서 경고 재발동 허용

    cancelTTS(); if (timerRef.current) clearInterval(timerRef.current);
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
    setPhase('setup'); setDuration(0); setWarningVisible(false); setMessages([]);
    setHungUp(false); setReactionTime(null); setReverifyOpen(false);
    setReverifyQuestion(''); setReverifyLoading(false);
    setIsSpeaking(false); setIsLoading(false);
    setIsListening(false); setMicStatus('');
  }, [cancelTTS]);

  const scenarioInfo = SCENARIO_UI[scenario];
  const isPatternD   = pattern === 'D';

  // ── 실험(피험자내) 화면들 ──
  if (phase === 'exp-consent') {
    return <ExpConsent onAgree={() => setPhase('exp-demographics')} onDemo={() => setPhase('setup')} />;
  }
  if (phase === 'exp-demographics') {
    return <ExpDemographicsForm onSubmit={enrollAndStart} />;
  }
  if (phase === 'exp-ui-eval' && expSession) {
    return (
      <ExpUiEval
        blockNumber={blockIndex + 1}
        totalBlocks={expSession.order.length}
        pattern={order_at(expSession, blockIndex)}
        onSubmit={onUiEvalDone}
      />
    );
  }
  if (phase === 'exp-final') {
    return <ExpFinalSurvey onSubmit={onFinalDone} submitting={expSubmitting} />;
  }
  if (phase === 'exp-done' && expSession) {
    return <ExpDone participantId={expSession.participantId} onRestart={restartExp} />;
  }

  // ── Survey ──
  if (phase === 'survey') {
    return (
      <Survey
        context={surveyContext}
        onBack={() => setPhase(surveyContext ? 'ended' : 'setup')}
        onDone={resetExperiment}
      />
    );
  }

  // ── Setup ──
  if (phase === 'setup') {
    const aiReady = apiStatus?.claudeReady || apiStatus?.ollamaReady;
    const modeLabel = apiStatus?.claudeReady ? 'Claude API'
      : apiStatus?.ollamaReady ? `Ollama · ${apiStatus.ollamaModel}`
      : '스크립트 모드';

    return (
      <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
        {/* Android status bar */}
        <AndroidStatusBar />

        {/* Header */}
        <div style={{ background: DS.primary, padding: '20px 20px 24px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.25 }}>
            딥보이스 보이스피싱<br />경고 UX 프로토타입
          </div>
          {/* AI mode badge */}
          {apiStatus && (
            <div style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: aiReady ? 'rgba(155,223,196,0.25)' : 'rgba(255,180,79,0.25)',
              border: `1px solid ${aiReady ? 'rgba(155,223,196,0.5)' : 'rgba(255,180,79,0.5)'}`,
              borderRadius: 20, padding: '4px 12px',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: aiReady ? '#9BDFC4' : '#FFB44F', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: aiReady ? '#9BDFC4' : '#FFB44F' }}>{modeLabel}</span>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 연구 소개 / 참여 안내 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${DS.primaryLight}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: DS.primary, letterSpacing: '-0.3px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              <IcBook size={18} color={DS.primary} /> 연구 참여 안내
            </div>
            <p style={{ fontSize: 13, color: DS.sub, lineHeight: 1.65, margin: 0 }}>
              본 연구는 <strong>딥보이스(AI 합성 음성) 보이스피싱</strong>에 대응하는
              통화 화면 <strong>경고 디자인의 효과</strong>를 알아보기 위한 학술 연구입니다.
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['1', '아래에서 시나리오와 경고 패턴을 고르고 통화를 받습니다.'],
                ['2', '실제처럼 통화하다 보면 화면에 AI 탐지 경고가 나타납니다.'],
                ['3', '자연스럽게 반응한 뒤, 마지막에 짧은 설문에 응답해 주세요.'],
              ].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: DS.primary, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</span>
                  <span style={{ fontSize: 13, color: DS.ink, lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#F9F9F9', borderRadius: 10, fontSize: 11.5, color: DS.muted, lineHeight: 1.6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><IcLock size={13} color={DS.muted} /></span>
              <span>모든 응답은 <strong>익명</strong>으로 수집되며, 개인을 식별하는 정보는 저장하지 않습니다.
              수집된 데이터는 <strong>오직 본 연구 분석 목적</strong>으로만 사용됩니다.
              참여는 자발적이며 언제든 중단하실 수 있습니다.</span>
            </div>
          </div>

          {/* Scenario selection */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
              시나리오 선택
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(Object.keys(SCENARIO_UI) as ScenarioId[]).map(sid => {
                const s = SCENARIO_UI[sid];
                const active = scenario === sid;
                return (
                  <button key={sid} onClick={() => setScenario(sid)} className="dv-btn" style={{
                    padding: '12px 13px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    border: active ? `2px solid ${DS.primary}` : '1.5px solid rgba(34,34,34,0.10)',
                    background: active ? '#D3E6E8' : '#fafafa',
                    transition: 'all 0.15s', fontFamily: 'var(--font-body)',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? DS.primary : DS.ink, letterSpacing: '-0.2px', lineHeight: 1.3 }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: active ? DS.primary : DS.muted, marginTop: 3, opacity: 0.85 }}>{s.shortDesc}</div>
                    <div style={{ fontSize: 11, color: DS.muted, marginTop: 2, lineHeight: 1.4, opacity: 0.7 }}>{s.tactic}</div>
                  </button>
                );
              })}
            </div>
            {/* Caller preview */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F9F9F9', borderRadius: 10, border: '1px solid rgba(34,34,34,0.07)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(160deg,#e6efed,#d4e2de)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IcPerson size={22} color="#9aa8a3" />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-number)', fontSize: 14, fontWeight: 700, color: DS.ink, letterSpacing: '0.1px' }}>{scenarioInfo.callerNumber}</div>
                <div style={{ fontSize: 11.5, color: DS.muted, marginTop: 1 }}>{scenarioInfo.callerName}</div>
              </div>
            </div>
          </div>

          {/* Pattern selection */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
              경고 패턴 선택
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['A','B','C','D'] as Pattern[]).map(p => {
                const active = pattern === p;
                return (
                  <button key={p} onClick={() => setPattern(p)} className="dv-btn" style={{
                    padding: '12px 13px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    border: active ? `2px solid ${DS.primary}` : '1.5px solid rgba(34,34,34,0.10)',
                    background: active ? '#D3E6E8' : '#fafafa',
                    transition: 'all 0.15s', fontFamily: 'var(--font-body)',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? DS.primary : DS.ink }}>{PATTERN_INFO[p].label}</div>
                    <div style={{ fontSize: 11.5, color: active ? DS.primary : DS.muted, marginTop: 3, opacity: 0.85 }}>{PATTERN_INFO[p].desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI status detail */}
          {apiStatus && !aiReady && (
            <div style={{ background: '#FFF8E7', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(251,197,60,0.4)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A96900', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><IcAlert size={15} color="#A96900" /> AI 모드 미설정</div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.65 }}>
                로컬 AI: <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 4, fontSize: 11.5 }}>ollama serve</code> 실행 후 새로고침<br />
                클라우드 AI: .env에 <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 4, fontSize: 11.5 }}>ANTHROPIC_API_KEY</code> 설정
              </div>
            </div>
          )}

        </div>

        {/* CTA */}
        <div style={{ padding: '12px 16px 28px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={startCall} className="dv-btn" style={{
            width: '100%', background: DS.success, color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px',
            padding: '16px', borderRadius: 14, boxShadow: '0 6px 20px rgba(46,158,91,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <IcPhoneUp size={20} color="#fff" /> 통화 수신
          </button>
          <button onClick={() => setPhase('survey')} className="dv-btn" style={{
            width: '100%', background: '#fff', color: DS.primary, border: `1.5px solid ${DS.primary}`, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px',
            padding: '13px', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <IcClipboard size={18} color={DS.primary} /> 체험 후 설문 참여
          </button>
        </div>
      </div>
    );
  }

  // ── Ringing ──
  if (phase === 'ringing') {
    return (
      <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
        <AndroidStatusBar />

        {/* Top label */}
        <div style={{ textAlign: 'center', paddingTop: 20, fontSize: 13.5, color: DS.muted }}>수신 전화</div>

        {/* Caller info — centered, large */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          {/* Avatar with ring */}
          <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 28 }}>
            <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', background: 'rgba(0,79,89,0.06)' }} />
            <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(160deg,#e6efed,#d4e2de)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}>
              <IcPerson size={90} color="#9aa8a3" />
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-number)', fontSize: 30, fontWeight: 700, color: DS.ink, letterSpacing: '0.3px' }}>
            {scenarioInfo.callerNumber}
          </div>
          <div style={{ fontSize: 13.5, color: DS.muted, marginTop: 6, letterSpacing: '-0.2px' }}>
            {scenarioInfo.callerName} · 휴대전화
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 40px 60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button onClick={handleHangup} className="dv-btn" style={{
              width: 72, height: 72, borderRadius: '50%', background: '#DC3545', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(220,53,69,0.40)',
            }}>
              <IcPhoneEnd size={30} color="#fff" />
            </button>
            <span style={{ fontSize: 13, color: DS.sub }}>거절</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button onClick={() => {
              // 링톤 타임아웃 즉시 취소 (자동 수락 콜백이 다시 실행되는 것을 막음)
              stopRingtoneRef.current?.();
              stopRingtoneRef.current = null;
              setPhase('calling');
              const opening = pickOpeningLine(scenario);
              setMessages([{ role: 'assistant', content: opening, ts: Date.now() }]);
              speakAsAttacker(opening);
            }} className="dv-btn" style={{
              width: 72, height: 72, borderRadius: '50%', background: DS.success, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(46,158,91,0.40)',
            }}>
              <IcPhoneUp size={30} color="#fff" />
            </button>
            <span style={{ fontSize: 13, color: DS.sub }}>받기</span>
          </div>
        </div>

        {/* Android nav bar */}
        <div style={{ height: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: 8 }}>
          <div style={{ width: 120, height: 4, borderRadius: 2, background: 'rgba(34,34,34,0.18)' }} />
        </div>
      </div>
    );
  }

  // ── Ended ──
  if (phase === 'ended') {
    return (
      <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 20, fontFamily: 'var(--font-body)' }}>
        {/* Shield result card */}
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: DS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 10px 24px rgba(46,158,91,0.32)' }}>
            <IcShield size={44} color="#fff" />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: DS.ink, letterSpacing: '-0.4px' }}>통화가 종료됐습니다</div>
          <div style={{ fontSize: 14, color: DS.sub, marginTop: 8, lineHeight: 1.6, letterSpacing: '-0.2px' }}>
            AI 합성 음성으로 의심되는 통화를 차단했습니다.
          </div>
        </div>

        {/* Stats */}
        <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: '18px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
          {[
            ['시나리오', scenarioInfo.label],
            ['패턴', `${PATTERN_INFO[pattern].label} — ${PATTERN_INFO[pattern].desc}`],
            ['통화 시간', formatDuration(duration)],
            ['경고 후 반응', reactionTime !== null ? `${(reactionTime/1000).toFixed(2)}초` : '미측정'],
            ['응답 횟수', `${messages.filter(m => m.role === 'user').length}회`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(34,34,34,0.07)', fontSize: 13.5 }}>
              <span style={{ color: DS.sub }}>{k}</span>
              <span style={{ fontWeight: 700, color: DS.ink, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* 112 tip */}
        <div style={{ width: '100%', maxWidth: 360, background: '#fff', border: `1px solid rgba(211,47,47,0.2)`, borderRadius: 14, padding: '14px 16px', boxShadow: '0 4px 12px rgba(211,47,47,0.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DS.red, letterSpacing: '-0.2px', marginBottom: 6 }}>피해가 우려된다면</div>
          <div style={{ fontSize: 13.5, color: '#444', lineHeight: 1.6, letterSpacing: '-0.2px' }}>
            금융 송금을 했다면 즉시 <strong>112</strong>(경찰) 또는 <strong>1332</strong>(금감원)로 신고하세요.
          </div>
        </div>

        {/* Transcript */}
        {messages.length > 0 && (
          <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 14, padding: '12px 14px', maxHeight: 160, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', marginBottom: 8, letterSpacing: '0.4px' }}>대화 기록</div>
            {messages.map((m, i) => (
              <div key={i} style={{ fontSize: 12.5, marginBottom: 6, color: m.role === 'assistant' ? DS.red : DS.primary }}>
                <span style={{ fontWeight: 700 }}>{m.role === 'assistant' ? '발신자' : '피험자'}: </span>{m.content}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
          <button onClick={() => setPhase('survey')} style={{
            width: '100%', background: DS.success, color: '#fff', border: 'none', borderRadius: 14,
            padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', letterSpacing: '-0.2px',
            boxShadow: '0 4px 16px rgba(46,158,91,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}><IcClipboard size={18} color="#fff" /> 설문 작성하기</button>
          <button onClick={resetExperiment} style={{
            width: '100%', background: '#fff', color: DS.primary, border: `1.5px solid ${DS.primary}`, borderRadius: 14,
            padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', letterSpacing: '-0.2px',
          }}>다시 시작하기</button>
        </div>
      </div>
    );
  }

  // ── Calling ──
  const showWarn = warningVisible && !hungUp;
  return (
    <div className={shake ? 'dv-shake' : undefined} style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}>

      {/* Android status bar */}
      <AndroidStatusBar />

      {/* Caller header */}
      <div style={{ padding: '0 16px' }}>
        <CallerHeader
          scenarioInfo={scenarioInfo}
          duration={duration}
          isSpeaking={isSpeaking}
          isLoading={isLoading}
          mini={isPatternD && showWarn}
        />
      </div>

      {/* Warning banner */}
      {showWarn && (
        <div style={{ padding: '0 16px 8px' }}>
          {pattern === 'A' && <PatternA />}
          {pattern === 'B' && <PatternB />}
          {pattern === 'C' && <PatternC />}
          {pattern === 'D' && <PatternD onHangup={expMode ? () => {} : handleHangup} onReverify={handleReverify} reverifyQuestion={reverifyQuestion} reverifyLoading={reverifyLoading} />}
        </div>
      )}

      {/* Conversation transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 8px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              maxWidth: '78%', padding: '10px 13px', borderRadius: 18,
              borderTopRightRadius: m.role === 'user' ? 4 : 18,
              borderTopLeftRadius: m.role === 'assistant' ? 4 : 18,
              background: m.role === 'user' ? DS.primary : '#fff',
              color: m.role === 'user' ? '#fff' : DS.ink,
              fontSize: 14, lineHeight: 1.5, letterSpacing: '-0.2px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              fontFamily: 'var(--font-body)',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div style={{ padding: '12px 16px', borderRadius: 18, borderTopLeftRadius: 4, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', gap: 5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccc', animation: 'waveform 0.8s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Re-verify modal */}
      {reverifyOpen && (
        <div style={{ margin: '0 14px 8px', background: '#fff9f0', border: '1.5px solid #f47d30', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IcSearch size={16} color="#b45309" /> 재확인 질문</div>
          {reverifyLoading ? (
            <div style={{ fontSize: 12.5, color: '#78350f', opacity: 0.7 }}>AI가 상황에 맞는 질문 생성 중...</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>
                <strong>"{reverifyQuestion || '상대방이 모를 만한 정보를 직접 질문해보세요'}"</strong>
                {reverifyQuestion && <span style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>— 답하지 못하면 즉시 통화를 종료하세요.</span>}
              </div>
              {reverifyQuestion && (
                <button onClick={() => { setReverifyOpen(false); handleSend(reverifyQuestion); }}
                  style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: DS.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-body)', padding: 0 }}>
                  이 질문 전송하기 →
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 실험모드: 대본을 끝까지 들은 뒤 평가로 진행하는 바 */}
      {!hungUp && expMode && (
        <div style={{ padding: '8px 16px 10px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)' }}>
          {scriptDone ? (
            <button onClick={() => endExpCall(false)} className="dv-btn" style={{
              width: '100%', background: DS.primary, color: '#fff', border: 'none', borderRadius: 14,
              padding: '14px', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
              boxShadow: '0 4px 14px rgba(0,79,89,0.25)',
            }}>{scenarioIdx < 3 ? '다음 통화로 →' : '이 경고 방식 평가하기 →'}</button>
          ) : (
            <div style={{ textAlign: 'center', fontSize: 13, color: DS.muted, fontWeight: 600, padding: '6px 0' }}>
              통화를 끝까지 들어 주세요…
            </div>
          )}
        </div>
      )}

      {/* Input bar — 실험모드에서는 표준 자극 유지를 위해 숨김(자유 대화·AI 비활성) */}
      {!hungUp && !expMode && (
        <div style={{ padding: '6px 14px 8px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)' }}>
          {micStatus && (
            <div style={{
              fontSize: 12, fontWeight: 600, lineHeight: 1.45, margin: '0 4px 6px',
              color: micStatus.startsWith('⚠') ? DS.red : DS.sub,
            }}>{micStatus}</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f3f4f6', borderRadius: 24, padding: '8px 12px' }}>
            <input
              type="text" value={userInput}
              onChange={e => { setUserInput(e.target.value); recordReactionTime(); }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? '듣는 중… 말씀하세요' : '응답 입력...'}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: DS.ink, fontFamily: 'var(--font-body)', letterSpacing: '-0.2px' }}
              disabled={isLoading || isSpeaking}
            />
            <button onClick={startListening} disabled={isLoading} className="dv-btn"
              title={isListening ? '듣는 중 — 눌러서 중지' : '마이크로 말하기'}
              style={{ background: isListening ? 'rgba(211,47,47,0.12)' : 'none', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 5, opacity: isLoading ? 0.4 : 1, transition: 'background .2s' }}>
              <IcMic size={22} color={isListening ? DS.red : DS.sub} />
            </button>
            <button onClick={() => handleSend()} disabled={!userInput.trim() || isLoading}
              style={{ background: DS.primary, color: '#fff', border: 'none', borderRadius: 18, padding: '6px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: (!userInput.trim() || isLoading) ? 0.4 : 1 }}>
              전송
            </button>
          </div>
        </div>
      )}

      {/* Call controls — 실험모드에서는 통화 컨트롤 영역 전체 숨김(‘다음 통화로’로만 진행). 데모: 정상 동작 */}
      {!expMode && (
        <div style={{ padding: '6px 16px 16px', background: DS.callBg }}>
          <CallControls
            onHangup={handleHangup}
            onMute={() => { cancelTTS(); setIsSpeaking(false); }}
            hidden={isPatternD && showWarn}
          />
          {isPatternD && showWarn && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <button onClick={handleHangup} className="dv-btn" style={{
                width: 66, height: 66, borderRadius: '50%', background: '#DC3545', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(220,53,69,0.40)',
              }}>
                <IcPhoneEnd size={30} color="#fff" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reaction time (researcher panel) — 데모 전용 */}
      {!expMode && reactionTime !== null && (
        <div style={{ background: 'rgba(46,158,91,0.1)', borderTop: '1px solid rgba(46,158,91,0.22)', padding: '7px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: DS.success }}>
          <span>⏱ 경고 인지 → 첫 행동</span>
          <span style={{ fontFamily: 'var(--font-number)', fontWeight: 700 }}>{(reactionTime/1000).toFixed(2)}초</span>
        </div>
      )}

      {/* Android nav bar */}
      <div style={{ height: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', background: DS.callBg }}>
        <div style={{ width: 120, height: 4, borderRadius: 2, background: 'rgba(34,34,34,0.18)' }} />
      </div>
    </div>
  );
}
