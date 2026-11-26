import { useMemo, useState } from 'react';
import { CalendarDays, Check, Dumbbell, Footprints, Layers, Timer, Trophy, Zap } from 'lucide-react';
import { UserProfile, WorkoutHistoryEntry } from '../types/animefit';
import { formatDuration, getExerciseById } from '../utils/animefit';
import { Modal } from './Modal';

export interface WeeklySummarySessionItem {
  date: string;
  dayLabel: string;
  name: string;
  sets: number;
  volume: number;
  durationMs: number;
  xp: number;
}

export interface WeeklySummaryData {
  weekStartKey: string;
  sundayKey: string;
  rangeLabel: string;
  sundayLabel: string;
  isSundayToday: boolean;
  workoutsCount: number;
  totalVolume: number;
  prevWeekVolume: number;
  volumeDelta: number | null;
  totalSets: number;
  totalDurationMs: number;
  totalXp: number;
  totalSteps: number;
  topMuscles: Array<{ muscle: string; sets: number }>;
  sessions: WeeklySummarySessionItem[];
}

function getMondayStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayMonth(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function getEntriesInRange(
  history: WorkoutHistoryEntry[],
  startMs: number,
  endMs: number
): WorkoutHistoryEntry[] {
  return (history || []).filter((h) => {
    const t = new Date(h.date).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

export function buildWeeklySummaryData(
  user: UserProfile,
  weekOffset = 0,
  now = new Date()
): WeeklySummaryData {
  const baseMonday = getMondayStart(now);
  const monday = new Date(baseMonday);
  monday.setDate(monday.getDate() + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevSunday = new Date(monday);
  prevSunday.setMilliseconds(-1);

  const entries = getEntriesInRange(
    user.history || [],
    monday.getTime(),
    sunday.getTime()
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const prevEntries = getEntriesInRange(
    user.history || [],
    prevMonday.getTime(),
    prevSunday.getTime()
  );

  let totalVolume = 0;
  let totalSets = 0;
  let totalDurationMs = 0;
  let totalXp = 0;
  const muscleCounts = new Map<string, number>();

  const sessions: WeeklySummarySessionItem[] = entries.map((e) => {
    const vol = Number.isFinite(e.volume) ? Math.max(0, Math.round(e.volume)) : 0;
    const sets = Number.isFinite(e.sets) ? Math.max(0, Math.round(e.sets)) : 0;
    const dur = Number.isFinite(e.durationMs) ? Math.max(0, e.durationMs) : 0;
    const xp = Number.isFinite(e.xp) ? Math.max(0, Math.round(e.xp)) : 0;

    totalVolume += vol;
    totalSets += sets;
    totalDurationMs += dur;
    totalXp += xp;

    for (const exItem of e.exercises || []) {
      const doneSets = (exItem.sets || []).filter((s) => s.done).length;
      if (doneSets > 0) {
        const exDef = getExerciseById(exItem.exId, user);
        const muscle = exDef?.muscle || 'General';
        muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + doneSets);
      }
    }

    const d = new Date(e.date);
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
    return {
      date: e.date,
      dayLabel: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()}`,
      name: e.name,
      sets,
      volume: vol,
      durationMs: dur,
      xp,
    };
  });

  const prevWeekVolume = prevEntries.reduce(
    (acc, e) =>
      acc + (Number.isFinite(e.volume) ? Math.max(0, Math.round(e.volume)) : 0),
    0
  );

  let totalSteps = 0;
  const logs = user.wellness?.logs || {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = formatLocalDateKey(d);
    const daySteps = Number(logs[key]?.steps || 0);
    if (Number.isFinite(daySteps) && daySteps > 0) {
      totalSteps += Math.round(daySteps);
    }
  }

  const topMuscles = Array.from(muscleCounts.entries())
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 4);

  return {
    weekStartKey: formatLocalDateKey(monday),
    sundayKey: formatLocalDateKey(sunday),
    rangeLabel: `${formatDayMonth(monday)} – ${formatDayMonth(sunday)}`,
    sundayLabel: `Domingo ${formatDayMonth(sunday)}`,
    isSundayToday: now.getDay() === 0 && weekOffset === 0,
    workoutsCount: sessions.length,
    totalVolume,
    prevWeekVolume,
    volumeDelta: prevEntries.length > 0 ? totalVolume - prevWeekVolume : null,
    totalSets,
    totalDurationMs,
    totalXp,
    totalSteps,
    topMuscles,
    sessions,
  };
}

interface WeeklySundaySummaryBodyProps {
  summary: WeeklySummaryData;
}

function WeeklySundaySummaryBody({ summary }: WeeklySundaySummaryBodyProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A92A2]">
            <Dumbbell className="w-3.5 h-3.5 text-[#38BDF8]" />
            Entrenamientos
          </div>
          <div className="text-lg font-black text-[#F1F5F9] mt-0.5">
            {summary.workoutsCount}
          </div>
        </div>

        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A92A2]">
            <Trophy className="w-3.5 h-3.5 text-[#FACC15]" />
            Volumen total
          </div>
          <div className="text-lg font-black text-[#38BDF8] mt-0.5">
            {summary.totalVolume.toLocaleString('es-ES')} kg
          </div>
          {summary.volumeDelta !== null && (
            <div
              className={`text-[11px] font-bold mt-0.5 ${
                summary.volumeDelta >= 0 ? 'text-[#22C55E]' : 'text-[#F59E0B]'
              }`}
            >
              {summary.volumeDelta >= 0 ? '+' : ''}
              {summary.volumeDelta.toLocaleString('es-ES')} kg vs sem. ant.
            </div>
          )}
        </div>

        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A92A2]">
            <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
            Series / Tiempo
          </div>
          <div className="text-lg font-black text-[#F1F5F9] mt-0.5">
            {summary.totalSets} series
          </div>
          <div className="text-[11px] text-[#8A92A2] inline-flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {summary.totalDurationMs > 0
              ? formatDuration(summary.totalDurationMs)
              : '0m'}
          </div>
        </div>

        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A92A2]">
            <Zap className="w-3.5 h-3.5 text-[#FACC15]" />
            XP & Pasos
          </div>
          <div className="text-lg font-black text-[#FACC15] mt-0.5">
            +{summary.totalXp} XP
          </div>
          <div className="text-[11px] text-[#8A92A2] inline-flex items-center gap-1">
            <Footprints className="w-3 h-3 text-[#38BDF8]" />
            {summary.totalSteps.toLocaleString('es-ES')} pasos
          </div>
        </div>
      </div>

      {summary.topMuscles.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8A92A2] tabular-nums">
          <span className="font-semibold text-[#F1F5F9]">Músculos trabajados:</span>
          {summary.topMuscles.map((m, idx) => (
            <span key={m.muscle} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <span className="text-[#1B1E26]" aria-hidden="true">
                  ·
                </span>
              )}
              <span>
                {m.muscle}{' '}
                <strong className="text-[#38BDF8]">({m.sets} series)</strong>
              </span>
            </span>
          ))}
        </div>
      )}

      {summary.sessions.length === 0 ? (
        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] px-4 py-5 text-center">
          <p className="text-sm font-semibold text-[#8A92A2]">
            Sin entrenamientos registrados entre {summary.rangeLabel}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
          {summary.sessions.map((s, idx) => (
            <div
              key={`${s.date}_${idx}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#F1F5F9] truncate">
                  {s.name}
                </div>
                <div className="text-xs text-[#8A92A2] tabular-nums">
                  {s.dayLabel} · {s.sets} series ·{' '}
                  {s.volume.toLocaleString('es-ES')} kg ·{' '}
                  {formatDuration(s.durationMs)}
                </div>
              </div>
              <span className="text-xs font-black text-[#38BDF8] whitespace-nowrap shrink-0 tabular-nums">
                +{s.xp} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WeeklySundaySummaryCardProps {
  user: UserProfile;
}

export function WeeklySundaySummaryCard({ user }: WeeklySundaySummaryCardProps) {
  const [selectedOffset, setSelectedOffset] = useState<0 | -1>(0);

  const currentWeek = useMemo(() => buildWeeklySummaryData(user, 0), [user]);
  const lastSundayWeek = useMemo(() => buildWeeklySummaryData(user, -1), [user]);
  const activeSummary = selectedOffset === 0 ? currentWeek : lastSundayWeek;
  const isSunday = new Date().getDay() === 0;

  return (
    <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#FACC15] shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-[#F1F5F9] truncate">
              {isSunday && selectedOffset === 0
                ? 'Resumen Semanal de Domingo'
                : 'Resumen Semanal (Domingos)'}
            </h3>
            <p className="text-xs text-[#8A92A2] tabular-nums">
              Semana {activeSummary.rangeLabel} ·{' '}
              {isSunday && selectedOffset === 0
                ? 'Cierre de hoy domingo'
                : selectedOffset === 0
                ? `Cierra el ${currentWeek.sundayLabel.toLowerCase()}`
                : `Cerrado el ${lastSundayWeek.sundayLabel.toLowerCase()}`}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#07080B] border border-[#1B1E26] self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSelectedOffset(0)}
            className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedOffset === 0
                ? 'bg-[#1E40AF] text-[#F1F5F9]'
                : 'text-[#8A92A2] hover:text-[#F1F5F9]'
            }`}
          >
            {isSunday ? 'Hoy domingo' : 'Esta semana'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedOffset(-1)}
            className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedOffset === -1
                ? 'bg-[#1E40AF] text-[#F1F5F9]'
                : 'text-[#8A92A2] hover:text-[#F1F5F9]'
            }`}
          >
            Domingo pasado
          </button>
        </div>
      </div>

      <WeeklySundaySummaryBody summary={activeSummary} />
    </section>
  );
}

interface WeeklySundaySummaryModalProps {
  open: boolean;
  user: UserProfile;
  onClose: () => void;
}

export function WeeklySundaySummaryModal({
  open,
  user,
  onClose,
}: WeeklySundaySummaryModalProps) {
  const summary = useMemo(() => buildWeeklySummaryData(user, 0), [user]);

  return (
    <Modal
      open={open}
      title={`Resumen Semanal · ${summary.sundayLabel}`}
      onClose={onClose}
      maxWidthClass="max-w-xl"
    >
      <p className="text-xs text-[#8A92A2] -mt-1">
        Balance de tus entrenamientos de lunes a domingo ({summary.rangeLabel}).
      </p>

      <WeeklySundaySummaryBody summary={summary} />

      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" />
        Cerrar resumen semanal
      </button>
    </Modal>
  );
}
