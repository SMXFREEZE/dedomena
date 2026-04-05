"use client";

import { useState } from "react";

interface ConnectorIconProps {
  iconSlug?: string;
  name: string;
  color: string;
  size?: number;
  className?: string;
}

export function ConnectorIcon({ iconSlug, name, color, size = 20, className }: ConnectorIconProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/[\s\-_/]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  if (!iconSlug || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded font-bold select-none ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          backgroundColor: `${color}22`,
          color: color,
          fontSize: Math.max(8, Math.round(size * 0.38)),
        }}
      >
        {initials || name[0].toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${iconSlug}/ffffff`}
      alt={name}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain" }}
    />
  );
}
