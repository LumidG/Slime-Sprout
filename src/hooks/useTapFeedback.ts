import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let tapCtx: AudioContext | null = null;

function playButtonTapSound(opts: {
  canPlay: boolean;
  enabled: boolean;
  volume: number;
}): void {
  const { canPlay, enabled, volume } = opts;
  if (!canPlay || !enabled || volume <= 0) return;
  try {
    if (!tapCtx) {
      tapCtx = new AudioContext();
    }
    void tapCtx.resume();

    const ctx = tapCtx;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.42, volume * 0.33);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.036);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.048);
    osc.connect(g);
    g.connect(master);
    master.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.055);
  } catch (e) {
    console.error('Button tap SFX:', e);
  }
}

function triggerTapHaptic(hapticsEnabled: boolean): void {
  if (!hapticsEnabled) return;
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Call when the user turns vibration on in settings so they feel a sample. */
export function triggerPreviewHaptic(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/**
 * Short UI click on all primary buttons under `#root` (capture phase).
 * Respects SFX volume and a separate haptics toggle.
 */
export function useGlobalButtonTapFeedback(
  canPlay: boolean,
  sfxEnabled: boolean,
  hapticsEnabled: boolean
): void {
  const optsRef = useRef({ canPlay, sfxEnabled, hapticsEnabled });
  optsRef.current = { canPlay, sfxEnabled, hapticsEnabled };

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest('button, [role="button"]');
      if (!el) return;
      if (el.hasAttribute('data-no-tap-feedback')) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      if (el.getAttribute('aria-disabled') === 'true') return;

      const o = optsRef.current;
      playButtonTapSound({
        canPlay: o.canPlay,
        enabled: o.sfxEnabled,
        volume: o.sfxEnabled ? 1 : 0,
      });
      triggerTapHaptic(o.hapticsEnabled);
    };

    root.addEventListener('pointerdown', onPointerDown, true);
    return () => root.removeEventListener('pointerdown', onPointerDown, true);
  }, []);
}
