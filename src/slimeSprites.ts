import type { Slime } from './types';

/**
 * Stacked body / eyes / accessory PNGs: same canvas size, layered with no
 * per-layer offset — DOM uses `object-fill`, canvas stretches to the draw size.
 */
export const SLIME_SPRITE_BODY_MAX = 8;
export const SLIME_SPRITE_EYES_MAX = 4;
export const SLIME_SPRITE_ACCESSORY_MAX = 6;

function hashStringToUint(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic appearance for a slime id (used for save migration and stable fallbacks). */
export function visualsFromSlimeId(id: string): {
  slimeBody: number;
  slimeEyes: number;
  slimeAccessory: number;
} {
  const h = hashStringToUint(id);
  const body = 1 + (h % SLIME_SPRITE_BODY_MAX);
  const eyes = 1 + ((h >> 8) % SLIME_SPRITE_EYES_MAX);
  const accRoll = (h >> 16) % 100;
  const accMax = SLIME_SPRITE_ACCESSORY_MAX;
  const accessory = accRoll < 38 ? 0 : 1 + ((h >> 24) % accMax);
  return { slimeBody: body, slimeEyes: eyes, slimeAccessory: accessory };
}

export function rollNewSlimeVisuals(): {
  slimeBody: number;
  slimeEyes: number;
  slimeAccessory: number;
} {
  const slimeBody = 1 + Math.floor(Math.random() * SLIME_SPRITE_BODY_MAX);
  const slimeEyes = 1 + Math.floor(Math.random() * SLIME_SPRITE_EYES_MAX);
  const aMax = SLIME_SPRITE_ACCESSORY_MAX;
  const slimeAccessory = Math.random() < 0.38 ? 0 : 1 + Math.floor(Math.random() * aMax);
  return { slimeBody, slimeEyes, slimeAccessory };
}

function mixIndex(na: number, nb: number, max: number, mutateChance: number): number {
  if (Math.random() < mutateChance) {
    return 1 + Math.floor(Math.random() * max);
  }
  return Math.random() < 0.5 ? na : nb;
}

function mixAccessory(na: number, nb: number, mutateChance: number): number {
  if (Math.random() < mutateChance) {
    if (Math.random() < 0.36) return 0;
    return 1 + Math.floor(Math.random() * SLIME_SPRITE_ACCESSORY_MAX);
  }
  return Math.random() < 0.5 ? na : nb;
}

/** Remap out-of-range body indices (e.g. if asset count changes) into 1..MAX. */
function mapLegacySlimeBody(n: number, fallback: number): number {
  if (!Number.isInteger(n) || n < 1) return fallback;
  if (n > SLIME_SPRITE_BODY_MAX) {
    return 1 + ((n - 1) % SLIME_SPRITE_BODY_MAX);
  }
  return n;
}

function mapLegacySlimeEyes(n: number, fallback: number): number {
  if (n === 0) return 0;
  if (!Number.isInteger(n) || n < 1 || n > SLIME_SPRITE_EYES_MAX) {
    return fallback;
  }
  return n;
}

function mapLegacySlimeAccessory(n: number, fallback: number): number {
  if (n === 0) return 0;
  if (!Number.isInteger(n) || n < 0) return fallback;
  if (n > SLIME_SPRITE_ACCESSORY_MAX) {
    return 1 + ((n - 1) % SLIME_SPRITE_ACCESSORY_MAX);
  }
  return n;
}

export function breedSlimeVisuals(
  a: Pick<Slime, 'slimeBody' | 'slimeEyes' | 'slimeAccessory'>,
  b: Pick<Slime, 'slimeBody' | 'slimeEyes' | 'slimeAccessory'>
): { slimeBody: number; slimeEyes: number; slimeAccessory: number } {
  const ab = mapLegacySlimeBody(a.slimeBody, 1);
  const bb = mapLegacySlimeBody(b.slimeBody, 1);
  const ae = mapLegacySlimeEyes(a.slimeEyes, 1);
  const be = mapLegacySlimeEyes(b.slimeEyes, 1);
  const ar = mapLegacySlimeAccessory(a.slimeAccessory, 0);
  const br = mapLegacySlimeAccessory(b.slimeAccessory, 0);
  return {
    slimeBody: mapLegacySlimeBody(mixIndex(ab, bb, SLIME_SPRITE_BODY_MAX, 0.14), 1),
    slimeEyes: mapLegacySlimeEyes(mixIndex(ae, be, SLIME_SPRITE_EYES_MAX, 0.12), 1),
    slimeAccessory: mapLegacySlimeAccessory(mixAccessory(ar, br, 0.16), 0),
  };
}

export function withSlimeVisualDefaults(s: Slime): Slime {
  const d = visualsFromSlimeId(s.id);
  const bodyRaw =
    typeof s.slimeBody === 'number' && Number.isInteger(s.slimeBody) && s.slimeBody >= 1 ? s.slimeBody : d.slimeBody;
  const body = mapLegacySlimeBody(bodyRaw, d.slimeBody);
  const eyesRaw =
    typeof s.slimeEyes === 'number' && Number.isInteger(s.slimeEyes) && s.slimeEyes >= 0 ? s.slimeEyes : d.slimeEyes;
  const eyes = eyesRaw === 0 ? 0 : mapLegacySlimeEyes(eyesRaw, d.slimeEyes);
  const accRaw =
    typeof s.slimeAccessory === 'number' && Number.isInteger(s.slimeAccessory) && s.slimeAccessory >= 0
      ? s.slimeAccessory
      : d.slimeAccessory;
  const slimeAccessory = mapLegacySlimeAccessory(accRaw, d.slimeAccessory);
  return { ...s, slimeBody: body, slimeEyes: eyes, slimeAccessory };
}

export function slimeBodySrc(n: number): string {
  return `/s_Slime${n}.png`;
}
export function slimeEyesSrc(n: number): string {
  return `/s_Eyes${n}.png`;
}
export function slimeAccessorySrc(n: number): string {
  return `/s_Accessory${n}.png`;
}

export const ALL_SLIME_SPRITE_URLS: string[] = (() => {
  const u: string[] = [];
  for (let i = 1; i <= SLIME_SPRITE_BODY_MAX; i++) u.push(slimeBodySrc(i));
  for (let i = 1; i <= SLIME_SPRITE_EYES_MAX; i++) u.push(slimeEyesSrc(i));
  for (let i = 1; i <= SLIME_SPRITE_ACCESSORY_MAX; i++) u.push(slimeAccessorySrc(i));
  return u;
})();

export function loadSlimeSpriteImageCache(): Promise<Map<string, HTMLImageElement>> {
  const m = new Map<string, HTMLImageElement>();
  return Promise.all(
    ALL_SLIME_SPRITE_URLS.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            m.set(url, img);
            resolve();
          };
          img.onerror = () => {
            resolve();
          };
          img.src = url;
        })
    )
  ).then(() => m);
}

