import { useEffect, useState } from 'react';
import { CHARACTER_IMAGES } from '../data/characterImages';
import { getCharacterById } from '../utils/animefit';

interface CharacterAvatarProps {
  charId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 28,
  sm: 44,
  md: 64,
  lg: 92,
  xl: 120,
};

export function CharacterAvatar({
  charId,
  size = 'md',
  className = '',
}: CharacterAvatarProps) {
  const char = getCharacterById(charId);
  const src = CHARACTER_IMAGES[charId] || CHARACTER_IMAGES.goku;
  const px = SIZE_MAP[size];
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [charId, src]);

  return (
    <div
      style={{
        width: px,
        height: px,
        borderColor: `${char.auraColor}99`,
        boxShadow:
          size === 'xl' || size === 'lg'
            ? `0 0 22px ${char.auraColor}44`
            : undefined,
      }}
      className={`relative rounded-full overflow-hidden border-2 shrink-0 bg-[#030406] select-none ${className}`}
      title={`${char.name} (${char.anime})`}
    >
      {!imgFailed && src ? (
        <img
          src={src}
          alt={char.name}
          width={px}
          height={px}
          referrerPolicy="no-referrer"
          loading={size === 'xl' || size === 'lg' ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top block"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-black text-[#F1F5F9]"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${char.auraColor}55, #07080B 78%)`,
            fontSize: Math.max(12, Math.round(px * 0.4)),
          }}
        >
          {char.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15"
      />
    </div>
  );
}
