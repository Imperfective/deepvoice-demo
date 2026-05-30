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

const PREFERRED_VOICES = [
  'com.apple.voice.premium.ko-KR.Sora',
  'com.apple.voice.enhanced.ko-KR.Sora',
  'Yuna',
  'ko-KR',
];

function getKoreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const preferred of PREFERRED_VOICES) {
    const match = voices.find(v =>
      v.voiceURI === preferred || v.name === preferred || v.lang === preferred
    );
    if (match) return match;
  }
  return voices.find(v => v.lang.startsWith('ko')) ?? null;
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
    opts: SpeakOpts
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
      const ctx = getCtx();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

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
  const playFromWebSpeech = useCallback((text: string, opts: SpeakOpts) => {
    if (!window.speechSynthesis) { opts.onEnd?.(); return; }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = opts.rate ?? 1.05;
    utterance.pitch = opts.pitch ?? 0.95;
    utterance.volume = 1.0;

    const doSpeak = () => {
      const voice = getKoreanVoice();
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
    const scenarioId = opts.scenarioId ?? 'accident';
    const apiOk = await playFromApi(text, scenarioId, opts);
    if (!apiOk) {
      playFromWebSpeech(text, opts);
    }
  }, [playFromApi, playFromWebSpeech]);

  const cancel = useCallback(() => {
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
