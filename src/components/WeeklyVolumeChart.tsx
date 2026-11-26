import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { WorkoutHistoryEntry } from '../types/animefit';

interface WeeklyVolumePoint {
  weekKey: string;
  label: string;
  rangeLabel: string;
  volume: number;
  workouts: number;
  sets: number;
}

function getMondayStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIsoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDayMonth(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function formatAxisVolume(val: number): string {
  if (val >= 1000) {
    return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(val);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeeklyVolumePoint }>;
}

function WeeklyVolumeTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] px-3 py-2 shadow-xl text-xs">
      <div className="font-bold text-[#F1F5F9]">{pt.rangeLabel}</div>
      <div className="text-[#38BDF8] font-black tabular-nums mt-0.5">
        {pt.volume.toLocaleString('es-ES')} kg acumulados
      </div>
      <div className="text-[#8A92A2] tabular-nums mt-0.5">
        {pt.workouts} {pt.workouts === 1 ? 'sesión' : 'sesiones'} · {pt.sets}{' '}
        {pt.sets === 1 ? 'serie' : 'series'}
      </div>
    </div>
  );
}

interface WeeklyVolumeChartProps {
  history: WorkoutHistoryEntry[];
}

export function WeeklyVolumeChart({ history }: WeeklyVolumeChartProps) {
  const { points, totalVolume, currentWeekVolume, bestWeekVolume } = useMemo(() => {
    const validEntries = (history || []).filter((h) => {
      const parsed = new Date(h.date);
      return !Number.isNaN(parsed.getTime());
    });

    if (validEntries.length === 0) {
      return {
        points: [] as WeeklyVolumePoint[],
        totalVolume: 0,
        currentWeekVolume: 0,
        bestWeekVolume: 0,
      };
    }

    const weekMap = new Map<
      string,
      { monday: Date; volume: number; workouts: number; sets: number }
    >();

    let earliestMondayMs = Infinity;
    let totalVol = 0;

    for (const entry of validEntries) {
      const monday = getMondayStart(new Date(entry.date));
      const key = formatIsoDateKey(monday);
      if (monday.getTime() < earliestMondayMs) {
        earliestMondayMs = monday.getTime();
      }

      const vol = Number.isFinite(entry.volume)
        ? Math.max(0, Math.round(Number(entry.volume)))
        : 0;
      const setsCount = Number.isFinite(entry.sets)
        ? Math.max(0, Math.round(Number(entry.sets)))
        : 0;

      totalVol += vol;

      const prev = weekMap.get(key);
      if (prev) {
        prev.volume += vol;
        prev.workouts += 1;
        prev.sets += setsCount;
      } else {
        weekMap.set(key, {
          monday,
          volume: vol,
          workouts: 1,
          sets: setsCount,
        });
      }
    }

    const currentMonday = getMondayStart(new Date());
    const minWindowStart = new Date(currentMonday);
    minWindowStart.setDate(minWindowStart.getDate() - 7 * 5); // at least 6 weeks

    const maxHistoryStart = new Date(currentMonday);
    maxHistoryStart.setDate(maxHistoryStart.getDate() - 7 * 11); // cap to last 12 weeks for legibility

    const startTime = Math.max(
      Math.min(earliestMondayMs, minWindowStart.getTime()),
      maxHistoryStart.getTime()
    );

    const series: WeeklyVolumePoint[] = [];
    const cursor = new Date(startTime);
    cursor.setHours(0, 0, 0, 0);

    let bestVol = 0;
    while (cursor.getTime() <= currentMonday.getTime()) {
      const key = formatIsoDateKey(cursor);
      const sunday = new Date(cursor);
      sunday.setDate(sunday.getDate() + 6);

      const agg = weekMap.get(key);
      const vol = agg ? agg.volume : 0;
      if (vol > bestVol) bestVol = vol;

      series.push({
        weekKey: key,
        label: formatShortDayMonth(cursor),
        rangeLabel: `${formatShortDayMonth(cursor)} – ${formatShortDayMonth(
          sunday
        )}`,
        volume: vol,
        workouts: agg ? agg.workouts : 0,
        sets: agg ? agg.sets : 0,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    const currKey = formatIsoDateKey(currentMonday);
    const currWeekVol = weekMap.get(currKey)?.volume ?? 0;

    return {
      points: series,
      totalVolume: totalVol,
      currentWeekVolume: currWeekVol,
      bestWeekVolume: bestVol,
    };
  }, [history]);

  return (
    <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#38BDF8] shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-[#F1F5F9] truncate">
              Volumen Semanal Acumulado
            </h3>
            <p className="text-xs text-[#8A92A2]">
              Total de carga movida por semana en tu historial (kg)
            </p>
          </div>
        </div>

        {points.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums shrink-0">
            <div>
              <span className="text-[#8A92A2]">Esta semana: </span>
              <strong className="text-[#38BDF8]">
                {currentWeekVolume.toLocaleString('es-ES')} kg
              </strong>
            </div>
            <span className="text-[#1B1E26]" aria-hidden="true">
              ·
            </span>
            <div>
              <span className="text-[#8A92A2]">Mejor semana: </span>
              <strong className="text-[#FACC15]">
                {bestWeekVolume.toLocaleString('es-ES')} kg
              </strong>
            </div>
            <span className="text-[#1B1E26]" aria-hidden="true">
              ·
            </span>
            <div>
              <span className="text-[#8A92A2]">Total: </span>
              <strong className="text-[#F1F5F9]">
                {totalVolume.toLocaleString('es-ES')} kg
              </strong>
            </div>
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#8A92A2]">
            Todavía no hay sesiones registradas en tu historial.
          </p>
          <p className="text-xs text-[#8A92A2] mt-1">
            Finaliza tu primer entrenamiento en <strong className="text-[#F1F5F9]">Entrenar</strong> para graficar tu volumen semanal acumulado.
          </p>
        </div>
      ) : (
        <div className="w-full h-[230px] sm:h-[250px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#1B1E26"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#8A92A2"
                tick={{ fill: '#8A92A2', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1B1E26' }}
                minTickGap={16}
              />
              <YAxis
                stroke="#8A92A2"
                tick={{ fill: '#8A92A2', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={formatAxisVolume}
              />
              <Tooltip
                content={<WeeklyVolumeTooltip />}
                cursor={{ stroke: '#38BDF8', strokeOpacity: 0.35, strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="volume"
                name="Volumen (kg)"
                stroke="#38BDF8"
                strokeWidth={2.5}
                dot={{
                  r: 4,
                  fill: '#0A0B0F',
                  stroke: '#38BDF8',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: '#FACC15',
                  stroke: '#030406',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
