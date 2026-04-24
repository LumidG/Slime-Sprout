import { useCallback, useRef } from 'react';

let tapCtx: AudioContext | null = null;

function playBubblyPop(opts: { canPlay: boolean; enabled: boolean; volume: number }): void {
  const { canPlay, enabled, volume } = opts;
  if (!canPlay || !enabled || volume <= 0) return;

  try {
    if (!tapCtx) tapCtx = new AudioContext();
    void tapCtx.resume();

    const ctx = tapCtx;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.32, volume * 0.28);

    // Low bubbly component — slides up like a pop
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(680, t);
    osc1.frequency.exponentialRampToValueAtTime(900, t + 0.09);
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.7, t + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc1.connect(g1);
    g1.connect(master);

    // High sparkle component — a quick chirp
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1180, t + 0.025);
    osc2.frequency.exponentialRampToValueAtTime(1480, t + 0.1);
    g2.gain.setValueAtTime(0, t + 0.025);
    g2.gain.linearRampToValueAtTime(0.45, t + 0.038);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc2.connect(g2);
    g2.connect(master);

    // Tiny high ping for cuteness
    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1760, t + 0.05);
    g3.gain.setValueAtTime(0, t + 0.05);
    g3.gain.linearRampToValueAtTime(0.28, t + 0.06);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc3.connect(g3);
    g3.connect(master);

    master.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.15);
    osc2.start(t + 0.025);
    osc2.stop(t + 0.17);
    osc3.start(t + 0.05);
    osc3.stop(t + 0.18);
  } catch (e) {
    console.error('Slime tap SFX:', e);
  }
}

/**
 * Bubbly pop sound when a slime is tapped on the main game screen.
 */
export function useSlimeTapSfx(
  canPlay: boolean,
  enabled: boolean,
  volume: number
): () => void {
  const optsRef = useRef({ canPlay, enabled, volume });
  optsRef.current = { canPlay, enabled, volume };

  return useCallback(() => {
    playBubblyPop(optsRef.current);
  }, []);
}
