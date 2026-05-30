import { useState, useRef, useEffect, useCallback } from 'react';
import { useWarningBeep, triggerHaptic } from './hooks/useWarningBeep';
import { useTTS } from './hooks/useTTS';
import {
  IcPerson, IcWarningTri, IcWarningTriColor, IcVibrate, IcSound,
  IcPhoneEnd, IcPhoneUp, IcMic, IcMicOff, IcKeypad, IcSpeaker,
  IcAddPerson, IcVideo, IcRecording, IcShield, IcQuestion,
} from './icons';
import Survey, { type SurveyContext } from './Survey';

type Pattern    = 'A' | 'B' | 'C' | 'D';
type Phase      = 'setup' | 'ringing' | 'calling' | 'ended' | 'survey';
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
function CallControls({ onHangup, onMute, hidden = false }: {
  onHangup: () => void; onMute: () => void; hidden?: boolean;
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', rowGap: 18, justifyItems: 'center', marginBottom: 22 }}>
        {chip(muted ? IcMicOff : IcMic, '음소거', () => { setMuted(m => !m); onMute(); }, muted)}
        {chip(IcKeypad, '키패드')}
        {chip(IcSpeaker, '스피커')}
        {chip(IcAddPerson, '통화 추가')}
        {chip(IcVideo, '영상통화')}
        {chip(IcRecording, '녹음')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={onHangup} aria-label="통화 종료" className="dv-btn" style={{
          width: 66, height: 66, borderRadius: '50%', background: '#DC3545', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(220,53,69,0.40)',
        }}>
          <IcPhoneEnd size={30} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [pattern, setPattern]   = useState<Pattern>('A');
  const [scenario, setScenario] = useState<ScenarioId>('accident');
  const [phase, setPhase]       = useState<Phase>('setup');
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
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  // 마지막 통화 결과 — 설문에 함께 저장
  const [surveyContext, setSurveyContext] = useState<SurveyContext | null>(null);

  const warningTriggerRef  = useRef<number | null>(null);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef         = useRef<HTMLDivElement | null>(null);
  const stopRingtoneRef    = useRef<(() => void) | null>(null);
  const sessionIdRef       = useRef<number>(0);
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
  }, [phase, hungUp]);

  useEffect(() => {
    // warningFiredRef: async state보다 먼저 체크 → 중복 실행 완전 차단
    if (duration === 5 && !warningFiredRef.current && phase === 'calling') {
      warningFiredRef.current = true;
      setWarningVisible(true);
      warningTriggerRef.current = Date.now();
      if (pattern === 'C' || pattern === 'D') {
        playBeep(1200);
        triggerHaptic([200, 100, 200, 100, 200, 100, 200]);
      }
      // messagesRef로 현재 대화 맥락을 읽어 reverify 질문 생성
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
  // messages·warningVisible 제거: messagesRef·warningFiredRef로 대체
  }, [duration, phase, pattern, playBeep, scenario]);

  const recordReactionTime = useCallback(() => {
    if (warningTriggerRef.current && reactionTime === null) {
      setReactionTime(Date.now() - warningTriggerRef.current);
    }
  }, [reactionTime]);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content: text, ts: Date.now() }]);
  }, []);

  const speakAsAttacker = useCallback((text: string, onDone?: () => void) => {
    setIsSpeaking(true);
    speak(text, {
      rate: 1.1, pitch: 0.92, scenarioId: scenario,
      onStart: () => setIsSpeaking(true),
      onEnd: () => { setIsSpeaking(false); onDone?.(); },
    });
  }, [speak, scenario]);

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

  const handleHangup = useCallback(() => {
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
  }, [recordReactionTime, cancelTTS, reactionTime, scenario, pattern, duration, messages]);

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
    const SRA = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRA) return alert('Chrome을 사용해주세요.');
    const recognition = new SRA();
    recognition.lang = 'ko-KR'; recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setUserInput(t); setIsListening(false); handleSend(t);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend   = () => setIsListening(false);
    recognition.start(); setIsListening(true);
  }, [handleSend]);

  const resetExperiment = useCallback(() => {
    // 링톤 타임아웃 체인 즉시 중단
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    sessionIdRef.current += 1;
    warningFiredRef.current = false; // 리셋 — 다음 통화에서 경고 재발동 허용

    cancelTTS(); if (timerRef.current) clearInterval(timerRef.current);
    setPhase('setup'); setDuration(0); setWarningVisible(false); setMessages([]);
    setHungUp(false); setReactionTime(null); setReverifyOpen(false);
    setReverifyQuestion(''); setReverifyLoading(false);
    setIsSpeaking(false); setIsLoading(false);
  }, [cancelTTS]);

  const scenarioInfo = SCENARIO_UI[scenario];
  const isPatternD   = pattern === 'D';

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
            <div style={{ fontSize: 15, fontWeight: 800, color: DS.primary, letterSpacing: '-0.3px', marginBottom: 8 }}>
              📖 연구 참여 안내
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
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#F9F9F9', borderRadius: 10, fontSize: 11.5, color: DS.muted, lineHeight: 1.6 }}>
              🔒 모든 응답은 <strong>익명</strong>으로 수집되며, 개인을 식별하는 정보는 저장하지 않습니다.
              수집된 데이터는 <strong>오직 본 연구 분석 목적</strong>으로만 사용됩니다.
              참여는 자발적이며 언제든 중단하실 수 있습니다.
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
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A96900', marginBottom: 4 }}>⚠ AI 모드 미설정</div>
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
          }}>
            📋 체험 후 설문 참여
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
          }}>📋 설문 작성하기</button>
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
    <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}>

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
          {pattern === 'D' && <PatternD onHangup={handleHangup} onReverify={handleReverify} reverifyQuestion={reverifyQuestion} reverifyLoading={reverifyLoading} />}
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>🔍 재확인 질문</div>
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

      {/* Input bar */}
      {!hungUp && (
        <div style={{ padding: '6px 14px 8px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f3f4f6', borderRadius: 24, padding: '8px 12px' }}>
            <input
              type="text" value={userInput}
              onChange={e => { setUserInput(e.target.value); recordReactionTime(); }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="응답 입력..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: DS.ink, fontFamily: 'var(--font-body)', letterSpacing: '-0.2px' }}
              disabled={isLoading || isSpeaking}
            />
            <button onClick={startListening} disabled={isLoading || isSpeaking} className="dv-btn"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: isListening ? 1 : 0.5 }}>
              <IcMic size={22} color={isListening ? DS.red : DS.sub} />
            </button>
            <button onClick={() => handleSend()} disabled={!userInput.trim() || isLoading}
              style={{ background: DS.primary, color: '#fff', border: 'none', borderRadius: 18, padding: '6px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: (!userInput.trim() || isLoading) ? 0.4 : 1 }}>
              전송
            </button>
          </div>
        </div>
      )}

      {/* Call controls */}
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

      {/* Reaction time (researcher panel) */}
      {reactionTime !== null && (
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
