import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { UserProfile } from '../types/animefit';
import { computeTrainingPvpBonus, getCharacterPhaseMoveset } from '../data/movesets';
import {
  TRAINING_STYLE_OPTIONS,
  formatDuration,
  getAllOneRmRecordEntries,
  getCharacterStage,
  getExerciseById,
  getLevelInfo,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';
import { Modal } from './Modal';
import { NotificationSettingsCard } from './NotificationSettingsCard';
import { PhaseMovesetPreview } from './PhaseMovesetPreview';
import { WeeklySundaySummaryCard } from './WeeklySundaySummary';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';
import { getTodayWellnessLog } from './WellnessTrackerSection';

interface CharacterTabProps {
  user: UserProfile;
  onDeleteAccount: () => void;
  onChangePassword: (
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onEditProfile?: () => void;
  reminderSupported: boolean;
  reminderPermission: NotificationPermission | 'unsupported';
  reminderEnabled: boolean;
  hoursSinceActivity: number | null;
  onRequestReminderPermission: () => void | Promise<unknown>;
  onRefreshReminderPermission: () => void;
  onToggleReminder: () => void;
  onTestReminder: () => void;
}

export function CharacterTab({
  user,
  onDeleteAccount,
  onChangePassword,
  onEditProfile,
  reminderSupported,
  reminderPermission,
  reminderEnabled,
  hoursSinceActivity,
  onRequestReminderPermission,
  onRefreshReminderPermission,
  onToggleReminder,
  onTestReminder,
}: CharacterTabProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const openPasswordModal = () => {
    setNewPassInput('');
    setConfirmPassInput('');
    setShowPasswords(false);
    setPasswordError(null);
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newPassInput.trim();
    const confirm = confirmPassInput.trim();

    if (next.length < 3 || next.length > 128) {
      setPasswordError('La nueva contraseña debe tener entre 3 y 128 caracteres.');
      return;
    }
    if (next !== confirm) {
      setPasswordError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setPasswordError(null);
    setSavingPassword(true);
    const res = await onChangePassword(next);
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(res.error);
      return;
    }
    setPasswordModalOpen(false);
    setNewPassInput('');
    setConfirmPassInput('');
  };

  const lv = getLevelInfo(user.xp);
  const st = getCharacterStage(user.charId, lv.level);
  const ch = st.char;
  const activeMoveset = getCharacterPhaseMoveset(
    user.charId,
    lv.level,
    st.stageName
  );
  const trainingBonus = computeTrainingPvpBonus(
    user.workoutsDone || 0,
    (user.history || []).map((h) => h.date)
  );
  const prs = Object.entries(user.prs || {});
  const oneRmMap = getAllOneRmRecordEntries(user);
  const recordExIds = Array.from(
    new Set([...Object.keys(user.prs || {}), ...Object.keys(oneRmMap)])
  );
  const history = (user.history || []).slice().reverse().slice(0, 10);
  const todayWellness = getTodayWellnessLog(user);

  return (
    <div className="flex flex-col gap-5">
      <section
        className="rounded-2xl border p-6 text-center bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),#0A0B0F_75%)]"
        style={{ borderColor: `${ch.auraColor}66` }}
      >
        <div
          className="w-32 h-32 mx-auto mb-3 rounded-full flex items-center justify-center border-[3px] bg-[#030406] aura-pulse"
          style={{
            borderColor: ch.auraColor,
            boxShadow: `0 0 28px ${ch.auraColor}55`,
          }}
        >
          <CharacterAvatar charId={ch.id} size="xl" className="border-0" />
        </div>

        <div className="text-xs font-semibold text-[#8A92A2]">
          {ch.anime} · Energía:{' '}
          <span className="font-bold" style={{ color: activeMoveset.energy.color }}>
            {activeMoveset.energy.name}
          </span>
        </div>
        <h2 className="text-2xl font-black text-[#F1F5F9] mt-0.5">{ch.name}</h2>
        <div
          className="text-base font-extrabold mt-1"
          style={{ color: ch.auraColor }}
        >
          ⚡ {st.stageName}
        </div>

        <div className="max-w-md mx-auto mt-4">
          <div className="flex items-center justify-between text-xs font-bold tabular-nums">
            <span className="text-[#FACC15]">Nivel {lv.level}</span>
            <span className="text-[#8A92A2]">
              {lv.currentXp} / {lv.neededXp} XP · Total {lv.totalXp} XP
            </span>
          </div>
          <div className="h-3 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden my-2">
            <div
              className="h-full bg-gradient-to-r from-[#38BDF8] to-[#FACC15] transition-all duration-300"
              style={{ width: `${lv.pct}%` }}
            />
          </div>
          <p className="text-xs text-[#8A92A2]">
            {st.nextStage ? (
              <>
                Siguiente evolución:{' '}
                <strong className="text-[#38BDF8]">{st.nextStage.phase}</strong>{' '}
                al Nivel{' '}
                <strong className="text-[#F1F5F9] tabular-nums">
                  {st.nextStage.levelReq}
                </strong>
              </>
            ) : (
              <>👑 ¡Has alcanzado la transformación definitiva de {ch.name}!</>
            )}
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-[#1B1E26] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm tabular-nums">
          <div>
            <span className="font-bold text-[#38BDF8]">
              {user.workoutsDone || 0}
            </span>{' '}
            <span className="text-[#8A92A2]">Entrenamientos</span>
          </div>
          <span className="text-[#1B1E26]" aria-hidden="true">
            ·
          </span>
          <div>
            <span className="font-bold text-[#FACC15]">{prs.length}</span>{' '}
            <span className="text-[#8A92A2]">PRs Logrados</span>
          </div>
          <span className="text-[#1B1E26]" aria-hidden="true">
            ·
          </span>
          <div>
            <span className="font-bold text-[#38BDF8]">
              {todayWellness.steps.toLocaleString('es-ES')}
            </span>{' '}
            <span className="text-[#8A92A2]">Pasos hoy</span>
          </div>
          <span className="text-[#1B1E26]" aria-hidden="true">
            ·
          </span>
          <div>
            <span className="font-bold text-[#3B82F6]">
              {todayWellness.sleepHours}h
            </span>{' '}
            <span className="text-[#8A92A2]">Sueño hoy</span>
          </div>
        </div>

        <div className="mt-4 text-left">
          <PhaseMovesetPreview moveset={activeMoveset} />
          {trainingBonus.badgeLabel && (
            <div className="mt-2.5 text-[11px] font-bold text-[#FACC15] text-center tabular-nums">
              🔥 Bono de entreno PvP: {trainingBonus.badgeLabel} · +
              {trainingBonus.bonusAura}% {activeMoveset.energy.shortName} inicial · +
              {trainingBonus.ultBoostPct}% daño en Definitiva
            </div>
          )}
        </div>
      </section>

      <WeeklyVolumeChart history={user.history || []} />

      <WeeklySundaySummaryCard user={user} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-6 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-extrabold text-[#F1F5F9]">
              Línea Evolutiva de {ch.name}
            </h3>
            <span className="text-xs text-[#8A92A2] tabular-nums">
              {ch.stages.length} fases
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {ch.stages.map((s, idx) => {
              const unlocked = lv.level >= s.levelReq;
              const isCurrent = st.stageName === s.phase;
              return (
                <div
                  key={`${s.levelReq}_${s.phase}`}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border transition-opacity ${
                    unlocked ? 'opacity-100' : 'opacity-55'
                  }`}
                  style={{
                    borderColor: isCurrent
                      ? ch.auraColor
                      : unlocked
                      ? 'rgba(34,197,94,0.35)'
                      : '#1B1E26',
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-sm font-bold truncate"
                      style={{ color: isCurrent ? ch.auraColor : '#F1F5F9' }}
                    >
                      Fase {idx + 1}: {s.phase}
                    </div>
                    <div className="text-xs text-[#8A92A2] tabular-nums">
                      Requisito: Nivel {s.levelReq}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold whitespace-nowrap shrink-0 tabular-nums ${
                      isCurrent
                        ? 'text-[#FACC15]'
                        : unlocked
                        ? 'text-[#22C55E]'
                        : 'text-[#8A92A2]'
                    }`}
                  >
                    {isCurrent
                      ? '⚡ Activa'
                      : unlocked
                      ? '✓ Desbloqueada'
                      : `🔒 Nv.${s.levelReq}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="lg:col-span-6 flex flex-col gap-5">
          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-extrabold text-[#F1F5F9] mb-3">
              Récords Personales (PRs) y 1RM
            </h3>
            {recordExIds.length === 0 ? (
              <p className="text-sm text-[#8A92A2]">
                Completa series en tus entrenamientos para registrar tus primeros PRs y 1RM estimado.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recordExIds.map((exId) => {
                  const ex = getExerciseById(exId, user);
                  if (!ex) return null;
                  const val = user.prs?.[exId];
                  const oneRm = oneRmMap[exId] || 0;
                  const unit = ex.isCardio
                    ? 'min'
                    : ex.isBodyweight
                    ? 'kg / reps'
                    : 'kg';
                  return (
                    <div
                      key={exId}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                    >
                      <span className="text-xs font-bold text-[#F1F5F9] line-clamp-2">
                        {ex.name}
                      </span>
                      <div className="text-right whitespace-nowrap shrink-0 tabular-nums">
                        {typeof val === 'number' && val > 0 && (
                          <div className="text-xs font-black text-[#FACC15]">
                            {val} {unit}
                          </div>
                        )}
                        {!ex.isCardio && oneRm > 0 && (
                          <div className="text-[11px] font-bold text-[#38BDF8]">
                            1RM: {oneRm} kg
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-extrabold text-[#F1F5F9] mb-3">
              Últimos Entrenamientos
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-[#8A92A2]">
                Todavía no has finalizado ningún entrenamiento.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h, idx) => (
                  <div
                    key={`${h.date}_${idx}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F1F5F9] truncate">
                        {h.name}
                      </div>
                      <div className="text-xs text-[#8A92A2] tabular-nums">
                        {new Date(h.date).toLocaleDateString('es-ES')} · {h.sets} series ·{' '}
                        {formatDuration(h.durationMs)}
                      </div>
                    </div>
                    <span className="text-xs font-black text-[#38BDF8] whitespace-nowrap shrink-0 tabular-nums">
                      +{h.xp} XP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {user.profileSetup && (
            <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-[#F1F5F9]">
                  Ficha de Mi usuario
                </h3>
                {onEditProfile && (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="min-h-[34px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8] inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center tabular-nums">
                <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                  <div className="text-xs font-black text-[#F1F5F9]">
                    {user.profileSetup.age} años
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">Edad</div>
                </div>
                <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                  <div className="text-xs font-black text-[#F1F5F9]">
                    {user.profileSetup.weightKg} kg
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">Peso</div>
                </div>
                <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                  <div className="text-xs font-black text-[#F1F5F9]">
                    {user.profileSetup.heightCm} cm
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">Altura</div>
                </div>
                <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                  <div className="text-xs font-black text-[#38BDF8]">
                    {user.profileSetup.experienceValue}{' '}
                    {user.profileSetup.experienceUnit}
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">Experiencia</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {user.profileSetup.trainingStyles.map((styleId) => {
                  const found = TRAINING_STYLE_OPTIONS.find((o) => o.id === styleId);
                  return (
                    <span
                      key={styleId}
                      className="px-2.5 py-1 rounded-lg bg-[#07080B] border border-[#1B1E26] text-[11px] font-bold text-[#FACC15]"
                    >
                      {found ? `${found.icon} ${found.label}` : styleId}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          <NotificationSettingsCard
            supported={reminderSupported}
            permission={reminderPermission}
            enabled={reminderEnabled}
            hoursSinceActivity={hoursSinceActivity}
            onRequestPermission={onRequestReminderPermission}
            onRefreshPermission={onRefreshReminderPermission}
            onToggleReminder={onToggleReminder}
            onTestReminder={onTestReminder}
          />

          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#F1F5F9] truncate">
                Cuenta: {user.username}
              </div>
              <div className="text-xs text-[#8A92A2] truncate">{user.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openPasswordModal}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-[#F1F5F9] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#38BDF8]" />
                Cambiar contraseña
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Cuenta
              </button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={passwordModalOpen}
        title="Cambiar Contraseña"
        onClose={() => {
          if (!savingPassword) setPasswordModalOpen(false);
        }}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Nueva contraseña
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="Mínimo 3 caracteres"
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Confirmar nueva contraseña
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassInput}
              onChange={(e) => setConfirmPassInput(e.target.value)}
              placeholder="Repite tu nueva contraseña"
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="self-start text-xs font-semibold text-[#8A92A2] hover:text-[#F1F5F9] inline-flex items-center gap-1.5 min-h-[32px]"
          >
            {showPasswords ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Ocultar contraseñas
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Mostrar contraseñas
              </>
            )}
          </button>

          {passwordError && (
            <div
              role="alert"
              className="rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/35 px-3 py-2 text-xs font-semibold text-[#FCA5A5]"
            >
              {passwordError}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              disabled={savingPassword}
              onClick={() => setPasswordModalOpen(false)}
              className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingPassword}
              className="min-h-[42px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              {savingPassword ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmDeleteOpen}
        title="Eliminar Cuenta"
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <p className="text-sm text-[#8A92A2]">
          ¿Seguro que deseas eliminar la cuenta <strong className="text-[#F1F5F9]">{user.username}</strong>? Se borrarán tus rutinas, XP y récords en este dispositivo y podrás registrarte nuevamente.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(false)}
            className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDeleteOpen(false);
              onDeleteAccount();
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
          >
            Sí, eliminar cuenta
          </button>
        </div>
      </Modal>
    </div>
  );
}
