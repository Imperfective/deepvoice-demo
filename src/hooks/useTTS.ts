import { useRef, useCallback } from 'react';

// ─── Phone quality audio filter chain ────────────────────────────────────────
// Simulates telephone bandpass (300Hz–3400Hz) + subtle line noise

function buildPhoneChain(ctx: AudioContext): {
  input: AudioNode;
  output: AudioNode;
  startNoise: () => void;
  stopNoise: () => void;
} {
  // Bandpass simulating telephone frequency range
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1800;
  bandpass.Q.value = 0.55;

  // Light compression for "pumped" phone feel
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 20;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;

  bandpass.connect(comp);
  comp.connect(ctx.destination);

  // Subtle line noise
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.007;
  }

  let noiseSource: AudioBufferSourceNode | null = null;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1400;
  noiseFilter.Q.value = 1.8;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.5;

  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  const startNoise = () => {
    try {
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      noiseSource.connect(noiseFilter);
      noiseSource.start();
    } catch (_) {}
  };

  const stopNoise = () => {
    try { noiseSource?.stop(); } catch (_) {}
    noiseSource = null;
  };

  return { input: bandpass, output: comp, startNoise, stopNoise };
}

// ─── Web Speech API fallback (Korean voice) ──────────────────────────────────

// 시나리오별 성별 — 폴백(브라우저) 음성도 성별을 맞추기 위함
const SCENARIO_GENDER: Record<string, 'male' | 'female'> = {
  accident: 'female', medical: 'male', prosecutor: 'male', bank: 'female',
};
const MALE_MARK = ['injoon', 'hyunsu', 'bongjin', 'gookmin', 'male', '남'];
const FEMALE_MARK = ['sunhi', 'heami', 'jimin', 'seohyeon', 'yujin', 'soonbok', 'female', '여'];

