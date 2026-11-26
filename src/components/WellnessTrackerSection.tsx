import { useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BellOff,
  Check,
  ExternalLink,
  Footprints,
  Info,
  Lock,
  Minus,
  Moon,
  Plus,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import { PedometerStatus } from '../hooks/useAutoPedometer';
import {
  DailyWellnessLog,
  DailyWellnessState,
  SleepQuality,
  UserProfile,
} from '../types/animefit';
import { Modal } from './Modal';

export const MIN_STEP_GOAL = 3000;

export function getLocalDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDefaultWellnessState(
  raw?: DailyWellnessState
): DailyWellnessState {
  return {
    stepGoal:
      raw && Number.isFinite(raw.stepGoal) && raw.stepGoal >= MIN_STEP_GOAL
        ? Math.min(50000, Math.round(raw.stepGoal))
        : 8000,
    sleepGoal:
      raw && Number.isFinite(raw.sleepGoal) && raw.sleepGoal >= 4
        ? Math.min(14, Math.round(raw.sleepGoal * 10) / 10)
        : 8,
    logs: raw?.logs && typeof raw.logs === 'object' ? raw.logs : {},
  };
}

export function getTodayWellnessLog(
  user: UserProfile,
  dateKey = getLocalDateKey()
): DailyWellnessLog {
  const state = getDefaultWellnessState(user.wellness);
  const existing = state.logs[dateKey];
  if (existing) {
    return {
      date: dateKey,
      steps: Math.max(0, Math.round(Number(existing.steps) || 0)),
      stepGoal: Math.max(
        MIN_STEP_GOAL,
        Math.min(50000, Math.round(Number(existing.stepGoal) || state.stepGoal))
      ),
      sleepHours: Math.max(0, Math.min(24, Number(existing.sleepHours) || 0)),
      sleepGoal: Math.max(4, Math.min(14, Number(existing.sleepGoal) || state.sleepGoal)),
      sleepQuality: existing.sleepQuality,
      bedTime: existing.bedTime,
      wakeTime: existing.wakeTime,
      stepsXpAwarded: Boolean(existing.stepsXpAwarded),
      sleepXpAwarded: Boolean(existing.sleepXpAwarded),
    };
  }
  return {
    date: dateKey,
    steps: 0,
    stepGoal: state.stepGoal,
    sleepHours: 0,
    sleepGoal: state.sleepGoal,
  };
}

function pruneRecentLogs(
  logs: Record<string, DailyWellnessLog>
): Record<string, DailyWellnessLog> {
  const keys = Object.keys(logs).sort().slice(-30);
  const out: Record<string, DailyWellnessLog> = {};
  for (const k of keys) {
    out[k] = logs[k];
  }
  return out;
}

function calculateSleepHoursBetween(bedTime: string, wakeTime: string): number | null {
  const bMatch = /^(\d{2}):(\d{2})$/.exec(bedTime.trim());
  const wMatch = /^(\d{2}):(\d{2})$/.exec(wakeTime.trim());
  if (!bMatch || !wMatch) return null;
  const bMin = Number(bMatch[1]) * 60 + Number(bMatch[2]);
  const wMin = Number(wMatch[1]) * 60 + Number(wMatch[2]);
  let diff = wMin - bMin;
  if (diff <= 0) diff += 24 * 60;
  const hours = Math.round((diff / 60) * 10) / 10;
  return Math.max(0, Math.min(24, hours));
}

const QUALITY_OPTIONS: Array<{
  id: SleepQuality;
  label: string;
}> = [
  { id: 'mala', label: 'Mala' },
  { id: 'regular', label: 'Regular' },
  { id: 'buena', label: 'Buena' },
  { id: 'excelente', label: 'Excelente' },
];

export function applyDetectedStepsToWellness(
  user: UserProfile,
  deltaSteps: number
): { nextWellness: DailyWellnessState; bonusXp: number; toastMsg?: string } {
  const todayKey = getLocalDateKey();
  const baseState = getDefaultWellnessState(user.wellness);
  const baseLog = getTodayWellnessLog(user, todayKey);
  const stepGoal = Math.max(
    MIN_STEP_GOAL,
    Math.min(50000, Math.round(baseState.stepGoal))
  );
  const nextSteps = Math.max(
    0,
    Math.min(60000, baseLog.steps + Math.max(0, Math.round(deltaSteps)))
  );

  const updatedLog: DailyWellnessLog = {
    ...baseLog,
    date: todayKey,
    steps: nextSteps,
    stepGoal,
  };

  let bonusXp = 0;
  let toastMsg: string | undefined;

  if (!updatedLog.stepsXpAwarded && updatedLog.steps >= stepGoal) {
    updatedLog.stepsXpAwarded = true;
    bonusXp = 20;
    toastMsg = '👟 ¡Meta diaria de pasos cumplida! +20 XP';
  }

  return {
    nextWellness: {
      stepGoal,
      sleepGoal: baseState.sleepGoal,
      logs: pruneRecentLogs({
        ...baseState.logs,
        [todayKey]: updatedLog,
      }),
    },
    bonusXp,
    toastMsg,
  };
}

interface WellnessTrackerSectionProps {
  user: UserProfile;
  pedometerStatus: PedometerStatus;
  hasMotionEvents: boolean;
  keepAliveEnabled: boolean;
  wakeLockActive: boolean;
  wakeLockSupported: boolean;
  onToggleKeepAlive: () => void;
  onRequestPedometerPermission: () => void;
  reminderSupported: boolean;
  reminderPermission: NotificationPermission | 'unsupported';
  reminderEnabled: boolean;
  hoursSinceActivity: number | null;
  onToggleReminder: () => void;
  onTestReminder: () => void;
  onUpdateWellness: (
    nextWellness: DailyWellnessState,
    bonusXp?: number,
    toastMsg?: string
  ) => void;
  onToast: (msg: string) => void;
}

export function WellnessTrackerSection({
  user,
  pedometerStatus,
  hasMotionEvents,
  keepAliveEnabled,
  wakeLockActive,
  wakeLockSupported,
  onToggleKeepAlive,
  onRequestPedometerPermission,
  reminderSupported,
  reminderPermission,
  reminderEnabled,
  hoursSinceActivity,
  onToggleReminder,
  onTestReminder,
  onUpdateWellness,
  onToast,
}: WellnessTrackerSectionProps) {
  const todayKey = getLocalDateKey();
  const state = getDefaultWellnessState(user.wellness);
  const todayLog = getTodayWellnessLog(user, todayKey);

  const latestLogRef = useRef(todayLog);
  const latestStateRef = useRef(state);
  latestLogRef.current = todayLog;
  latestStateRef.current = state;

  // Modals state (step goal only — steps cannot be edited manually)
  const [stepGoalModalOpen, setStepGoalModalOpen] = useState(false);
  const [stepGoalInput, setStepGoalInput] = useState('');

  const [sleepModalOpen, setSleepModalOpen] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState('');
  const [sleepGoalInput, setSleepGoalInput] = useState('');
  const [bedTimeInput, setBedTimeInput] = useState('23:00');
  const [wakeTimeInput, setWakeTimeInput] = useState('07:00');
  const [sleepQualityInput, setSleepQualityInput] =
    useState<SleepQuality>('buena');

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [pedometerInfoOpen, setPedometerInfoOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  const commitTodayUpdate = (
    patch: Partial<DailyWellnessLog>,
    nextStepGoal?: number,
    nextSleepGoal?: number
  ) => {
    const baseState = latestStateRef.current;
    const baseLog = latestLogRef.current;
    const stepGoal = Math.max(
      MIN_STEP_GOAL,
      Math.min(50000, Math.round(nextStepGoal ?? baseState.stepGoal))
    );
    const sleepGoal = Math.max(
      4,
      Math.min(14, Math.round((nextSleepGoal ?? baseState.sleepGoal) * 10) / 10)
    );

    const updatedLog: DailyWellnessLog = {
      ...baseLog,
      ...patch,
      date: todayKey,
      stepGoal,
      sleepGoal,
    };

    let bonusXp = 0;
    const toastParts: string[] = [];

    if (!updatedLog.stepsXpAwarded && updatedLog.steps >= stepGoal) {
      updatedLog.stepsXpAwarded = true;
      bonusXp += 20;
      toastParts.push('👟 ¡Meta diaria de pasos cumplida! +20 XP');
    }

    const sleepTargetForXp = Math.min(sleepGoal, 7);
    if (!updatedLog.sleepXpAwarded && updatedLog.sleepHours >= sleepTargetForXp) {
      updatedLog.sleepXpAwarded = true;
      bonusXp += 20;
      toastParts.push('🌙 ¡Buen descanso registrado! +20 XP');
    }

    const nextState: DailyWellnessState = {
      stepGoal,
      sleepGoal,
      logs: pruneRecentLogs({
        ...baseState.logs,
        [todayKey]: updatedLog,
      }),
    };

    onUpdateWellness(
      nextState,
      bonusXp,
      toastParts.length > 0 ? toastParts.join(' · ') : undefined
    );
  };

  const adjustSleepHours = (delta: number) => {
    const nextHours = Math.max(
      0,
      Math.min(24, Math.round((todayLog.sleepHours + delta) * 10) / 10)
    );
    commitTodayUpdate({ sleepHours: nextHours });
  };

  const openStepGoalModal = () => {
    setStepGoalInput(String(state.stepGoal));
    setStepGoalModalOpen(true);
  };

  const saveStepGoalModal = () => {
    const parsedGoal = Math.max(
      MIN_STEP_GOAL,
      Math.min(50000, Math.round(Number(stepGoalInput) || state.stepGoal))
    );
    commitTodayUpdate({}, parsedGoal, undefined);
    setStepGoalModalOpen(false);
    onToast(`Meta diaria actualizada: ${parsedGoal.toLocaleString('es-ES')} pasos`);
  };

  const openSleepModal = () => {
    setSleepHoursInput(
      todayLog.sleepHours > 0 ? String(todayLog.sleepHours) : '7.5'
    );
    setSleepGoalInput(String(state.sleepGoal));
    setBedTimeInput(todayLog.bedTime || '23:00');
    setWakeTimeInput(todayLog.wakeTime || '06:30');
    setSleepQualityInput(todayLog.sleepQuality || 'buena');
    setSleepModalOpen(true);
  };

  const handleTimeChange = (nextBed: string, nextWake: string) => {
    setBedTimeInput(nextBed);
    setWakeTimeInput(nextWake);
    const calc = calculateSleepHoursBetween(nextBed, nextWake);
    if (calc !== null) {
      setSleepHoursInput(String(calc));
    }
  };

  const saveSleepModal = () => {
    const parsedHours = Math.max(
      0,
      Math.min(24, Math.round((Number(sleepHoursInput) || 0) * 10) / 10)
    );
    const parsedGoal = Math.max(
      4,
      Math.min(14, Math.round((Number(sleepGoalInput) || state.sleepGoal) * 10) / 10)
    );
    commitTodayUpdate(
      {
        sleepHours: parsedHours,
        sleepQuality: sleepQualityInput,
        bedTime: bedTimeInput,
        wakeTime: wakeTimeInput,
      },
      undefined,
      parsedGoal
    );
    setSleepModalOpen(false);
    onToast(`Sueño guardado: ${parsedHours} h`);
  };

  // Ring math
  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  const stepsPct = Math.min(100, Math.round((todayLog.steps / state.stepGoal) * 100));
  const stepsDashOffset = circumference * (1 - stepsPct / 100);
  const stepsDone = todayLog.steps >= state.stepGoal;
  const estKm = (todayLog.steps * 0.00075).toFixed(1);
  const estKcal = Math.round(todayLog.steps * 0.04);

  const sleepPct = Math.min(
    100,
    Math.round((todayLog.sleepHours / state.sleepGoal) * 100)
  );
  const sleepDashOffset = circumference * (1 - sleepPct / 100);
  const sleepStatus =
    todayLog.sleepHours === 0
      ? { label: 'Sin registro', color: 'text-[#8A92A2]' }
      : todayLog.sleepHours >= state.sleepGoal
      ? { label: 'Descanso óptimo', color: 'text-[#22C55E]' }
      : todayLog.sleepHours >= 6.5
      ? { label: 'Recuperación media', color: 'text-[#38BDF8]' }
      : { label: 'Falta descanso', color: 'text-[#F59E0B]' };

  const last7Days = useMemo(() => {
    const out: Array<{
      dateKey: string;
      label: string;
      steps: number;
      stepGoal: number;
      sleepHours: number;
      sleepGoal: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const entry = state.logs[key];
      const dayLabel =
        i === 0
          ? 'Hoy'
          : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      out.push({
        dateKey: key,
        label: dayLabel,
        steps: entry?.steps || 0,
        stepGoal: entry?.stepGoal || state.stepGoal,
        sleepHours: entry?.sleepHours || 0,
        sleepGoal: entry?.sleepGoal || state.sleepGoal,
      });
    }
    return out;
  }, [state.logs, state.stepGoal, state.sleepGoal]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-extrabold text-[#F1F5F9]">
          Actividad y Descanso Hoy
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setReminderModalOpen(true)}
            className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
              reminderEnabled
                ? 'bg-[#1E40AF]/30 border-[#38BDF8]/60 text-[#F1F5F9]'
                : 'bg-[#101218] border-[#1B1E26] hover:border-[#38BDF8] text-[#8A92A2] hover:text-[#F1F5F9]'
            }`}
          >
            {reminderEnabled ? (
              <Bell className="w-3.5 h-3.5 text-[#22C55E]" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-[#8A92A2]" />
            )}
            Recordatorio 24h
          </button>
          <button
            type="button"
            onClick={() => setHistoryModalOpen(true)}
            className="min-h-[34px] px-2.5 rounded-lg bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#38BDF8]" />
            Últimos 7 días
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step Counter Card */}
        <article className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#38BDF8] shrink-0">
                <Footprints className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#F1F5F9] truncate">
                Contador de Pasos
              </h4>
            </div>
            <span
              className={`text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                pedometerStatus === 'active'
                  ? 'text-[#22C55E]'
                  : pedometerStatus === 'needs_permission'
                  ? 'text-[#38BDF8]'
                  : pedometerStatus === 'denied' ||
                    pedometerStatus === 'iframe_blocked'
                  ? 'text-[#F59E0B]'
                  : 'text-[#8A92A2]'
              }`}
            >
              {pedometerStatus === 'unsupported' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Sin sensor
                </>
              ) : pedometerStatus === 'needs_permission' ? (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Requiere permiso
                </>
              ) : pedometerStatus === 'iframe_blocked' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Bloqueado en vista previa
                </>
              ) : pedometerStatus === 'denied' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Permiso bloqueado
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Automático
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-[72px] h-[72px] shrink-0 flex items-center justify-center">
              <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 72 72">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke="#1B1E26"
                  strokeWidth="6"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke={stepsDone ? '#22C55E' : '#38BDF8'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={stepsDashOffset}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute text-xs font-black text-[#F1F5F9] tabular-nums">
                {stepsPct}%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap tabular-nums">
                <span className="text-2xl font-black text-[#F1F5F9]">
                  {todayLog.steps.toLocaleString('es-ES')}
                </span>
                <span className="text-xs text-[#8A92A2] font-semibold">
                  / {state.stepGoal.toLocaleString('es-ES')} pasos
                </span>
              </div>
              <div className="text-xs text-[#8A92A2] mt-1 tabular-nums">
                ~{estKm} km · ~{estKcal} kcal
                {stepsDone ? (
                  <span className="text-[#22C55E] font-bold"> · Meta +20 XP</span>
                ) : null}
              </div>
            </div>
          </div>

          {pedometerStatus === 'needs_permission' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRequestPedometerPermission}
                className="min-h-[40px] flex-1 px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold whitespace-nowrap"
              >
                Permitir conteo automático
              </button>
              <button
                type="button"
                onClick={openStepGoalModal}
                className="min-h-[40px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#38BDF8]" />
                Meta
              </button>
            </div>
          ) : pedometerStatus === 'iframe_blocked' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-[#8A92A2] leading-snug">
                La vista previa de AI Studio bloquea el sensor del teléfono. Abre la app en una pestaña propia o instálala para contar pasos.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] flex-1 px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir app para activar sensor
                </a>
                <button
                  type="button"
                  onClick={openStepGoalModal}
                  className="min-h-[40px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Meta
                </button>
              </div>
            </div>
          ) : pedometerStatus === 'denied' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-[#8A92A2] leading-snug">
                Tu navegador bloqueó el sensor. Toca el candado o el escudo junto a la URL → <strong className="text-[#F1F5F9]">Permisos / Sensores de movimiento → Permitir</strong> y reintenta.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRequestPedometerPermission}
                  className="min-h-[40px] flex-1 px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold whitespace-nowrap"
                >
                  Reintentar permiso
                </button>
                <button
                  type="button"
                  onClick={openStepGoalModal}
                  className="min-h-[40px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Meta
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 min-h-[40px] px-3 rounded-xl bg-[#07080B] border border-[#1B1E26]">
                <div className="flex items-center gap-2 min-w-0">
                  {pedometerStatus === 'active' ? (
                    <Activity className="w-4 h-4 text-[#22C55E] shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-[#8A92A2] shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold text-[#8A92A2] truncate">
                    {pedometerStatus === 'active'
                      ? wakeLockActive
                        ? 'Modo caminata activo · No se suspende'
                        : hasMotionEvents
                        ? 'Conteo automático por movimiento real'
                        : 'Conteo automático listo · Camina para sumar'
                      : 'Solo conteo automático por sensor móvil'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openStepGoalModal}
                  className="min-h-[32px] px-2.5 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Meta diaria
                </button>
              </div>

              {pedometerStatus === 'active' && (
                <div className="flex items-center gap-2">
                  {wakeLockSupported && (
                    <button
                      type="button"
                      onClick={onToggleKeepAlive}
                      className={`min-h-[36px] flex-1 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                        keepAliveEnabled
                          ? 'bg-[#1E40AF]/40 border-[#38BDF8]/60 text-[#F1F5F9]'
                          : 'bg-[#101218] border-[#1B1E26] hover:border-[#38BDF8] text-[#8A92A2] hover:text-[#F1F5F9]'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                      {keepAliveEnabled
                        ? 'Modo caminata: Encendido'
                        : 'Mantener activo al caminar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPedometerInfoOpen(true)}
                    aria-label="Información sobre conteo en segundo plano"
                    className={`min-h-[36px] px-2.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-[11px] font-bold text-[#8A92A2] hover:text-[#F1F5F9] inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      wakeLockSupported ? 'shrink-0' : 'flex-1'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-[#38BDF8]" />
                    ¿Al cerrar la app?
                  </button>
                </div>
              )}
            </div>
          )}
        </article>

        {/* Sleep Meter Card */}
        <article className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#38BDF8] shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#F1F5F9] truncate">
                Medidor de Sueño
              </h4>
            </div>
            <span className={`text-xs font-bold whitespace-nowrap ${sleepStatus.color}`}>
              {sleepStatus.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-[72px] h-[72px] shrink-0 flex items-center justify-center">
              <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 72 72">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke="#1B1E26"
                  strokeWidth="6"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke={
                    todayLog.sleepHours >= state.sleepGoal
                      ? '#22C55E'
                      : todayLog.sleepHours >= 6.5
                      ? '#3B82F6'
                      : todayLog.sleepHours > 0
                      ? '#F59E0B'
                      : '#1B1E26'
                  }
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={sleepDashOffset}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute text-xs font-black text-[#F1F5F9] tabular-nums">
                {todayLog.sleepHours}h
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap tabular-nums">
                <span className="text-2xl font-black text-[#F1F5F9]">
                  {todayLog.sleepHours} h
                </span>
                <span className="text-xs text-[#8A92A2] font-semibold">
                  / {state.sleepGoal} h meta
                </span>
              </div>
              <div className="text-xs text-[#8A92A2] mt-1 tabular-nums">
                {todayLog.bedTime && todayLog.wakeTime
                  ? `${todayLog.bedTime} → ${todayLog.wakeTime}`
                  : 'Registra tus horas de descanso'}
                {todayLog.sleepQuality
                  ? ` · Calidad ${todayLog.sleepQuality}`
                  : ''}
                {todayLog.sleepXpAwarded ? (
                  <span className="text-[#22C55E] font-bold"> · +20 XP</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustSleepHours(-0.5)}
              aria-label="Restar media hora de sueño"
              className="min-h-[40px] min-w-[44px] px-2.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center justify-center gap-0.5 tabular-nums"
            >
              <Minus className="w-3.5 h-3.5" />
              0.5h
            </button>
            <button
              type="button"
              onClick={() => adjustSleepHours(0.5)}
              aria-label="Sumar media hora de sueño"
              className="min-h-[40px] min-w-[44px] px-2.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center justify-center gap-0.5 tabular-nums"
            >
              <Plus className="w-3.5 h-3.5" />
              0.5h
            </button>
            <button
              type="button"
              onClick={openSleepModal}
              className="min-h-[40px] flex-1 px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold whitespace-nowrap"
            >
              Registrar sueño
            </button>
          </div>
        </article>
      </div>

      {/* Step Goal Only Modal (Anti-Cheat: steps cannot be manually entered) */}
      <Modal
        open={stepGoalModalOpen}
        title="Meta Diaria de Pasos"
        onClose={() => setStepGoalModalOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 text-xs text-[#8A92A2] leading-relaxed">
            Los pasos se registran <strong className="text-[#F1F5F9]">únicamente de forma automática</strong> mediante el sensor de movimiento real de tu dispositivo para evitar trampas.
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Meta diaria de pasos (mínimo 3,000)
            </label>
            <input
              type="number"
              min={MIN_STEP_GOAL}
              max={50000}
              step={500}
              inputMode="numeric"
              value={stepGoalInput}
              onChange={(e) => setStepGoalInput(e.target.value)}
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm font-bold text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[5000, 8000, 10000, 12000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStepGoalInput(String(preset))}
                  className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-bold tabular-nums ${
                    Number(stepGoalInput) === preset
                      ? 'bg-[#1E40AF] border-[#3B82F6]/60 text-[#F1F5F9]'
                      : 'bg-[#101218] border-[#1B1E26] text-[#8A92A2]'
                  }`}
                >
                  {preset.toLocaleString('es-ES')}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={saveStepGoalModal}
            className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar meta diaria
          </button>
        </div>
      </Modal>

      {/* Register Sleep Modal */}
      <Modal
        open={sleepModalOpen}
        title="Registrar Sueño de Hoy"
        onClose={() => setSleepModalOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Hora de dormir
              </label>
              <input
                type="time"
                value={bedTimeInput}
                onChange={(e) => handleTimeChange(e.target.value, wakeTimeInput)}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm font-bold text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Hora de despertar
              </label>
              <input
                type="time"
                value={wakeTimeInput}
                onChange={(e) => handleTimeChange(bedTimeInput, e.target.value)}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm font-bold text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Horas dormidas
              </label>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                inputMode="decimal"
                value={sleepHoursInput}
                onChange={(e) => setSleepHoursInput(e.target.value)}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm font-bold text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Meta diaria (h)
              </label>
              <input
                type="number"
                min={4}
                max={14}
                step={0.5}
                inputMode="decimal"
                value={sleepGoalInput}
                onChange={(e) => setSleepGoalInput(e.target.value)}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm font-bold text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Calidad del descanso
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSleepQualityInput(q.id)}
                  className={`min-h-[40px] rounded-xl border text-xs font-bold transition-colors ${
                    sleepQualityInput === q.id
                      ? 'bg-[#1E40AF] border-[#3B82F6]/60 text-[#F1F5F9]'
                      : 'bg-[#101218] border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={saveSleepModal}
            className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar registro de sueño
          </button>
        </div>
      </Modal>

      {/* Last 7 Days Modal */}
      <Modal
        open={historyModalOpen}
        title="Resumen de los últimos 7 días"
        onClose={() => setHistoryModalOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-2">
          {last7Days.map((day) => {
            const sPct = Math.min(
              100,
              Math.round((day.steps / day.stepGoal) * 100)
            );
            const slPct = Math.min(
              100,
              Math.round((day.sleepHours / day.sleepGoal) * 100)
            );
            return (
              <div
                key={day.dateKey}
                className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#F1F5F9] capitalize">{day.label}</span>
                  <span className="text-[#8A92A2] tabular-nums">
                    {day.steps.toLocaleString('es-ES')} pasos · {day.sleepHours}h sueño
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-1.5 rounded-full bg-[#101218] overflow-hidden">
                    <div
                      className="h-full bg-[#38BDF8] rounded-full"
                      style={{ width: `${sPct}%` }}
                    />
                  </div>
                  <div className="h-1.5 rounded-full bg-[#101218] overflow-hidden">
                    <div
                      className="h-full bg-[#3B82F6] rounded-full"
                      style={{ width: `${slPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Pedometer Background & Save Behavior Modal */}
      <Modal
        open={pedometerInfoOpen}
        title="Conteo al Minimizar o Cerrar"
        onClose={() => setPedometerInfoOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3 text-xs text-[#8A92A2] leading-relaxed">
          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
            <strong className="text-[#F1F5F9] block mb-1">
              Guardado automático sin perder pasos
            </strong>
            Cada paso detectado se guarda al instante en tu dispositivo y se sincroniza automáticamente cuando minimizás o cerrás la app.
          </div>
          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
            <strong className="text-[#F1F5F9] block mb-1">
              Limitación del navegador al cerrar la app
            </strong>
            Por seguridad del sistema en Android e iOS, ningún navegador ni app web (PWA) puede leer el acelerómetro cuando cerrás la app por completo. Para seguir contando en una caminata, activá <strong className="text-[#38BDF8]">Mantener activo al caminar</strong> y dejá la app abierta sin cerrarla.
          </div>
          <button
            type="button"
            onClick={() => setPedometerInfoOpen(false)}
            className="min-h-[42px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-extrabold"
          >
            Entendido
          </button>
        </div>
      </Modal>

      {/* 24h Inactivity Reminder Modal */}
      <Modal
        open={reminderModalOpen}
        title="Recordatorio de Entrenamiento (24h)"
        onClose={() => setReminderModalOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3.5 text-xs text-[#8A92A2] leading-relaxed">
          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <strong className="text-[#F1F5F9]">Estado de notificaciones PWA</strong>
              <span
                className={`font-bold ${
                  !reminderSupported
                    ? 'text-[#8A92A2]'
                    : reminderPermission === 'denied'
                    ? 'text-[#F59E0B]'
                    : reminderEnabled
                    ? 'text-[#22C55E]'
                    : 'text-[#8A92A2]'
                }`}
              >
                {!reminderSupported
                  ? 'No compatible'
                  : reminderPermission === 'denied'
                  ? 'Bloqueadas'
                  : reminderEnabled
                  ? 'Activadas'
                  : 'Desactivadas'}
              </span>
            </div>
            Si pasan <strong className="text-[#F1F5F9]">24 horas</strong> sin registrar un entrenamiento, pasos o sueño, el Service Worker enviará una notificación local para recordarte entrenar.
            {hoursSinceActivity !== null && (
              <div className="mt-2 pt-2 border-t border-[#1B1E26] tabular-nums">
                Última actividad:{' '}
                <strong className="text-[#38BDF8]">
                  {hoursSinceActivity === 0
                    ? 'hace menos de 1 hora'
                    : `hace ${hoursSinceActivity} h`}
                </strong>
              </div>
            )}
          </div>

          {reminderPermission === 'denied' && (
            <div className="rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 p-3 text-[#FACC15]">
              Las notificaciones están bloqueadas en tu navegador. Toca el candado o ajustes del sitio y selecciona Permitir notificaciones.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!reminderSupported}
              onClick={onToggleReminder}
              className={`min-h-[42px] flex-1 px-4 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                reminderEnabled
                  ? 'bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-[#F1F5F9]'
                  : 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
              }`}
            >
              {reminderEnabled ? (
                <>
                  <BellOff className="w-4 h-4 text-[#8A92A2]" />
                  Desactivar recordatorio
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Activar recordatorio 24h
                </>
              )}
            </button>
            {reminderSupported && reminderPermission !== 'denied' && (
              <button
                type="button"
                onClick={onTestReminder}
                className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8]"
              >
                Probar aviso
              </button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
