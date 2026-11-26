import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Flame,
  KeyRound,
  RotateCcw,
  Shield,
  Swords,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { OnlinePvpUser } from '../hooks/usePvpSocket';
import { PvpInvite, PvpMatchState, UserProfile } from '../types/animefit';
import { getCharacterStage, getLevelInfo } from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';

interface PvpTabProps {
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  connected: boolean;
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
  onJoinRoom: (code: string) => void;
  onSendAction: (matchId: string, action: 'strike' | 'guard' | 'ultimate') => void;
  onSendClashTap: (matchId: string) => void;
  onForfeitMatch: (matchId: string) => void;
  onClearMatch: () => void;
  onToast: (msg: string) => void;
}

export function PvpTab({
  currentUser,
  allUsers,
  connected,
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
  onJoinRoom,
  onSendAction,
  onSendClashTap,
  onForfeitMatch,
  onClearMatch,
  onToast,
}: PvpTabProps) {
  const [joinCode, setJoinCode] = useState('');
  const [friendNameInput, setFriendNameInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [clashSecondsLeft, setClashSecondsLeft] = useState(0);

  const lv = getLevelInfo(currentUser.xp || 0);
  const st = getCharacterStage(currentUser.charId, lv.level);
  const myMaxHp = Math.round(
    140 +
      lv.level * 16 +
      (currentUser.workoutsDone || 0) * 4 +
      Object.keys(currentUser.prs || {}).length * 6
  );
  const myBaseAtk = Math.round(
    22 + lv.level * 4 + Math.min(26, (currentUser.workoutsDone || 0) * 1.4)
  );

  useEffect(() => {
    if (!activeMatch?.clash) {
      setClashSecondsLeft(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, activeMatch.clash!.endsAt - Date.now());
      setClashSecondsLeft(left);
    };
    update();
    const id = window.setInterval(update, 80);
    return () => window.clearInterval(id);
  }, [activeMatch?.clash]);

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      onToast(`Código ${roomCode} copiado. Pásaselo a tu amigo.`);
      window.setTimeout(() => setCopiedCode(false), 2200);
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

    const myTaps = activeMatch.clash?.taps[currentUser.username] || 0;
    const rivalTaps = activeMatch.clash?.taps[rivalName] || 0;
    const totalTaps = Math.max(1, myTaps + rivalTaps);
    const clashBalancePct = Math.round((myTaps / totalTaps) * 100);
    const iWon = activeMatch.winner === currentUser.username;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
              Arena PvP en Tiempo Real · Ronda {activeMatch.round}
            </div>
            <h2 className="text-xl font-black text-[#F1F5F9]">
              {currentUser.username} vs {rivalName}
            </h2>
          </div>
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

        {/* Fighters Arena Card */}
        <section className="rounded-2xl border border-[#38BDF8]/40 p-4 sm:p-5 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.06),#07080B_78%)]">
          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Me */}
            {me && (
              <div className="flex flex-col items-center text-center">
                <CharacterAvatar charId={me.charId} size="lg" />
                <div className="text-xs font-extrabold text-[#FACC15] mt-2 truncate max-w-full">
                  {me.username} (Tú)
                </div>
                <div className="text-[11px] font-bold text-[#8A92A2] truncate max-w-full">
                  Nv.{me.level} · {me.stageName}
                </div>
                <div className="w-full max-w-[160px] mt-2.5">
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
              <div className="flex flex-col items-center text-center">
                <CharacterAvatar charId={rival.charId} size="lg" />
                <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
                  {rival.username}
                </div>
                <div className="text-[11px] font-bold text-[#8A92A2] truncate max-w-full">
                  Nv.{rival.level} · {rival.stageName}
                </div>
                <div className="w-full max-w-[160px] mt-2.5">
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
          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
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
                  onClick={() => onSendClashTap(activeMatch.id)}
                  className="min-h-[62px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black text-base active:scale-95 transition-transform shadow-[0_0_20px_rgba(29,78,216,0.35)]"
                >
                  ⚡ ¡IMPULSAR KI! ({myTaps} toques)
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`rounded-xl px-3.5 py-2 text-xs font-extrabold text-center border ${
                    isMyTurn
                      ? 'bg-[#FACC15]/12 border-[#FACC15]/45 text-[#FACC15]'
                      : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2]'
                  }`}
                >
                  {isMyTurn
                    ? '🔥 ¡Es tu turno! Elige tu movimiento'
                    : `⏳ Esperando jugada de ${activeMatch.turn}...`}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    disabled={!isMyTurn}
                    onClick={() => onSendAction(activeMatch.id, 'strike')}
                    className="min-h-[50px] px-4 rounded-xl bg-[#101218] border border-[#38BDF8]/50 text-[#F1F5F9] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-45 active:scale-[0.98]"
                  >
                    <Swords className="w-4 h-4 text-[#38BDF8]" />
                    Golpe de Ki
                  </button>
                  <button
                    type="button"
                    disabled={!isMyTurn}
                    onClick={() => onSendAction(activeMatch.id, 'guard')}
                    className="min-h-[50px] px-4 rounded-xl bg-[#101218] border border-[#22C55E]/50 text-[#F1F5F9] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-45 active:scale-[0.98]"
                  >
                    <Shield className="w-4 h-4 text-[#22C55E]" />
                    Guardia (+HP)
                  </button>
                  <button
                    type="button"
                    disabled={!isMyTurn || (me?.aura || 0) < 100}
                    onClick={() => onSendAction(activeMatch.id, 'ultimate')}
                    className={`min-h-[50px] px-4 rounded-xl font-black text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] ${
                      isMyTurn && (me?.aura || 0) >= 100
                        ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)]'
                        : 'bg-[#07080B] border border-[#1B1E26] text-[#8A92A2] opacity-50'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    {(me?.aura || 0) >= 100
                      ? '¡Definitiva!'
                      : `Definitiva (${me?.aura || 0}%)`}
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
            <h3 className="text-xl font-black text-[#F1F5F9]">
              {iWon ? '¡Victoria en la Arena PvP!' : `Victoria de ${activeMatch.winner}`}
            </h3>
            <p className="text-sm text-[#8A92A2]">
              {iWon
                ? `Dominaste a ${rivalName} y ganaste +80 XP para ${st.char.name}.`
                : `Gran batalla contra ${rivalName}. Ganaste +35 XP de combate.`}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSendChallenge(rivalName)}
                className="min-h-[46px] rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-xs font-black inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Pedir Revancha
              </button>
              <button
                type="button"
                onClick={onClearMatch}
                className="min-h-[46px] rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black"
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
        className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.06),#0A0B0F_72%)]"
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
                Nv.{lv.level} · HP {myMaxHp} · ATK {myBaseAtk} ·{' '}
                <span className="text-[#22C55E] font-bold">
                  {currentUser.pvpWins || 0}V
                </span>{' '}
                /{' '}
                <span className="text-[#EF4444] font-bold">
                  {currentUser.pvpLosses || 0}D
                </span>
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#07080B] border border-[#1B1E26] text-xs font-bold shrink-0 self-start sm:self-center">
            {connected ? (
              <>
                <Wifi className="w-4 h-4 text-[#22C55E]" />
                <span className="text-[#22C55E]">
                  En línea ({onlineUsers.length})
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-[#FACC15]" />
                <span className="text-[#FACC15]">Conectando...</span>
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
              <button
                type="button"
                onClick={() => void handleCopyRoomCode()}
                className="min-h-[38px] w-full rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] inline-flex items-center justify-center gap-1.5"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                    Código copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar código
                  </>
                )}
              </button>
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
