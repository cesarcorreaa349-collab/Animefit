import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Dumbbell,
  HelpCircle,
  LogOut,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { CharacterAvatar } from './components/CharacterAvatar';
import { CharacterTab } from './components/CharacterTab';
import { Modal } from './components/Modal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PvpTab } from './components/PvpTab';
import { RankingTab } from './components/RankingTab';
import { StoryTab } from './components/StoryTab';
import { TrainTab } from './components/TrainTab';
import {
  WeeklySundaySummaryModal,
  formatLocalDateKey,
} from './components/WeeklySundaySummary';
import { WelcomeTutorialModal } from './components/WelcomeTutorialModal';
import {
  applyDetectedStepsToWellness,
  getLocalDateKey,
} from './components/WellnessTrackerSection';
import { useAutoPedometer } from './hooks/useAutoPedometer';
import { useInactivityNotifications } from './hooks/useInactivityNotifications';
import { usePvpSocket } from './hooks/usePvpSocket';
import {
  ActiveWorkout,
  AppDB,
  AthleteProfileSetup,
  DailyWellnessState,
  ExerciseDef,
  FriendNotification,
  MainTab,
  Routine,
  RoutineFolder,
  StoryChapter,
  StoryProgress,
  UserProfile,
  WorkoutSummaryInfo,
} from './types/animefit';
import {
  apiChangePassword,
  apiCreateGroup,
  apiDeleteAccount,
  apiLogin,
  apiLogout,
  apiMarkFriendNotificationsRead,
  apiRegister,
  apiToggleGroup,
  assignCharacterBySex,
  buildAppDBFromServerAuth,
  buildRoutinesFromOnboarding,
  clearLocalDeviceCache,
  getCharacterById,
  getCharacterStage,
  getExerciseById,
  getLevelInfo,
  getStoryWeeklyStatus,
  loadDB,
  markExplicitLogout,
  persistDB,
  pushDBToServer,
  removeUserFromDB,
  resolveUsername,
  syncDBFromBackups,
} from './utils/animefit';

interface ToastItem {
  id: number;
  text: string;
}

