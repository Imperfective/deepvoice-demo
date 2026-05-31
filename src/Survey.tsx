import { useState } from 'react';

// ─── Design tokens (mirror App DS) ───────────────────────────────────────────
export const DS = {
  primary: '#004F59',
  primary200: '#003640',
  primaryLight: '#D3E6E8',
  success: '#2E9E5B',
  error: '#D32F2F',
  callBg: '#fbfdfc',
  ink: '#1c1c1c',
  sub: '#555',
  muted: '#9aa0a0',
};

export interface SurveyContext {
  scenario: string;
  pattern: string;        // 예: "Pattern C (멀티모달 경고)"
  patternCode: string;    // 'A' | 'B' | 'C' | 'D'
  duration: number;
  reactionTime: number | null;
  msgCount: number;
}

interface SurveyProps {
  context: SurveyContext | null;
  onBack: () => void;
  onDone: () => void;
}

// 5점 리커트 라벨
const LIKERT_AGREE = ['전혀\n아니다', '아니다', '보통', '그렇다', '매우\n그렇다'];

// ── 옵션 정의 ──
const RECOGNIZE_OPTS = ['예, 사기라고 판단했다', '아니오', '잘 모르겠다'];
const SUSPICION_POINT_OPTS = [
  '통화 시작 시점부터',
  '대화 내용을 듣고',
  '경고가 표시된 후',
  '끝까지 의심하지 못했다',
];
export const NEXT_ACTION_OPTS = [
  '즉시 통화를 종료한다',
  '가족만 아는 정보를 되묻는다',
  '다른 경로로 가족에게 직접 확인한다',
  '112(경찰)·1332(금감원)에 신고한다',
  '송금하기 전 잠시 멈추고 생각한다',
  '특별히 달라지지 않을 것 같다',
];
const PATTERN_COMPARE_OPTS = ['A 단순 텍스트', 'B 컬러·아이콘', 'C 멀티모달', 'D 행동 유도형', '비교 불가(일부만 체험)'];

export const AGE_OPTS = ['10대', '20대', '30대', '40대', '50대', '60대 이상'];
export const GENDER_OPTS = ['남성', '여성'];
export const EDU_OPTS = ['고졸 이하', '대학 재학·졸업', '대학원 이상'];
export const USAGE_OPTS = ['1시간 미만', '1~3시간', '3~5시간', '5시간 이상'];
export const YESNO_OPTS = ['예', '아니오'];

export function StatusBar() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'relative', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--font-number)', fontSize: 14, fontWeight: 600, color: DS.ink }}>{time}</span>
      <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#1a1a1a' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
          <path d="M8.5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill={DS.ink} />
          <path d="M4.5 7.5C5.8 6 7 5.5 8.5 5.5s2.7.5 4 2" stroke={DS.ink} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M1.5 4.5C3.5 2 5.8 1 8.5 1s5 1 7 3.5" stroke={DS.ink} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.5" />
        </svg>
        <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
          <rect x="1" y="9" width="3" height="4" rx="0.5" fill={DS.ink} />
          <rect x="5.5" y="6" width="3" height="7" rx="0.5" fill={DS.ink} />
          <rect x="10" y="3" width="3" height="10" rx="0.5" fill={DS.ink} />
          <rect x="14.5" y="0" width="2" height="13" rx="0.5" fill={DS.ink} opacity="0.3" />
        </svg>
        <svg width="25" height="13" viewBox="0 0 25 13" fill="none">
          <rect x="0.5" y="0.5" width="21" height="12" rx="2.5" stroke={DS.ink} strokeOpacity="0.35" strokeWidth="1" />
          <rect x="2" y="2" width="16" height="9" rx="1.5" fill={DS.ink} />
          <path d="M23 4.5v4c1-.7 1-3.3 0-4Z" fill={DS.ink} opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: DS.primary, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 8, marginBottom: 2, paddingBottom: 6, borderBottom: `2px solid ${DS.primaryLight}` }}>
      {children}
    </div>
  );
}

