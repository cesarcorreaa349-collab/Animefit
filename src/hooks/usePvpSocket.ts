import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from '../config/api';
import {
  buildUserPvpCosmeticLoadout,
  toShopLocalDateKey,
} from '../data/shopCatalog';
import {
  DailyPvpXpTracker,
  FriendNotification,
  PvpEmoteEvent,
  PvpInvite,
  PvpMatchKind,
  PvpMatchState,
  UserProfile,
} from '../types/animefit';
import {
  AuthSessionPayload,
  apiFetchWsToken,
  apiResumePvpSession,
  clearInMemoryAuthTokens,
  getActiveCharacterStage,
  getInMemoryWsToken,
  getLevelInfo,
} from '../utils/animefit';

export interface OnlinePvpUser {
  username: string;
  charId: string;
  stageName: string;
  level: number;
}

interface UsePvpSocketOptions {
  user: UserProfile | null;
  serverSessionEpoch?: number;
  onNotify: (msg: string) => void;
  onFriendAdded?: (notification: FriendNotification) => void;
  onSessionResumed?: (payload: AuthSessionPayload) => void;
  onReward: (payload: {
    xpEarned: number;
    coinsEarned?: number;
    matchKind?: PvpMatchKind;
    xpCapReached?: boolean;
    dailyXpEarned?: number;
    dailyXpCap?: number;
    notice?: string;
    won: boolean;
    totalXp?: number;
    totalCoins?: number;
    pvpWins?: number;
    pvpLosses?: number;
    pvpDailyXp?: DailyPvpXpTracker;
  }) => void;
}

