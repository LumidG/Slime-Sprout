import React from 'react';
import type { Slime } from '../types';
import {
  withSlimeVisualDefaults,
  slimeBodySrc,
  slimeEyesSrc,
  slimeAccessorySrc,
} from '../slimeSprites';

const sizeMap = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-20 w-20',
  '2xl': 'h-40 w-40',
} as const;

type Size = keyof typeof sizeMap;

type Props = {
  slime: Slime;
  size?: Size;
  className?: string;
  /** e.g. ring when selected — default rounded-full. */
  roundedClassName?: string;
};

/**
 * Renders a slime in layer order: body, eyes, accessory (optional). Eyes are always present.
 */
export function SlimeStackSprite({
  slime,
  size = 'md',
  className = '',
  roundedClassName = 'rounded-full',
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
      <img
        src={slimeEyesSrc(v.slimeEyes)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        draggable={false}
      />
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
