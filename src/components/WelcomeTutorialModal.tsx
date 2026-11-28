import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { MainTab } from '../types/animefit';
import { Modal } from './Modal';

interface WelcomeTutorialModalProps {
  open: boolean;
  username: string;
  onClose: () => void;
}

interface TutorialStep {
  id: 'welcome' | MainTab;
  tabId?: MainTab;
  navLabel?: string;
  title: string;
  description: string;
  tip: string;
  accentHex: string;
  icon: typeof Dumbbell;
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a AnimeFit!',
    description:
      'Cada entrenamiento real en el gimnasio carga tu Ki, sube de nivel a tu guerrero y desbloquea nuevas fases.',
    tip: 'En la barra inferior tienes 5 pestañas principales. Toca Siguiente o elige cualquier icono arriba para ver para qué sirve.',
    accentHex: '#FACC15',
    icon: Sparkles,
  },
  {
    id: 'entrenar',
    tabId: 'entrenar',
    navLabel: 'Entrenar',
    title: 'Entrenar — Tus rutinas y series',
    description:
      'Crea tus propias plantillas con barras, mancuernas o máquinas Smith poniendo las series y repeticiones que prefieras.',
    tip: 'Sumas 1 XP cada 20 kg levantados. Desde la segunda sesión, superar tu PR anterior suma +15 XP por ejercicio.',
    accentHex: '#FACC15',
    icon: Dumbbell,
  },
  {
    id: 'historia',
    tabId: 'historia',
    navLabel: 'Historia',
    title: 'Historia — Campaña diaria',
    description:
      'Enfrenta capítulos y jefes anime (1 capítulo nuevo por día) vinculando tu rutina real de entrenamiento para cargar tu energía.',
    tip: 'Completa un capítulo diario para derrotar al jefe y sumar recompensas de XP.',
    accentHex: '#38BDF8',
    icon: BookOpen,
  },
  {
    id: 'pvp',
    tabId: 'pvp',
    navLabel: 'PvP',
    title: 'PvP — Duelos en tiempo real',
    description:
      'Reta a tus amigos por invitación directa o mediante un código de sala usando el nivel y fuerza real de tu guerrero.',
    tip: 'Entrenar con constancia mejora tu poder base y te da ventaja en los choques de Ki.',
    accentHex: '#22C55E',
    icon: Swords,
  },
  {
    id: 'personaje',
    tabId: 'personaje',
    navLabel: 'Guerrero',
    title: 'Guerrero — Tu perfil y récords',
    description:
      'Consulta la evolución de tu personaje anime, tu barra de XP hacia la siguiente fase, tus PRs e historial de entrenamientos.',
    tip: 'Desde aquí también puedes editar tu perfil físico cuando cambien tus metas.',
    accentHex: '#FACC15',
    icon: Zap,
  },
  {
    id: 'ranking',
    tabId: 'ranking',
    navLabel: 'Ranking',
    title: 'Ranking — Comunidad y amigos',
    description:
      'Compite en la tabla global de Ki, agrega amigos, únete a grupos y copia rutinas públicas de otros atletas en un toque.',
    tip: 'Publica tus mejores rutinas al guardarlas para compartirlas con la comunidad.',
    accentHex: '#38BDF8',
    icon: Trophy,
  },
];

const BOTTOM_TABS: Array<{ id: MainTab; label: string; icon: typeof Dumbbell }> = [
  { id: 'entrenar', label: 'Entrenar', icon: Dumbbell },
  { id: 'historia', label: 'Historia', icon: BookOpen },
  { id: 'pvp', label: 'PvP', icon: Swords },
  { id: 'personaje', label: 'Guerrero', icon: Zap },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
];

export function WelcomeTutorialModal({
  open,
  username,
  onClose,
}: WelcomeTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const current = STEPS[stepIndex] ?? STEPS[0];
  const Icon = current.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <Modal
      open={open}
      title={isFirst ? `Hola, ${username}` : `Guía rápida · ${stepIndex}/${STEPS.length - 1}`}
      onClose={onClose}
      maxWidthClass="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {/* Mini preview mirroring the 5-tab bottom bar */}
        <div
          aria-label="Vista previa de la barra inferior"
          className="grid grid-cols-5 rounded-xl bg-[#030406] border border-[#1B1E26] overflow-hidden"
        >
          {BOTTOM_TABS.map((tab, idx) => {
            const TabIcon = tab.icon;
            const targetStepIdx = idx + 1;
            const isHighlighted =
              current.id === 'welcome' || current.tabId === tab.id;
            const isExactTab = current.tabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStepIndex(targetStepIdx)}
                className={`min-h-[52px] flex flex-col items-center justify-center gap-1 border-t-2 transition-colors px-1 ${
                  isExactTab
                    ? 'border-[#FACC15] text-[#FACC15] bg-[#FACC15]/10'
                    : isHighlighted
                    ? 'border-transparent text-[#E2E8F0] hover:bg-[#101218]'
                    : 'border-transparent text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#101218]/60'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active step explanation */}
        <div className="rounded-2xl bg-[#07080B] border border-[#1B1E26] p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl border border-[#1B1E26] bg-[#0A0B0F] flex items-center justify-center shrink-0"
              style={{ color: current.accentHex }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#8A92A2]">
                Paso {stepIndex + 1} de {STEPS.length}
                {current.navLabel ? ` · Pestaña ${current.navLabel}` : ''}
              </div>
              <h4 className="text-base font-extrabold text-[#F1F5F9] leading-snug mt-0.5">
                {current.title}
              </h4>
            </div>
          </div>

          <p className="text-sm text-[#CBD5E1] leading-relaxed">
            {current.description}
          </p>

          <p className="text-xs text-[#8A92A2] leading-relaxed border-t border-[#1B1E26]/80 pt-2.5">
            {current.tip}
          </p>
        </div>

        {/* Step dots + action controls */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Pasos del tutorial">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                aria-label={`Ir al paso ${idx + 1}: ${step.title}`}
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-5 bg-[#FACC15]'
                    : 'w-2 bg-[#1B1E26] hover:bg-[#475569]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isFirst ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-3 rounded-xl text-xs font-semibold text-[#8A92A2] hover:text-[#F1F5F9] whitespace-nowrap"
              >
                Omitir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                className="min-h-[42px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1 whitespace-nowrap hover:border-[#38BDF8]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() =>
                  setStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))
                }
                className="min-h-[42px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold whitespace-nowrap"
              >
                ¡Empezar!
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