function getKoreanVoice(gender?: 'male' | 'female'): SpeechSynthesisVoice | null {
  const ko = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('ko'));
  if (!ko.length) return null;
  if (gender) {
    const marks = gender === 'male' ? MALE_MARK : FEMALE_MARK;
    const anti = gender === 'male' ? FEMALE_MARK : MALE_MARK;
    // 성별이 맞는 음성 우선, 반대 성별로 명시된 음성은 회피
    const match = ko.find(v => marks.some(m => v.name.toLowerCase().includes(m)));
    if (match) return match;
    const neutral = ko.find(v => !anti.some(m => v.name.toLowerCase().includes(m)));
    if (neutral) return neutral;
  }
  return ko[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SpeakOpts {
  rate?: number;
  pitch?: number;
  scenarioId?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export function useTTS() {
  const speakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stopNoiseRef = useRef<(() => void) | null>(null);
  // 재생 세대 토큰 — cancel/speak 시 증가. 비동기 fetch가 늦게 끝나도
  // 자기 세대가 아니면 재생을 시작하지 않아 목소리 겹침을 막는다.
  const genRef = useRef(0);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }, []);

  // ── ElevenLabs path ──────────────────────────────────────────────────────
  const playFromApi = useCallback(async (
    text: string,
    scenarioId: string,
    opts: SpeakOpts,
    myGen: number
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, scenarioId }),
      });

      // 503 = no API key configured → fall through to Web Speech
      if (res.status === 503) return false;
      if (!res.ok) return false;

      const arrayBuffer = await res.arrayBuffer();
      // 늦게 도착한 응답: 이미 다음 발화/취소가 발생했으면 재생하지 않음
      if (genRef.current !== myGen) return true;
      const ctx = getCtx();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (genRef.current !== myGen) return true;

      const chain = buildPhoneChain(ctx);

      const source = ctx.createBufferSource();
      source.buffer = decoded;
      // Slight speed-up for panicked scenarios
      const isPanicked = ['accident', 'medical'].includes(scenarioId);
      source.playbackRate.value = isPanicked ? 1.08 : 1.0;

      source.connect(chain.input);
      currentSourceRef.current = source;
      stopNoiseRef.current = chain.stopNoise;

      chain.startNoise();
      speakingRef.current = true;
      opts.onStart?.();
      source.start();

      source.onended = () => {
        chain.stopNoise();
        // 더 새로운 발화가 시작돼 중단된 경우엔 onEnd를 호출하지 않음(상태 꼬임 방지)
        if (genRef.current !== myGen) return;
        speakingRef.current = false;
        currentSourceRef.current = null;
        opts.onEnd?.();
      };

      return true;
    } catch {
      return false;
    }
  }, [getCtx]);

  // ── Web Speech fallback ──────────────────────────────────────────────────
  const playFromWebSpeech = useCallback((text: string, opts: SpeakOpts, myGen: number) => {
    if (!window.speechSynthesis) { opts.onEnd?.(); return; }
    if (genRef.current !== myGen) return; // 취소/다음 발화 발생 시 재생 안 함
    window.speechSynthesis.cancel();

    const gender = SCENARIO_GENDER[opts.scenarioId ?? 'accident'] ?? 'female';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = opts.rate ?? 1.05;
    // 남성 시나리오인데 브라우저에 남성 음성이 없으면 피치를 낮춰 남성에 가깝게(폴백 한정)
    const koVoice = getKoreanVoice(gender);
    const voiceLooksMale = koVoice ? MALE_MARK.some(m => koVoice.name.toLowerCase().includes(m)) : false;
    utterance.pitch = (gender === 'male' && !voiceLooksMale) ? 0.5 : (opts.pitch ?? 0.95);
    utterance.volume = 1.0;

    const doSpeak = () => {
      const voice = koVoice ?? getKoreanVoice(gender);
      if (voice) utterance.voice = voice;

      // Phone noise via AudioContext for Web Speech too
      let stopNoise: (() => void) | null = null;
      try {
        const ctx = getCtx();
        const chain = buildPhoneChain(ctx);
        chain.startNoise();
        stopNoise = chain.stopNoise;
      } catch (_) {}

      utterance.onstart = () => {
        speakingRef.current = true;
        opts.onStart?.();
      };
      utterance.onend = () => {
        stopNoise?.();
        if (genRef.current !== myGen) return;
        speakingRef.current = false;
        opts.onEnd?.();
      };
      utterance.onerror = () => {
        stopNoise?.();
        speakingRef.current = false;
        opts.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
    } else {
      doSpeak();
    }
  }, [getCtx]);

  // ── Public speak ─────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string, opts: SpeakOpts = {}) => {
    const myGen = ++genRef.current; // 새 발화 시작 — 이전 발화/대기 무효화
    // 이전 오디오 소스가 재생 중이면 즉시 중단(겹침 방지)
    try { currentSourceRef.current?.stop(); } catch (_) {}
    currentSourceRef.current = null;
    stopNoiseRef.current?.();
    stopNoiseRef.current = null;
    window.speechSynthesis?.cancel();

    const scenarioId = opts.scenarioId ?? 'accident';
    // Edge TTS 1차 시도 → 실패 시 1회 재시도(간헐적 실패로 인한 잘못된 폴백 음성 방지)
    let apiOk = await playFromApi(text, scenarioId, opts, myGen);
    if (!apiOk && genRef.current === myGen) {
      apiOk = await playFromApi(text, scenarioId, opts, myGen);
    }
    // 두 번 다 실패했을 때만 브라우저 음성으로 폴백(성별 맞춤 시도)
    if (!apiOk && genRef.current === myGen) {
      playFromWebSpeech(text, opts, myGen);
    }
  }, [playFromApi, playFromWebSpeech]);

  const cancel = useCallback(() => {
    genRef.current++; // 진행 중/대기 중인 모든 재생 무효화
    // Stop AudioContext source (ElevenLabs)
    try { currentSourceRef.current?.stop(); } catch (_) {}
    currentSourceRef.current = null;
    stopNoiseRef.current?.();
    stopNoiseRef.current = null;
    speakingRef.current = false;

    // Stop Web Speech
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, cancel, speakingRef };
}
