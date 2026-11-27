import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Flame,
  KeyRound,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  Swords,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  computeTrainingPvpBonus,
  getCharacterPhaseMoveset,
} from '../data/movesets';
import { OnlinePvpUser } from '../hooks/usePvpSocket';
import { PvpInvite, PvpMatchState, UserProfile } from '../types/animefit';
import {
  getCharacterStage,
  getLevelInfo,
  playPvpEffectSound,
  unlockPvpAudio,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';
import { PhaseMovesetPreview } from './PhaseMovesetPreview';

interface PvpTabProps {
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  connected: boolean;
  reconnecting?: boolean;
  onlineUsers: OnlinePvpUser[];
  incomingInvites: PvpInvite[];
  roomCode: string | null;
  activeMatch: PvpMatchState | null;
  onRetryConnect?: () => void;
  onAddFriendByName: (name: string) => void;
  onSendChallenge: (toUsername: string) => void;
  onAcceptInvite: (inviteId: string) => void;
  onDeclineInvite: (inviteId: string) => void;
  onCreateRoom: () => void;
  onLeaveRoom?: () => void;
  onJoinRoom: (code: string) => void;
  onSendAction: (
    matchId: string,
    action: 'strike' | 'special' | 'guard' | 'ultimate'
  ) => void;
  onSendClashTap: (matchId: string) => void;
  onForfeitMatch: (matchId: string) => void;
  onRequestRematch?: (matchId: string) => void;
  onClearMatch: () => void;
  onToast: (msg: string) => void;
}

export function PvpTab({
  currentUser,
  allUsers,
  connected,
  reconnecting = false,
  onlineUsers,
  incomingInvites,
  roomCode,
  activeMatch,
  onRetryConnect,
  onAddFriendByName,
  onSendChallenge,
  onAcceptInvite,
  onDeclineInvite,
  onCreateRoom,
  onLeaveRoom,
  onJoinRoom,
  onSendAction,
  onSendClashTap,
  onForfeitMatch,
  onRequestRematch,
  onClearMatch,
  onToast,
}: PvpTabProps) {
  const [joinCode, setJoinCode] = useState('');
  const [friendNameInput, setFriendNameInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [sharedCode, setSharedCode] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [flashEventId, setFlashEventId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('animefit_pvp_sound_v1') !== '0';
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) unlockPvpAudio();
      try {
        window.localStorage.setItem('animefit_pvp_sound_v1', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const lv = getLevelInfo(currentUser.xp || 0);
  const st = getCharacterStage(currentUser.charId, lv.level);
  const lobbyMoveset = getCharacterPhaseMoveset(
    currentUser.charId,
    lv.level,
    st.stageName
  );
  const lobbyTrainingBonus = computeTrainingPvpBonus(
    currentUser.workoutsDone || 0,
    (currentUser.history || []).map((h) => h.date)
  );
  const myMaxHp = Math.round(
    140 +
      lv.level * 16 +
      (currentUser.workoutsDone || 0) * 4 +
      Object.keys(currentUser.prs || {}).length * 6
  );
  const myBaseAtk = Math.round(
    22 + lv.level * 4 + Math.min(26, (currentUser.workoutsDone || 0) * 1.4)
  );

  // Live 100ms tick for turn countdown, clash countdown, and 30s disconnect grace countdown
  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'active') return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => window.clearInterval(id);
  }, [activeMatch?.id, activeMatch?.status]);

  // Trigger brief visual hit/action pulse + optional lightweight WebAudio synth
  const lastEventId = activeMatch?.lastEvent?.id || null;
  const lastEventAction = activeMatch?.lastEvent?.action || null;
  const lastEventCrit = Boolean(activeMatch?.lastEvent?.crit);
  useEffect(() => {
    if (!lastEventId) return;
    setFlashEventId(lastEventId);
    if (soundEnabled) {
      if (lastEventAction === 'ultimate' || lastEventAction === 'clash_win') {
        playPvpEffectSound('ultimate');
      } else if (lastEventAction === 'special') {
        playPvpEffectSound('special');
      } else if (
        lastEventAction === 'guard' ||
        lastEventAction === 'clash_reflect'
      ) {
        playPvpEffectSound('guard');
      } else if (lastEventAction === 'strike') {
        playPvpEffectSound(lastEventCrit ? 'crit' : 'hit');
      }
    }
    const t = window.setTimeout(() => setFlashEventId(null), 700);
    return () => window.clearTimeout(t);
  }, [lastEventId, lastEventAction, lastEventCrit, soundEnabled]);

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      onToast(`Código ${roomCode} copiado al portapapeles.`);
      window.setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      onToast(`Comparte este código: ${roomCode}`);
    }
  };

  const handleShareRoomCode = async () => {
    if (!roomCode) return;
    const shareText = `⚡ ¡Te reto en AnimeFit PvP! Entra con el código: ${roomCode}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Duelo PvP en AnimeFit',
          text: shareText,
        });
        setSharedCode(true);
        window.setTimeout(() => setSharedCode(false), 2200);
        return;
      }
    } catch {
      // Fallback to clipboard copy cleanly if share was dismissed or unsupported in iframe
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setSharedCode(true);
      onToast(`Invitación con código ${roomCode} copiada para compartir.`);
      window.setTimeout(() => setSharedCode(false), 2200);
    } catch {
      onToast(`Comparte este código: ${roomCode}`);
    }
  };

  if (activeMatch) {
    const me = activeMatch.players[currentUser.username];
    const rivalName =
      activeMatch.playerOrder.find((n) => n !== currentUser.username) ||
      activeMatch.playerOrder[1];
    const rival = activeMatch.players[rivalName];

    const myPct = me ? Math.max(0, Math.round((me.hp / me.maxHp) * 100)) : 0;
    const rivalPct = rival
      ? Math.max(0, Math.round((rival.hp / rival.maxHp) * 100))
      : 0;
    const isMyTurn =
      activeMatch.status === 'active' &&
      !activeMatch.clash &&
      activeMatch.turn === currentUser.username;

    const rivalStatus = activeMatch.playerStatus?.[rivalName];
    const rivalOnlineInPresence = onlineUsers.some((u) => u.username === rivalName);
    const rivalConnected =
      rivalStatus !== undefined ? rivalStatus.connected : rivalOnlineInPresence;
    const rivalGraceSec =
      !rivalConnected && rivalStatus?.reconnectingUntil
        ? Math.max(0, Math.ceil((rivalStatus.reconnectingUntil - nowMs) / 1000))
        : null;

    const turnDurationMs = activeMatch.turnDurationMs || 22000;
    const turnMsLeft = activeMatch.turnEndsAt
      ? Math.max(0, activeMatch.turnEndsAt - nowMs)
      : turnDurationMs;
    const turnSecLeft = Math.ceil(turnMsLeft / 1000);
    const turnPct = Math.max(
      0,
      Math.min(100, Math.round((turnMsLeft / turnDurationMs) * 100))
    );

    const clashSecondsLeft = activeMatch.clash
      ? Math.max(0, activeMatch.clash.endsAt - nowMs)
      : 0;
    const myTaps = activeMatch.clash?.taps[currentUser.username] || 0;
    const rivalTaps = activeMatch.clash?.taps[rivalName] || 0;
    const totalTaps = Math.max(1, myTaps + rivalTaps);
    const clashBalancePct = Math.round((myTaps / totalTaps) * 100);

    const iWon = activeMatch.winner === currentUser.username;
    const lastEv = activeMatch.lastEvent;
    const isFlashing = Boolean(lastEv && flashEventId === lastEv.id);
    const showElementFlash = Boolean(
      isFlashing &&
        lastEv &&
        (lastEv.action === 'special' ||
          lastEv.action === 'ultimate' ||
          lastEv.action === 'clash_win' ||
          lastEv.crit)
    );
    const flashAccent = lastEv?.auraColor || st.char.auraColor || '#FACC15';
    const myMoveset = me
      ? getCharacterPhaseMoveset(me.charId, me.level, me.stageName)
      : lobbyMoveset;
    const myTotalDamage = activeMatch.damageDealt?.[currentUser.username] ?? 0;
    const rivalTotalDamage = activeMatch.damageDealt?.[rivalName] ?? 0;
    const myXpEarned =
      activeMatch.xpRewards?.[currentUser.username] ?? (iWon ? 80 : 35);

    const rematchList = activeMatch.rematchRequestedBy || [];
    const iRequestedRematch = rematchList.includes(currentUser.username);
    const rivalRequestedRematch = rematchList.includes(rivalName);

    return (
      <div className="flex flex-col gap-4">
        {/* Top Match Header + Rival Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
              Arena PvP en Tiempo Real · Ronda {activeMatch.round}
            </div>
            <h2 className="text-xl font-black text-[#F1F5F9] truncate">
              {currentUser.username} vs {rivalName}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Silenciar combate' : 'Activar sonido'}
              title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
              className="min-h-[38px] w-[38px] rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] flex items-center justify-center text-[#8A92A2] hover:text-[#F1F5F9]"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#38BDF8]" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            {activeMatch.status === 'active' && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold tabular-nums ${
                  rivalConnected
                    ? 'bg-[#07080B] border-[#22C55E]/40 text-[#22C55E]'
                    : 'bg-[#FACC15]/10 border-[#FACC15]/50 text-[#FACC15]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    rivalConnected ? 'bg-[#22C55E]' : 'bg-[#FACC15] animate-pulse'
                  }`}
                />
                {rivalConnected
                  ? `${rivalName}: Conectado`
                  : rivalGraceSec !== null
                  ? `Reconectando... (${rivalGraceSec}s)`
                  : 'Reconectando...'}
              </div>
            )}

            {activeMatch.status === 'active' ? (
              <button
                type="button"
                onClick={() => onForfeitMatch(activeMatch.id)}
                className="min-h-[38px] px-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
              >
                Retirarse
              </button>
            ) : (
              <button
                type="button"
                onClick={onClearMatch}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
              >
                ← Lobby PvP
              </button>
            )}
          </div>
        </div>

        {/* Local Auto-Reconnect Banner (Non-blocking) */}
        {!connected && (
          <div className="rounded-xl bg-[#FACC15]/12 border border-[#FACC15]/50 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-[#FACC15]">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
              <span className="truncate">
                {reconnecting
                  ? 'Conexión perdida. Reconectando automáticamente a la sala...'
                  : 'Sin conexión a la arena. Reintentando...'}
              </span>
            </div>
            {onRetryConnect && (
              <button
                type="button"
                onClick={onRetryConnect}
                className="px-2.5 py-1 rounded-lg bg-[#07080B] border border-[#FACC15]/40 text-[#FACC15] shrink-0"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {/* Fighters Arena Card */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[#38BDF8]/40 p-4 sm:p-5 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.06),#07080B_78%)] flex flex-col gap-3 transition-colors duration-200"
          style={
            showElementFlash
              ? { borderColor: `${flashAccent}AA` }
              : undefined
          }
        >
          {showElementFlash && lastEv && (
            <>
              <div
                key={`flash-${lastEv.id}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 pvp-tech-flash"
                style={{
                  background: `radial-gradient(circle at 50% 48%, ${flashAccent}4D, transparent 72%)`,
                }}
              />
              {(lastEv.action === 'ultimate' ||
                lastEv.action === 'clash_win' ||
                lastEv.action === 'special') && (
                <div
                  key={`ring-${lastEv.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border-2 pvp-ring-burst"
                  style={{ borderColor: flashAccent }}
                />
              )}
              {lastEv.skillName && (
                <div
                  key={`callout-${lastEv.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 flex justify-center"
                >
                  <div
                    className="pvp-callout-pop rounded-xl bg-[#030406]/90 border px-3.5 py-1.5 text-center shadow-lg max-w-full"
                    style={{ borderColor: `${flashAccent}B0` }}
                  >
                    <div
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: flashAccent }}
                    >
                      {lastEv.action === 'ultimate' || lastEv.action === 'clash_win'
                        ? '🔥 Técnica Definitiva'
                        : lastEv.action === 'special'
                        ? '✨ Técnica Especial'
                        : '⚡ Golpe Crítico'}
                    </div>
                    <div className="text-xs sm:text-sm font-black text-[#F1F5F9] truncate">
                      {lastEv.skillName}
                      {typeof lastEv.damage === 'number' && lastEv.damage > 0
                        ? ` · -${lastEv.damage} HP`
                        : ''}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Live Last Action / Damage Callout */}
          {lastEv && (
            <div
              className={`relative z-10 rounded-xl px-3 py-2 text-xs font-black text-center border transition-all duration-200 ${
                lastEv.action === 'special'
                  ? 'bg-[#07080B]/90 text-[#F1F5F9]'
                  : lastEv.crit || lastEv.action === 'clash_win'
                  ? 'bg-[#FACC15]/15 border-[#FACC15]/60 text-[#FACC15]'
                  : lastEv.action === 'guard'
                  ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#22C55E]'
                  : lastEv.action === 'timeout' || lastEv.action === 'disconnect'
                  ? 'bg-[#EF4444]/15 border-[#EF4444]/45 text-[#FCA5A5]'
                  : 'bg-[#38BDF8]/12 border-[#38BDF8]/45 text-[#38BDF8]'
              } ${isFlashing ? 'scale-[1.02]' : ''}`}
              style={
                lastEv.action === 'special'
                  ? {
                      borderColor: `${flashAccent}88`,
                      boxShadow: `0 0 14px ${flashAccent}28`,
                    }
                  : undefined
              }
            >
              {lastEv.label}
            </div>
          )}

          <div className="relative z-10 grid grid-cols-2 gap-4 items-start">
            {/* Me */}
            {me && (
              <div
                className={`flex flex-col items-center text-center rounded-xl p-2 transition-all duration-200 ${
                  isFlashing && lastEv?.target === me.username && (lastEv?.damage || 0) > 0
                    ? `bg-[#EF4444]/12 ring-2 ring-[#EF4444]/60 ${
                        showElementFlash ? 'pvp-hit-shake' : ''
                      }`
                    : isFlashing && lastEv?.actor === me.username && lastEv?.action === 'guard'
                    ? 'bg-[#22C55E]/10 ring-2 ring-[#22C55E]/50'
                    : ''
                }`}
              >
                <CharacterAvatar charId={me.charId} size="lg" />
                <div className="text-xs font-extrabold text-[#FACC15] mt-2 truncate max-w-full">
                  {me.username} (Tú)
                </div>
                <div className="text-[11px] font-bold text-[#8A92A2] truncate max-w-full">
                  Nv.{me.level} · {me.stageName}
                </div>
                {me.streakLabel && (
                  <div className="text-[10px] font-extrabold text-[#FACC15] truncate max-w-full mt-0.5 tabular-nums">
                    🔥 {me.streakLabel}
                    {me.ultBoostPct ? ` (+${me.ultBoostPct}% Def.)` : ''}
                  </div>
                )}
                <div className="w-full max-w-[160px] mt-2">
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                    <span className="text-[#22C55E]">HP</span>
                    <span>
                      {me.hp}/{me.maxHp}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-[#22C55E] transition-all duration-300"
                      style={{ width: `${myPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mt-1.5 mb-0.5">
                    <span className="text-[#FACC15]">Aura Ki</span>
                    <span>{me.aura}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#38BDF8] to-[#FACC15] transition-all duration-300"
                      style={{ width: `${me.aura}%` }}
                    />
                  </div>
                  {me.guarding && (
                    <div className="mt-1.5 text-[11px] font-bold text-[#22C55E]">
                      🛡️ Guardia activa
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rival */}
            {rival && (
              <div
                className={`flex flex-col items-center text-center rounded-xl p-2 transition-all duration-200 ${
                  isFlashing && lastEv?.target === rival.username && (lastEv?.damage || 0) > 0
                    ? `bg-[#EF4444]/12 ring-2 ring-[#EF4444]/60 ${
                        showElementFlash ? 'pvp-hit-shake' : ''
                      }`
                    : isFlashing && lastEv?.actor === rival.username && lastEv?.action === 'guard'
                    ? 'bg-[#22C55E]/10 ring-2 ring-[#22C55E]/50'
                    : ''
                }`}
              >
                <CharacterAvatar charId={rival.charId} size="lg" />
                <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      rivalConnected ? 'bg-[#22C55E]' : 'bg-[#FACC15] animate-pulse'
                    }`}
                  />
                  <span className="truncate">{rival.username}</span>
                </div>
                <div className="text-[11px] font-bold text-[#8A92A2] truncate max-w-full">
                  Nv.{rival.level} · {rival.stageName}
                </div>
                {rival.streakLabel && (
                  <div className="text-[10px] font-extrabold text-[#FACC15] truncate max-w-full mt-0.5 tabular-nums">
                    🔥 {rival.streakLabel}
                    {rival.ultBoostPct ? ` (+${rival.ultBoostPct}% Def.)` : ''}
                  </div>
                )}
                <div className="w-full max-w-[160px] mt-2">
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                    <span className="text-[#EF4444]">HP</span>
                    <span>
                      {rival.hp}/{rival.maxHp}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#EF4444] to-[#F97316] transition-all duration-300"
                      style={{ width: `${rivalPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mt-1.5 mb-0.5">
                    <span className="text-[#FACC15]">Aura Ki</span>
                    <span>{rival.aura}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#38BDF8] to-[#FACC15] transition-all duration-300"
                      style={{ width: `${rival.aura}%` }}
                    />
                  </div>
                  {rival.guarding && (
                    <div className="mt-1.5 text-[11px] font-bold text-[#38BDF8]">
                      🛡️ En Guardia
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Battle Controls or Result */}
        {activeMatch.status === 'active' ? (
          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
            {activeMatch.clash ? (
              <div className="rounded-2xl bg-[#07080B] border-2 border-[#FACC15] p-4 text-center flex flex-col gap-3">
                <div className="text-sm font-black text-[#FACC15]">
                  ⚡ ¡CHOQUE DE KI EN VIVO! ({myTaps} vs {rivalTaps})
                </div>
                <div className="text-xs text-[#8A92A2] tabular-nums">
                  ¡Toca más rápido que {rivalName}! Tiempo:{' '}
                  {(clashSecondsLeft / 1000).toFixed(1)}s
                </div>
                <div className="h-5 rounded-full bg-[#101218] border border-[#1B1E26] overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[#22C55E] to-[#FACC15] transition-all duration-75"
                    style={{ width: `${clashBalancePct}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) unlockPvpAudio();
                    onSendClashTap(activeMatch.id);
                  }}
                  className="min-h-[62px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black text-base active:scale-95 transition-transform shadow-[0_0_20px_rgba(29,78,216,0.35)]"
                >
                  ⚡ ¡IMPULSAR KI! ({myTaps} toques)
                </button>
              </div>
            ) : (
              <>
                {/* Turn Banner + Visible Countdown Bar */}
                <div
                  className={`rounded-xl px-3.5 py-2.5 border flex flex-col gap-2 ${
                    isMyTurn
                      ? 'bg-[#FACC15]/10 border-[#FACC15]/50'
                      : 'bg-[#07080B] border-[#1B1E26]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                    <span className={isMyTurn ? 'text-[#FACC15]' : 'text-[#8A92A2]'}>
                      {isMyTurn
                        ? '🔥 ¡Es tu turno! Elige movimiento'
                        : `⏳ Turno de ${activeMatch.turn}...`}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 tabular-nums font-black ${
                        turnSecLeft <= 6
                          ? 'text-[#EF4444]'
                          : isMyTurn
                          ? 'text-[#FACC15]'
                          : 'text-[#38BDF8]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {turnSecLeft}s
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#030406] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        turnSecLeft <= 6
                          ? 'bg-[#EF4444]'
                          : isMyTurn
                          ? 'bg-[#FACC15]'
                          : 'bg-[#38BDF8]'
                      }`}
                      style={{ width: `${turnPct}%` }}
                    />
                  </div>
                </div>

                {/* Agile Mobile Action Buttons (Phase-matched 4-move kit) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={!isMyTurn || !connected}
                    onClick={() => {
                      if (soundEnabled) unlockPvpAudio();
                      onSendAction(activeMatch.id, 'strike');
                    }}
                    className="min-h-[58px] px-3 py-2 rounded-xl bg-[#101218] border border-[#38BDF8]/50 text-[#F1F5F9] flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 active:scale-[0.98] transition-transform"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                      <Swords className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                      <span className="truncate">{myMoveset.physical.name}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#38BDF8]">
                      Físico · +30% Ki
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!isMyTurn || !connected || (me?.aura || 0) < 40}
                    onClick={() => {
                      if (soundEnabled) unlockPvpAudio();
                      onSendAction(activeMatch.id, 'special');
                    }}
                    className="min-h-[58px] px-3 py-2 rounded-xl bg-[#101218] border text-[#F1F5F9] flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 active:scale-[0.98] transition-transform"
                    style={{
                      borderColor:
                        isMyTurn && connected && (me?.aura || 0) >= 40
                          ? `${myMoveset.accentColor}99`
                          : '#1B1E26',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                      <Sparkles
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: myMoveset.accentColor }}
                      />
                      <span className="truncate">{myMoveset.special.name}</span>
                    </span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: myMoveset.accentColor }}
                    >
                      {(me?.aura || 0) >= 40
                        ? 'Especial · -40% Ki'
                        : `Especial (40% Ki)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!isMyTurn || !connected}
                    onClick={() => {
                      if (soundEnabled) unlockPvpAudio();
                      onSendAction(activeMatch.id, 'guard');
                    }}
                    className="min-h-[58px] px-3 py-2 rounded-xl bg-[#101218] border border-[#22C55E]/50 text-[#F1F5F9] flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 active:scale-[0.98] transition-transform"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                      <Shield className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                      <span className="truncate">{myMoveset.guard.name}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#22C55E]">
                      +8% HP · +20% Ki
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!isMyTurn || !connected || (me?.aura || 0) < 100}
                    onClick={() => {
                      if (soundEnabled) unlockPvpAudio();
                      onSendAction(activeMatch.id, 'ultimate');
                    }}
                    className={`min-h-[58px] px-3 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] transition-transform ${
                      isMyTurn && connected && (me?.aura || 0) >= 100
                        ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)]'
                        : 'bg-[#07080B] border border-[#1B1E26] text-[#8A92A2] opacity-50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{myMoveset.ultimate.name}</span>
                    </span>
                    <span className="text-[10px] font-semibold opacity-90">
                      {(me?.aura || 0) >= 100
                        ? 'Definitiva · Choque'
                        : `Definitiva (${me?.aura || 0}%)`}
                    </span>
                  </button>
                </div>
              </>
            )}

            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 flex flex-col gap-1.5">
              {activeMatch.log.map((entry, idx) => (
                <div
                  key={idx}
                  className={`text-xs ${
                    idx === 0 ? 'text-[#F1F5F9] font-bold' : 'text-[#8A92A2]'
                  }`}
                >
                  {entry}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section
            className={`rounded-2xl border p-5 text-center flex flex-col gap-4 ${
              iWon
                ? 'bg-[radial-gradient(circle_at_50%_15%,rgba(202,138,4,0.07),#0A0B0F_75%)] border-[#FACC15]/55'
                : 'bg-[#0A0B0F] border-[#EF4444]/45'
            }`}
          >
            <div className="text-3xl" aria-hidden="true">
              {iWon ? '🏆' : '💥'}
            </div>
            <div>
              <h3 className="text-xl font-black text-[#F1F5F9]">
                {iWon ? '¡Victoria en la Arena PvP!' : `Victoria de ${activeMatch.winner}`}
              </h3>
              <p className="text-xs sm:text-sm text-[#8A92A2] mt-1">
                {activeMatch.log[0] ||
                  (iWon
                    ? `Derrotaste a ${rivalName} en ${activeMatch.round} rondas.`
                    : `Gran pelea contra ${rivalName} en ${activeMatch.round} rondas.`)}
              </p>
            </div>

            {/* Quick Post-Match Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#8A92A2]">
                  Tu daño
                </div>
                <div className="text-base font-black text-[#38BDF8] tabular-nums mt-0.5">
                  {myTotalDamage} HP
                </div>
              </div>
              <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#8A92A2]">
                  Daño rival
                </div>
                <div className="text-base font-black text-[#F1F5F9] tabular-nums mt-0.5">
                  {rivalTotalDamage} HP
                </div>
              </div>
              <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#8A92A2]">
                  XP ganado
                </div>
                <div className="text-base font-black text-[#FACC15] tabular-nums mt-0.5">
                  +{myXpEarned} XP
                </div>
              </div>
            </div>

            {rivalRequestedRematch && !iRequestedRematch && (
              <div className="rounded-xl bg-[#FACC15]/12 border border-[#FACC15]/50 px-3 py-2 text-xs font-extrabold text-[#FACC15]">
                🔥 ¡{rivalName} quiere la revancha ahora mismo!
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={iRequestedRematch || !connected}
                onClick={() =>
                  onRequestRematch
                    ? onRequestRematch(activeMatch.id)
                    : onSendChallenge(rivalName)
                }
                className={`min-h-[46px] px-3 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                  rivalRequestedRematch && !iRequestedRematch
                    ? 'bg-gradient-to-br from-[#FACC15] to-[#D97706] text-[#030406] shadow-[0_0_16px_rgba(250,204,21,0.3)]'
                    : 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406]'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                {iRequestedRematch
                  ? `Esperando a ${rivalName}...`
                  : rivalRequestedRematch
                  ? '¡Aceptar Revancha!'
                  : 'Revancha'}
              </button>
              <button
                type="button"
                onClick={onClearMatch}
                className="min-h-[46px] px-3 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black"
              >
                Volver al Lobby
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  const onlineMap = new Map(onlineUsers.map((u) => [u.username, u]));
  const friendsList = currentUser.friends || [];
  const otherOnlineUsers = onlineUsers.filter(
    (u) => u.username !== currentUser.username && !friendsList.includes(u.username)
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Fighter PvP Summary Banner */}
      <section
        className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.06),#0A0B0F_72%)] flex flex-col gap-3.5"
        style={{ borderColor: `${st.char.auraColor}55` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <CharacterAvatar charId={st.char.id} size="md" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" />
                Arena PvP en Tiempo Real
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#F1F5F9] truncate">
                {currentUser.username} · {st.char.name}
              </h2>
              <p className="text-xs text-[#8A92A2] mt-0.5 tabular-nums">
                Nv.{lv.level} · {st.stageName} · HP {myMaxHp} · ATK {myBaseAtk} ·{' '}
                <span className="text-[#22C55E] font-bold">
                  {currentUser.pvpWins || 0}V
                </span>{' '}
                /{' '}
                <span className="text-[#EF4444] font-bold">
                  {currentUser.pvpLosses || 0}D
                </span>
              </p>
              {lobbyTrainingBonus.badgeLabel && (
                <p className="text-[11px] font-bold text-[#FACC15] mt-1 tabular-nums">
                  🔥 Bono de entreno: {lobbyTrainingBonus.badgeLabel} · +
                  {lobbyTrainingBonus.bonusAura}% Ki inicial · +
                  {lobbyTrainingBonus.ultBoostPct}% Definitiva
                </p>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#07080B] border border-[#1B1E26] text-xs font-bold shrink-0 self-start sm:self-center">
            {connected ? (
              <>
                <Wifi className="w-4 h-4 text-[#22C55E]" />
                <span className="text-[#22C55E]">
                  Conectado ({onlineUsers.length})
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-[#FACC15] animate-pulse" />
                <span className="text-[#FACC15]">
                  {reconnecting ? 'Reconectando...' : 'Conectando...'}
                </span>
                {onRetryConnect && (
                  <button
                    type="button"
                    onClick={onRetryConnect}
                    className="ml-1 px-2 py-0.5 rounded-md bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-[11px] font-bold text-[#38BDF8]"
                  >
                    Reintentar
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <PhaseMovesetPreview moveset={lobbyMoveset} compact />
      </section>

      {/* Incoming PvP Invites */}
      {incomingInvites.length > 0 && (
        <section className="rounded-2xl border-2 border-[#FACC15] bg-[#0A0B0F] p-4 flex flex-col gap-3">
          <div className="text-xs font-black uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            Desafíos PvP Entrantes
          </div>
          {incomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#07080B] border border-[#1B1E26]"
            >
              <div className="flex items-center gap-3">
                <CharacterAvatar charId={inv.fromCharId} size="sm" />
                <div>
                  <div className="text-sm font-black text-[#F1F5F9]">
                    {inv.fromUsername} te desafía a combate
                  </div>
                  <div className="text-xs text-[#8A92A2]">
                    Guerrero Nv.{inv.fromLevel} · Recompensa +80 XP al ganador
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAcceptInvite(inv.id)}
                  className="min-h-[40px] px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black"
                >
                  ⚔️ Aceptar Duelo
                </button>
                <button
                  type="button"
                  onClick={() => onDeclineInvite(inv.id)}
                  className="min-h-[40px] px-3 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2]"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Room Code Matchmaking */}
        <section className="lg:col-span-5 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
          <div>
            <h3 className="text-base font-extrabold text-[#F1F5F9] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#FACC15]" />
              Sala Privada con Código
            </h3>
            <p className="text-xs text-[#8A92A2] mt-1">
              Crea una sala y pasa el código a tu amigo por WhatsApp para pelear en vivo desde cualquier celular.
            </p>
          </div>

          {roomCode ? (
            <div className="rounded-xl bg-[#07080B] border border-[#FACC15]/50 p-3.5 text-center space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A92A2]">
                Esperando rival en la sala...
              </div>
              <div className="text-2xl font-black tracking-[0.25em] text-[#FACC15] font-mono">
                {roomCode}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyRoomCode()}
                  className={`min-h-[40px] rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    copiedCode
                      ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#22C55E]'
                      : 'bg-[#101218] border-[#1B1E26] text-[#F1F5F9] hover:border-[#38BDF8]'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Copiar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareRoomCode()}
                  className={`min-h-[40px] rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    sharedCode
                      ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#22C55E]'
                      : 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] border-[#38BDF8]/40 text-[#030406] font-black'
                  }`}
                >
                  {sharedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      ¡Listo!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      Compartir código
                    </>
                  )}
                </button>
              </div>
              {onLeaveRoom && (
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="text-[11px] font-semibold text-[#8A92A2] hover:text-[#FCA5A5] pt-0.5"
                >
                  Cerrar sala
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={!connected}
              onClick={onCreateRoom}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black disabled:opacity-50"
            >
              ⚡ Crear Sala PvP
            </button>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!joinCode.trim()) return;
              onJoinRoom(joinCode.trim());
            }}
            className="flex gap-2 pt-2 border-t border-[#1B1E26]"
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Código (ej: KI7X2)"
              className="flex-1 min-h-[42px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3 text-xs sm:text-sm font-mono uppercase text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
            <button
              type="submit"
              disabled={!connected}
              className="min-h-[42px] px-4 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-xs font-black whitespace-nowrap disabled:opacity-50"
            >
              Entrar
            </button>
          </form>
        </section>

        {/* Friends Direct PvP Challenge */}
        <section className="lg:col-span-7 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-[#F1F5F9] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#38BDF8]" />
              Retar a Mis Amigos ({friendsList.length})
            </h3>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!friendNameInput.trim()) return;
              onAddFriendByName(friendNameInput);
              setFriendNameInput('');
            }}
            className="flex gap-2"
          >
            <input
              value={friendNameInput}
              onChange={(e) => setFriendNameInput(e.target.value)}
              placeholder="Agregar amigo por usuario..."
              className="flex-1 min-h-[42px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
            <button
              type="submit"
              className="min-h-[42px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </form>

          {friendsList.length === 0 ? (
            <p className="text-xs text-[#8A92A2] py-2">
              Aún no agregaste amigos. Escribe el usuario de un amigo arriba o usa una Sala Privada con código para pelear al instante.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {friendsList.map((fname) => {
                const online = onlineMap.get(fname);
                const fu = allUsers[fname];
                const fLv = fu ? getLevelInfo(fu.xp || 0).level : online?.level || 1;
                const fCharId = fu?.charId || online?.charId || 'vegeta';
                const fStage = fu
                  ? getCharacterStage(fCharId, fLv).stageName
                  : online?.stageName || 'Guerrero';
                return (
                  <div
                    key={fname}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CharacterAvatar charId={fCharId} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#F1F5F9] truncate flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              online ? 'bg-[#22C55E]' : 'bg-[#64748B]'
                            }`}
                          />
                          <span className="truncate">{fname}</span>
                        </div>
                        <div className="text-xs text-[#8A92A2] truncate">
                          Nv.{fLv} · {fStage} ·{' '}
                          {online ? 'En línea' : 'Desconectado'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!online || !connected}
                      onClick={() => onSendChallenge(fname)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                        online
                          ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
                          : 'bg-[#101218] border border-[#1B1E26] text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      {online ? 'Retar' : 'Offline'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {otherOnlineUsers.length > 0 && (
            <div className="pt-3 border-t border-[#1B1E26] space-y-2">
              <div className="text-xs font-bold text-[#8A92A2]">
                Otros guerreros conectados ahora:
              </div>
              <div className="flex flex-wrap gap-2">
                {otherOnlineUsers.map((ou) => (
                  <button
                    key={ou.username}
                    type="button"
                    onClick={() => onSendChallenge(ou.username)}
                    className="min-h-[36px] px-3 rounded-lg bg-[#07080B] border border-[#22C55E]/40 text-xs font-bold text-[#F1F5F9] hover:border-[#FACC15] inline-flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    ⚔️ Retar a {ou.username} (Nv.{ou.level})
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