/**
 * Draw stacked slime, eyes, accessory in order (1→2→3) in a `size`×`size` square at the current transform origin.
 * @returns true if all needed images were in the cache and drawn.
 */
export function drawSlimeSpriteStack(
  ctx: CanvasRenderingContext2D,
  cache: Map<string, HTMLImageElement>,
  slime: Slime,
  size: number
): boolean {
  const v = withSlimeVisualDefaults(slime);
  const bodyUrl = slimeBodySrc(v.slimeBody);
  const eyesUrl = v.slimeEyes > 0 ? slimeEyesSrc(v.slimeEyes) : null;
  const accUrl = v.slimeAccessory > 0 ? slimeAccessorySrc(v.slimeAccessory) : null;
  const body = cache.get(bodyUrl);
  const eyes = eyesUrl ? cache.get(eyesUrl) : null;
  if (!body || !body.complete) {
    return false;
  }
  if (eyesUrl && (!eyes || !eyes.complete)) {
    return false;
  }
  if (accUrl) {
    const acc = cache.get(accUrl);
    if (!acc || !acc.complete) {
      return false;
    }
  }
  /** Same as CSS `object-fill`: each layer fills the `size`×`size` box (no per-image contain/center). */
  const draw = (im: HTMLImageElement) => {
    if (im.naturalWidth < 1 || im.naturalHeight < 1) return;
    ctx.drawImage(im, -size * 0.5, -size * 0.5, size, size);
  };
  draw(body);
  if (eyes) draw(eyes);
  if (accUrl) {
    const acc = cache.get(accUrl);
    if (acc) draw(acc);
  }
  return true;
}
