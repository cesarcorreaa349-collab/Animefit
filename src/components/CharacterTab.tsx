import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Pencil, Store, Trash2 } from 'lucide-react';
import { UserProfile } from '../types/animefit';
import {
  ACCESSORY_SLOT_ICONS,
  ACCESSORY_SLOT_LABELS,
  getAccessoryById,
  getAccessorySlotKey,
  getEquippedAccessoriesList,
  getOwnedAccessoryIds,
  SECONDARY_CURRENCY_COLOR,
  SECONDARY_CURRENCY_ICON,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { computeTrainingPvpBonus, getCharacterPhaseMoveset } from '../data/movesets';
import { getShopItemById, getUnlockedCharacterIds } from '../data/shopCatalog';
import {
  TRAINING_STYLE_OPTIONS,
  computeDailyStreakSummary,
  formatDuration,
  getActiveCharacterStage,
  getGlobalDisplayRecords,
  getLevelInfo,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';
import { Modal } from './Modal';
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
  onOpenShop?: () => void;
  onEquipAccessory?: (
    accessoryId: string | null,
    slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
  ) => void;
}

export function CharacterTab({
  user,
  onDeleteAccount,
  onChangePassword,
  onEditProfile,
  onOpenShop,
  onEquipAccessory,
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
  const st = getActiveCharacterStage(user);
  const ch = st.char;
  const activeMoveset = getCharacterPhaseMoveset(
    user.charId,
    st.effectiveLevel,
    st.stageName
  );
  const trainingBonus = computeTrainingPvpBonus(
    user.workoutsDone || 0,
    (user.history || []).map((h) => h.date)
  );
  const dailyStreak = computeDailyStreakSummary(user);
  const globalRecords = getGlobalDisplayRecords(user);
  const history = (user.history || []).slice().reverse().slice(0, 10);
  const todayWellness = getTodayWellnessLog(user);
  const coins = Math.max(0, Math.floor(Number(user.coins || 0)));
  const secondaryCoins = Math.max(0, Math.floor(Number(user.secondaryCoins || 0)));
  const ownedAccessoryIds = getOwnedAccessoryIds(user);
  const equippedAccessories = getEquippedAccessoriesList(user.equippedAccessories);
  const roomBestFloor = Math.max(0, Math.floor(Number(user.roomBestFloor || 0)));
  const roomBossMilestones = Array.isArray(user.roomBossMilestonesDefeated)
    ? [...user.roomBossMilestonesDefeated].sort((a, b) => a - b)
    : [];
  const unlockedCharsCount = getUnlockedCharacterIds(user).length;
  const equippedAura = user.equippedCosmetics?.auraId
    ? getShopItemById(user.equippedCosmetics.auraId)
    : undefined;
  const equippedTitle = user.equippedCosmetics?.titleId
    ? getShopItemById(user.equippedCosmetics.titleId)
    : undefined;
  const equippedEmblem = user.equippedCosmetics?.emblemId
    ? getShopItemById(user.equippedCosmetics.emblemId)
    : undefined;
  const ringAccent = equippedAura?.accentColor || ch.auraColor;

  return (
    <div className="flex flex-col gap-5">
      <section
        className="rounded-2xl border p-6 text-center bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),#0A0B0F_75%)]"
        style={{ borderColor: `${ringAccent}66` }}
      >
        <div
          className="w-32 h-32 mx-auto mb-3 rounded-full flex items-center justify-center border-[3px] bg-[#030406] aura-pulse"
          style={{
            borderColor: ringAccent,
            boxShadow: `0 0 28px ${ringAccent}55`,
          }}
        >
          <CharacterAvatar
            charId={ch.id}
            stageName={st.stageName}
            level={st.effectiveLevel}
            size="xl"
            className="border-0"
          />
        </div>

        <div className="text-xs font-semibold text-[#8A92A2]">
          {ch.anime} · Energía:{' '}
          <span className="font-bold" style={{ color: activeMoveset.energy.color }}>
            {activeMoveset.energy.name}
          </span>
          {equippedAura && (
            <span className="ml-1.5" style={{ color: ringAccent }}>
              · {equippedAura.icon} {equippedAura.name}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-black text-[#F1F5F9] mt-0.5 flex items-center justify-center gap-2">
          {equippedEmblem && <span title={equippedEmblem.name}>{equippedEmblem.icon}</span>}
          <span>{ch.name}</span>
        </h2>
        {equippedTitle && (
          <div className="text-xs font-bold text-amber-300 mt-0.5">
            {equippedTitle.icon} {equippedTitle.name}
          </div>
        )}
        <div
          className="text-base font-extrabold mt-1"
          style={{ color: ringAccent }}
        >
          ⚡ {st.stageName}
        </div>

        {equippedAccessories.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {equippedAccessories.map((acc) => (
              <span
                key={acc.id}
                className="px-2.5 py-0.5 rounded-lg border text-[11px] font-bold bg-[#07080B]"
                style={{
                  borderColor: `${acc.accentColor}55`,
                  color: acc.accentColor,
                }}
              >
                {acc.icon} {acc.name}
              </span>
            ))}
          </div>
        )}

        {onOpenShop && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onOpenShop}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-black text-amber-300 transition tabular-nums"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Tienda · 🪙 {coins.toLocaleString('es-ES')}</span>
              <span className="text-slate-400 font-semibold">· {unlockedCharsCount} guerreros</span>
            </button>
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border bg-[#07080B] px-3 py-2 text-xs font-black tabular-nums"
              style={{
                borderColor: `${SECONDARY_CURRENCY_COLOR}55`,
                color: SECONDARY_CURRENCY_COLOR,
              }}
            >
              <span>{SECONDARY_CURRENCY_ICON}</span>
              <span>
                {secondaryCoins.toLocaleString('es-ES')} {SECONDARY_CURRENCY_NAME}
              </span>
              {roomBestFloor > 0 && (
                <span className="text-slate-400 font-semibold">
                  · Sala {roomBestFloor}
                </span>
              )}
            </div>
          </div>
        )}

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
            <span className="font-bold text-[#F97316]">
              🔥 {dailyStreak.currentStreak}
            </span>{' '}
            <span className="text-[#8A92A2]">
              {dailyStreak.currentStreak === 1 ? 'Día racha' : 'Días racha'}
              {dailyStreak.pausedOnSunday ? ' (Pausa dom.)' : ''}
            </span>
          </div>
          <span className="text-[#1B1E26]" aria-hidden="true">
            ·
          </span>
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
            <span className="font-bold text-[#FACC15]">{globalRecords.length}</span>{' '}
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

      <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#F1F5F9]">
              Accesorios Anime & Torre de Salas
            </h3>
            <p className="text-xs text-[#8A92A2]">
              Colección: {ownedAccessoryIds.length} accesorios · Mejor sala:{' '}
              <strong className="text-[#2DD4BF]">
                {roomBestFloor > 0 ? `Sala ${roomBestFloor}` : 'Sin iniciar'}
              </strong>
              {roomBossMilestones.length > 0 && (
                <span className="ml-1.5 text-amber-300">
                  · Jefes: {roomBossMilestones.map((m) => `S.${m}`).join(', ')}
                </span>
              )}
            </p>
          </div>
          <span
            className="text-xs font-black tabular-nums px-2.5 py-1 rounded-lg border bg-[#07080B]"
            style={{
              borderColor: `${SECONDARY_CURRENCY_COLOR}44`,
              color: SECONDARY_CURRENCY_COLOR,
            }}
          >
            {SECONDARY_CURRENCY_ICON} {secondaryCoins.toLocaleString('es-ES')}{' '}
            {SECONDARY_CURRENCY_NAME}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {(['helm', 'armor', 'ring', 'amulet'] as const).map((slot) => {
            const slotKey = getAccessorySlotKey(slot);
            const eqDef = getAccessoryById(user.equippedAccessories?.[slotKey]);
            return (
              <div
                key={slot}
                className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#8A92A2]">
                    {ACCESSORY_SLOT_ICONS[slot]} {ACCESSORY_SLOT_LABELS[slot]}
                  </div>
                  <div
                    className="text-xs font-black truncate mt-0.5"
                    style={{ color: eqDef ? eqDef.accentColor : '#64748B' }}
                  >
                    {eqDef ? `${eqDef.icon} ${eqDef.name}` : 'Sin equipar'}
                  </div>
                </div>
                {eqDef && onEquipAccessory && (
                  <button
                    type="button"
                    onClick={() => onEquipAccessory(null, slotKey)}
                    className="text-[10px] font-bold px-2 py-1 rounded-md border border-[#1B1E26] bg-[#101218] text-slate-300 hover:text-white shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
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
              const unlocked = st.effectiveLevel >= s.levelReq;
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
                  <div className="flex items-center gap-3 min-w-0">
                    <CharacterAvatar
                      charId={ch.id}
                      stageName={s.phase}
                      level={s.levelReq}
                      size="sm"
                    />
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
              Récords Personales (PRs) y 1RM Globales
            </h3>
            {globalRecords.length === 0 ? (
              <p className="text-sm text-[#8A92A2]">
                Completa series en tus entrenamientos para registrar tus primeros PRs y 1RM estimado entre todas tus rutinas.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {globalRecords.map((rec) => {
                  const unit = rec.isCardio
                    ? 'min'
                    : rec.isBodyweight
                    ? 'kg / reps'
                    : 'kg';
                  return (
                    <div
                      key={rec.key}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                    >
                      <span className="text-xs font-bold text-[#F1F5F9] line-clamp-2">
                        {rec.name}
                      </span>
                      <div className="text-right whitespace-nowrap shrink-0 tabular-nums">
                        {rec.pr > 0 && (
                          <div className="text-xs font-black text-[#FACC15]">
                            {rec.pr} {unit}
                          </div>
                        )}
                        {!rec.isCardio && rec.oneRm > 0 && (
                          <div className="text-[11px] font-bold text-[#38BDF8]">
                            1RM: {rec.oneRm} kg
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
