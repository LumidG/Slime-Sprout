import { useEffect, useRef } from 'react';

/** Served from `public/blossom.wav` (Vite root URL). */
export const BLOSSOM_MUSIC_URL = '/blossom.wav';

/** Served from `public/boss battle.wav` (space encoded for URL). */
export const BOSS_BATTLE_MUSIC_URL = '/boss%20battle.wav';

/**
 * Plays the main looped soundtrack via Web Audio API (`loop` on a decoded buffer)
 * for gapless repeats. Respects browser autoplay policy: pass `canPlay` only after
 * a user gesture (e.g. tap past splash).
 */
export function useBlossomMusic(
  canPlay: boolean,
  enabled: boolean,
  volume: number,
  trackUrl: string = BLOSSOM_MUSIC_URL
): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    const g = gainRef.current;
    if (!g) return;
    const ctx = g.context as AudioContext;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(enabled ? volume : 0, t);
  }, [enabled, volume]);

  useEffect(() => {
    if (!canPlay || !enabled) {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          /* already stopped */
        }
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      gainRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext();
        }
        const ctx = ctxRef.current;
        await ctx.resume();

        let buffer = bufferCacheRef.current.get(trackUrl);
        if (!buffer) {
          const res = await fetch(trackUrl);
          if (!res.ok) {
            throw new Error(`Failed to load ${trackUrl} (${res.status})`);
          }
          const raw = await res.arrayBuffer();
          buffer = await ctx.decodeAudioData(raw.slice(0));
          bufferCacheRef.current.set(trackUrl, buffer);
        }

        if (cancelled) return;

        if (sourceRef.current) {
          try {
            sourceRef.current.stop();
          } catch {
            /* noop */
          }
          sourceRef.current.disconnect();
        }

        const gain = ctx.createGain();
        gain.gain.value = enabled ? volumeRef.current : 0;
        gainRef.current = gain;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        sourceRef.current = source;
      } catch (e) {
        console.error('Blossom music:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          /* noop */
        }
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      gainRef.current = null;
    };
  }, [canPlay, enabled, trackUrl]);
}