export default function App() {
  const [db, setDb] = useState<AppDB>(() => loadDB());
  const [mainTab, setMainTab] = useState<MainTab>('entrenar');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [assignedCharId, setAssignedCharId] = useState<string | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [editingProfileOpen, setEditingProfileOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialDismissedRef = useRef<Set<string>>(new Set());
  const [sundaySummaryOpen, setSundaySummaryOpen] = useState(false);
  const sundayDismissedRef = useRef<Set<string>>(new Set());

  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3100);
  }, []);

  const latestDbRef = useRef(db);
  latestDbRef.current = db;

  const updateDb = useCallback(
    (updater: (prev: AppDB) => AppDB, immediateServer = false) => {
      setDb((prev) => {
        const next = updater(prev);
        latestDbRef.current = next;
        persistDB(next, immediateServer);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void syncDBFromBackups(loadDB()).then((synced) => {
      if (!cancelled && synced) {
        latestDbRef.current = synced;
        setDb(synced);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const flush = () => {
      const snapshot = latestDbRef.current;
      if (!snapshot.sessionUser) return;
      persistDB(snapshot, false);
      pushDBToServer(snapshot, true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const resolvedSession = resolveUsername(db.users, db.sessionUser);
  const currentUser: UserProfile | null = resolvedSession
    ? db.users[resolvedSession] || null
    : null;

  const activeWorkout: ActiveWorkout | null = currentUser
    ? db.activeWorkouts[currentUser.username] || null
    : null;

  const closeWelcomeTutorial = useCallback(() => {
    setTutorialOpen(false);
    if (!currentUser) return;
    const key = currentUser.username.toLowerCase();
    tutorialDismissedRef.current.add(key);
    try {
      window.localStorage.setItem(`animefit_welcome_tutorial_seen_v1_${key}`, '1');
    } catch {
      // Ignore storage errors
    }
  }, [currentUser]);

  useEffect(() => {
    if (
      !currentUser ||
      !currentUser.profileSetup ||
      editingProfileOpen ||
      assignedCharId !== null ||
      activeWorkout
    ) {
      return;
    }
    const key = currentUser.username.toLowerCase();
    if (tutorialDismissedRef.current.has(key)) return;
    let seen = false;
    try {
      seen =
        window.localStorage.getItem(`animefit_welcome_tutorial_seen_v1_${key}`) ===
        '1';
    } catch {
      seen = false;
    }
    if (!seen && (currentUser.workoutsDone || 0) === 0) {
      setTutorialOpen(true);
    }
  }, [currentUser, editingProfileOpen, assignedCharId, activeWorkout]);

  const closeSundaySummary = useCallback(() => {
    setSundaySummaryOpen(false);
    if (!currentUser) return;
    const todayKey = formatLocalDateKey(new Date());
    const seenKey = `${currentUser.username.toLowerCase()}_${todayKey}`;
    sundayDismissedRef.current.add(seenKey);
    try {
      window.localStorage.setItem(
        `animefit_sunday_summary_seen_v1_${seenKey}`,
        '1'
      );
    } catch {
      // Ignore storage errors
    }
  }, [currentUser]);

  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 0) return;
    if (
      !currentUser ||
      !currentUser.profileSetup ||
      editingProfileOpen ||
      assignedCharId !== null ||
      activeWorkout ||
      tutorialOpen
    ) {
      return;
    }
    const todayKey = formatLocalDateKey(now);
    const seenKey = `${currentUser.username.toLowerCase()}_${todayKey}`;
    if (sundayDismissedRef.current.has(seenKey)) return;
    let seen = false;
    try {
      seen =
        window.localStorage.getItem(
          `animefit_sunday_summary_seen_v1_${seenKey}`
        ) === '1';
    } catch {
      seen = false;
    }
    if (!seen) {
      setSundaySummaryOpen(true);
    }
  }, [
    currentUser,
    editingProfileOpen,
    assignedCharId,
    activeWorkout,
    tutorialOpen,
  ]);

  const handlePvpReward = useCallback(
    (payload: {
      xpEarned: number;
      won: boolean;
      totalXp?: number;
      pvpWins?: number;
      pvpLosses?: number;
    }) => {
      if (!currentUser) return;
      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: {
              ...u,
              xp:
                typeof payload.totalXp === 'number'
                  ? payload.totalXp
                  : (u.xp || 0) + payload.xpEarned,
              pvpWins:
                typeof payload.pvpWins === 'number'
                  ? payload.pvpWins
                  : (u.pvpWins || 0) + (payload.won ? 1 : 0),
              pvpLosses:
                typeof payload.pvpLosses === 'number'
                  ? payload.pvpLosses
                  : (u.pvpLosses || 0) + (payload.won ? 0 : 1),
            },
          },
        };
      }, true);
      pushToast(
        payload.won
          ? `🏆 ¡Victoria PvP! +${payload.xpEarned} XP ganados.`
          : `⚔️ Duelo PvP finalizado: +${payload.xpEarned} XP de combate.`
      );
    },
    [currentUser, pushToast, updateDb]
  );

  const toastedFriendNotifIdsRef = useRef<Set<string>>(new Set());

  const showFriendSystemNotification = useCallback(
    async (notif: FriendNotification) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const title = '🤝 ¡Nuevo amigo en AnimeFit!';
      const body = `${notif.fromUsername} (Nv.${notif.fromLevel}) te agregó como amigo.`;
      if ('serviceWorker' in navigator) {
        try {
          const reg = await Promise.race<ServiceWorkerRegistration | null>([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
          ]);
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `animefit-friend-${notif.id}`,
              data: { url: '/' },
            });
            return;
          }
        } catch {
          // fallback below
        }
      }
      try {
        new Notification(title, { body, icon: '/pwa-192x192.png' });
      } catch {
        // ignore in browsers disallowing window Notification constructor
      }
    },
    []
  );

  const handleIncomingFriendAdded = useCallback(
    (notif: FriendNotification) => {
      if (!currentUser) return;
      const username = currentUser.username;
      updateDb((prev) => {
        const u = prev.users[username];
        if (!u) return prev;
        const existing = u.friendNotifications || [];
        if (existing.some((n) => n.id === notif.id)) return prev;
        return {
          ...prev,
          users: {
            ...prev.users,
            [username]: {
              ...u,
              friendNotifications: [notif, ...existing].slice(0, 25),
            },
          },
        };
      }, false);

      if (!toastedFriendNotifIdsRef.current.has(notif.id)) {
        toastedFriendNotifIdsRef.current.add(notif.id);
        pushToast(
          `🤝 ¡${notif.fromUsername} (Nv.${notif.fromLevel}) te agregó como amigo!`
        );
        void showFriendSystemNotification(notif);
      }
    },
    [currentUser, pushToast, showFriendSystemNotification, updateDb]
  );

  useEffect(() => {
    if (!currentUser) return;
    const unread = (currentUser.friendNotifications || []).filter(
      (n) => !n.read && !toastedFriendNotifIdsRef.current.has(n.id)
    );
    if (unread.length === 0) return;
    unread.forEach((n) => toastedFriendNotifIdsRef.current.add(n.id));
    if (unread.length === 1) {
      pushToast(
        `🤝 ¡${unread[0].fromUsername} (Nv.${unread[0].fromLevel}) te agregó como amigo!`
      );
      void showFriendSystemNotification(unread[0]);
    } else {
      pushToast(
        `🤝 Tienes ${unread.length} notificaciones de nuevos amigos en Ranking.`
      );
    }
  }, [currentUser, pushToast, showFriendSystemNotification]);

  const pvp = usePvpSocket({
    user: currentUser,
    onNotify: pushToast,
    onFriendAdded: handleIncomingFriendAdded,
    onReward: handlePvpReward,
  });

  const handleLogin = async (rawIdentifier: string, rawPass: string) => {
    const identifier = rawIdentifier.trim();
    const pass = rawPass.trim();
    if (!identifier || !pass) {
      pushToast('Ingresa tu usuario/correo y contraseña.');
      return;
    }

    const res = await apiLogin(identifier, pass);
    if (!res.ok) {
      pushToast(res.error);
      return;
    }

    markExplicitLogout(false);
    const next = buildAppDBFromServerAuth(res.data);
    setDb(next);
    persistDB(next, false);
    setMainTab('entrenar');
  };

  const handleRegister = async (
    rawUsername: string,
    rawEmail: string,
    rawPass: string
  ) => {
    const username = rawUsername.trim();
    const email = rawEmail.trim().toLowerCase();
    const pass = rawPass.trim();

    if (username.length < 3 || pass.length < 3) {
      pushToast('Usuario y contraseña deben tener al menos 3 caracteres.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      pushToast('Ingresa un correo electrónico válido.');
      return;
    }

    const res = await apiRegister(username, email, pass);
    if (!res.ok) {
      pushToast(res.error);
      return;
    }

    markExplicitLogout(false);
    const next = buildAppDBFromServerAuth(res.data);
    setDb(next);
    persistDB(next, false);
    setMainTab('entrenar');
    setAssignedCharId(null);
  };

  const handleSaveProfileSetup = (setup: AthleteProfileSetup) => {
    if (!currentUser) return;
    const isInitialOnboarding = !currentUser.profileSetup;
    const nextChar = assignCharacterBySex(
      setup.sex,
      currentUser.email,
      currentUser.charId
    );
    const charChanged = nextChar.id !== currentUser.charId;

    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      if (!u) return prev;
      let nextRoutines = u.routines;
      if (isInitialOnboarding) {
        const customRoutines = buildRoutinesFromOnboarding(setup, u.username);
        const nonStarter = u.routines.filter(
          (r) => !r.id.startsWith('r_starter_')
        );
        nextRoutines = [...customRoutines, ...nonStarter];
      }
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            charId: nextChar.id,
            profileSetup: setup,
            routines: nextRoutines,
          },
        },
      };
    }, true);

    setEditingProfileOpen(false);
    if (isInitialOnboarding || charChanged) {
      setAssignedCharId(nextChar.id);
      pushToast(
        `🎲 ¡Guerrero asignado (${setup.sex}): ${nextChar.name}!`
      );
    } else {
      pushToast('✅ Perfil de "Mi usuario" actualizado.');
    }
  };

  const handleLogout = () => {
    setAssignedCharId(null);
    setConfirmLogoutOpen(false);
    markExplicitLogout(true);
    void apiLogout();
    void clearLocalDeviceCache();
    setDb((prev) => ({
      ...prev,
      sessionUser: null,
      activeWorkouts: {},
    }));
    setMainTab('entrenar');
  };

  const handleDeleteAccount = () => {
    if (!currentUser) return;
    const deletedName = currentUser.username;
    setAssignedCharId(null);
    markExplicitLogout(true);
    void apiDeleteAccount();
    void clearLocalDeviceCache();
    setDb((prev) => ({
      ...removeUserFromDB(prev, deletedName),
      sessionUser: null,
    }));
    setMainTab('entrenar');
    pushToast(`Cuenta "${deletedName}" eliminada. Ya puedes crear una nueva.`);
  };

  const handleChangePassword = useCallback(
    async (newPassword: string) => {
      const res = await apiChangePassword(newPassword);
      if (res.ok) {
        pushToast('🔑 Contraseña actualizada correctamente.');
      }
      return res;
    },
    [pushToast]
  );

  const handleStartFreeWorkout = () => {
    if (!currentUser) return;
    const workout: ActiveWorkout = {
      name: 'Entrenamiento Libre',
      startedAt: Date.now(),
      restEndAt: null,
      restDuration: 90,
      exercises: [],
    };
    updateDb((prev) => ({
      ...prev,
      activeWorkouts: {
        ...prev.activeWorkouts,
        [currentUser.username]: workout,
      },
    }));
  };

  const handleStartRoutineWorkout = (routineId: string) => {
    if (!currentUser) return;
    const routine = currentUser.routines.find((r) => r.id === routineId);
    if (!routine) return;

    const exercises = routine.exercises.map((re) => {
      const sets =
        re.plannedSets && re.plannedSets.length > 0
          ? re.plannedSets.map((ps) => ({
              weight: ps.weight,
              reps: ps.reps,
              done: false,
              isPR: false,
            }))
          : Array.from({ length: Math.max(1, re.sets || 1) }, () => ({
              weight: '' as const,
              reps: re.targetReps
                ? parseInt(re.targetReps, 10) || ('' as const)
                : ('' as const),
              done: false,
              isPR: false,
            }));
      return {
        exId: re.exId,
        targetReps: re.targetReps,
        notes: re.notes,
        sets,
      };
    });

    const workout: ActiveWorkout = {
      name: routine.name,
      startedAt: Date.now(),
      restEndAt: null,
      restDuration: 90,
      exercises,
    };
    updateDb((prev) => ({
      ...prev,
      activeWorkouts: {
        ...prev.activeWorkouts,
        [currentUser.username]: workout,
      },
    }));
  };

  const handleUpdateActiveWorkout = useCallback(
    (updater: (prev: ActiveWorkout) => ActiveWorkout) => {
      setDb((prev) => {
        if (!prev.sessionUser) return prev;
        const curr = prev.activeWorkouts[prev.sessionUser];
        if (!curr) return prev;
        const nextWorkout = updater(curr);
        const next: AppDB = {
          ...prev,
          activeWorkouts: {
            ...prev.activeWorkouts,
            [prev.sessionUser]: nextWorkout,
          },
        };
        persistDB(next);
        return next;
      });
    },
    []
  );

  const handleRecordPR = useCallback((exId: string, score: number) => {
    setDb((prev) => {
      if (!prev.sessionUser) return prev;
      const u = prev.users[prev.sessionUser];
      if (!u) return prev;
      const prevPR = u.prs[exId] || 0;
      if (score <= prevPR) return prev;
      const next: AppDB = {
        ...prev,
        users: {
          ...prev.users,
          [prev.sessionUser]: {
            ...u,
            prs: { ...u.prs, [exId]: score },
          },
        },
      };
      persistDB(next);
      return next;
    });
  }, []);

  const handleCancelActiveWorkout = () => {
    if (!currentUser) return;
    updateDb((prev) => {
      const nextActive = { ...prev.activeWorkouts };
      delete nextActive[currentUser.username];
      return { ...prev, activeWorkouts: nextActive };
    });
  };

  const handleFinishActiveWorkout = (): WorkoutSummaryInfo | null => {
    if (!currentUser || !activeWorkout) return null;

    let completedSets = 0;
    let prCount = 0;
    let totalVolume = 0;

    activeWorkout.exercises.forEach((item) => {
      item.sets.forEach((s) => {
        if (s.done) {
          completedSets++;
          if (s.isPR) prCount++;
          const w = Number(s.weight) || 0;
          const r = Number(s.reps) || 0;
          totalVolume += w > 0 ? w * r : r * 15;
        }
      });
    });

    if (completedSets === 0) {
      pushToast('Confirma al menos 1 serie con ✓ antes de terminar.');
      return null;
    }

    const prevLevel = getLevelInfo(currentUser.xp).level;
    const prevStage = getCharacterStage(currentUser.charId, prevLevel).stageName;

    const earnedXp = 40 + completedSets * 15 + prCount * 25;
    const nextXp = currentUser.xp + earnedXp;
    const newLevel = getLevelInfo(nextXp).level;
    const newStageObj = getCharacterStage(currentUser.charId, newLevel);
    const evolved = newStageObj.stageName !== prevStage;

    const historyEntry = {
      date: new Date().toISOString(),
      name: activeWorkout.name,
      durationMs: Date.now() - activeWorkout.startedAt,
      sets: completedSets,
      volume: Math.round(totalVolume),
      xp: earnedXp,
      exercises: activeWorkout.exercises,
    };

    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const nextHistory = [...(u.history || []), historyEntry].slice(-40);
      const nextActive = { ...prev.activeWorkouts };
      delete nextActive[currentUser.username];
      return {
        ...prev,
        activeWorkouts: nextActive,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            xp: nextXp,
            workoutsDone: (u.workoutsDone || 0) + 1,
            history: nextHistory,
          },
        },
      };
    });

    return {
      earnedXp,
      completedSets,
      prCount,
      totalVolume: Math.round(totalVolume),
      prevLevel,
      newLevel,
      evolved,
      stageName: newStageObj.stageName,
      charIcon: newStageObj.char.icon,
    };
  };

  const handleSaveRoutine = (routine: Routine) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const idx = u.routines.findIndex((r) => r.id === routine.id);
      const nextRoutines =
        idx >= 0
          ? u.routines.map((r, i) => (i === idx ? routine : r))
          : [routine, ...u.routines];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: { ...u, routines: nextRoutines },
        },
      };
    });
    pushToast('✅ Rutina guardada correctamente.');
  };

  const handleDeleteRoutine = (routineId: string) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routines: u.routines.filter((r) => r.id !== routineId),
          },
        },
      };
    });
  };

  const handleTogglePublishRoutine = (routineId: string) => {
    if (!currentUser) return;
    let nowPublished = false;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const nextRoutines = u.routines.map((r) => {
        if (r.id !== routineId) return r;
        nowPublished = !r.published;
        return { ...r, published: nowPublished, author: currentUser.username };
      });
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: { ...u, routines: nextRoutines },
        },
      };
    });
    pushToast(
      nowPublished
        ? '🌐 ¡Rutina publicada en la Comunidad!'
        : 'Rutina cambiada a privada.'
    );
  };

  const handleSetStoryRoutine = useCallback(
    (routineId: string) => {
      if (!currentUser) return;
      const target = currentUser.routines.find((r) => r.id === routineId);
      if (!target) return;
      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: { ...u, storyRoutineId: routineId },
          },
        };
      }, true);
      pushToast(`⭐ "${target.name}" fijada como Tu Rutina para Modo Historia.`);
    },
    [currentUser, pushToast, updateDb]
  );

  const handleAddGeneratedRoutines = (
    generated: Routine[],
    folderId?: string
  ) => {
    if (!currentUser) return;
    const withFolder = folderId
      ? generated.map((r) => ({ ...r, folderId }))
      : generated;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routines: [...withFolder, ...u.routines],
          },
        },
      };
    });
    pushToast(
      `🤖 ¡Se crearon ${generated.length} rutinas listas para entrenar!`
    );
  };

  const handleSaveFolder = (
    folder: RoutineFolder,
    selectedRoutineIds?: string[]
  ) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const existingFolders = u.routineFolders || [];
      const exists = existingFolders.some((f) => f.id === folder.id);
      const nextFolders = exists
        ? existingFolders.map((f) => (f.id === folder.id ? folder : f))
        : [folder, ...existingFolders];

      let nextRoutines = u.routines;
      if (Array.isArray(selectedRoutineIds)) {
        const selectedSet = new Set(selectedRoutineIds);
        nextRoutines = u.routines.map((r) => {
          if (selectedSet.has(r.id)) {
            return { ...r, folderId: folder.id };
          }
          if (r.folderId === folder.id) {
            const copy = { ...r };
            delete copy.folderId;
            return copy;
          }
          return r;
        });
      }

      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routineFolders: nextFolders,
            routines: nextRoutines,
          },
        },
      };
    });
    pushToast(`📁 Carpeta "${folder.name}" guardada.`);
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const nextFolders = (u.routineFolders || []).filter(
        (f) => f.id !== folderId
      );
      const nextRoutines = u.routines.map((r) => {
        if (r.folderId !== folderId) return r;
        const copy = { ...r };
        delete copy.folderId;
        return copy;
      });
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routineFolders: nextFolders,
            routines: nextRoutines,
          },
        },
      };
    });
    pushToast('Carpeta eliminada. Tus rutinas se conservaron.');
  };

  const handleMoveRoutineToFolder = (
    routineId: string,
    folderId: string | null
  ) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const nextRoutines = u.routines.map((r) => {
        if (r.id !== routineId) return r;
        if (!folderId) {
          const copy = { ...r };
          delete copy.folderId;
          return copy;
        }
        return { ...r, folderId };
      });
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routines: nextRoutines,
          },
        },
      };
    });
  };

  const handleSaveCustomExercise = (ex: ExerciseDef) => {
    if (!currentUser) return;
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            customExercises: [...(u.customExercises || []), ex],
          },
        },
      };
    });
    pushToast(`✅ "${ex.name}" guardado en tu biblioteca.`);
  };


  const handleToggleFriend = (targetUsername: string) => {
    if (!currentUser) return;
    const exists = (currentUser.friends || []).includes(targetUsername);
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      const friends = u.friends || [];
      const nextFriends = exists
        ? friends.filter((f) => f !== targetUsername)
        : [...friends, targetUsername];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: { ...u, friends: nextFriends },
        },
      };
    }, true);
    pushToast(
      exists
        ? `Eliminaste a ${targetUsername} de tus amigos.`
        : `🤝 ¡${targetUsername} agregado como amigo!`
    );
  };

  const handleMarkFriendNotificationsRead = useCallback(
    (ids?: string[]) => {
      if (!currentUser) return;
      const idSet = ids ? new Set(ids) : null;
      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        const nextNotifs = (u.friendNotifications || []).map((n) =>
          !idSet || idSet.has(n.id) ? { ...n, read: true } : n
        );
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: { ...u, friendNotifications: nextNotifs },
          },
        };
      }, false);
      void apiMarkFriendNotificationsRead(ids);
    },
    [currentUser, updateDb]
  );

  const handleAddFriendByName = (rawName: string) => {
    if (!currentUser) return;
    const resolved = resolveUsername(db.users, rawName.trim());
    if (!resolved || resolved === currentUser.username) {
      pushToast('Ingresa un usuario válido.');
      return;
    }
    if (!(currentUser.friends || []).includes(resolved)) {
      handleToggleFriend(resolved);
    } else {
      pushToast(`${resolved} ya está en tu lista de amigos.`);
    }
  };

  const handleCloneRoutine = (authorUsername: string, routineId: string) => {
    if (!currentUser) return;
    const author = db.users[authorUsername];
    const orig = author?.routines.find((r) => r.id === routineId);
    if (!orig) return;

    const cloned: Routine = {
      id: `clone_${Date.now()}`,
      name: `${orig.name} (Copia)`,
      published: false,
      author: authorUsername,
      likes: 0,
      exercises: JSON.parse(JSON.stringify(orig.exercises)),
    };
    updateDb((prev) => {
      const u = prev.users[currentUser.username];
      return {
        ...prev,
        users: {
          ...prev.users,
          [currentUser.username]: {
            ...u,
            routines: [cloned, ...u.routines],
          },
        },
      };
    });
    pushToast(`📥 "${orig.name}" añadida a tus rutinas en Entrenar.`);
  };

  const handleToggleGroup = (groupId: string) => {
    if (!currentUser) return;
    setDb((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        const isMember = g.members.includes(currentUser.username);
        return {
          ...g,
          members: isMember
            ? g.members.filter((m) => m !== currentUser.username)
            : [...g.members, currentUser.username],
        };
      }),
    }));
    void apiToggleGroup(groupId).then((groups) => {
      if (groups) {
        setDb((prev) => ({ ...prev, groups }));
      }
    });
  };

  const handleCreateGroup = (name: string, desc: string) => {
    if (!currentUser) return;
    void apiCreateGroup(name, desc).then((groups) => {
      if (groups) {
        setDb((prev) => ({ ...prev, groups }));
      }
    });
    pushToast(`⚔️ Grupo "${name}" creado.`);
  };

  const handleUpdateStory = useCallback(
    (nextStory: StoryProgress) => {
      if (!currentUser) return;
      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: { ...u, story: nextStory },
          },
        };
      }, true);
    },
    [currentUser, updateDb]
  );

  const handleCompleteStoryChapter = useCallback(
    (chapter: StoryChapter): boolean => {
      if (!currentUser) return false;
      const currStory: StoryProgress = currentUser.story || {
        completedChapters: [],
        choices: {},
        currentChapterId: null,
        currentNodeIndex: 0,
        alignment: { honor: 0, fury: 0, strategy: 0 },
        claimedRewards: [],
        lastChapterCompletedAt: null,
      };

      const alreadyCompleted = currStory.completedChapters.includes(chapter.id);
      if (alreadyCompleted) {
        updateDb((prev) => {
          const u = prev.users[currentUser.username];
          if (!u) return prev;
          return {
            ...prev,
            users: {
              ...prev.users,
              [currentUser.username]: {
                ...u,
                story: {
                  ...currStory,
                  currentChapterId: null,
                  currentNodeIndex: 0,
                },
              },
            },
          };
        }, true);
        return false;
      }

      const weekly = getStoryWeeklyStatus(currStory.lastChapterCompletedAt);
      if (!weekly.canCompleteNewChapter) {
        pushToast('⏳ Ya completaste tu capítulo semanal. Vuelve la próxima semana.');
        return false;
      }

      const nowIso = new Date().toISOString();
      const prevLevel = getLevelInfo(currentUser.xp).level;
      const nextXp = currentUser.xp + chapter.xpReward;
      const newLevel = getLevelInfo(nextXp).level;

      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        const baseStory = u.story || currStory;
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: {
              ...u,
              xp: u.xp + chapter.xpReward,
              story: {
                ...baseStory,
                completedChapters: baseStory.completedChapters.includes(chapter.id)
                  ? baseStory.completedChapters
                  : [...baseStory.completedChapters, chapter.id],
                claimedRewards: baseStory.claimedRewards.includes(chapter.id)
                  ? baseStory.claimedRewards
                  : [...baseStory.claimedRewards, chapter.id],
                lastChapterCompletedAt: nowIso,
                currentChapterId: null,
                currentNodeIndex: 0,
              },
            },
          },
        };
      }, true);

      pushToast(
        newLevel > prevLevel
          ? `🔥 ¡Cap. ${chapter.number} completado! +${chapter.xpReward} XP semanales · ¡Subiste a Nivel ${newLevel}!`
          : `🏆 ¡Cap. ${chapter.number} completado! +${chapter.xpReward} XP semanales ganados.`
      );
      return true;
    },
    [currentUser, pushToast, updateDb]
  );

  const handleUpdateWellness = useCallback(
    (nextWellness: DailyWellnessState, bonusXp = 0, toastMsg?: string) => {
      if (!currentUser) return;
      updateDb((prev) => {
        const u = prev.users[currentUser.username];
        if (!u) return prev;
        return {
          ...prev,
          users: {
            ...prev.users,
            [currentUser.username]: {
              ...u,
              xp: (u.xp || 0) + Math.max(0, bonusXp),
              wellness: nextWellness,
            },
          },
        };
      }, true);
      if (toastMsg) pushToast(toastMsg);
    },
    [currentUser, pushToast, updateDb]
  );

  const stepGoalToastDateRef = useRef<string | null>(null);

  const handleDetectedSteps = useCallback(
    (deltaSteps: number) => {
      if (!currentUser || deltaSteps <= 0) return;
      const username = currentUser.username;
      updateDb((prev) => {
        const u = prev.users[username];
        if (!u) return prev;
        const result = applyDetectedStepsToWellness(u, deltaSteps);
        const todayKey = getLocalDateKey();
        if (result.toastMsg && stepGoalToastDateRef.current !== todayKey) {
          stepGoalToastDateRef.current = todayKey;
          const msg = result.toastMsg;
          window.setTimeout(() => pushToast(msg), 0);
        }
        return {
          ...prev,
          users: {
            ...prev.users,
            [username]: {
              ...u,
              xp: (u.xp || 0) + result.bonusXp,
              wellness: result.nextWellness,
            },
          },
        };
      }, false);
    },
    [currentUser, pushToast, updateDb]
  );

  const {
    pedometerStatus,
    hasMotionEvents,
    keepAliveEnabled,
    wakeLockActive,
    wakeLockSupported,
    toggleKeepAlive,
    requestPedometerPermission,
  } = useAutoPedometer({
    enabled: Boolean(currentUser && currentUser.profileSetup),
    onStepsDetected: handleDetectedSteps,
    onNotify: pushToast,
  });

  const inactivityReminder = useInactivityNotifications({
    user: currentUser && currentUser.profileSetup ? currentUser : null,
    activeWorkout,
    onNotify: pushToast,
  });

  const handleStartStoryMissionWorkout = useCallback(
    (chapter: StoryChapter, routineId?: string) => {
      if (!currentUser) return;
      if (db.activeWorkouts[currentUser.username]) {
        setMainTab('entrenar');
        pushToast('Ya tienes un entrenamiento activo en curso.');
        return;
      }

      const validRoutines = (currentUser.routines || []).filter(
        (r) => r.exercises.length > 0
      );
      const preferredId =
        routineId || currentUser.storyRoutineId || validRoutines[0]?.id;
      const userRoutine =
        validRoutines.find((r) => r.id === preferredId) ||
        validRoutines[0] ||
        null;

      const sourceExercises = userRoutine
        ? userRoutine.exercises.filter((re) =>
            Boolean(getExerciseById(re.exId, currentUser))
          )
        : [];
      const finalItems =
        sourceExercises.length > 0
          ? sourceExercises
          : chapter.missionExercises;

      const exercises = finalItems.map((re) => {
        const sets =
          re.plannedSets && re.plannedSets.length > 0
            ? re.plannedSets.map((ps) => ({
                weight: ps.weight,
                reps: ps.reps,
                done: false,
                isPR: false,
              }))
            : Array.from({ length: Math.max(1, re.sets || 1) }, () => ({
                weight: '' as const,
                reps: re.targetReps
                  ? parseInt(re.targetReps, 10) || ('' as const)
                  : ('' as const),
                done: false,
                isPR: false,
              }));
        return {
          exId: re.exId,
          targetReps: re.targetReps,
          notes: re.notes,
          sets,
        };
      });

      const workoutName =
        userRoutine && sourceExercises.length > 0
          ? `Cap. ${chapter.number}: ${userRoutine.name}`
          : chapter.missionName;

      const workout: ActiveWorkout = {
        name: workoutName,
        startedAt: Date.now(),
        restEndAt: null,
        restDuration: 90,
        exercises,
      };
      updateDb(
        (prev) => ({
          ...prev,
          activeWorkouts: {
            ...prev.activeWorkouts,
            [currentUser.username]: workout,
          },
        }),
        true
      );
      setMainTab('entrenar');
      pushToast(
        userRoutine && sourceExercises.length > 0
          ? `🏋️ Misión Cap. ${chapter.number} iniciada con tu rutina "${userRoutine.name}"!`
          : `🏋️ Misión "${chapter.missionName}" iniciada!`
      );
    },
    [currentUser, db.activeWorkouts, pushToast, updateDb]
  );

  const toastLayer = (
    <div
      aria-live="polite"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-1.5 pointer-events-none w-[92%] max-w-md"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-[#0A0B0F] border border-[#FACC15] text-[#F1F5F9] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-center shadow-2xl"
        >
          {t.text}
        </div>
      ))}
    </div>
  );

  if (!currentUser) {
    return (
      <>
        {toastLayer}
        <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />
      </>
    );
  }

  if (!currentUser.profileSetup || editingProfileOpen) {
    return (
      <>
        {toastLayer}
        <OnboardingScreen
          username={currentUser.username}
          initialSetup={currentUser.profileSetup}
          isEditing={Boolean(currentUser.profileSetup)}
          onCancel={
            currentUser.profileSetup
              ? () => setEditingProfileOpen(false)
              : undefined
          }
          onSubmit={handleSaveProfileSetup}
        />
      </>
    );
  }

  const lv = getLevelInfo(currentUser.xp);
  const st = getCharacterStage(currentUser.charId, lv.level);

  return (
    <div className="min-h-screen relative pb-24 md:pb-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.03),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(202,138,4,0.03),transparent_36%)]"
      />
      {toastLayer}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#030406]/92 backdrop-blur-md border-b border-[#1B1E26]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
          <div className="text-lg font-black tracking-tight whitespace-nowrap shrink-0 font-[family-name:var(--font-display)]">
            ⚡ ANIME<span className="text-[#FACC15]">FIT</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setMainTab('entrenar')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                mainTab === 'entrenar'
                  ? 'text-[#FACC15] border-[#FACC15]'
                  : 'text-[#8A92A2] border-transparent hover:text-[#F1F5F9]'
              }`}
            >
              Entrenar
            </button>
            <button
              type="button"
              onClick={() => setMainTab('historia')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                mainTab === 'historia'
                  ? 'text-[#FACC15] border-[#FACC15]'
                  : 'text-[#8A92A2] border-transparent hover:text-[#F1F5F9]'
              }`}
            >
              Modo Historia
            </button>
            <button
              type="button"
              onClick={() => setMainTab('pvp')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors relative inline-flex items-center gap-1.5 ${
                mainTab === 'pvp'
                  ? 'text-[#FACC15] border-[#FACC15]'
                  : 'text-[#8A92A2] border-transparent hover:text-[#F1F5F9]'
              }`}
            >
              <span>PvP</span>
              {pvp.incomingInvites.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMainTab('personaje')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                mainTab === 'personaje'
                  ? 'text-[#FACC15] border-[#FACC15]'
                  : 'text-[#8A92A2] border-transparent hover:text-[#F1F5F9]'
              }`}
            >
              Mi Personaje
            </button>
            <button
              type="button"
              onClick={() => setMainTab('ranking')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                mainTab === 'ranking'
                  ? 'text-[#FACC15] border-[#FACC15]'
                  : 'text-[#8A92A2] border-transparent hover:text-[#F1F5F9]'
              }`}
            >
              <span>Ranking</span>
              {(currentUser.friendNotifications || []).some((n) => !n.read) && (
                <span className="text-[11px] font-black text-[#38BDF8] tabular-nums">
                  (
                  {
                    (currentUser.friendNotifications || []).filter((n) => !n.read)
                      .length
                  }
                  )
                </span>
              )}
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              aria-label="Tutorial de bienvenida"
              title="Guía de pestañas"
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-[#101218] border border-[#1B1E26] text-[#8A92A2] hover:text-[#FACC15] hover:border-[#FACC15]/70 inline-flex items-center justify-center transition-colors shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditingProfileOpen(true)}
              className="min-h-[36px] pl-1.5 pr-2.5 rounded-lg bg-[#101218] border border-[#1B1E26] hover:border-[#FACC15] flex items-center gap-2 transition-colors whitespace-nowrap"
              title="Editar Mi usuario"
            >
              <CharacterAvatar charId={st.char.id} size="xs" />
              <span className="text-xs font-extrabold text-[#F1F5F9]">
                Mi usuario
              </span>
              <span className="text-[11px] font-bold text-[#FACC15] tabular-nums">
                Nv.{lv.level}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="min-h-[36px] px-2.5 sm:px-3 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9] hover:border-[#38BDF8] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-5">
        {mainTab === 'entrenar' && (
          <TrainTab
            user={currentUser}
            activeWorkout={activeWorkout}
            onStartFreeWorkout={handleStartFreeWorkout}
            onStartRoutineWorkout={handleStartRoutineWorkout}
            onUpdateActiveWorkout={handleUpdateActiveWorkout}
            onRecordPR={handleRecordPR}
            onCancelActiveWorkout={handleCancelActiveWorkout}
            onFinishActiveWorkout={handleFinishActiveWorkout}
            onSaveRoutine={handleSaveRoutine}
            onDeleteRoutine={handleDeleteRoutine}
            onTogglePublishRoutine={handleTogglePublishRoutine}
            onSetStoryRoutine={handleSetStoryRoutine}
            onAddGeneratedRoutines={handleAddGeneratedRoutines}
            onSaveFolder={handleSaveFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveRoutineToFolder={handleMoveRoutineToFolder}
            onSaveCustomExercise={handleSaveCustomExercise}
            onUpdateWellness={handleUpdateWellness}
            pedometerStatus={pedometerStatus}
            hasMotionEvents={hasMotionEvents}
            keepAliveEnabled={keepAliveEnabled}
            wakeLockActive={wakeLockActive}
            wakeLockSupported={wakeLockSupported}
            onToggleKeepAlive={toggleKeepAlive}
            onRequestPedometerPermission={requestPedometerPermission}
            reminderSupported={inactivityReminder.supported}
            reminderPermission={inactivityReminder.permission}
            reminderEnabled={inactivityReminder.enabled}
            hoursSinceActivity={inactivityReminder.hoursSinceActivity}
            onToggleReminder={inactivityReminder.toggleNotifications}
            onTestReminder={inactivityReminder.sendTestNotification}
            onToast={pushToast}
            onNavigateToCharacter={() => setMainTab('personaje')}
          />
        )}

        {mainTab === 'historia' && (
          <StoryTab
            user={currentUser}
            onUpdateStory={handleUpdateStory}
            onCompleteChapter={handleCompleteStoryChapter}
            onStartMissionWorkout={handleStartStoryMissionWorkout}
            onSetStoryRoutine={handleSetStoryRoutine}
          />
        )}

        {mainTab === 'pvp' && (
          <PvpTab
            currentUser={currentUser}
            allUsers={db.users}
            connected={pvp.connected}
            onlineUsers={pvp.onlineUsers}
            incomingInvites={pvp.incomingInvites}
            roomCode={pvp.roomCode}
            activeMatch={pvp.activeMatch}
            onAddFriendByName={handleAddFriendByName}
            onSendChallenge={pvp.sendChallenge}
            onAcceptInvite={pvp.acceptInvite}
            onDeclineInvite={pvp.declineInvite}
            onCreateRoom={pvp.createRoom}
            onJoinRoom={pvp.joinRoom}
            onSendAction={pvp.sendAction}
            onSendClashTap={pvp.sendClashTap}
            onForfeitMatch={pvp.forfeitMatch}
            onClearMatch={pvp.clearMatch}
            onToast={pushToast}
          />
        )}

        {mainTab === 'personaje' && (
          <CharacterTab
            user={currentUser}
            onDeleteAccount={handleDeleteAccount}
            onChangePassword={handleChangePassword}
            onEditProfile={() => setEditingProfileOpen(true)}
            reminderSupported={inactivityReminder.supported}
            reminderPermission={inactivityReminder.permission}
            reminderEnabled={inactivityReminder.enabled}
            hoursSinceActivity={inactivityReminder.hoursSinceActivity}
            onToggleReminder={inactivityReminder.toggleNotifications}
            onTestReminder={inactivityReminder.sendTestNotification}
          />
        )}

        {mainTab === 'ranking' && (
          <RankingTab
            currentUser={currentUser}
            allUsers={db.users}
            groups={db.groups}
            onToggleFriend={handleToggleFriend}
            onAddFriendByName={handleAddFriendByName}
            onCloneRoutine={handleCloneRoutine}
            onToggleGroup={handleToggleGroup}
            onCreateGroup={handleCreateGroup}
            onChallengeFriend={(username) => {
              setMainTab('pvp');
              pvp.sendChallenge(username);
            }}
            onMarkFriendNotificationsRead={handleMarkFriendNotificationsRead}
          />
        )}
      </main>

      {/* Mobile Bottom 5-Tab Navigation */}
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#030406]/95 backdrop-blur-md border-t border-[#1B1E26]"
      >
        <div className="grid grid-cols-5 h-16">
          <button
            type="button"
            onClick={() => setMainTab('entrenar')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold border-t-2 transition-colors ${
              mainTab === 'entrenar'
                ? 'text-[#FACC15] border-[#FACC15] bg-[#FACC15]/5'
                : 'text-[#8A92A2] border-transparent'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span>Entrenar</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('historia')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold border-t-2 transition-colors ${
              mainTab === 'historia'
                ? 'text-[#FACC15] border-[#FACC15] bg-[#FACC15]/5'
                : 'text-[#8A92A2] border-transparent'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Historia</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('pvp')}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold border-t-2 transition-colors ${
              mainTab === 'pvp'
                ? 'text-[#FACC15] border-[#FACC15] bg-[#FACC15]/5'
                : 'text-[#8A92A2] border-transparent'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span>PvP</span>
            {pvp.incomingInvites.length > 0 && (
              <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-[#22C55E]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMainTab('personaje')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold border-t-2 transition-colors ${
              mainTab === 'personaje'
                ? 'text-[#FACC15] border-[#FACC15] bg-[#FACC15]/5'
                : 'text-[#8A92A2] border-transparent'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>Guerrero</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('ranking')}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold border-t-2 transition-colors ${
              mainTab === 'ranking'
                ? 'text-[#FACC15] border-[#FACC15] bg-[#FACC15]/5'
                : 'text-[#8A92A2] border-transparent'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span>Ranking</span>
            {(currentUser.friendNotifications || []).some((n) => !n.read) && (
              <span className="absolute top-1.5 right-3 text-[10px] font-black text-[#38BDF8] tabular-nums">
                {(currentUser.friendNotifications || []).filter((n) => !n.read).length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Auto-assigned warrior welcome modal */}
      <Modal
        open={assignedCharId !== null}
        title="🎲 ¡Tu Guerrero ha sido Asignado!"
        onClose={() => setAssignedCharId(null)}
      >
        {assignedCharId && (() => {
          const assigned = getCharacterById(assignedCharId);
          return (
            <div className="flex flex-col gap-4 text-center">
              <div
                className="rounded-2xl border p-6 bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),#07080B_75%)]"
                style={{ borderColor: `${assigned.auraColor}66` }}
              >
                <div
                  className="w-32 h-32 mx-auto rounded-full flex items-center justify-center border-[3px] bg-[#030406] aura-pulse"
                  style={{ borderColor: assigned.auraColor }}
                >
                  <CharacterAvatar
                    charId={assigned.id}
                    size="xl"
                    className="border-0"
                  />
                </div>
                <div className="text-xs font-semibold text-[#8A92A2] mt-3">
                  {assigned.anime}
                </div>
                <h3 className="text-2xl font-black text-[#F1F5F9] mt-0.5">
                  {assigned.name}
                </h3>
                <div
                  className="text-sm font-extrabold mt-1"
                  style={{ color: assigned.auraColor }}
                >
                  ⚡ Nivel 1 · {assigned.stages[0].phase}
                </div>
                <p className="text-xs text-[#8A92A2] mt-2">
                  Este guerrero fue asignado automáticamente a tu cuenta. Entrena para desbloquear sus {assigned.stages.length} fases evolutivas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAssignedCharId(null);
                    setMainTab('personaje');
                  }}
                  className="min-h-[44px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
                >
                  Ver Evoluciones
                </button>
                <button
                  type="button"
                  onClick={() => setAssignedCharId(null)}
                  className="min-h-[44px] rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-bold"
                >
                  ¡A Entrenar!
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
      {/* Welcome step-by-step tutorial modal for new users */}
      <WelcomeTutorialModal
        open={tutorialOpen}
        username={currentUser.username}
        onClose={closeWelcomeTutorial}
      />

      {/* Automatic Sunday Weekly Summary Modal */}
      <WeeklySundaySummaryModal
        open={sundaySummaryOpen}
        user={currentUser}
        onClose={closeSundaySummary}
      />

      {/* Logout confirmation modal */}
      <Modal
        open={confirmLogoutOpen}
        title="¿Cerrar sesión?"
        onClose={() => setConfirmLogoutOpen(false)}
      >
        <p className="text-sm text-[#8A92A2]">
          Tu cuenta <strong className="text-[#F1F5F9]">{currentUser.username}</strong>, tu guerrero y tu progreso quedan guardados. Si solo sales de la app sin cerrar sesión, volverás a entrar conectado automáticamente.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setConfirmLogoutOpen(false)}
            className="min-h-[42px] px-4 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
          >
            Seguir conectado
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[42px] px-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs font-bold text-[#FCA5A5]"
          >
            Cerrar sesión
          </button>
        </div>
      </Modal>
    </div>
  );
}
