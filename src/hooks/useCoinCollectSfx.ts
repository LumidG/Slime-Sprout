import { useCallback, useRef } from 'react';

let sfxCtx: AudioContext | null = null;

function playCoinCollectSound(opts: {
  canPlay: boolean;
  enabled: boolean;
  volume: number;
}): void {
  const { canPlay, enabled, volume } = opts;
  if (!canPlay || !enabled || volume <= 0) return;

  try {
    if (!sfxCtx) {
      sfxCtx = new AudioContext();
    }
    void sfxCtx.resume();

    const ctx = sfxCtx;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    const gain = Math.min(0.45, volume * 0.4);
    master.gain.value = gain;

    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(988, t);
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.5, t + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc1.connect(g1);
    g1.connect(master);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1319, t + 0.045);
    g2.gain.setValueAtTime(0, t + 0.045);
    g2.gain.linearRampToValueAtTime(0.45, t + 0.058);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc2.connect(g2);
    g2.connect(master);

    master.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.1);
    osc2.start(t + 0.045);
    osc2.stop(t + 0.17);
  } catch (e) {
    console.error('Coin collect SFX:', e);
  }
}

/**
 * Short two-tone chime when coins are collected in the playfield.
 * Uses a dedicated AudioContext so it does not interfere with the looped music graph.
 */
export function useCoinCollectSfx(
  canPlay: boolean,
  enabled: boolean,
  volume: number
): (count: number) => void {
  const optsRef = useRef({ canPlay, enabled, volume });
  optsRef.current = { canPlay, enabled, volume };

  return useCallback((count: number) => {
    if (count <= 0) return;
    playCoinCollectSound(optsRef.current);
  }, []);
}
