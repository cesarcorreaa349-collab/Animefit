import { Flame, Shield, Sparkles, Swords } from 'lucide-react';
import type { PhaseMoveset } from '../types/animefit';

interface PhaseMovesetPreviewProps {
  moveset: PhaseMoveset;
  compact?: boolean;
}

export function PhaseMovesetPreview({
  moveset,
  compact = false,
}: PhaseMovesetPreviewProps) {
  const slots = [
    {
      key: 'physical',
      slotLabel: 'Ataque físico · +30% Ki',
      name: moveset.physical.name,
      effect: moveset.physical.effect,
      icon: Swords,
      accent: '#38BDF8',
    },
    {
      key: 'special',
      slotLabel: 'Técnica especial · 40% Ki',
      name: moveset.special.name,
      effect: moveset.special.effect,
      icon: Sparkles,
      accent: moveset.accentColor || '#FACC15',
    },
    {
      key: 'guard',
      slotLabel: 'Defensa · +8% HP',
      name: moveset.guard.name,
      effect: moveset.guard.effect,
      icon: Shield,
      accent: '#22C55E',
    },
    {
      key: 'ultimate',
      slotLabel: 'Definitiva · 100% Ki',
      name: moveset.ultimate.name,
      effect: moveset.ultimate.effect,
      icon: Flame,
      accent: '#F97316',
    },
  ];

  return (
    <div className={compact ? 'pt-3 border-t border-[#1B1E26]' : 'pt-4 border-t border-[#1B1E26]'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2.5 text-left">
        <div className="text-xs font-extrabold text-[#F1F5F9]">
          Movimientos PvP ·{' '}
          <span style={{ color: moveset.accentColor }}>{moveset.stageName}</span>
        </div>
        <div className="text-[11px] font-semibold text-[#8A92A2]">
          {moveset.styleLabel} · {moveset.elementTag}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
        {slots.map((slot) => {
          const Icon = slot.icon;
          return (
            <div
              key={slot.key}
              className="flex items-start gap-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26] px-3 py-2"
            >
              <Icon
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: slot.accent }}
              />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A92A2] leading-tight">
                  {slot.slotLabel}
                </div>
                <div className="text-xs font-extrabold text-[#F1F5F9] truncate mt-0.5">
                  {slot.name}
                </div>
                {!compact && (
                  <div className="text-[11px] text-[#8A92A2] leading-snug mt-0.5">
                    {slot.effect}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
