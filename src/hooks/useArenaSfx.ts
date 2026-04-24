import { useCallback, useRef } from 'react';

let arenaSfxCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!arenaSfxCtx) arenaSfxCtx = new AudioContext();
    void arenaSfxCtx.resume();
    return arenaSfxCtx;
  } catch {
    return null;
  }
}

/** Short percussive thud + low sine for a melee hit landing. */
function playArenaHit(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.55, vol * 0.5);
    master.connect(ctx.destination);

    // Noise burst filtered to a thud
    const bufSize = Math.ceil(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 280;
    filt.Q.value = 0.9;
    noise.connect(filt);
    filt.connect(master);
    noise.start(t);

    // Low body thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.08);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) {
    console.error('Arena hit SFX:', e);
  }
}

/** Quick high sweep for a dodge. */
function playArenaDodge(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.35, vol * 0.3);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.07);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) {
    console.error('Arena dodge SFX:', e);
  }
}

/** Magical shimmering arpeggio for an ability proc. */
function playArenaAbility(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.4, vol * 0.35);
    master.connect(ctx.destination);

    const freqs = [880, 1108, 1320, 1760];
    freqs.forEach((freq, i) => {
      const delay = i * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.4, t + delay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
      osc.connect(g);
      g.connect(master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.14);
    });
  } catch (e) {
    console.error('Arena ability SFX:', e);
  }
}

/** Short ascending fanfare at the start of a battle. */
function playArenaBattleStart(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.4, vol * 0.35);
    master.connect(ctx.destination);

    const notes = [392, 523, 659, 784];
    notes.forEach((freq, i) => {
      const delay = i * 0.1;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.28, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
      osc.connect(g);
      g.connect(master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.2);
    });
  } catch (e) {
    console.error('Arena battle-start SFX:', e);
  }
}

/** Triumphant jingle on victory. */
function playArenaVictory(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.45, vol * 0.4);
    master.connect(ctx.destination);

    const notes = [523, 659, 784, 1047, 784, 1047];
    const timings = [0, 0.1, 0.2, 0.32, 0.44, 0.52];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const d = timings[i]!;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.5, t + d + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
      osc.connect(g);
      g.connect(master);
      osc.start(t + d);
      osc.stop(t + d + 0.26);
    });
  } catch (e) {
    console.error('Arena victory SFX:', e);
  }
}

/** Descending sad notes on defeat. */
function playArenaDefeat(vol: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.4, vol * 0.35);
    master.connect(ctx.destination);

    const notes = [440, 349, 294, 220];
    notes.forEach((freq, i) => {
      const delay = i * 0.14;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.42, t + delay + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.26);
      osc.connect(g);
      g.connect(master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.3);
    });
  } catch (e) {
    console.error('Arena defeat SFX:', e);
  }
}

/**
 * Arena combat sound effects (hit, dodge, ability, battle-start, victory, defeat).
 * Uses a single shared AudioContext at module scope so it can be resumed on first user interaction.
 */
export function useArenaSfx(canPlay: boolean, enabled: boolean, volume: number) {
  const optsRef = useRef({ canPlay, enabled, volume });
  optsRef.current = { canPlay, enabled, volume };

  /** Per-sound last-played timestamp for light rate-limiting (avoids audio spam on simultaneous hits). */
  const lastPlayedRef = useRef<Record<string, number>>({});

  const canFire = (key: string, minGapMs = 80): boolean => {
    const { canPlay, enabled, volume } = optsRef.current;
    if (!canPlay || !enabled || volume <= 0) return false;
    const last = lastPlayedRef.current[key] ?? 0;
    if (Date.now() - last < minGapMs) return false;
    lastPlayedRef.current[key] = Date.now();
    return true;
  };

  const onHit = useCallback(() => {
    if (!canFire('hit', 60)) return;
    playArenaHit(optsRef.current.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDodge = useCallback(() => {
    if (!canFire('dodge', 80)) return;
    playArenaDodge(optsRef.current.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAbility = useCallback(() => {
    if (!canFire('ability', 200)) return;
    playArenaAbility(optsRef.current.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const onBattleStart = useCallback(() => {}, []);

  const onVictory = useCallback(() => {
    if (!canFire('victory', 1000)) return;
    playArenaVictory(optsRef.current.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDefeat = useCallback(() => {
    if (!canFire('defeat', 1000)) return;
    playArenaDefeat(optsRef.current.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { onHit, onDodge, onAbility, onBattleStart, onVictory, onDefeat };
}
