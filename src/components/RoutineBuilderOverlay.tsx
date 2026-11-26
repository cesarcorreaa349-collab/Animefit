import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Dumbbell,
  FileText,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  Routine,
  RoutineExerciseItem,
  RoutineSetTemplate,
  UserProfile,
} from '../types/animefit';
import { getExerciseById, getLastExerciseSetsHistory } from '../utils/animefit';

interface RoutineBuilderOverlayProps {
  open: boolean;
  draft: Routine | null;
  user: UserProfile;
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onChangeDraft: (next: Routine) => void;
  onOpenAddExercise: () => void;
  onOpenReplaceExercise: (idx: number) => void;
  onClose: () => void;
  onSave: (routine: Routine) => void;
  onToast: (msg: string) => void;
}

function normalizePlannedSets(item: RoutineExerciseItem): RoutineSetTemplate[] {
  if (item.plannedSets && item.plannedSets.length > 0) {
    return item.plannedSets;
  }
  const count = Math.max(1, item.sets || 1);
  return Array.from({ length: count }, () => ({
    weight: '',
    reps: '',
  }));
}

export function RoutineBuilderOverlay({
  open,
  draft,
  user,
  selectedIdx,
  onSelectIdx,
  onChangeDraft,
  onOpenAddExercise,
  onOpenReplaceExercise,
  onClose,
  onSave,
  onToast,
}: RoutineBuilderOverlayProps) {
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    setNotesOpen(false);
  }, [selectedIdx, open]);

  if (!open || !draft) return null;

  const safeIdx =
    draft.exercises.length === 0
      ? 0
      : Math.min(selectedIdx, draft.exercises.length - 1);
  const activeItem = draft.exercises[safeIdx] || null;
  const activeEx = activeItem ? getExerciseById(activeItem.exId, user) : null;
  const prevHist =
    activeItem && activeEx
      ? getLastExerciseSetsHistory(user, activeItem.exId)
      : null;

  const plannedSets = activeItem ? normalizePlannedSets(activeItem) : [];

  const updateActiveItem = (
    updater: (item: RoutineExerciseItem) => RoutineExerciseItem
  ) => {
    if (!activeItem) return;
    const nextExercises = draft.exercises.map((it, idx) =>
      idx === safeIdx ? updater(it) : it
    );
    onChangeDraft({ ...draft, exercises: nextExercises });
  };

  const handleSetChange = (
    sIdx: number,
    field: 'weight' | 'reps',
    rawVal: string
  ) => {
    const parsed: number | '' =
      rawVal.trim() === ''
        ? ''
        : Number.isNaN(parseFloat(rawVal))
        ? ''
        : parseFloat(rawVal);

    updateActiveItem((it) => {
      const currSets = normalizePlannedSets(it);
      const nextSets = currSets.map((row, i) =>
        i === sIdx ? { ...row, [field]: parsed } : row
      );
      const firstReps = nextSets.find((r) => r.reps !== '')?.reps;
      return {
        ...it,
        sets: nextSets.length,
        targetReps: firstReps !== undefined && firstReps !== '' ? String(firstReps) : it.targetReps,
        plannedSets: nextSets,
      };
    });
  };

  const handleAddSet = () => {
    updateActiveItem((it) => {
      const currSets = normalizePlannedSets(it);
      const nextSets: RoutineSetTemplate[] = [
        ...currSets,
        { weight: '', reps: '' },
      ];
      return {
        ...it,
        sets: nextSets.length,
        plannedSets: nextSets,
      };
    });
  };

  const handleRemoveSet = (sIdx: number) => {
    updateActiveItem((it) => {
      const currSets = normalizePlannedSets(it);
      if (currSets.length <= 1) return it;
      const nextSets = currSets.filter((_, i) => i !== sIdx);
      return {
        ...it,
        sets: nextSets.length,
        plannedSets: nextSets,
      };
    });
  };

  const handleRemoveExercise = () => {
    const nextExercises = draft.exercises.filter((_, i) => i !== safeIdx);
    onChangeDraft({ ...draft, exercises: nextExercises });
    onSelectIdx(Math.max(0, safeIdx - 1));
  };

  const handleSaveClick = () => {
    if (!draft.name.trim()) {
      onToast('Escribe un nombre para tu rutina.');
      return;
    }
    if (draft.exercises.length === 0) {
      onToast('Añade al menos un ejercicio.');
      return;
    }
    const normalizedExercises = draft.exercises.map((it) => {
      const setsArr = normalizePlannedSets(it);
      const firstReps = setsArr.find((r) => r.reps !== '')?.reps;
      return {
        ...it,
        sets: setsArr.length,
        targetReps:
          firstReps !== undefined && firstReps !== ''
            ? String(firstReps)
            : it.targetReps || '',
        plannedSets: setsArr,
      };
    });
    onSave({
      ...draft,
      name: draft.name.trim(),
      exercises: normalizedExercises,
    });
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor de rutina"
      className="fixed inset-0 z-[75] bg-[#030406] text-[#F1F5F9] flex flex-col overflow-hidden"
    >
      {/* Top Header Bar (Symmetry-inspired clean navigation in AnimeFit colors) */}
      <header className="h-14 px-3 sm:px-5 border-b border-[#1B1E26] bg-[#07080B] flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar editor de rutina"
          className="min-h-[40px] min-w-[40px] rounded-xl bg-[#0A0B0F] border border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9] flex items-center justify-center shrink-0"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-sm sm:text-base font-black text-[#F1F5F9] truncate">
          {draft.name.trim() || 'Crear rutina'}
        </h2>

        <button
          type="button"
          onClick={handleSaveClick}
          aria-label="Guardar rutina"
          className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black flex items-center justify-center gap-1 shrink-0 shadow-[0_0_14px_rgba(29,78,216,0.26)]"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
        </button>
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] max-w-2xl w-full mx-auto flex flex-col gap-5">
        {/* Routine Name Input + Optional Folder Picker */}
        <div className="flex flex-col gap-2.5">
          <input
            value={draft.name}
            onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
            placeholder="Nombre de tu rutina (ej: Día de Empuje)"
            className="w-full min-h-[46px] bg-[#0A0B0F] border border-[#1B1E26] rounded-xl px-4 text-sm font-bold text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />
          {(user.routineFolders || []).length > 0 && (
            <select
              aria-label="Carpeta de la rutina"
              value={draft.folderId || ''}
              onChange={(e) => {
                const nextFolderId = e.target.value || undefined;
                onChangeDraft({ ...draft, folderId: nextFolderId });
              }}
              className="w-full min-h-[42px] bg-[#0A0B0F] border border-[#1B1E26] rounded-xl px-3.5 text-xs font-bold text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            >
              <option value="">📁 Sin carpeta (Lista principal)</option>
              {(user.routineFolders || []).map((f) => (
                <option key={f.id} value={f.id}>
                  📁 Carpeta: {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Horizontal Exercise Bubbles Strip + Add (+) Circle */}
        <div className="flex items-start gap-3 overflow-x-auto no-scrollbar pb-1">
          {draft.exercises.map((item, idx) => {
            const ex = getExerciseById(item.exId, user);
            const isActive = idx === safeIdx;
            const shortBadge = ex
              ? ex.muscle.slice(0, 3).toUpperCase()
              : 'EJ';
            return (
              <button
                key={`${item.exId}_${idx}`}
                type="button"
                onClick={() => onSelectIdx(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
              >
                <div
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'bg-[#101218] border-[#FACC15] text-[#FACC15] shadow-[0_0_14px_rgba(29,78,216,0.26)]'
                      : 'bg-[#0A0B0F] border-[#1B1E26] text-[#8A92A2] group-hover:border-[#38BDF8]'
                  }`}
                >
                  <Dumbbell className="w-4 h-4 mb-0.5" />
                  <span className="text-[10px] font-black tracking-wider">
                    {shortBadge}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-semibold leading-tight text-center line-clamp-1 w-full ${
                    isActive ? 'text-[#FACC15]' : 'text-[#8A92A2]'
                  }`}
                >
                  {ex ? ex.name : 'Ejercicio'}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenAddExercise}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
          >
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#38BDF8]/70 bg-[#0A0B0F]/70 hover:bg-[#101218] text-[#38BDF8] flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold text-[#38BDF8]">Añadir</span>
          </button>
        </div>

        {/* Active Exercise Detail & Per-Set Table (No center anatomical image!) */}
        {!activeItem || !activeEx ? (
          <div className="rounded-2xl border border-dashed border-[#1B1E26] bg-[#0A0B0F]/60 p-8 text-center flex flex-col items-center gap-3">
            <Dumbbell className="w-9 h-9 text-[#38BDF8]" />
            <div className="text-base font-extrabold text-[#F1F5F9]">
              Arma tu rutina sin límites
            </div>
            <p className="text-xs text-[#8A92A2] max-w-sm">
              Toca el botón <strong className="text-[#38BDF8]">+ Añadir</strong> de arriba para elegir tus ejercicios (incluye máquina Smith, pesas libres, calistenia y más). Tú eliges el peso y repeticiones de cada serie.
            </p>
            <button
              type="button"
              onClick={onOpenAddExercise}
              className="mt-1 min-h-[44px] px-5 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-xs font-black"
            >
              + Añadir Primer Ejercicio
            </button>
          </div>
        ) : (
          <section className="rounded-2xl bg-[#0A0B0F] border border-[#1B1E26] p-4 sm:p-5 flex flex-col gap-4">
            {/* Active Exercise Title & Metadata */}
            <div>
              <h3 className="text-lg font-black text-[#F1F5F9] leading-snug">
                {activeEx.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#8A92A2]">
                <span className="text-[#38BDF8] font-bold">
                  {activeEx.muscle}
                </span>
                <span>·</span>
                <span>{activeEx.type}</span>
                <span>·</span>
                <span className="text-[#FACC15] font-semibold">
                  {activeEx.subTag}
                </span>
                {prevHist && prevHist.bestWeight > 0 && (
                  <span className="text-[#22C55E] font-bold">
                    · Última vez: {prevHist.bestWeight}
                    {activeEx.isCardio ? ' min' : ' kg'}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenReplaceExercise(safeIdx)}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#38BDF8]" />
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                  notesOpen || activeItem.notes
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8]/50 text-[#38BDF8]'
                    : 'bg-[#101218] border-[#1B1E26] text-[#F1F5F9]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Notas
              </button>
              <button
                type="button"
                onClick={handleRemoveExercise}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5] inline-flex items-center gap-1.5 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar
              </button>
            </div>

            {(notesOpen || activeItem.notes) && (
              <div>
                <input
                  value={activeItem.notes || ''}
                  onChange={(e) =>
                    updateActiveItem((it) => ({ ...it, notes: e.target.value }))
                  }
                  placeholder="Nota opcional (ej: pausa 1s abajo, altura del banco 4...)"
                  className="w-full min-h-[40px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            )}

            {/* Per-Set Table (SERIE | PREVIA | KG | REPES | -) with NO prefilled default numbers */}
            <div>
              <div className="grid grid-cols-[40px_1fr_84px_84px_38px] gap-2 items-center text-[11px] font-extrabold uppercase tracking-wider text-[#8A92A2] text-center pb-2">
                <div>Serie</div>
                <div>Previa</div>
                <div>
                  {activeEx.isCardio
                    ? 'Min'
                    : activeEx.isBodyweight
                    ? 'Lastre'
                    : 'Kg'}
                </div>
                <div>{activeEx.isCardio ? 'Km/Nv' : 'Repes'}</div>
                <div />
              </div>

              <div className="flex flex-col gap-2">
                {plannedSets.map((row, sIdx) => {
                  const prevSet =
                    prevHist?.sets[sIdx] ||
                    (prevHist && prevHist.sets.length > 0
                      ? prevHist.sets[prevHist.sets.length - 1]
                      : null);
                  const prevText = prevSet
                    ? `${prevSet.weight === '' ? 0 : prevSet.weight} × ${
                        prevSet.reps === '' ? 0 : prevSet.reps
                      }`
                    : '—';

                  return (
                    <div
                      key={sIdx}
                      className="grid grid-cols-[40px_1fr_84px_84px_38px] gap-2 items-center"
                    >
                      <div className="text-center text-sm font-black text-[#38BDF8] tabular-nums">
                        {sIdx + 1}
                      </div>
                      <div className="text-center text-xs font-semibold text-[#8A92A2] truncate tabular-nums">
                        {prevText}
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="—"
                        value={row.weight === '' ? '' : row.weight}
                        onChange={(e) =>
                          handleSetChange(sIdx, 'weight', e.target.value)
                        }
                        className="min-h-[42px] w-full bg-[#07080B] border border-[#1B1E26] rounded-xl px-2 text-center text-sm font-bold text-[#F1F5F9] placeholder:text-[#475569] tabular-nums focus:outline-none focus:border-[#FACC15]"
                      />
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="—"
                        value={row.reps === '' ? '' : row.reps}
                        onChange={(e) =>
                          handleSetChange(sIdx, 'reps', e.target.value)
                        }
                        className="min-h-[42px] w-full bg-[#07080B] border border-[#1B1E26] rounded-xl px-2 text-center text-sm font-bold text-[#F1F5F9] placeholder:text-[#475569] tabular-nums focus:outline-none focus:border-[#38BDF8]"
                      />
                      <button
                        type="button"
                        disabled={plannedSets.length <= 1}
                        aria-label={`Eliminar serie ${sIdx + 1}`}
                        onClick={() => handleRemoveSet(sIdx)}
                        className="w-9 h-9 rounded-full bg-[#EF4444]/85 text-white flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed mx-auto"
                      >
                        <Minus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddSet}
                className="mt-3.5 min-h-[44px] w-full rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-extrabold text-[#F1F5F9] inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#38BDF8]" />
                Añadir serie
              </button>
            </div>
          </section>
        )}

        {/* Community Publish Option */}
        <label className="flex items-center gap-2.5 text-xs sm:text-sm text-[#8A92A2] cursor-pointer px-1">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) =>
              onChangeDraft({ ...draft, published: e.target.checked })
            }
            className="w-4 h-4 accent-[#38BDF8]"
          />
          Publicar en la Comunidad para que otros guerreros puedan copiarla
        </label>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