export function usePvpSocket({
  user,
  serverSessionEpoch = 0,
  onNotify,
  onFriendAdded,
  onSessionResumed,
  onReward,
}: UsePvpSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const onNotifyRef = useRef(onNotify);
  const onFriendAddedRef = useRef(onFriendAdded);
  const onSessionResumedRef = useRef(onSessionResumed);
  const onRewardRef = useRef(onReward);
  const userRef = useRef(user);

  onNotifyRef.current = onNotify;
  onFriendAddedRef.current = onFriendAdded;
  onSessionResumedRef.current = onSessionResumed;
  onRewardRef.current = onReward;
  userRef.current = user;

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlinePvpUser[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<PvpInvite[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [queuedPublic, setQueuedPublic] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastEmote, setLastEmote] = useState<PvpEmoteEvent | null>(null);
  const [activeMatch, setActiveMatch] = useState<PvpMatchState | null>(null);
  const activeMatchRef = useRef<PvpMatchState | null>(null);
  activeMatchRef.current = activeMatch;

  const retryConnect = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  const sendAuth = useCallback(
    (ws: WebSocket, u: UserProfile, token?: string | null) => {
      const lv = getLevelInfo(u.xp || 0);
      const st = getActiveCharacterStage(u);
      ws.send(
        JSON.stringify({
          type: 'pvp:auth',
          ...(token ? { token } : {}),
          username: u.username,
          charId: u.charId,
          stageName: st.stageName,
          level: lv.level,
          workoutsDone: u.workoutsDone || 0,
          prsCount: Object.keys(u.prs || {}).length,
          cosmetics: buildUserPvpCosmeticLoadout(u),
          localDateKey: toShopLocalDateKey(new Date()),
          ...(activeMatchRef.current?.id
            ? { activeMatchId: activeMatchRef.current.id }
            : {}),
        })
      );
    },
    []
  );

  useEffect(() => {
    if (!user) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setReconnecting(false);
      setOnlineUsers([]);
      setIncomingInvites([]);
      setRoomCode(null);
      setQueuedPublic(false);
      setQueueSize(0);
      setLastEmote(null);
      setActiveMatch(null);
      return;
    }

    let cancelled = false;
    let attempt = 0;
    let authRetryCount = 0;
    let connecting = false;
    let fastRetryPending = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = (immediate = false) => {
      if (cancelled) return;
      clearReconnectTimer();
      const useFastDelay = immediate && authRetryCount <= 3;
      const delay = useFastDelay
        ? 60
        : Math.min(5000, Math.round(700 * Math.pow(1.45, attempt)));
      attempt = useFastDelay ? 0 : Math.min(attempt + 1, 6);
      setReconnecting(true);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect(useFastDelay);
      }, delay);
    };

    const resolveWsTokenSilently = async (
      forceRefreshToken: boolean
    ): Promise<string | null> => {
      if (forceRefreshToken) {
        clearInMemoryAuthTokens();
      } else {
        const cached = getInMemoryWsToken();
        if (cached) return cached;
      }

      const tokenRes = await apiFetchWsToken();
      if (cancelled) return null;
      if (tokenRes.ok) {
        authRetryCount = 0;
        return tokenRes.wsToken;
      }

      if (userRef.current) {
        const resumed = await apiResumePvpSession(userRef.current);
        if (cancelled) return null;
        if (resumed.ok && resumed.data.wsToken) {
          authRetryCount = 0;
          onSessionResumedRef.current?.(resumed.data);
          return resumed.data.wsToken;
        }
      }
      return null;
    };

    const connect = async (forceRefreshToken: boolean) => {
      if (cancelled || connecting) return;
      const existingWs = wsRef.current;
      if (
        !forceRefreshToken &&
        existingWs &&
        (existingWs.readyState === WebSocket.OPEN ||
          existingWs.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      connecting = true;
      setReconnecting(true);
      let activeToken: string | null = null;
      try {
        activeToken = await resolveWsTokenSilently(forceRefreshToken);
      } finally {
        connecting = false;
      }

      if (cancelled) return;
      if (!activeToken) {
        scheduleReconnect(false);
        return;
      }

      const endpoint = wsUrl(`/ws/pvp?token=${encodeURIComponent(activeToken)}`);
      const ws = new WebSocket(endpoint);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        clearReconnectTimer();
        if (userRef.current) {
          sendAuth(ws, userRef.current, activeToken);
        }
      };

      ws.onmessage = (evt) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(evt.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = String(msg.type || '');

        if (type === 'pvp:authenticated') {
          attempt = 0;
          authRetryCount = 0;
          setConnected(true);
          setReconnecting(false);
        } else if (type === 'pvp:presence') {
          attempt = 0;
          authRetryCount = 0;
          setConnected(true);
          setReconnecting(false);
          setOnlineUsers((msg.users as OnlinePvpUser[]) || []);
        } else if (type === 'pvp:invite') {
          const invite = msg.invite as PvpInvite;
          setIncomingInvites((prev) => {
            if (prev.some((i) => i.id === invite.id)) return prev;
            return [invite, ...prev];
          });
          onNotifyRef.current(
            `⚔️ ¡${invite.fromUsername} (Nv.${invite.fromLevel}) te retó a un duelo PvP!`
          );
        } else if (type === 'pvp:invite_sent') {
          onNotifyRef.current(
            `📩 Reto PvP enviado a ${String(msg.toUsername || '')}.`
          );
        } else if (type === 'pvp:invite_declined') {
          onNotifyRef.current(
            `${String(msg.byUsername || '')} rechazó el duelo PvP.`
          );
        } else if (type === 'pvp:room_created') {
          setRoomCode(String(msg.code || ''));
        } else if (type === 'pvp:room_closed') {
          setRoomCode(null);
        } else if (type === 'pvp:queue_status') {
          setQueuedPublic(Boolean(msg.queued));
          setQueueSize(Number(msg.queueSize || 0));
        } else if (type === 'pvp:emote') {
          const ev = msg.event as PvpEmoteEvent | undefined;
          if (ev && ev.id) {
            setLastEmote(ev);
          }
        } else if (type === 'pvp:match_state') {
          const match = msg.match as PvpMatchState;
          setActiveMatch(match);
          setRoomCode(null);
          setQueuedPublic(false);
          setIncomingInvites([]);
          if (match.lastEmote) {
            setLastEmote(match.lastEmote);
          }
        } else if (type === 'pvp:match_lost') {
          const lostId = String(msg.matchId || '');
          if (activeMatchRef.current?.id === lostId) {
            setActiveMatch(null);
            onNotifyRef.current(
              String(msg.message || 'La partida anterior expiró tras reiniciar el servidor.')
            );
          }
        } else if (type === 'pvp:rematch_notice') {
          onNotifyRef.current(
            `🔥 ¡${String(msg.fromUsername || 'Tu rival')} pidió la revancha!`
          );
        } else if (type === 'pvp:reward') {
          onRewardRef.current({
            xpEarned: Number(msg.xpEarned || 0),
            coinsEarned: Number(msg.coinsEarned || 0),
            matchKind:
              typeof msg.matchKind === 'string'
                ? (msg.matchKind as PvpMatchKind)
                : undefined,
            xpCapReached: Boolean(msg.xpCapReached),
            dailyXpEarned:
              typeof msg.dailyXpEarned === 'number' ? msg.dailyXpEarned : undefined,
            dailyXpCap:
              typeof msg.dailyXpCap === 'number' ? msg.dailyXpCap : undefined,
            notice: typeof msg.notice === 'string' ? msg.notice : undefined,
            won: Boolean(msg.won),
            totalXp:
              typeof msg.totalXp === 'number' ? msg.totalXp : undefined,
            totalCoins:
              typeof msg.totalCoins === 'number' ? msg.totalCoins : undefined,
            pvpWins:
              typeof msg.pvpWins === 'number' ? msg.pvpWins : undefined,
            pvpLosses:
              typeof msg.pvpLosses === 'number' ? msg.pvpLosses : undefined,
            pvpDailyXp:
              msg.pvpDailyXp && typeof msg.pvpDailyXp === 'object'
                ? (msg.pvpDailyXp as DailyPvpXpTracker)
                : undefined,
          });
        } else if (type === 'social:friend_added') {
          const notification = msg.notification as
            | FriendNotification
            | undefined;
          if (notification && notification.fromUsername) {
            onFriendAddedRef.current?.(notification);
          }
        } else if (type === 'pvp:error') {
          const code = String(msg.code || '');
          const message = String(msg.message || 'Error en PvP.');
          if (
            code === 'AUTH_REQUIRED' ||
            message.includes('Debes iniciar sesión')
          ) {
            clearInMemoryAuthTokens();
            authRetryCount += 1;
            fastRetryPending = true;
            ws.close();
            return;
          }
          onNotifyRef.current(message);
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setConnected(false);
        setQueuedPublic(false);
        if (cancelled) return;
        const immediate = fastRetryPending;
        fastRetryPending = false;
        scheduleReconnect(immediate);
      };
    };

    const handleWakeOrOnline = () => {
      if (cancelled) return;
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return;
      }
      const currentWs = wsRef.current;
      if (
        !currentWs ||
        (currentWs.readyState !== WebSocket.OPEN &&
          currentWs.readyState !== WebSocket.CONNECTING)
      ) {
        attempt = 0;
        clearReconnectTimer();
        void connect(false);
      }
    };

    window.addEventListener('online', handleWakeOrOnline);
    document.addEventListener('visibilitychange', handleWakeOrOnline);
    void connect(false);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleWakeOrOnline);
      document.removeEventListener('visibilitychange', handleWakeOrOnline);
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.username, serverSessionEpoch, retryNonce, sendAuth]);

  // Keep server seed fresh when user levels up / changes character / equips PvP cosmetics
  useEffect(() => {
    if (user && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendAuth(wsRef.current, user, getInMemoryWsToken());
    }
  }, [
    user?.charId,
    user?.xp,
    user?.workoutsDone,
    user?.equippedCosmetics,
    user?.inventory,
    sendAuth,
  ]);

  const send = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    onNotifyRef.current('Reconectando con la arena PvP...');
    retryConnect();
    return false;
  }, [retryConnect]);

  return {
    connected,
    reconnecting,
    retryConnect,
    onlineUsers,
    incomingInvites,
    roomCode,
    queuedPublic,
    queueSize,
    lastEmote,
    activeMatch,
    sendChallenge: (toUsername: string) =>
      send({ type: 'pvp:challenge', toUsername }),
    acceptInvite: (inviteId: string) => {
      setIncomingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      return send({ type: 'pvp:accept', inviteId });
    },
    declineInvite: (inviteId: string) => {
      setIncomingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      return send({ type: 'pvp:decline', inviteId });
    },
    createRoom: () => send({ type: 'pvp:create_room' }),
    leaveRoom: () => {
      setRoomCode(null);
      return send({ type: 'pvp:leave_room' });
    },
    joinRoom: (code: string) => send({ type: 'pvp:join_room', code }),
    joinPublicQueue: () => send({ type: 'pvp:queue_join' }),
    leavePublicQueue: () => {
      setQueuedPublic(false);
      return send({ type: 'pvp:queue_leave' });
    },
    sendEmote: (matchId: string, emoteId: string) =>
      send({ type: 'pvp:emote', matchId, emoteId }),
    sendAction: (
      matchId: string,
      action: 'strike' | 'special' | 'guard' | 'ultimate'
    ) => send({ type: 'pvp:action', matchId, action }),
    sendClashTap: (matchId: string) =>
      send({ type: 'pvp:clash_tap', matchId }),
    forfeitMatch: (matchId: string) =>
      send({ type: 'pvp:forfeit', matchId }),
    requestRematch: (matchId: string) =>
      send({ type: 'pvp:rematch', matchId }),
    clearMatch: () => setActiveMatch(null),
  };
}
