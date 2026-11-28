import { useEffect, useMemo, useState } from 'react';
import {
  getCharacterImageCandidates,
  getPhaseVisualProfile,
} from '../data/characterImages';
import { getCharacterById } from '../utils/animefit';

interface CharacterAvatarProps {
  charId: string;
  stageName?: string;
  level?: number;
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
  stageName,
  level,
  size = 'md',
  className = '',
}: CharacterAvatarProps) {
  const char = getCharacterById(charId);
  const phaseVisual = useMemo(
    () => getPhaseVisualProfile(charId, stageName, level),
    [charId, stageName, level]
  );
  const candidates = useMemo(
    () => getCharacterImageCandidates(charId, stageName, level),
    [charId, stageName, level]
  );
  const px = SIZE_MAP[size];
  const [candidateIdx, setCandidateIdx] = useState(0);

  useEffect(() => {
    setCandidateIdx(0);
  }, [charId, phaseVisual.stageName, candidates.length]);

  const currentSrc =
    candidateIdx < candidates.length ? candidates[candidateIdx] : null;
  const ringColor = phaseVisual.auraColor || char.auraColor;

  return (
    <div
      style={{
        width: px,
        height: px,
        borderColor: `${ringColor}B3`,
        boxShadow:
          size === 'xl' || size === 'lg'
            ? `0 0 22px ${phaseVisual.glowRgba}`
            : phaseVisual.stageIndex > 0 && size === 'md'
            ? `0 0 12px ${phaseVisual.glowRgba}`
            : undefined,
      }}
      className={`relative rounded-full overflow-hidden border-2 shrink-0 bg-[#030406] select-none ${className}`}
      title={`${char.name} · ${phaseVisual.stageName} (${char.anime})`}
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={`${char.name} — ${phaseVisual.stageName}`}
          width={px}
          height={px}
          referrerPolicy="no-referrer"
          loading={size === 'xl' || size === 'lg' ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setCandidateIdx((idx) => idx + 1)}
          style={
            phaseVisual.imageFilter !== 'none'
              ? { filter: phaseVisual.imageFilter }
              : undefined
          }
          className="w-full h-full object-cover object-top block"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-black text-[#F1F5F9]"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${ringColor}55, #07080B 78%)`,
            fontSize: Math.max(12, Math.round(px * 0.4)),
          }}
        >
          {char.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      {phaseVisual.overlayGradient !== 'none' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: phaseVisual.overlayGradient }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15"
      />
    </div>
  );
}
