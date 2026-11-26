import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ActiveWorkout,
  DailyWellnessState,
  ExerciseDef,
  ExerciseLocationType,
  ExerciseMuscle,
  Routine,
  RoutineFolder,
  UserProfile,
  WorkoutSummaryInfo,
} from '../types/animefit';
import {
  beepRestDone,
  buildSmartRoutines,
  calculateEstimated1RM,
  formatDuration,
  getAllExercisesForUser,
  getBestOneRmForExercise,
  getExerciseById,
  getLastExerciseSetsHistory,
} from '../utils/animefit';
import { PedometerStatus } from '../hooks/useAutoPedometer';
import { CharacterAvatar } from './CharacterAvatar';
import { ExerciseSvg } from './ExerciseSvg';
import { Modal } from './Modal';
import { RoutineBuilderOverlay } from './RoutineBuilderOverlay';
import { WellnessTrackerSection } from './WellnessTrackerSection';

interface TrainTabProps {
  user: UserProfile;
  activeWorkout: ActiveWorkout | null;
  onStartFreeWorkout: () => void;
  onStartRoutineWorkout: (routineId: string) => void;
  onUpdateActiveWorkout: (
    updater: (prev: ActiveWorkout) => ActiveWorkout,
    toastMsg?: string
  ) => void;
  onRecordPR: (exId: string, score: number) => void;
  onRecordOneRM: (params: {
    exId: string;
    exerciseName: string;
    newOneRm: number;
    prevOneRm: number;
    weight: number;
    reps: number;
    isAchievement: boolean;
  }) => void;
  onCancelActiveWorkout: () => void;
  onFinishActiveWorkout: () => WorkoutSummaryInfo | null;
  onSaveRoutine: (routine: Routine) => void;
  onDeleteRoutine: (routineId: string) => void;
  onTogglePublishRoutine: (routineId: string) => void;
  onSetStoryRoutine: (routineId: string) => void;
  onAddGeneratedRoutines: (routines: Routine[], folderId?: string) => void;
  onSaveFolder: (folder: RoutineFolder, selectedRoutineIds?: string[]) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveRoutineToFolder: (routineId: string, folderId: string | null) => void;
  onSaveCustomExercise: (ex: ExerciseDef) => void;
  onUpdateWellness: (
    nextWellness: DailyWellnessState,
    bonusXp?: number,
    toastMsg?: string
  ) => void;
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
  onToast: (msg: string) => void;
  onNavigateToCharacter: () => void;
}

const LOCATION_FILTERS: ('Todos' | ExerciseLocationType | 'Máquina Smith')[] = [
  'Todos',
  'Máquina Smith',
  'Máquinas Gym',
  'Pesos Libres',
  'Casa',
  'Calistenia',
];

const MUSCLE_FILTERS: ('Todos' | ExerciseMuscle)[] = [
  'Todos',
  'Pecho',
  'Espalda',
  'Piernas',
  'Glúteos',
  'Hombros',
  'Brazos',
  'Abdomen',
  'Cardio',
];

