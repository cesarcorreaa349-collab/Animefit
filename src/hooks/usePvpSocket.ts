import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from '../config/api';
import {
  FriendNotification,
  PvpInvite,
  PvpMatchState,
  UserProfile,
} from '../types/animefit';
import { getCharacterStage, getLevelInfo } from '../utils/animefit';

export interface OnlinePvpUser {
  username: string;
  charId: string;
  stageName: string;
  level: number;
}

interface UsePvpSocketOptions {
  user: UserProfile | null;
  onNotify: (msg: string) => void;
  onFriendAdded?: (notification: FriendNotification) => void;
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
  onNotify,
  onFriendAdded,
  onReward,
}: UsePvpSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const onNotifyRef = useRef(onNotify);
  const onFriendAddedRef = useRef(onFriendAdded);
  const onRewardRef = useRef(onReward);
  const userRef = useRef(user);

  onNotifyRef.current = onNotify;
  onFriendAddedRef.current = onFriendAdded;
  onRewardRef.current = onReward;
  userRef.current = user;

  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlinePvpUser[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<PvpInvite[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<PvpMatchState | null>(null);

  const sendAuth = useCallback((ws: WebSocket, u: UserProfile) => {
    const lv = getLevelInfo(u.xp || 0);
    const st = getCharacterStage(u.charId, lv.level);
    ws.send(
      JSON.stringify({
        type: 'pvp:auth',
        username: u.username,
        charId: u.charId,
        stageName: st.stageName,
        level: lv.level,
        workoutsDone: u.workoutsDone || 0,
        prsCount: Object.keys(u.prs || {}).length,
      })
    );
  }, []);

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

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl('/ws/pvp'));
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attempt = 0;
        setConnected(true);
        if (userRef.current) {
          sendAuth(ws, userRef.current);
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
          const notification = msg.notification as FriendNotification | undefined;
          if (notification && notification.fromUsername) {
            onFriendAddedRef.current?.(notification);
          }
        } else if (type === 'pvp:error') {
          onNotifyRef.current(String(msg.message || 'Error en PvP.'));
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(8000, 1000 * Math.pow(1.5, attempt));
        attempt += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.username, sendAuth]);

  // Keep server seed fresh when user levels up / changes character
  useEffect(() => {
    if (user && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendAuth(wsRef.current, user);
    }
  }, [user?.charId, user?.xp, user?.workoutsDone, sendAuth]);

  const send = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    onNotifyRef.current('Reconectando con la arena PvP...');
    return false;
  }, []);

  return {
    connected,
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
