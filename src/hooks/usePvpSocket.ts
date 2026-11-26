import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from '../config/api';
import {
  FriendNotification,
  PvpInvite,
  PvpMatchState,
  UserProfile,
} from '../types/animefit';
import {
  AuthSessionPayload,
  apiFetchWsToken,
  apiResumePvpSession,
  clearInMemoryAuthTokens,
  getCharacterStage,
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
    won: boolean;
    totalXp?: number;
    pvpWins?: number;
    pvpLosses?: number;
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
  const [retryNonce, setRetryNonce] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlinePvpUser[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<PvpInvite[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<PvpMatchState | null>(null);

  const retryConnect = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  const sendAuth = useCallback(
    (ws: WebSocket, u: UserProfile, token?: string | null) => {
      const lv = getLevelInfo(u.xp || 0);
      const st = getCharacterStage(u.charId, lv.level);
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
      setOnlineUsers([]);
      setIncomingInvites([]);
      setRoomCode(null);
      setActiveMatch(null);
      return;
    }

    let cancelled = false;
    let attempt = 0;
    let connecting = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      clearReconnectTimer();
      const delay = Math.min(6000, Math.round(900 * Math.pow(1.45, attempt)));
      attempt = Math.min(attempt + 1, 6);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect(false);
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
        return tokenRes.wsToken;
      }

      if (tokenRes.unauthenticated && userRef.current) {
        const resumed = await apiResumePvpSession(userRef.current);
        if (cancelled) return null;
        if (resumed.ok && resumed.data.wsToken) {
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
      let activeToken: string | null = null;
      try {
        activeToken = await resolveWsTokenSilently(forceRefreshToken);
      } finally {
        connecting = false;
      }

      if (cancelled) return;
      if (!activeToken) {
        scheduleReconnect();
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
        attempt = 0;
        clearReconnectTimer();
        setConnected(true);
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

        if (type === 'pvp:presence') {
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
        } else if (type === 'pvp:match_state') {
          const match = msg.match as PvpMatchState;
          setActiveMatch(match);
          setRoomCode(null);
          setIncomingInvites([]);
        } else if (type === 'pvp:reward') {
          onRewardRef.current({
            xpEarned: Number(msg.xpEarned || 0),
            won: Boolean(msg.won),
            totalXp:
              typeof msg.totalXp === 'number' ? msg.totalXp : undefined,
            pvpWins:
              typeof msg.pvpWins === 'number' ? msg.pvpWins : undefined,
            pvpLosses:
              typeof msg.pvpLosses === 'number' ? msg.pvpLosses : undefined,
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
        if (cancelled) return;
        scheduleReconnect();
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

  // Keep server seed fresh when user levels up / changes character
  useEffect(() => {
    if (user && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendAuth(wsRef.current, user, getInMemoryWsToken());
    }
  }, [user?.charId, user?.xp, user?.workoutsDone, sendAuth]);

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
    retryConnect,
    onlineUsers,
    incomingInvites,
    roomCode,
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
    joinRoom: (code: string) => send({ type: 'pvp:join_room', code }),
    sendAction: (matchId: string, action: 'strike' | 'guard' | 'ultimate') =>
      send({ type: 'pvp:action', matchId, action }),
    sendClashTap: (matchId: string) =>
      send({ type: 'pvp:clash_tap', matchId }),
    forfeitMatch: (matchId: string) =>
      send({ type: 'pvp:forfeit', matchId }),
    clearMatch: () => setActiveMatch(null),
  };
}