export function TrainTab({
  user,
  activeWorkout,
  onStartFreeWorkout,
  onStartRoutineWorkout,
  onUpdateActiveWorkout,
  onRecordPR,
  onRecordOneRM,
  onCancelActiveWorkout,
  onFinishActiveWorkout,
  onSaveRoutine,
  onDeleteRoutine,
  onTogglePublishRoutine,
  onSetStoryRoutine,
  onAddGeneratedRoutines,
  onSaveFolder,
  onDeleteFolder,
  onMoveRoutineToFolder,
  onSaveCustomExercise,
  onUpdateWellness,
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
  onToast,
  onNavigateToCharacter,
}: TrainTabProps) {
  const [now, setNow] = useState(() => Date.now());

  // Modals state
  const [selectorMode, setSelectorMode] = useState<
    null | 'active' | 'builder' | 'replace' | 'catalog'
  >(null);
  const [replaceTargetIdx, setReplaceTargetIdx] = useState<number | null>(null);
  const [exSearch, setExSearch] = useState('');
  const [exFilterType, setExFilterType] = useState<
    'Todos' | ExerciseLocationType | 'Máquina Smith'
  >('Todos');
  const [exFilterMuscle, setExFilterMuscle] = useState<
    'Todos' | ExerciseMuscle
  >('Todos');

  const [tutorialExId, setTutorialExId] = useState<string | null>(null);
  const [customExOpen, setCustomExOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custMuscle, setCustMuscle] = useState<ExerciseMuscle>('Pecho');
  const [custType, setCustType] =
    useState<ExerciseLocationType>('Máquinas Gym');
  const [custBw, setCustBw] = useState(false);
  const [custCardio, setCustCardio] = useState(false);
  const [custCues, setCustCues] = useState('');

  // Routine Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderDraft, setBuilderDraft] = useState<Routine | null>(null);
  const [builderSelectedIdx, setBuilderSelectedIdx] = useState<number>(0);

  // Smart Routine Generator state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('hipertrofia');
  const [aiPlace, setAiPlace] = useState<'gym' | 'home' | 'calistenia'>('gym');
  const [aiDays, setAiDays] = useState(3);
  const [aiLevel, setAiLevel] = useState('intermedio');
  const [aiPublish, setAiPublish] = useState(false);

  // Summary modal state
  const [summaryInfo, setSummaryInfo] = useState<WorkoutSummaryInfo | null>(
    null
  );

  // Confirm cancel workout modal
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmDeleteRoutineId, setConfirmDeleteRoutineId] = useState<
    string | null
  >(null);

  // Routine folders state
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderRoutineIds, setFolderRoutineIds] = useState<string[]>([]);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<
    string | null
  >(null);
  const [moveRoutineId, setMoveRoutineId] = useState<string | null>(null);
  const [aiFolderId, setAiFolderId] = useState<string>('');

  // Live timer tick for active workout + rest countdown
  useEffect(() => {
    if (!activeWorkout) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (activeWorkout.restEndAt && activeWorkout.restEndAt <= current) {
        onUpdateActiveWorkout((prev) => ({ ...prev, restEndAt: null }));
        onToast('⏰ ¡Descanso terminado! A por la siguiente serie.');
        beepRestDone();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [activeWorkout, onToast, onUpdateActiveWorkout]);

  const allExercises = useMemo(() => getAllExercisesForUser(user), [user]);

  const filteredExercises = useMemo(() => {
    const q = exSearch.toLowerCase().trim();
    return allExercises.filter((ex) => {
      const mSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.subTag.toLowerCase().includes(q) ||
        ex.muscle.toLowerCase().includes(q);
      const mType =
        exFilterType === 'Todos' ||
        (exFilterType === 'Máquina Smith'
          ? ex.subTag.toLowerCase().includes('smith') ||
            ex.name.toLowerCase().includes('smith')
          : ex.type === exFilterType);
      const mMuscle =
        exFilterMuscle === 'Todos' || ex.muscle === exFilterMuscle;
      return mSearch && mType && mMuscle;
    });
  }, [allExercises, exSearch, exFilterType, exFilterMuscle]);

  const openSelector = (
    mode: 'active' | 'builder' | 'replace' | 'catalog',
    replaceIdx?: number
  ) => {
    setExSearch('');
    setExFilterType('Todos');
    setExFilterMuscle('Todos');
    setReplaceTargetIdx(
      mode === 'replace' && typeof replaceIdx === 'number' ? replaceIdx : null
    );
    setSelectorMode(mode);
  };

  const openBuilder = (existing?: Routine, defaultFolderId?: string) => {
    setBuilderSelectedIdx(0);
    if (existing) {
      setBuilderDraft(JSON.parse(JSON.stringify(existing)));
    } else {
      setBuilderDraft({
        id: `r_${Date.now()}`,
        name: '',
        published: false,
        author: user.username,
        likes: 0,
        exercises: [],
        folderId: defaultFolderId || activeFolderId || undefined,
      });
    }
    setBuilderOpen(true);
  };

  const handlePickExercise = (ex: ExerciseDef) => {
    if (selectorMode === 'active' && activeWorkout) {
      onUpdateActiveWorkout(
        (prevW) => ({
          ...prevW,
          exercises: [
            ...prevW.exercises,
            {
              exId: ex.id,
              targetReps: '',
              sets: [
                {
                  weight: '',
                  reps: '',
                  done: false,
                  isPR: false,
                },
              ],
            },
          ],
        }),
        'Ejercicio añadido'
      );
      setSelectorMode(null);
    } else if (selectorMode === 'builder' && builderDraft) {
      const nextIdx = builderDraft.exercises.length;
      setBuilderDraft({
        ...builderDraft,
        exercises: [
          ...builderDraft.exercises,
          {
            exId: ex.id,
            sets: 1,
            targetReps: '',
            plannedSets: [{ weight: '', reps: '' }],
          },
        ],
      });
      setBuilderSelectedIdx(nextIdx);
      setSelectorMode(null);
    } else if (
      selectorMode === 'replace' &&
      builderDraft &&
      replaceTargetIdx !== null
    ) {
      const nextExercises = builderDraft.exercises.map((item, idx) =>
        idx === replaceTargetIdx ? { ...item, exId: ex.id } : item
      );
      setBuilderDraft({
        ...builderDraft,
        exercises: nextExercises,
      });
      setReplaceTargetIdx(null);
      setSelectorMode(null);
    }
  };

  const handleSaveCustom = () => {
    const trimmed = custName.trim();
    if (!trimmed) {
      onToast('Escribe un nombre para el ejercicio.');
      return;
    }
    const newEx: ExerciseDef = {
      id: `cust_${Date.now()}`,
      name: trimmed,
      muscle: custMuscle,
      type: custType,
      subTag: 'Personalizado',
      isCardio: custCardio,
      isBodyweight: custBw,
      cues:
        custCues.trim() ||
        'Mantén una técnica limpia y rango de movimiento completo.',
    };
    onSaveCustomExercise(newEx);
    setCustomExOpen(false);
    setCustName('');
    setCustCues('');
    setCustBw(false);
    setCustCardio(false);
  };

  const tutorialEx = tutorialExId
    ? getExerciseById(tutorialExId, user)
    : undefined;

  const routines = user.routines || [];
  const folders = user.routineFolders || [];
  const folderIdsSet = new Set(folders.map((f) => f.id));
  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId) || null
    : null;
  const visibleRoutines = activeFolder
    ? routines.filter((r) => r.folderId === activeFolder.id)
    : routines.filter((r) => !r.folderId || !folderIdsSet.has(r.folderId));

  const openCreateFolderModal = () => {
    setEditingFolderId(null);
    setFolderNameInput('');
    setFolderRoutineIds([]);
    setFolderModalOpen(true);
  };

  const openEditFolderModal = (folder: RoutineFolder) => {
    setEditingFolderId(folder.id);
    setFolderNameInput(folder.name);
    setFolderRoutineIds(
      routines.filter((r) => r.folderId === folder.id).map((r) => r.id)
    );
    setFolderModalOpen(true);
  };

  const toggleFolderRoutineSelection = (routineId: string) => {
    setFolderRoutineIds((prev) =>
      prev.includes(routineId)
        ? prev.filter((id) => id !== routineId)
        : [...prev, routineId]
    );
  };

  const handleSaveFolderModal = () => {
    const name = folderNameInput.trim();
    if (!name) {
      onToast('Escribe un nombre para la carpeta.');
      return;
    }
    const existing = editingFolderId
      ? folders.find((f) => f.id === editingFolderId)
      : null;
    const folder: RoutineFolder = {
      id: existing ? existing.id : `fld_${Date.now()}`,
      name,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };
    onSaveFolder(folder, folderRoutineIds);
    setFolderModalOpen(false);
    if (!existing) {
      setActiveFolderId(folder.id);
    }
  };

  // ACTIVE WORKOUT VIEW
  if (activeWorkout) {
    const doneSets = activeWorkout.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.done).length,
      0
    );
    const totalSets = activeWorkout.exercises.reduce(
      (acc, ex) => acc + ex.sets.length,
      0
    );
    const restRemaining =
      activeWorkout.restEndAt && activeWorkout.restEndAt > now
        ? formatDuration(activeWorkout.restEndAt - now)
        : 'Listo';

    return (
      <div className="flex flex-col gap-4">
        <div className="sticky top-[57px] z-20 bg-gradient-to-r from-[#0A0B0F] to-[#0E1016] border border-[#38BDF8]/45 rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-[#8A92A2] tabular-nums">
              ⏱️ Tiempo activo · {doneSets}/{totalSets} series
            </div>
            <div className="text-2xl font-black text-[#FACC15] tabular-nums font-[family-name:var(--font-mono)]">
              {formatDuration(now - activeWorkout.startedAt)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-[#8A92A2] tabular-nums">
              Descanso:{' '}
              <span
                className={`font-black ${
                  activeWorkout.restEndAt && activeWorkout.restEndAt > now
                    ? 'text-[#38BDF8]'
                    : 'text-[#8A92A2]'
                }`}
              >
                {restRemaining}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 justify-end">
              {[
                { label: '60s', sec: 60 },
                { label: '90s', sec: 90 },
                { label: '2m', sec: 120 },
              ].map((btn) => (
                <button
                  key={btn.sec}
                  type="button"
                  onClick={() =>
                    onUpdateActiveWorkout((prev) => ({
                      ...prev,
                      restDuration: btn.sec,
                      restEndAt: Date.now() + btn.sec * 1000,
                    }))
                  }
                  className="min-h-[34px] px-2.5 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] hover:border-[#38BDF8]"
                >
                  {btn.label}
                </button>
              ))}
              <button
                type="button"
                aria-label="Detener descanso"
                onClick={() =>
                  onUpdateActiveWorkout((prev) => ({ ...prev, restEndAt: null }))
                }
                className="min-h-[34px] px-2.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[#F1F5F9] truncate">
              {activeWorkout.name}
            </h2>
            <p className="text-xs text-[#8A92A2]">
              Autoguardado activo: puedes cerrar y volver sin perder tu sesión
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5] text-xs font-bold whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const res = onFinishActiveWorkout();
                if (res) setSummaryInfo(res);
              }}
              className="min-h-[42px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black whitespace-nowrap shadow-[0_0_14px_rgba(29,78,216,0.26)]"
            >
              🏁 Terminar
            </button>
          </div>
        </div>

        {activeWorkout.exercises.length === 0 ? (
          <div className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-6 text-center">
            <p className="text-sm text-[#8A92A2] mb-4">
              Agrega tu primer ejercicio para comenzar a registrar series.
            </p>
            <button
              type="button"
              onClick={() => openSelector('active')}
              className="min-h-[46px] px-5 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-sm font-bold"
            >
              + Añadir Ejercicio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {activeWorkout.exercises.map((item, exIdx) => {
              const ex = getExerciseById(item.exId, user);
              if (!ex) return null;
              const prevHist = getLastExerciseSetsHistory(user, item.exId);
              const prBest = user.prs[item.exId] || 0;
              const bestOneRm = getBestOneRmForExercise(
                user,
                item.exId,
                ex.isCardio
              );
              const metricUnit = ex.isCardio
                ? 'min'
                : ex.isBodyweight && (!prevHist || prevHist.bestWeight === 0)
                ? 'reps'
                : 'kg';
              const prevBestMetric = prevHist
                ? ex.isCardio
                  ? prevHist.bestWeight
                  : ex.isBodyweight && prevHist.bestWeight === 0
                  ? prevHist.bestReps
                  : prevHist.bestWeight
                : 0;

              return (
                <article
                  key={`${item.exId}_${exIdx}`}
                  className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-[#F1F5F9] leading-snug">
                        {ex.name}
                      </h3>
                      <div className="text-xs text-[#8A92A2] mt-1 tabular-nums">
                        <span className="text-[#38BDF8] font-semibold">
                          {ex.muscle}
                        </span>{' '}
                        · {ex.type}
                        {prBest > 0 && (
                          <span className="text-[#FACC15] font-bold">
                            {' '}
                            · 🏆 PR {prBest}
                            {ex.isCardio ? ' min' : ' kg'}
                          </span>
                        )}
                        {!ex.isCardio && bestOneRm > 0 && (
                          <span className="text-[#38BDF8] font-bold">
                            {' '}
                            · 🏅 1RM {bestOneRm} kg
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-[#8A92A2] mt-1 italic">
                          📝 {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Tutorial de ${ex.name}`}
                        onClick={() => setTutorialExId(ex.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#101218] border border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Quitar ${ex.name}`}
                        onClick={() =>
                          onUpdateActiveWorkout((prevW) => {
                            const nextEx = [...prevW.exercises];
                            nextEx.splice(exIdx, 1);
                            return { ...prevW, exercises: nextEx };
                          })
                        }
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5] text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {prevHist && (
                    <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#07080B] border border-[#38BDF8]/35 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[#38BDF8] font-bold tabular-nums">
                        📈 Última vez:{' '}
                        {prevBestMetric > 0
                          ? `Máx ${prevBestMetric} ${metricUnit}`
                          : `${prevHist.sets.length} series`}
                      </span>
                      <span className="text-[#FACC15] font-extrabold">
                        ⚡ Supera este peso para +25 XP
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-[38px_1fr_76px_76px_44px] gap-1.5 items-center mt-3 text-[11px] font-bold text-[#8A92A2] text-center">
                    <div>Serie</div>
                    <div>Anterior</div>
                    <div>
                      {ex.isCardio
                        ? 'Minutos'
                        : ex.isBodyweight
                        ? 'Lastre kg'
                        : 'Peso kg'}
                    </div>
                    <div>{ex.isCardio ? 'Km/Nv' : 'Reps'}</div>
                    <div>✓</div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {item.sets.map((s, sIdx) => {
                      const prevSet =
                        prevHist?.sets[sIdx] ||
                        (prevHist && prevHist.sets.length > 0
                          ? prevHist.sets[prevHist.sets.length - 1]
                          : null);
                      const prevSetLabel = prevSet
                        ? `${prevSet.weight === '' ? 0 : prevSet.weight}${
                            ex.isCardio ? 'm' : 'kg'
                          }×${prevSet.reps === '' ? 0 : prevSet.reps}`
                        : '—';
                      const prevSetTargetScore = prevSet
                        ? ex.isCardio
                          ? Number(prevSet.weight) || 0
                          : ex.isBodyweight && Number(prevSet.weight || 0) === 0
                          ? Number(prevSet.reps) || 0
                          : Number(prevSet.weight) || 0
                        : 0;
                      const liveOneRm = !ex.isCardio
                        ? calculateEstimated1RM(
                            Number(s.weight) || 0,
                            Number(s.reps) || 0
                          )
                        : 0;
                      const beatsOneRmNow =
                        liveOneRm > 0 && bestOneRm > 0 && liveOneRm > bestOneRm;

                      return (
                        <div
                          key={sIdx}
                          className={`rounded-xl border p-1 ${
                            s.done
                              ? 'bg-[#22C55E]/10 border-[#22C55E]/35'
                              : 'bg-[#030406]/60 border-transparent'
                          }`}
                        >
                          <div className="grid grid-cols-[38px_1fr_76px_76px_44px] gap-1.5 items-center">
                          <div className="text-center font-extrabold text-xs text-[#38BDF8] tabular-nums leading-tight">
                            <span>{sIdx + 1}</span>
                            {s.done && s.isPR && (
                              <span
                                title="Peso superado (+25 XP)"
                                className="block text-[9px] font-black text-[#FACC15]"
                              >
                                🔥+25
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-center text-xs truncate tabular-nums ${
                              prevSet
                                ? 'text-[#F1F5F9] font-bold'
                                : 'text-[#64748B]'
                            }`}
                          >
                            {prevSetLabel}
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="—"
                            value={s.weight === '' ? '' : s.weight}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val: number | '' =
                                raw === ''
                                  ? ''
                                  : Number.isNaN(parseFloat(raw))
                                  ? ''
                                  : parseFloat(raw);
                              onUpdateActiveWorkout((prevW) => {
                                const nextEx = prevW.exercises.map((exItem, i) =>
                                  i !== exIdx
                                    ? exItem
                                    : {
                                        ...exItem,
                                        sets: exItem.sets.map((setRow, j) =>
                                          j !== sIdx
                                            ? setRow
                                            : { ...setRow, weight: val }
                                        ),
                                      }
                                );
                                return { ...prevW, exercises: nextEx };
                              });
                            }}
                            className="min-h-[40px] w-full bg-[#07080B] border border-[#1B1E26] rounded-lg px-1 text-center text-sm font-bold text-[#F1F5F9] placeholder:text-[#475569] tabular-nums focus:outline-none focus:border-[#38BDF8]"
                          />
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder={item.targetReps || '—'}
                            value={s.reps === '' ? '' : s.reps}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val: number | '' =
                                raw === ''
                                  ? ''
                                  : Number.isNaN(parseFloat(raw))
                                  ? ''
                                  : parseFloat(raw);
                              onUpdateActiveWorkout((prevW) => {
                                const nextEx = prevW.exercises.map((exItem, i) =>
                                  i !== exIdx
                                    ? exItem
                                    : {
                                        ...exItem,
                                        sets: exItem.sets.map((setRow, j) =>
                                          j !== sIdx
                                            ? setRow
                                            : { ...setRow, reps: val }
                                        ),
                                      }
                                );
                                return { ...prevW, exercises: nextEx };
                              });
                            }}
                            className="min-h-[40px] w-full bg-[#07080B] border border-[#1B1E26] rounded-lg px-1 text-center text-sm font-bold text-[#F1F5F9] placeholder:text-[#475569] tabular-nums focus:outline-none focus:border-[#38BDF8]"
                          />
                          <button
                            type="button"
                            aria-label={`Confirmar serie ${sIdx + 1}`}
                            onClick={() => {
                              const targetSet = item.sets[sIdx];
                              const nextDone = !targetSet.done;
                              let weightVal = targetSet.weight;
                              let repsVal = targetSet.reps;
                              let isPR = false;
                              let isOneRmPR = false;

                              if (nextDone) {
                                if (weightVal === '' && ex.isBodyweight)
                                  weightVal = 0;
                                if (repsVal === '' || Number(repsVal) <= 0)
                                  repsVal = ex.isCardio ? 10 : 8;
                                if (weightVal === '') weightVal = 0;

                                const score = ex.isCardio
                                  ? Number(weightVal)
                                  : ex.isBodyweight && Number(weightVal) === 0
                                  ? Number(repsVal)
                                  : Number(weightVal);
                                const prevPR = user.prs[ex.id] || 0;
                                const beatPR = score > prevPR && score > 0;
                                const beatPrevious =
                                  prevHist !== null &&
                                  prevSetTargetScore > 0 &&
                                  score > prevSetTargetScore;

                                const numericWeight = Number(weightVal) || 0;
                                const numericReps = Number(repsVal) || 0;
                                const estOneRm = !ex.isCardio
                                  ? calculateEstimated1RM(numericWeight, numericReps)
                                  : 0;
                                const prevBestOneRm = getBestOneRmForExercise(
                                  user,
                                  ex.id,
                                  ex.isCardio
                                );
                                const beatOneRm =
                                  !ex.isCardio &&
                                  estOneRm > 0 &&
                                  estOneRm > prevBestOneRm;

                                if (beatOneRm) {
                                  const isAchievement = prevBestOneRm > 0;
                                  isOneRmPR = isAchievement;
                                  onRecordOneRM({
                                    exId: ex.id,
                                    exerciseName: ex.name,
                                    newOneRm: estOneRm,
                                    prevOneRm: prevBestOneRm,
                                    weight: numericWeight,
                                    reps: numericReps,
                                    isAchievement,
                                  });
                                }

                                if (beatPR || beatPrevious) {
                                  isPR = true;
                                  if (beatPR) {
                                    onRecordPR(ex.id, score);
                                  }
                                  const unit = ex.isCardio
                                    ? ' min'
                                    : ex.isBodyweight && Number(weightVal) === 0
                                    ? ' reps'
                                    : ' kg';
                                  if (beatPrevious && beatPR) {
                                    onToast(
                                      `🔥 ¡Superaste tu peso anterior (${prevSetTargetScore} → ${score}${unit}) y nuevo PR! +25 XP`
                                    );
                                  } else if (beatPrevious) {
                                    onToast(
                                      `⚡ ¡Superaste tu peso anterior (${prevSetTargetScore} → ${score}${unit})! +25 XP`
                                    );
                                  } else {
                                    onToast(
                                      `🔥 ¡Nuevo PR en ${ex.name}! (${score}${unit}) +25 XP`
                                    );
                                  }
                                }
                              }

                              onUpdateActiveWorkout((prevW) => {
                                const nextEx = prevW.exercises.map((exItem, i) =>
                                  i !== exIdx
                                    ? exItem
                                    : {
                                        ...exItem,
                                        sets: exItem.sets.map((setRow, j) =>
                                          j !== sIdx
                                            ? setRow
                                            : {
                                                weight: weightVal,
                                                reps: repsVal,
                                                done: nextDone,
                                                isPR,
                                                isOneRmPR,
                                              }
                                        ),
                                      }
                                );

                                return {
                                  ...prevW,
                                  restEndAt: nextDone
                                    ? Date.now() +
                                      (prevW.restDuration || 90) * 1000
                                    : prevW.restEndAt,
                                  exercises: nextEx,
                                };
                              }, 'Serie confirmada');
                            }}
                            className={`min-h-[40px] w-full rounded-lg border text-sm font-black flex items-center justify-center transition-colors ${
                              s.done
                                ? 'bg-[#22C55E] border-[#22C55E] text-[#030406] shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                                : 'bg-[#101218] border-[#1B1E26] text-[#8A92A2]'
                            }`}
                          >
                            ✓
                          </button>
                          </div>
                          {!ex.isCardio && liveOneRm > 0 && (
                            <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-0.5 mt-1 border-t border-[#1B1E26]/60 text-[11px] tabular-nums">
                              <span className="text-[#8A92A2]">
                                1RM est.:{' '}
                                <strong
                                  className={
                                    beatsOneRmNow || (s.done && s.isOneRmPR)
                                      ? 'text-[#FACC15]'
                                      : 'text-[#F1F5F9]'
                                  }
                                >
                                  {liveOneRm} kg
                                </strong>
                              </span>
                              {s.done && s.isOneRmPR ? (
                                <span className="font-black text-[#FACC15]">
                                  🏅 ¡Logro 1RM!
                                </span>
                              ) : bestOneRm > 0 ? (
                                <span
                                  className={
                                    beatsOneRmNow
                                      ? 'font-bold text-[#22C55E]'
                                      : 'text-[#8A92A2]'
                                  }
                                >
                                  {beatsOneRmNow
                                    ? `▲ +${
                                        Math.round((liveOneRm - bestOneRm) * 10) /
                                        10
                                      } kg sobre récord`
                                    : `Récord 1RM: ${bestOneRm} kg`}
                                </span>
                              ) : (
                                <span className="text-[#38BDF8] font-semibold">
                                  1RM base
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveWorkout((prevW) => {
                          const nextEx = prevW.exercises.map((exItem, i) => {
                            if (i !== exIdx) return exItem;
                            return {
                              ...exItem,
                              sets: [
                                ...exItem.sets,
                                {
                                  weight: '' as const,
                                  reps: '' as const,
                                  done: false,
                                  isPR: false,
                                },
                              ],
                            };
                          });
                          return { ...prevW, exercises: nextEx };
                        })
                      }
                      className="flex-1 min-h-[38px] rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] hover:border-[#38BDF8]"
                    >
                      + Añadir Serie
                    </button>
                    {item.sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveWorkout((prevW) => {
                            const nextEx = prevW.exercises.map((exItem, i) =>
                              i !== exIdx || exItem.sets.length <= 1
                                ? exItem
                                : {
                                    ...exItem,
                                    sets: exItem.sets.slice(0, -1),
                                  }
                            );
                            return { ...prevW, exercises: nextEx };
                          })
                        }
                        className="min-h-[38px] px-3.5 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9]"
                      >
                        - Quitar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => openSelector('active')}
          className="min-h-[48px] w-full rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-sm font-bold shadow-[0_0_16px_rgba(56,189,248,0.28)]"
        >
          + Añadir Ejercicio al Entrenamiento
        </button>

        {/* Confirm Cancel Modal */}
        <Modal
          open={confirmCancelOpen}
          title="Descartar Entrenamiento"
          onClose={() => setConfirmCancelOpen(false)}
        >
          <p className="text-sm text-[#8A92A2]">
            ¿Seguro que deseas descartar este entrenamiento en curso? Las series confirmadas de esta sesión no sumarán XP.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setConfirmCancelOpen(false)}
              className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
            >
              Seguir entrenando
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmCancelOpen(false);
                onCancelActiveWorkout();
              }}
              className="min-h-[42px] px-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
            >
              Descartar
            </button>
          </div>
        </Modal>

        {renderSharedModals()}
      </div>
    );
  }

  function renderSharedModals() {
    return (
      <>
        {/* Exercise Selector / Catalog Modal */}
        <Modal
          open={selectorMode !== null}
          title={
            selectorMode === 'catalog'
              ? `Catálogo (${filteredExercises.length} ejercicios)`
              : selectorMode === 'replace'
              ? `Reemplazar Ejercicio (${filteredExercises.length})`
              : `Añadir Ejercicio (${filteredExercises.length})`
          }
          onClose={() => {
            setReplaceTargetIdx(null);
            setSelectorMode(null);
          }}
        >
          <div className="flex gap-2">
            <input
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
              placeholder="Buscar: smith, press, prensa, polea, dominadas..."
              className="flex-1 min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
            <button
              type="button"
              onClick={() => setCustomExOpen(true)}
              className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-bold whitespace-nowrap shrink-0"
            >
              + Crear
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {LOCATION_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExFilterType(t)}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                    exFilterType === t
                      ? 'bg-[#38BDF8]/18 text-[#38BDF8] border-[#38BDF8]'
                      : 'bg-[#101218] text-[#8A92A2] border-[#1B1E26]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {MUSCLE_FILTERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setExFilterMuscle(m)}
                  className={`min-h-[36px] px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                    exFilterMuscle === m
                      ? 'bg-[#FACC15]/18 text-[#FACC15] border-[#FACC15]'
                      : 'bg-[#101218] text-[#8A92A2] border-[#1B1E26]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 max-h-[48vh] overflow-y-auto pr-1">
            {filteredExercises.length === 0 ? (
              <p className="text-sm text-[#8A92A2] text-center py-6">
                No se encontraron ejercicios. Usa "+ Crear" para añadir uno personalizado.
              </p>
            ) : (
              filteredExercises.map((ex) => {
                const modeShort =
                  ex.type === 'Máquinas Gym'
                    ? 'Gym Máq.'
                    : ex.type === 'Pesos Libres'
                    ? 'Gym Libre'
                    : ex.type;
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F1F5F9] leading-snug">
                        {ex.name}
                      </div>
                      <div className="text-xs text-[#8A92A2] mt-0.5">
                        <span className="text-[#38BDF8] font-semibold">
                          {ex.muscle}
                        </span>{' '}
                        · {modeShort} · {ex.subTag}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Ver tutorial de ${ex.name}`}
                        onClick={() => setTutorialExId(ex.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#101218] border border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      {selectorMode !== 'catalog' && (
                        <button
                          type="button"
                          aria-label={`Seleccionar ${ex.name}`}
                          onClick={() => handlePickExercise(ex)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>

        {/* Custom Exercise Modal */}
        <Modal
          open={customExOpen}
          title="Crear Ejercicio Personalizado"
          onClose={() => setCustomExOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Nombre del ejercicio o máquina
              </label>
              <input
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="Ej: Prensa unilateral Matrix"
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                  Grupo muscular
                </label>
                <select
                  value={custMuscle}
                  onChange={(e) =>
                    setCustMuscle(e.target.value as ExerciseMuscle)
                  }
                  className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
                >
                  {MUSCLE_FILTERS.filter((m) => m !== 'Todos').map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                  Lugar / Tipo
                </label>
                <select
                  value={custType}
                  onChange={(e) =>
                    setCustType(e.target.value as ExerciseLocationType)
                  }
                  className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
                >
                  {LOCATION_FILTERS.filter((t) => t !== 'Todos').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-[#F1F5F9] cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={custBw}
                onChange={(e) => setCustBw(e.target.checked)}
                className="w-4 h-4 accent-[#FACC15]"
              />
              Peso corporal / Calistenia (acepta 0 kg o lastre)
            </label>

            <label className="flex items-center gap-2.5 text-sm text-[#F1F5F9] cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={custCardio}
                onChange={(e) => setCustCardio(e.target.checked)}
                className="w-4 h-4 accent-[#38BDF8]"
              />
              Es ejercicio de Cardio (Minutos / Distancia)
            </label>

            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Notas / Técnica rápida (opcional)
              </label>
              <textarea
                rows={2}
                value={custCues}
                onChange={(e) => setCustCues(e.target.value)}
                placeholder="Ej: Ajustar asiento en nivel 4, pausa abajo..."
                className="w-full bg-[#07080B] border border-[#1B1E26] rounded-xl p-3 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveCustom}
              className="min-h-[46px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-bold"
            >
              Guardar Ejercicio
            </button>
          </div>
        </Modal>

        {/* Tutorial Modal */}
        <Modal
          open={Boolean(tutorialEx)}
          title={tutorialEx ? `Tutorial: ${tutorialEx.name}` : ''}
          onClose={() => setTutorialExId(null)}
        >
          {tutorialEx && (
            <>
              <ExerciseSvg muscle={tutorialEx.muscle} />
              <div className="text-xs text-[#8A92A2] tabular-nums">
                <span className="text-[#38BDF8] font-bold">
                  {tutorialEx.muscle}
                </span>{' '}
                · {tutorialEx.type} · {tutorialEx.subTag}
                {(user.prs[tutorialEx.id] || 0) > 0 && (
                  <span className="text-[#FACC15] font-bold">
                    {' '}
                    · 🏆 Tu PR: {user.prs[tutorialEx.id]}
                    {tutorialEx.isCardio ? ' min' : ' kg'}
                  </span>
                )}
              </div>
              <div className="bg-[#07080B] border border-[#1B1E26] rounded-xl p-3.5">
                <div className="text-xs font-bold text-[#FACC15]">
                  ⚡ Claves de Ejecución
                </div>
                <p className="text-sm text-[#F1F5F9] mt-1.5 leading-relaxed">
                  {tutorialEx.cues}
                </p>
              </div>
              <div className="bg-[#07080B] border border-[#1B1E26] rounded-xl p-3.5">
                <div className="text-xs font-bold text-[#38BDF8]">
                  💨 Respiración y Control
                </div>
                <p className="text-xs text-[#8A92A2] mt-1.5 leading-relaxed">
                  Inhala al preparar o bajar el peso (fase excéntrica 2 seg). Exhala con fuerza al empujar o jalar manteniendo el core compacto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTutorialExId(null)}
                className="min-h-[44px] w-full rounded-xl bg-[#101218] border border-[#1B1E26] text-sm font-bold text-[#F1F5F9]"
              >
                Cerrar
              </button>
            </>
          )}
        </Modal>

        {/* Workout Summary Modal */}
        <Modal
          open={summaryInfo !== null}
          title="🏁 ¡Entrenamiento Completado!"
          onClose={() => setSummaryInfo(null)}
        >
          {summaryInfo && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[#FACC15]/40 p-5 text-center bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),#07080B_75%)]">
                <CharacterAvatar charId={user.charId} size="lg" className="mx-auto" />
                <div className="text-2xl font-black text-[#FACC15] mt-2 tabular-nums">
                  +{summaryInfo.earnedXp} XP Ganados
                </div>
                <div className="text-xs text-[#8A92A2] mt-1 tabular-nums">
                  {summaryInfo.completedSets} series completadas ·{' '}
                  {summaryInfo.totalVolume} pts de volumen ·{' '}
                  {summaryInfo.prCount} nuevos PRs
                  {(summaryInfo.oneRmRecordCount || 0) > 0 &&
                    ` · ${summaryInfo.oneRmRecordCount} logros de 1RM`}
                </div>
                {summaryInfo.newLevel > summaryInfo.prevLevel && (
                  <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-[#38BDF8]/12 border border-[#38BDF8]/50 text-sm font-extrabold text-[#38BDF8] tabular-nums">
                    ⬆️ ¡Subiste de Nivel! ({summaryInfo.prevLevel} →{' '}
                    {summaryInfo.newLevel})
                  </div>
                )}
                {summaryInfo.evolved && (
                  <div className="mt-3 p-3 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]">
                    <div className="text-xs font-bold text-[#FACC15]">
                      ⚡ ¡Evolución Desbloqueada!
                    </div>
                    <div className="text-base font-black text-[#F1F5F9] mt-0.5">
                      {summaryInfo.stageName}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSummaryInfo(null);
                  onNavigateToCharacter();
                }}
                className="min-h-[46px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-bold"
              >
                Ver Mi Personaje
              </button>
            </div>
          )}
        </Modal>
      </>
    );
  }

  // IDLE VIEW: ROUTINES + GENERATOR + MANUAL BUILDER + CATALOG
  return (
    <div className="flex flex-col gap-5">
      <section className="bg-[#0A0B0F] border border-[#FACC15]/40 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#F1F5F9]">
              Centro de Entrenamiento
            </h2>
            <p className="text-sm text-[#8A92A2]">
              Confirma series, controla descansos y sube tu Ki
            </p>
          </div>
          <button
            type="button"
            onClick={onStartFreeWorkout}
            className="min-h-[44px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-bold whitespace-nowrap shadow-[0_0_14px_rgba(29,78,216,0.26)]"
          >
            + Entrenamiento Libre
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAiFolderId(activeFolder ? activeFolder.id : '');
              setAiOpen(true);
            }}
            className="min-h-[44px] px-4 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-sm font-bold"
          >
            🤖 Crear Rutina Automática
          </button>
          <button
            type="button"
            onClick={() => openBuilder()}
            className="min-h-[44px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-sm font-bold text-[#F1F5F9] hover:border-[#38BDF8]"
          >
            📝 Crear Mi Propia Rutina
          </button>
        </div>

        <button
          type="button"
          onClick={() => openSelector('catalog')}
          className="min-h-[42px] px-4 rounded-xl bg-[#07080B] border border-[#1B1E26] text-xs sm:text-sm font-bold text-[#F1F5F9] hover:border-[#38BDF8]"
        >
          📚 Explorar Catálogo Completo ({allExercises.length} ejercicios) + Personalizados
        </button>
      </section>

      <WellnessTrackerSection
        user={user}
        pedometerStatus={pedometerStatus}
        hasMotionEvents={hasMotionEvents}
        keepAliveEnabled={keepAliveEnabled}
        wakeLockActive={wakeLockActive}
        wakeLockSupported={wakeLockSupported}
        onToggleKeepAlive={onToggleKeepAlive}
        onRequestPedometerPermission={onRequestPedometerPermission}
        reminderSupported={reminderSupported}
        reminderPermission={reminderPermission}
        reminderEnabled={reminderEnabled}
        hoursSinceActivity={hoursSinceActivity}
        onToggleReminder={onToggleReminder}
        onTestReminder={onTestReminder}
        onUpdateWellness={onUpdateWellness}
        onToast={onToast}
      />

      <section className="flex flex-col gap-3.5">
        {activeFolder ? (
          <div className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveFolderId(null)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Carpetas
                </button>
                <div className="min-w-0 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#38BDF8] shrink-0" />
                  <h3 className="text-base font-extrabold text-[#F1F5F9] truncate">
                    {activeFolder.name}
                  </h3>
                  <span className="text-xs font-bold text-[#8A92A2] tabular-nums shrink-0">
                    ({visibleRoutines.length})
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditFolderModal(activeFolder)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Editar / Rutinas
                </button>
                <button
                  type="button"
                  onClick={() => openBuilder(undefined, activeFolder.id)}
                  className="min-h-[38px] px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva rutina
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar carpeta ${activeFolder.name}`}
                  onClick={() => setConfirmDeleteFolderId(activeFolder.id)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#F1F5F9]">
                Mis Rutinas ({routines.length})
              </h3>
              <span className="text-xs text-[#8A92A2]">
                Organiza tus rutinas por carpetas o entrena en 1 toque
              </span>
            </div>
            <button
              type="button"
              onClick={openCreateFolderModal}
              className="min-h-[40px] px-3.5 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              Nueva carpeta
            </button>
          </div>
        )}

        {!activeFolder && folders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {folders.map((folder) => {
              const inside = routines.filter((r) => r.folderId === folder.id);
              const previewNames = inside
                .slice(0, 3)
                .map((r) => r.name)
                .join(' · ');
              return (
                <div
                  key={folder.id}
                  className="bg-[#0A0B0F] border border-[#1B1E26] hover:border-[#38BDF8]/60 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#38BDF8] shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#F1F5F9] truncate">
                          {folder.name}
                        </span>
                        <span className="text-xs font-bold text-[#38BDF8] tabular-nums shrink-0">
                          {inside.length} {inside.length === 1 ? 'rutina' : 'rutinas'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A92A2] truncate mt-0.5">
                        {inside.length > 0
                          ? `${previewNames}${inside.length > 3 ? ` · +${inside.length - 3} más` : ''}`
                          : 'Carpeta vacía · Toca para agregar rutinas'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8A92A2] shrink-0" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Editar carpeta ${folder.name}`}
                    onClick={() => openEditFolderModal(folder)}
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-[#101218] border border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9] flex items-center justify-center shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {visibleRoutines.length === 0 ? (
          <div className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-6 text-center flex flex-col items-center gap-3">
            <p className="text-sm text-[#8A92A2]">
              {activeFolder
                ? `La carpeta "${activeFolder.name}" aún no tiene rutinas.`
                : folders.length > 0
                ? 'Todas tus rutinas están organizadas dentro de tus carpetas.'
                : 'No tienes rutinas aún. Crea una manualmente o usa el generador automático.'}
            </p>
            {activeFolder && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditFolderModal(activeFolder)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9]"
                >
                  Agregar rutinas existentes
                </button>
                <button
                  type="button"
                  onClick={() => openBuilder(undefined, activeFolder.id)}
                  className="min-h-[40px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-xs font-extrabold text-[#F1F5F9]"
                >
                  + Crear nueva rutina aquí
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleRoutines.map((r) => {
              const exPreview = r.exercises
                .map((re) => {
                  const ex = getExerciseById(re.exId, user);
                  if (!ex) return '';
                  const setsCount = re.plannedSets?.length || re.sets || 1;
                  return re.targetReps
                    ? `${ex.name} (${setsCount}×${re.targetReps})`
                    : `${ex.name} (${setsCount} series)`;
                })
                .filter(Boolean)
                .slice(0, 4);

              return (
                <article
                  key={r.id}
                  className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-base font-extrabold text-[#F1F5F9] leading-snug">
                          {r.name}
                        </h4>
                        <div className="text-xs text-[#8A92A2] mt-1 tabular-nums">
                          <span className="text-[#38BDF8] font-semibold">
                            {r.exercises.length} ejercicios
                          </span>{' '}
                          ·{' '}
                          <span
                            className={
                              r.published
                                ? 'text-[#22C55E] font-semibold'
                                : 'text-[#8A92A2]'
                            }
                          >
                            {r.published ? '🌐 Publicada' : 'Privada'}
                          </span>
                          {r.author && r.author !== user.username && (
                            <span className="text-[#A855F7]">
                              {' '}
                              · De {r.author}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onStartRoutineWorkout(r.id)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Entrenar
                      </button>
                    </div>

                    <p className="text-xs text-[#8A92A2] mt-3 leading-relaxed">
                      {exPreview.join(' · ')}
                      {r.exercises.length > 4
                        ? ` · +${r.exercises.length - 4} más`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1B1E26]">
                    <button
                      type="button"
                      onClick={() => openBuilder(r)}
                      className="min-h-[36px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoveRoutineId(r.id)}
                      className="min-h-[36px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Carpeta
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetStoryRoutine(r.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border ${
                        (user.storyRoutineId || user.routines[0]?.id) === r.id
                          ? 'bg-[#FACC15]/15 border-[#FACC15] text-[#FACC15]'
                          : 'bg-[#101218] border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]'
                      }`}
                    >
                      {(user.storyRoutineId || user.routines[0]?.id) === r.id
                        ? '⭐ Tu Rutina (Historia)'
                        : 'Usar en Historia'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePublishRoutine(r.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-bold ${
                        r.published
                          ? 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406]'
                          : 'bg-[#101218] border border-[#1B1E26] text-[#F1F5F9]'
                      }`}
                    >
                      {r.published
                        ? '🌐 Dejar de publicar'
                        : '🚀 Publicar a Comunidad'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${r.name}`}
                      onClick={() => setConfirmDeleteRoutineId(r.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5] ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <RoutineBuilderOverlay
        open={builderOpen && builderDraft !== null}
        draft={builderDraft}
        user={user}
        selectedIdx={builderSelectedIdx}
        onSelectIdx={setBuilderSelectedIdx}
        onChangeDraft={setBuilderDraft}
        onOpenAddExercise={() => openSelector('builder')}
        onOpenReplaceExercise={(idx) => openSelector('replace', idx)}
        onClose={() => setBuilderOpen(false)}
        onSave={(savedRoutine) => {
          onSaveRoutine(savedRoutine);
          setBuilderOpen(false);
        }}
        onToast={onToast}
      />

      {/* AI / Smart Routine Generator Modal */}
      <Modal
        open={aiOpen}
        title="Generador Automático de Rutinas"
        onClose={() => setAiOpen(false)}
      >
        <p className="text-sm text-[#8A92A2]">
          Configura tu objetivo, días y lugar. El sistema creará un split completo adaptado para ti.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Objetivo principal
            </label>
            <select
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
            >
              <option value="hipertrofia">
                Hipertrofia (Ganancia muscular y estética)
              </option>
              <option value="powerbuilding">
                Powerbuilding (Fuerza base + Hipertrofia)
              </option>
              <option value="powerlifting">
                Powerlifting (Sentadilla, Banca y Peso Muerto)
              </option>
              <option value="fuerza">Fuerza Máxima General</option>
              <option value="calistenia">
                Calistenia y Habilidades (Muscle-up, Pino, Fuerza)
              </option>
              <option value="definicion">
                Pérdida de Grasa / Acondicionamiento Metabólico
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Lugar / Equipo
              </label>
              <select
                value={aiPlace}
                onChange={(e) =>
                  setAiPlace(e.target.value as 'gym' | 'home' | 'calistenia')
                }
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
              >
                <option value="gym">Gimnasio Completo</option>
                <option value="home">Casa (Básico / Mancuernas)</option>
                <option value="calistenia">Calistenia / Parque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Días por semana
              </label>
              <select
                value={aiDays}
                onChange={(e) => setAiDays(parseInt(e.target.value, 10))}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
              >
                <option value={2}>2 días (Full Body)</option>
                <option value={3}>3 días (Full Body / PPL)</option>
                <option value={4}>4 días (Torso / Pierna)</option>
                <option value={5}>5 días (PPL + Upper/Lower)</option>
                <option value={6}>6 días (Push / Pull / Legs ×2)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Nivel de experiencia
            </label>
            <select
              value={aiLevel}
              onChange={(e) => setAiLevel(e.target.value)}
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </div>

          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Guardar en carpeta (opcional)
              </label>
              <select
                value={aiFolderId}
                onChange={(e) => setAiFolderId(e.target.value)}
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-sm text-[#F1F5F9]"
              >
                <option value="">Sin carpeta (Lista principal)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm text-[#F1F5F9] cursor-pointer">
            <input
              type="checkbox"
              checked={aiPublish}
              onChange={(e) => setAiPublish(e.target.checked)}
              className="w-4 h-4 accent-[#38BDF8]"
            />
            Publicar rutinas generadas en la comunidad
          </label>

          <button
            type="button"
            onClick={() => {
              const generated = buildSmartRoutines({
                goal: aiGoal,
                place: aiPlace,
                days: aiDays,
                level: aiLevel,
                publish: aiPublish,
                username: user.username,
              });
              onAddGeneratedRoutines(generated, aiFolderId || undefined);
              setAiOpen(false);
            }}
            className="min-h-[46px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-bold"
          >
            ⚡ Generar Mis Rutinas
          </button>
        </div>
      </Modal>

      {/* Create / Edit Routine Folder Modal (with multi-routine selection) */}
      <Modal
        open={folderModalOpen}
        title={editingFolderId ? 'Editar Carpeta' : 'Nueva Carpeta de Rutinas'}
        onClose={() => setFolderModalOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Nombre de la carpeta
            </label>
            <input
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="Ej: Push / Pull / Legs, Volumen, Casa..."
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm font-bold text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#8A92A2]">
                Rutinas dentro de esta carpeta ({folderRoutineIds.length})
              </span>
              {routines.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFolderRoutineIds(
                      folderRoutineIds.length === routines.length
                        ? []
                        : routines.map((r) => r.id)
                    )
                  }
                  className="text-[11px] font-bold text-[#38BDF8]"
                >
                  {folderRoutineIds.length === routines.length
                    ? 'Quitar todas'
                    : 'Seleccionar todas'}
                </button>
              )}
            </div>

            {routines.length === 0 ? (
              <p className="text-xs text-[#8A92A2] rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
                Aún no tienes rutinas creadas. Guarda la carpeta y luego crea rutinas directamente dentro de ella.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {routines.map((r) => {
                  const checked = folderRoutineIds.includes(r.id);
                  const otherFolder =
                    r.folderId && r.folderId !== editingFolderId
                      ? folders.find((f) => f.id === r.folderId)
                      : null;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleFolderRoutineSelection(r.id)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                        checked
                          ? 'bg-[#1E40AF]/25 border-[#38BDF8]/60 text-[#F1F5F9]'
                          : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#F1F5F9] truncate">
                          {r.name}
                        </div>
                        <div className="text-[11px] text-[#8A92A2] truncate">
                          {r.exercises.length} ejercicios
                          {otherFolder ? ` · En "${otherFolder.name}"` : ''}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked
                            ? 'bg-[#1D4ED8] border-[#38BDF8] text-[#F1F5F9]'
                            : 'bg-[#101218] border-[#1B1E26]'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveFolderModal}
            className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {editingFolderId ? 'Guardar cambios' : 'Crear carpeta'}
          </button>
        </div>
      </Modal>

      {/* Move Single Routine to Folder Modal */}
      <Modal
        open={moveRoutineId !== null}
        title="Mover Rutina a Carpeta"
        onClose={() => setMoveRoutineId(null)}
        maxWidthClass="max-w-md"
      >
        {moveRoutineId && (() => {
          const targetRoutine = routines.find((r) => r.id === moveRoutineId);
          if (!targetRoutine) return null;
          return (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-[#8A92A2]">
                Elige dónde guardar <strong className="text-[#F1F5F9]">{targetRoutine.name}</strong>:
              </p>
              <button
                type="button"
                onClick={() => {
                  onMoveRoutineToFolder(targetRoutine.id, null);
                  setMoveRoutineId(null);
                  onToast('Rutina movida a la lista principal.');
                }}
                className={`min-h-[42px] px-3.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between ${
                  !targetRoutine.folderId || !folderIdsSet.has(targetRoutine.folderId)
                    ? 'bg-[#1E40AF]/25 border-[#38BDF8]/60 text-[#F1F5F9]'
                    : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9]'
                }`}
              >
                <span>Sin carpeta (Lista principal)</span>
                {(!targetRoutine.folderId || !folderIdsSet.has(targetRoutine.folderId)) && (
                  <Check className="w-4 h-4 text-[#38BDF8]" />
                )}
              </button>

              {folders.map((f) => {
                const isCurrent = targetRoutine.folderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onMoveRoutineToFolder(targetRoutine.id, f.id);
                      setMoveRoutineId(null);
                      onToast(`Rutina movida a "${f.name}".`);
                    }}
                    className={`min-h-[42px] px-3.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[#1E40AF]/25 border-[#38BDF8]/60 text-[#F1F5F9]'
                        : 'bg-[#07080B] border-[#1B1E26] text-[#F1F5F9] hover:border-[#38BDF8]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-[#38BDF8] shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    {isCurrent && <Check className="w-4 h-4 text-[#38BDF8] shrink-0" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  const rid = targetRoutine.id;
                  setMoveRoutineId(null);
                  setEditingFolderId(null);
                  setFolderNameInput('');
                  setFolderRoutineIds([rid]);
                  setFolderModalOpen(true);
                }}
                className="min-h-[42px] px-3.5 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 mt-1"
              >
                <FolderPlus className="w-4 h-4" />
                Crear nueva carpeta con esta rutina
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* Confirm Delete Folder Modal */}
      <Modal
        open={confirmDeleteFolderId !== null}
        title="Eliminar Carpeta"
        onClose={() => setConfirmDeleteFolderId(null)}
      >
        <p className="text-sm text-[#8A92A2]">
          ¿Seguro que deseas eliminar esta carpeta? Tus rutinas NO se borrarán: volverán a la lista principal.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setConfirmDeleteFolderId(null)}
            className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteFolderId) {
                onDeleteFolder(confirmDeleteFolderId);
                if (activeFolderId === confirmDeleteFolderId) {
                  setActiveFolderId(null);
                }
              }
              setConfirmDeleteFolderId(null);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
          >
            Eliminar carpeta
          </button>
        </div>
      </Modal>

      {/* Confirm Delete Routine Modal */}
      <Modal
        open={confirmDeleteRoutineId !== null}
        title="Eliminar Rutina"
        onClose={() => setConfirmDeleteRoutineId(null)}
      >
        <p className="text-sm text-[#8A92A2]">
          ¿Seguro que deseas eliminar esta rutina de tu lista?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setConfirmDeleteRoutineId(null)}
            className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteRoutineId) {
                onDeleteRoutine(confirmDeleteRoutineId);
              }
              setConfirmDeleteRoutineId(null);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
          >
            Eliminar
          </button>
        </div>
      </Modal>

      {renderSharedModals()}
    </div>
  );
}
