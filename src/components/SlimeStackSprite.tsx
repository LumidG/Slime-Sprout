import React from 'react';
import type { Slime } from '../types';
import {
  withSlimeVisualDefaults,
  slimeBodySrc,
  slimeEyesSrc,
  slimeAccessorySrc,
} from '../slimeSprites';

const sizeMap = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
  '2xl': 'h-40 w-40',
} as const;

type Size = keyof typeof sizeMap;

type Props = {
  slime: Slime;
  size?: Size;
  className?: string;
  /** Corner radius for the frame (default: soft square, not a circle, so the full art stays visible). */
  roundedClassName?: string;
};

/**
 * Renders a slime in layer order: body, eyes (optional if `slimeEyes === 0`), accessory (optional).
 */
export function SlimeStackSprite({
  slime,
  size = 'md',
  className = '',
  roundedClassName = 'rounded-xl',
}: Props) {
  const v = withSlimeVisualDefaults(slime);
  const dim = sizeMap[size] ?? sizeMap.md;
  return (
    <div
      className={`relative ${dim} shrink-0 overflow-hidden ${roundedClassName} ${className}`}
    >
      <img
        src={slimeBodySrc(v.slimeBody)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        draggable={false}
      />
      {v.slimeEyes > 0 && (
        <img
          src={slimeEyesSrc(v.slimeEyes)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      )}
      {v.slimeAccessory > 0 && (
        <img
          src={slimeAccessorySrc(v.slimeAccessory)}
          alt=""
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill"
          draggable={false}
        />
      )}
    </div>
  );
}