export function QLabel({ text, required = true, hint }: { text: string; required?: boolean; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: DS.ink, letterSpacing: '-0.2px', lineHeight: 1.45 }}>
        {text}{required && <span style={{ color: DS.error, marginLeft: 4 }}>*</span>}
      </div>
      {hint && <div style={{ fontSize: 12, color: DS.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export function Likert({ value, onChange, lowLabel = '전혀 아니다', highLabel = '매우 그렇다' }: {
  value: number | null; onChange: (v: number) => void; lowLabel?: string; highLabel?: string;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {LIKERT_AGREE.map((label, i) => {
          const v = i + 1;
          const active = value === v;
          return (
            <button key={v} onClick={() => onChange(v)} className="dv-btn" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '9px 2px', borderRadius: 12, cursor: 'pointer',
              border: active ? `2px solid ${DS.primary}` : '1.5px solid rgba(34,34,34,0.12)',
              background: active ? DS.primaryLight : '#fff',
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}>
              <span style={{ fontFamily: 'var(--font-number)', fontSize: 16, fontWeight: 700, color: active ? DS.primary : DS.muted }}>{v}</span>
              <span style={{ fontSize: 9, color: active ? DS.primary : DS.muted, lineHeight: 1.15, textAlign: 'center', whiteSpace: 'pre-line' }}>{label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: DS.muted }}>
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </div>
  );
}

export function Choice({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)} className="dv-btn" style={{
            padding: '9px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: active ? `2px solid ${DS.primary}` : '1.5px solid rgba(34,34,34,0.12)',
            background: active ? DS.primaryLight : '#fff',
            color: active ? DS.primary : DS.sub, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

export function MultiChoice({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button key={opt} onClick={() => onToggle(opt)} className="dv-btn" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
            border: active ? `2px solid ${DS.primary}` : '1.5px solid rgba(34,34,34,0.12)',
            background: active ? DS.primaryLight : '#fff', textAlign: 'left',
            fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: active ? 'none' : '1.5px solid rgba(34,34,34,0.25)',
              background: active ? DS.primary : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: active ? DS.primary : DS.ink }}>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, resize: 'vertical',
        border: '1.5px solid rgba(34,34,34,0.12)', fontSize: 13.5, fontFamily: 'var(--font-body)',
        color: DS.ink, outline: 'none', lineHeight: 1.5,
      }} />
  );
}

export default function Survey({ context, onBack, onDone }: SurveyProps) {
  // 경험한 패턴 (C/D면 햅틱·신뢰도점수 문항 노출)
  const code = context?.patternCode ?? '';
  const isMultimodal = code === 'C' || code === 'D';

  // ── B-2 사기 인지 ──
  const [recognized, setRecognized] = useState<string | null>(null);
  const [suspicionPoint, setSuspicionPoint] = useState<string | null>(null);
  // ── B-2 경고 평가 (리커트) ──
  const [trust, setTrust] = useState<number | null>(null);
  const [understand, setUnderstand] = useState<number | null>(null);
  const [usability, setUsability] = useState<number | null>(null);
  const [intrusive, setIntrusive] = useState<number | null>(null);   // 역척도
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [readability, setReadability] = useState<number | null>(null);
  const [habituation, setHabituation] = useState<number | null>(null);
  const [haptic, setHaptic] = useState<number | null>(null);          // C/D만
  const [confScore, setConfScore] = useState<number | null>(null);    // C/D만
  // ── 행동 의도 ──
  const [nextActions, setNextActions] = useState<string[]>([]);
  // ── B-3 패턴 비교 ──
  const [mostEffective, setMostEffective] = useState<string | null>(null);
  const [mostAnnoying, setMostAnnoying] = useState<string | null>(null);
  // ── B-1 인구통계 ──
  const [age, setAge] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [edu, setEdu] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [priorVishing, setPriorVishing] = useState<string | null>(null);
  const [priorDeepfake, setPriorDeepfake] = useState<string | null>(null);
  // ── B-4 자유 응답 ──
  const [improve, setImprove] = useState('');
  const [strategy, setStrategy] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const toggleAction = (v: string) =>
    setNextActions((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  // 필수 검증 (자유응답·패턴비교 제외, 햅틱·신뢰도점수는 C/D일 때만 필수)
  const requiredOk =
    recognized && suspicionPoint &&
    trust && understand && usability && intrusive && satisfaction && readability && habituation &&
    nextActions.length > 0 &&
    age && gender && edu && usage && priorVishing && priorDeepfake &&
    (!isMultimodal || (haptic && confScore));

  const submit = async () => {
    if (!requiredOk) { setError('필수 문항(*)에 모두 응답해 주세요.'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 실험 컨텍스트 (객관 지표)
          scenario: context?.scenario ?? '미실시',
          pattern: context?.pattern ?? '미실시',
          patternCode: code || '미실시',
          duration: context?.duration ?? '',
          reactionTime: context?.reactionTime != null ? (context.reactionTime / 1000).toFixed(2) : '',
          msgCount: context?.msgCount ?? '',
          // 사기 인지
          recognized, suspicionPoint,
          // 경고 평가 (리커트)
          trust, understand, usability, intrusive, satisfaction, readability, habituation,
          haptic: isMultimodal ? haptic : '', confScore: isMultimodal ? confScore : '',
          // 행동 의도
          nextActions,
          // 패턴 비교
          mostEffective, mostAnnoying,
          // 인구통계
          age, gender, edu, usage, priorVishing, priorDeepfake,
          // 자유 응답
          improve, strategy,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error('save failed');
      setDone(true);
    } catch {
      setError('저장에 실패했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 설문 제출 완료 화면 ──
  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: DS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 10px 24px rgba(46,158,91,0.30)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: DS.ink, letterSpacing: '-0.4px' }}>설문을 제출했습니다</div>
          <div style={{ fontSize: 14, color: DS.sub, marginTop: 8, lineHeight: 1.6 }}>소중한 응답에 감사드립니다.<br />연구에 큰 도움이 됩니다.</div>
          <button onClick={onDone} style={{
            marginTop: 32, width: '100%', maxWidth: 320, background: DS.primary, color: '#fff', border: 'none', borderRadius: 14,
            padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>처음으로</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: DS.callBg, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ background: DS.primary, padding: '18px 20px 20px', position: 'relative' }}>
        <button onClick={onBack} style={{ position: 'absolute', left: 12, top: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>경고 UX 평가 설문</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>약 2분 소요 · 익명으로 수집됩니다</div>
        </div>
      </div>

      {/* Context summary */}
      {context && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: DS.primaryLight, borderRadius: 10, fontSize: 12, color: DS.primary200, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          <span><strong>방금 체험:</strong> {context.scenario}</span>
          <span><strong>경고:</strong> {context.pattern}</span>
          {context.reactionTime != null && <span><strong>반응:</strong> {(context.reactionTime / 1000).toFixed(2)}초</span>}
        </div>
      )}

      {/* Questions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* 영역 1. 사기 인지 */}
        <SectionTitle>1. 사기 인지</SectionTitle>
        <div>
          <QLabel text="방금 통화가 사기(보이스피싱)였다고 판단하셨습니까?" />
          <Choice options={RECOGNIZE_OPTS} value={recognized} onChange={setRecognized} />
        </div>
        <div>
          <QLabel text="어느 시점에서 사기임을 가장 강하게 의심하셨습니까?" />
          <Choice options={SUSPICION_POINT_OPTS} value={suspicionPoint} onChange={setSuspicionPoint} />
        </div>

        {/* 영역 2. 경고 평가 */}
        <SectionTitle>2. 경고 평가 {context ? `(${context.pattern.replace(/\s*\(.*\)/, '')})` : ''}</SectionTitle>
        <div><QLabel text="① 신뢰도 — 이 경고가 보여준 정보를 어느 정도 신뢰합니까?" /><Likert value={trust} onChange={setTrust} /></div>
        <div><QLabel text="② 이해도 — 이 경고가 의미하는 바를 즉시 이해하셨습니까?" /><Likert value={understand} onChange={setUnderstand} /></div>
        <div><QLabel text="③ 사용성 — 이 경고에 따라 행동하기가 쉬웠습니까?" /><Likert value={usability} onChange={setUsability} /></div>
        <div>
          <QLabel text="④ 방해도 — 이 경고가 통화에 지나치게 방해되었습니까?" hint="점수가 높을수록 방해가 컸음을 의미합니다 (역척도)." />
          <Likert value={intrusive} onChange={setIntrusive} lowLabel="전혀 방해 안 됨" highLabel="매우 방해됨" />
        </div>
        <div><QLabel text="⑤ 만족도 — 이러한 경고가 실제 통화에 적용되기를 원하십니까?" /><Likert value={satisfaction} onChange={setSatisfaction} /></div>
        <div><QLabel text="⑥ 가독성 — 글자 크기·색 대비가 충분하였습니까?" /><Likert value={readability} onChange={setReadability} /></div>
        <div><QLabel text="⑦ 습관화 — 같은 경고가 반복되면 무시하게 될 것 같습니까?" /><Likert value={habituation} onChange={setHabituation} /></div>

        {isMultimodal && (
          <>
            <div><QLabel text="⑧ 햅틱 적절성 — 진동의 강도·지속시간이 적절하였습니까?" /><Likert value={haptic} onChange={setHaptic} /></div>
            <div><QLabel text="⑨ 신뢰도 점수 — 신뢰도 점수(%) 표시가 의사결정에 도움이 되었습니까?" /><Likert value={confScore} onChange={setConfScore} /></div>
          </>
        )}

        {/* 영역 3. 행동 의도 */}
        <SectionTitle>3. 행동 의도</SectionTitle>
        <div>
          <QLabel text="다음에 의심스러운 통화를 받으면 어떻게 하시겠습니까? (복수 선택)" />
          <MultiChoice options={NEXT_ACTION_OPTS} values={nextActions} onToggle={toggleAction} />
        </div>

        {/* 영역 4. 패턴 비교 (선택) */}
        <SectionTitle>4. 패턴 비교 (여러 경고를 체험한 경우)</SectionTitle>
        <div>
          <QLabel text="가장 효과적이라고 느낀 경고는 무엇입니까?" required={false} />
          <Choice options={PATTERN_COMPARE_OPTS} value={mostEffective} onChange={setMostEffective} />
        </div>
        <div>
          <QLabel text="가장 거슬렸던(방해된) 경고는 무엇입니까?" required={false} />
          <Choice options={PATTERN_COMPARE_OPTS} value={mostAnnoying} onChange={setMostAnnoying} />
        </div>

        {/* 영역 5. 인구통계 */}
        <SectionTitle>5. 응답자 정보</SectionTitle>
        <div><QLabel text="연령대" /><Choice options={AGE_OPTS} value={age} onChange={setAge} /></div>
        <div><QLabel text="성별" /><Choice options={GENDER_OPTS} value={gender} onChange={setGender} /></div>
        <div><QLabel text="최종 학력" /><Choice options={EDU_OPTS} value={edu} onChange={setEdu} /></div>
        <div><QLabel text="일평균 스마트폰 사용 시간" /><Choice options={USAGE_OPTS} value={usage} onChange={setUsage} /></div>
        <div><QLabel text="보이스피싱 피해·시도를 경험한 적이 있습니까?" /><Choice options={YESNO_OPTS} value={priorVishing} onChange={setPriorVishing} /></div>
        <div><QLabel text="딥페이크·AI 합성 음성에 대해 들어본 적이 있습니까?" /><Choice options={YESNO_OPTS} value={priorDeepfake} onChange={setPriorDeepfake} /></div>

        {/* 영역 6. 자유 응답 */}
        <SectionTitle>6. 자유 응답 (선택)</SectionTitle>
        <div>
          <QLabel text="경고 UX 개선을 위한 의견을 자유롭게 적어 주세요." required={false} />
          <TextArea value={improve} onChange={setImprove} placeholder="예: 경고가 더 크면 좋겠다 / 소리가 갑작스럽다 등" />
        </div>
        <div>
          <QLabel text="가족 목소리 사칭에 대한 본인만의 대응 전략이 있다면?" required={false} />
          <TextArea value={strategy} onChange={setStrategy} placeholder="예: 가족끼리 정한 암호 질문이 있다 등" />
        </div>

        {error && (
          <div style={{ background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: DS.error }}>
            {error}
          </div>
        )}
      </div>

      {/* Submit */}
      <div style={{ padding: '12px 16px 28px', background: '#fff', borderTop: '1px solid rgba(34,34,34,0.07)' }}>
        <button onClick={submit} disabled={submitting} className="dv-btn" style={{
          width: '100%', background: requiredOk ? DS.success : '#cbd5d3', color: '#fff', border: 'none', borderRadius: 14,
          padding: '16px', fontSize: 16, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'var(--font-body)',
          boxShadow: requiredOk ? '0 6px 20px rgba(46,158,91,0.32)' : 'none', transition: 'all 0.2s',
        }}>
          {submitting ? '제출 중...' : '설문 제출하기'}
        </button>
      </div>
    </div>
  );
}
