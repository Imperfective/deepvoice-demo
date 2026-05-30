import { useRef } from 'react';

export function useWarningBeep() {
  const ctxRef = useRef<AudioContext | null>(null);

  const play = (durationMs = 1200) => {
    if (typeof window === 'undefined') return;
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 800;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const start = ctx.currentTime;
    const pulses = Math.floor(durationMs / 300);
    for (let i = 0; i < pulses; i++) {
      gain.gain.setValueAtTime(0.12, start + i * 0.3);
      gain.gain.setValueAtTime(0.0, start + i * 0.3 + 0.2);
    }
    osc.start(start);
    osc.stop(start + durationMs / 1000);
  };

  // Returns a cancel function — call it to stop the ringtone immediately
  const playRingtone = (onStop?: () => void): (() => void) => {
    let cancelled = false;

    if (typeof window === 'undefined') return () => {};
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const tones = [440, 550];
    let t = ctx.currentTime;
    let rep = 0;
    const maxReps = 4; // reduced from 6 to feel more natural

    const scheduleRing = () => {
      if (cancelled) return;
      if (rep >= maxReps) {
        if (!cancelled) onStop?.();
        return;
      }
      for (let j = 0; j < 2; j++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = tones[j % 2];
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
        gain.gain.linearRampToValueAtTime(0.0, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
        t += 0.4;
      }
      t += 1.5;
      rep++;
      setTimeout(scheduleRing, (t - ctx.currentTime) * 1000);
    };

    scheduleRing();

    return () => { cancelled = true; };
  };

  return { play, playRingtone };
}

export function triggerHaptic(pattern: number[] = [200, 100, 200, 100, 200, 100, 200]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
