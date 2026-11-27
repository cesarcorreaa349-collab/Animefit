import { ExerciseMuscle } from '../types/animefit';

interface ExerciseSvgProps {
  muscle: ExerciseMuscle;
}

export function ExerciseSvg({ muscle }: ExerciseSvgProps) {
  const highlight = '#FACC15';
  const body = '#1B1E26';
  const aura = '#38BDF8';

  const renderMuscleFocus = () => {
    switch (muscle) {
      case 'Pecho':
        return <rect x="78" y="54" width="44" height="22" rx="6" fill={highlight} />;
      case 'Espalda':
        return <polygon points="75,52 125,52 115,92 85,92" fill={highlight} />;
      case 'Hombros':
        return (
          <>
            <circle cx="72" cy="56" r="10" fill={highlight} />
            <circle cx="128" cy="56" r="10" fill={highlight} />
          </>
        );
      case 'Bíceps':
        return (
          <>
            <rect x="56" y="60" width="13" height="22" rx="6" fill={highlight} />
            <rect x="131" y="60" width="13" height="22" rx="6" fill={highlight} />
          </>
        );
      case 'Tríceps':
        return (
          <>
            <rect x="54" y="58" width="14" height="30" rx="6" fill={highlight} />
            <rect x="132" y="58" width="14" height="30" rx="6" fill={highlight} />
            <rect x="57" y="63" width="6" height="20" rx="3" fill={body} opacity="0.45" />
            <rect x="137" y="63" width="6" height="20" rx="3" fill={body} opacity="0.45" />
          </>
        );
      case 'Abdomen':
        return <rect x="86" y="78" width="28" height="34" rx="5" fill={highlight} />;
      case 'Piernas':
        return (
          <>
            <rect x="78" y="116" width="18" height="54" rx="7" fill={highlight} />
            <rect x="104" y="116" width="18" height="54" rx="7" fill={highlight} />
          </>
        );
      case 'Glúteos':
        return <ellipse cx="100" cy="116" rx="22" ry="12" fill={highlight} />;
      case 'Cardio':
        return (
          <path
            d="M100 56 C100 50 90 50 90 58 C90 66 100 72 100 72 C100 72 110 66 110 58 C110 50 100 50 100 56 Z"
            fill={highlight}
          />
        );
      default:
        return (
          <>
            <rect x="55" y="60" width="14" height="36" rx="6" fill={highlight} />
            <rect x="131" y="60" width="14" height="36" rx="6" fill={highlight} />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 200 185"
      aria-label={`Diagrama muscular enfocado en ${muscle}`}
      className="w-full max-h-[175px] bg-[#030406] rounded-xl border border-[#1B1E26]"
    >
      <circle
        cx="100"
        cy="92"
        r="76"
        fill="none"
        stroke={aura}
        strokeOpacity="0.25"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <circle cx="100" cy="28" r="14" fill={body} stroke={aura} strokeWidth="1.5" />
      <rect x="76" y="48" width="48" height="66" rx="10" fill={body} />
      <rect x="55" y="54" width="14" height="48" rx="6" fill={body} />
      <rect x="131" y="54" width="14" height="48" rx="6" fill={body} />
      <rect x="78" y="116" width="18" height="56" rx="7" fill={body} />
      <rect x="104" y="116" width="18" height="56" rx="7" fill={body} />
      {renderMuscleFocus()}
      <text
        x="100"
        y="178"
        textAnchor="middle"
        fill="#8A92A2"
        fontSize="10"
        fontWeight="bold"
      >
        Zona enfoque: {muscle}
      </text>
    </svg>
  );
}
