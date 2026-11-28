import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  Dumbbell,
  Flame,
  Lock,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  SECONDARY_CURRENCY_ICON,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { getCharacterEnergyProfile, getCharacterPhaseMoveset } from '../data/movesets';
import {
  getShopItemById,
  getUserExtraVictoryQuotes,
  STORY_AUTOREVIVE_LIMIT,
} from '../data/shopCatalog';
import { STORY_CHAPTERS } from '../data/storyCampaign';
import { pickRotatingVictoryQuote } from '../data/victoryQuotes';
import {
  ShopItemDef,
  StoryAlignmentKey,
  StoryChapter,
  StoryChoiceOption,
  StoryProgress,
  UserProfile,
} from '../types/animefit';
import {
  formatDailyCountdown,
  getActiveCharacterStage,
  getCharacterById,
  getCombatSoundEnabled,
  getExerciseById,
  getLevelInfo,
  getStoryDailyStatus,
  playConsumeItemSound,
  playTechniqueCombatSound,
  setCombatSoundEnabled,
  speakVictoryVoice,
  stopAllCombatAudio,
  subscribeCombatSound,
  unlockPvpAudio,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';
import {
  RoomClearRewardResult,
  RoomTowerMode,
} from './RoomTowerMode';
import {
  SurvivalModeView,
  SurvivalWaveClearResult,
} from './SurvivalModeView';

const STORY_SPECIAL_COST = 40;

type CombatAnimClass =
  | ''
  | 'combat-anim-attack-right'
  | 'combat-anim-attack-left'
  | 'combat-anim-hit'
  | 'combat-anim-guard'
  | 'combat-anim-charge'
  | 'combat-anim-special';

interface StoryTabProps {
  user: UserProfile;
  onUpdateStory: (story: StoryProgress) => void;
  onCompleteChapter: (
    chapter: StoryChapter
  ) => { rewarded: boolean; coinsEarned: number; secondaryEarned?: number } | boolean;
  onStartMissionWorkout: (chapter: StoryChapter, routineId?: string) => void;
  onSetStoryRoutine: (routineId: string) => void;
  onSurvivalWaveCleared: (clearedWave: number) => SurvivalWaveClearResult;
  onRoomCleared: (clearedRoom: number) => RoomClearRewardResult;
  onBuyAccessory: (accessoryId: string) => void;
  onEquipAccessory: (
    accessoryId: string | null,
    slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
  ) => void;
  onConsumeItem?: (itemId: string) => boolean;
  onOpenShop?: () => void;
}

const DEFAULT_STORY: StoryProgress = {
  completedChapters: [],
  choices: {},
  currentChapterId: null,
  currentNodeIndex: 0,
  alignment: { honor: 0, fury: 0, strategy: 0 },
  claimedRewards: [],
  lastChapterCompletedAt: null,
};

type BattlePhase = 'dialogue' | 'battle' | 'victory' | 'defeat';

export function StoryTab({
  user,
  onUpdateStory,
  onCompleteChapter,
  onStartMissionWorkout,
  onSetStoryRoutine,
  onSurvivalWaveCleared,
  onRoomCleared,
  onBuyAccessory,
  onEquipAccessory,
  onConsumeItem,
  onOpenShop,
}: StoryTabProps) {
  const [combatSubMode, setCombatSubMode] = useState<'story' | 'survival' | 'tower'>('story');
  const story: StoryProgress = user.story || DEFAULT_STORY;
  const lv = getLevelInfo(user.xp);
  const st = getActiveCharacterStage(user);
  const warrior = st.char;
  const warriorMoveset = getCharacterPhaseMoveset(
    warrior.id,
    st.effectiveLevel,
    st.stageName
  );
  const warriorEnergy = warriorMoveset.energy;

  const validRoutines = useMemo(
    () => (user.routines || []).filter((r) => r.exercises.length > 0),
    [user.routines]
  );
  const activeRoutine = useMemo(() => {
    if (validRoutines.length === 0) return null;
    if (user.storyRoutineId) {
      const pinned = validRoutines.find((r) => r.id === user.storyRoutineId);
      if (pinned) return pinned;
    }
    return validRoutines[0];
  }, [validRoutines, user.storyRoutineId]);

  const dailyStatus = getStoryDailyStatus(story.lastChapterCompletedAt);

  // Determine the next sequential chapter index
  const nextChapterIndex = useMemo(() => {
    const idx = STORY_CHAPTERS.findIndex(
      (c) => !story.completedChapters.includes(c.id)
    );
    return idx === -1 ? STORY_CHAPTERS.length - 1 : idx;
  }, [story.completedChapters]);

  const [selectedSaga, setSelectedSaga] = useState<number>(
    () => Math.floor(nextChapterIndex / 10) + 1
  );

  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    story.currentChapterId
  );
  const [phase, setPhase] = useState<BattlePhase>('dialogue');
  const [nodeIdx, setNodeIdx] = useState<number>(story.currentNodeIndex || 0);
  const [pendingReply, setPendingReply] = useState<StoryChoiceOption | null>(
    null
  );
  const [selectedBuff, setSelectedBuff] = useState<StoryAlignmentKey | null>(
    null
  );
  const [earnedXpThisRun, setEarnedXpThisRun] = useState<number>(0);
  const [earnedCoinsThisRun, setEarnedCoinsThisRun] = useState<number>(0);
  const [earnedSecondaryThisRun, setEarnedSecondaryThisRun] = useState<number>(0);

  // Battle state (locks warrior phase at battle start)
  const [lockedBattleStage, setLockedBattleStage] = useState<{
    stageName: string;
    level: number;
  } | null>(null);
  const [playerHp, setPlayerHp] = useState(160);
  const [bossHp, setBossHp] = useState(145);
  const [aura, setAura] = useState(30);
  const [guarding, setGuarding] = useState(false);
  const [bossGuarding, setBossGuarding] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [bossCharging, setBossCharging] = useState(false);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerAnim, setPlayerAnim] = useState<CombatAnimClass>('');
  const [bossAnim, setBossAnim] = useState<CombatAnimClass>('');
  const [arenaFlashColor, setArenaFlashColor] = useState<string | null>(null);
  const [usedItemCounts, setUsedItemCounts] = useState<Record<string, number>>({});
  const [autoReviveUsed, setAutoReviveUsed] = useState(0);
  const [atkBuffTurns, setAtkBuffTurns] = useState(0);
  const [pierceBuffTurns, setPierceBuffTurns] = useState(0);
  const [evadeNextHit, setEvadeNextHit] = useState(false);
  const [shieldNextHit, setShieldNextHit] = useState(false);

  // Interactive Ki Clash mini-game state
  const [clashActive, setClashActive] = useState(false);
  const [clashPower, setClashPower] = useState(50);
  const [clashTimeLeft, setClashTimeLeft] = useState(3500);
  const [clashKind, setClashKind] = useState<'ultimate' | 'defend'>('ultimate');
  const clashPowerRef = useRef(50);
  const [storyVictoryQuote, setStoryVictoryQuote] = useState<string | null>(null);
  const victoryHandledRunRef = useRef(false);
  const bossTurnTimerRef = useRef<number | null>(null);
  const battleRunIdRef = useRef<number>(0);
  const autoReviveUsedRef = useRef(0);
  const evadeNextHitRef = useRef(false);
  const shieldNextHitRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    getCombatSoundEnabled()
  );

  useEffect(() => subscribeCombatSound(setSoundEnabled), []);

  const clearBossTurnTimer = () => {
    if (bossTurnTimerRef.current !== null) {
      window.clearTimeout(bossTurnTimerRef.current);
      bossTurnTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearBossTurnTimer();
      stopAllCombatAudio();
    };
  }, []);

  const toggleSound = () => {
    setCombatSoundEnabled(!soundEnabled);
  };

  const activeChapter = useMemo(
    () => STORY_CHAPTERS.find((c) => c.id === activeChapterId) || null,
    [activeChapterId]
  );

  const playerMaxHp = useMemo(
    () =>
      Math.round(
        150 +
          lv.level * 18 +
          (user.workoutsDone || 0) * 5 +
          Object.keys(user.prs || {}).length * 8
      ),
    [lv.level, user.workoutsDone, user.prs]
  );

  const playerBaseAtk = useMemo(
    () =>
      Math.round(
        20 + lv.level * 4 + Math.min(28, (user.workoutsDone || 0) * 1.5)
      ),
    [lv.level, user.workoutsDone]
  );

  const alignmentTitle = useMemo(() => {
    const { honor, fury, strategy } = story.alignment;
    if (honor === 0 && fury === 0 && strategy === 0) {
      return warriorEnergy.name === 'Ki'
        ? 'Aprendiz del Ki'
        : `Aprendiz de ${warriorEnergy.name}`;
    }
    if (honor >= fury && honor >= strategy) return 'Guardián Honorable';
    if (fury >= honor && fury >= strategy) return 'Aura Indomable';
    return 'Estratega Supremo';
  }, [story.alignment, warriorEnergy.name]);

  const interpolate = (raw: string) =>
    raw
      .replace(/\{WARRIOR\}/g, warrior.name)
      .replace(/\{STAGE\}/g, st.stageName);

  const triggerCombatAnim = (
    target: 'player' | 'boss',
    anim: CombatAnimClass,
    flashColor?: string
  ) => {
    if (target === 'player') {
      setPlayerAnim(anim);
      window.setTimeout(() => setPlayerAnim(''), 440);
    } else {
      setBossAnim(anim);
      window.setTimeout(() => setBossAnim(''), 440);
    }
    if (flashColor) {
      setArenaFlashColor(flashColor);
      window.setTimeout(() => setArenaFlashColor(null), 460);
    }
  };

  const openChapter = (ch: StoryChapter) => {
    const idx = STORY_CHAPTERS.findIndex((item) => item.id === ch.id);
    const alreadyDone = story.completedChapters.includes(ch.id);
    const prevDone =
      idx === 0 || story.completedChapters.includes(STORY_CHAPTERS[idx - 1].id);
    const dailyNow = getStoryDailyStatus(story.lastChapterCompletedAt);

    if (!alreadyDone) {
      if (!prevDone || lv.level < ch.minLevel || !dailyNow.canCompleteNewChapter) {
        return;
      }
    }

    setActiveChapterId(ch.id);
    setPhase('dialogue');
    setNodeIdx(0);
    setPendingReply(null);
    setEarnedXpThisRun(0);
    setEarnedCoinsThisRun(0);
    setEarnedSecondaryThisRun(0);
    setSelectedBuff(story.choices[ch.id] || null);
    setClashActive(false);
    setLockedBattleStage(null);
    onUpdateStory({
      ...story,
      currentChapterId: ch.id,
      currentNodeIndex: 0,
    });
  };

  const exitChapter = () => {
    clearBossTurnTimer();
    stopAllCombatAudio();
    setActiveChapterId(null);
    setClashActive(false);
    setLockedBattleStage(null);
    setStoryVictoryQuote(null);
    victoryHandledRunRef.current = false;
    onUpdateStory({
      ...story,
      currentChapterId: null,
      currentNodeIndex: 0,
    });
  };

  const tryTriggerStoryAutoRevive = (): boolean => {
    if (autoReviveUsedRef.current >= STORY_AUTOREVIVE_LIMIT) return false;
    const invEntry = (userRef.current.inventory || []).find(
      (e) => e.itemId === 'tac_phoenix_autorevive' && Number(e.quantity || 0) > 0
    );
    if (!invEntry) return false;
    if (onConsumeItem && !onConsumeItem('tac_phoenix_autorevive')) return false;

    autoReviveUsedRef.current += 1;
    setAutoReviveUsed(autoReviveUsedRef.current);
    const reviveHp = Math.max(20, Math.round(playerMaxHp * 0.45));
    setPlayerHp(reviveHp);
    setAura((a) => Math.min(100, a + 25));
    setGuarding(true);
    playConsumeItemSound('auto_revive');
    triggerCombatAnim('player', 'combat-anim-charge', '#F97316');
    setBattleLog((prev) => [
      `🔥 ¡LLAMAS DE MARCO ACTIVADAS! Auto-Revivir restauró ${reviveHp} HP y +25% ${warriorEnergy.shortName} (${autoReviveUsedRef.current}/${STORY_AUTOREVIVE_LIMIT} uso en este combate).`,
      ...prev.slice(0, 5),
    ]);
    return true;
  };

  const startBattle = (ch: StoryChapter, buff: StoryAlignmentKey | null) => {
    clearBossTurnTimer();
    stopAllCombatAudio();
    battleRunIdRef.current += 1;
    victoryHandledRunRef.current = false;
    autoReviveUsedRef.current = 0;
    evadeNextHitRef.current = false;
    shieldNextHitRef.current = false;
    setStoryVictoryQuote(null);
    setLockedBattleStage({ stageName: st.stageName, level: st.effectiveLevel });
    setPhase('battle');
    setPlayerHp(playerMaxHp);
    setBossHp(ch.bossHp);
    setAura(30);
    setGuarding(false);
    setBossGuarding(false);
    setBossCharging(false);
    setTurnBusy(false);
    setClashActive(false);
    setUsedItemCounts({});
    setAutoReviveUsed(0);
    setAtkBuffTurns(0);
    setPierceBuffTurns(0);
    setEvadeNextHit(false);
    setShieldNextHit(false);
    const boss = getCharacterById(ch.bossCharId);
    const buffMsg =
      buff === 'honor'
        ? '🛡️ Escudo de Honor activo (-25% daño recibido).'
        : buff === 'fury'
        ? '🔥 Aura de Furia activa (+25% daño de ataque).'
        : buff === 'strategy'
        ? '🎯 Visión Estratégica activa (+30% prob. crítica).'
        : '⚔️ ¡Combate iniciado!';
    setBattleLog([
      `⚔️ ¡${warrior.name} (${st.stageName}) vs ${boss.name}!`,
      buffMsg,
    ]);
  };

  const handleChooseOption = (ch: StoryChapter, opt: StoryChoiceOption) => {
    const nextAlignment = {
      ...story.alignment,
      [opt.alignment]: (story.alignment[opt.alignment] || 0) + 1,
    };
    const nextStory: StoryProgress = {
      ...story,
      choices: { ...story.choices, [ch.id]: opt.alignment },
      alignment: nextAlignment,
      currentChapterId: ch.id,
      currentNodeIndex: nodeIdx,
    };
    onUpdateStory(nextStory);
    setSelectedBuff(opt.alignment);
    setPendingReply(opt);
  };

  const handleAdvanceDialogue = () => {
    if (!activeChapter) return;
    if (pendingReply) {
      setPendingReply(null);
    }
    const nextIdx = nodeIdx + 1;
    if (nextIdx < activeChapter.nodes.length) {
      setNodeIdx(nextIdx);
      onUpdateStory({
        ...story,
        currentChapterId: activeChapter.id,
        currentNodeIndex: nextIdx,
      });
    } else {
      startBattle(
        activeChapter,
        selectedBuff || story.choices[activeChapter.id] || null
      );
    }
  };

  const getStoryBattleActors = (ch: StoryChapter) => {
    const boss = getCharacterById(ch.bossCharId);
    const bossStageName =
      boss.stages[
        Math.min(boss.stages.length - 1, Math.floor((ch.number - 1) / 25))
      ]?.phase || boss.stages[0]?.phase;
    const bossLevel = Math.max(1, ch.minLevel);
    const pStageName = lockedBattleStage?.stageName || st.stageName;
    const pLevel = lockedBattleStage?.level || st.effectiveLevel;
    const pMoveset = getCharacterPhaseMoveset(warrior.id, pLevel, pStageName);
    const bMoveset = getCharacterPhaseMoveset(boss.id, bossLevel, bossStageName);
    return {
      boss,
      bossActor: {
        charId: boss.id,
        stageName: bossStageName,
        level: bossLevel,
        anime: boss.anime,
      },
      playerActor: {
        charId: warrior.id,
        stageName: pStageName,
        level: pLevel,
        anime: warrior.anime,
      },
      pMoveset,
      bMoveset,
    };
  };

  const handleFinishVictory = (ch: StoryChapter) => {
    clearBossTurnTimer();
    setPhase('victory');
    const res = onCompleteChapter(ch);
    const rewarded = typeof res === 'boolean' ? res : res.rewarded;
    const coinsEarned = typeof res === 'boolean' ? 0 : Math.max(0, Number(res.coinsEarned || 0));
    const secondaryEarned =
      typeof res === 'boolean' ? 0 : Math.max(0, Number(res.secondaryEarned || 0));
    setEarnedXpThisRun(rewarded ? ch.xpReward : 0);
    setEarnedCoinsThisRun(rewarded ? coinsEarned : 0);
    setEarnedSecondaryThisRun(rewarded ? secondaryEarned : 0);

    if (!victoryHandledRunRef.current) {
      victoryHandledRunRef.current = true;
      const extraQuotes = getUserExtraVictoryQuotes(userRef.current);
      const picked = pickRotatingVictoryQuote(
        warrior.id,
        warrior.anime,
        warrior.gender,
        extraQuotes
      );
      setStoryVictoryQuote(picked.quote);
      const runKey = `${battleRunIdRef.current}:${ch.id}`;
      playTechniqueCombatSound({
        slot: 'victory',
        attacker: { charId: warrior.id, stageName: lockedBattleStage?.stageName || st.stageName, anime: warrior.anime },
        delayMs: 240,
        eventKey: `story_win:${runKey}`,
      });
      speakVictoryVoice(picked.quote, {
        ...picked.voice,
        gender: warrior.gender,
        delayMs: 650,
        eventKey: `story_voice:${runKey}`,
      });
    }
  };

  const runBossTurn = (
    ch: StoryChapter,
    currentPlayerHp: number,
    currentBossHp: number,
    isGuarding: boolean,
    wasCharging: boolean
  ) => {
    clearBossTurnTimer();
    bossTurnTimerRef.current = window.setTimeout(() => {
      bossTurnTimerRef.current = null;
      const { boss, bossActor, playerActor, bMoveset } = getStoryBattleActors(ch);
      const bossEnergy = getCharacterEnergyProfile(boss.id);

      if (wasCharging) {
        setBossCharging(false);
        setBossGuarding(false);
        setClashKind('defend');
        clashPowerRef.current = 46;
        setClashPower(46);
        setClashTimeLeft(3400);
        setClashActive(true);
        triggerCombatAnim('boss', 'combat-anim-charge', bossEnergy.color);
        playTechniqueCombatSound({
          slot: 'charge',
          skillName: ch.bossSignatureMove,
          attacker: bossActor,
          defender: playerActor,
        });
        setBattleLog((prev) => [
          `⚡ ¡${boss.name} lanza ${ch.bossSignatureMove}! ¡Toca rápido para bloquear!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      const roll = Math.random();
      const chargeChance = Math.min(0.4, 0.28 + ch.number * 0.0012);
      const guardChance = Math.min(0.28, 0.16 + ch.number * 0.0012);

      if (roll < chargeChance) {
        setBossCharging(true);
        setBossGuarding(false);
        setGuarding(false);
        setTurnBusy(false);
        triggerCombatAnim('boss', 'combat-anim-charge', bossEnergy.color);
        playTechniqueCombatSound({
          slot: 'charge',
          skillName: ch.bossSignatureMove,
          attacker: bossActor,
          defender: playerActor,
        });
        setBattleLog((prev) => [
          `⚠️ ¡${boss.name} está concentrando ${bossEnergy.name} para ${ch.bossSignatureMove}!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      if (roll < chargeChance + guardChance) {
        const bossHeal = Math.max(6, Math.round(ch.bossHp * 0.045));
        setBossHp(Math.min(ch.bossHp, currentBossHp + bossHeal));
        setBossGuarding(true);
        setGuarding(false);
        setTurnBusy(false);
        triggerCombatAnim('boss', 'combat-anim-guard');
        playTechniqueCombatSound({
          slot: 'guard',
          skillName: bMoveset.guard.name,
          attacker: bossActor,
        });
        setBattleLog((prev) => [
          `🛡️ ${boss.name} levanta guardia defensiva (+${bossHeal} HP, reduce tu próximo golpe físico).`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      setBossGuarding(false);
      if (evadeNextHitRef.current) {
        evadeNextHitRef.current = false;
        setEvadeNextHit(false);
        setGuarding(false);
        triggerCombatAnim('boss', 'combat-anim-attack-left');
        triggerCombatAnim('player', 'combat-anim-guard');
        setBattleLog((prev) => [
          `💨 ¡Shunpo activado! Esquivaste el golpe de ${boss.name} (0 HP).`,
          ...prev.slice(0, 5),
        ]);
        setTurnBusy(false);
        return;
      }

      const honorReduce = selectedBuff === 'honor' ? 0.75 : 1;
      const guardReduce = isGuarding ? 0.35 : 1;
      const shieldReduce = shieldNextHitRef.current ? 0.5 : 1;
      if (shieldNextHitRef.current) {
        shieldNextHitRef.current = false;
        setShieldNextHit(false);
      }
      const isBossHeavy = ch.number >= 5 && Math.random() < Math.min(0.26, 0.1 + ch.number * 0.002);
      const dmg = Math.max(
        4,
        Math.round(
          ch.bossAtk *
            (0.84 + Math.random() * 0.25) *
            (isBossHeavy ? 1.25 : 1) *
            honorReduce *
            guardReduce *
            shieldReduce
        )
      );
      const nextHp = Math.max(0, currentPlayerHp - dmg);
      setPlayerHp(nextHp);
      setGuarding(false);
      triggerCombatAnim('boss', 'combat-anim-attack-left');
      triggerCombatAnim(
        'player',
        isGuarding ? 'combat-anim-guard' : 'combat-anim-hit',
        isBossHeavy ? '#EF4444' : undefined
      );
      playTechniqueCombatSound({
        slot: isBossHeavy ? 'special' : 'physical',
        skillName: isBossHeavy ? bMoveset.special.name : bMoveset.physical.name,
        attacker: bossActor,
        defender: playerActor,
        isCrit: isBossHeavy,
        isBlocked: isGuarding,
      });

      const counterDmg = isGuarding ? Math.round(playerBaseAtk * 0.42) : 0;
      let nextBossAfterCounter = currentBossHp;
      if (counterDmg > 0) {
        nextBossAfterCounter = Math.max(0, currentBossHp - counterDmg);
        setBossHp(nextBossAfterCounter);
      }

      setBattleLog((prev) => [
        isGuarding
          ? `🛡️ Bloqueaste a ${boss.name} (-${dmg} HP) y contraatacaste (-${counterDmg} HP).`
          : isBossHeavy
          ? `💢 ¡Golpe firme de ${boss.name}! Te infligió -${dmg} HP.`
          : `💥 ${boss.name} te golpeó por ${dmg} HP.`,
        ...prev.slice(0, 5),
      ]);

      if (nextBossAfterCounter <= 0) {
        handleFinishVictory(ch);
        setTurnBusy(false);
        return;
      }

      if (nextHp <= 0) {
        const revived = tryTriggerStoryAutoRevive();
        if (!revived) {
          setPhase('defeat');
          playTechniqueCombatSound({
            slot: 'defeat',
            attacker: bossActor,
            defender: playerActor,
            delayMs: 220,
            eventKey: `story_lose:${battleRunIdRef.current}:${ch.id}`,
          });
        }
        setTurnBusy(false);
      } else {
        setTurnBusy(false);
      }
    }, 480);
  };

  useEffect(() => {
    if (!clashActive || !activeChapter) return;
    const started = Date.now();
    const duration = 3400;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const left = Math.max(0, duration - elapsed);
      setClashTimeLeft(left);

      const decay = Math.min(3.5, 1.45 + activeChapter.number * 0.02);
      const nextP = Math.max(5, clashPowerRef.current - decay);
      clashPowerRef.current = nextP;
      setClashPower(nextP);

      if (nextP >= 100 || left <= 0) {
        window.clearInterval(timer);
        setClashActive(false);
        const won = clashPowerRef.current >= 62;
        const { boss, bossActor, playerActor, pMoveset } =
          getStoryBattleActors(activeChapter);
        const resistMult = 1 - (activeChapter.bossDefensePct || 0) * 0.5;

        if (clashKind === 'ultimate') {
          const furyMult = selectedBuff === 'fury' ? 1.25 : 1;
          const mult = won ? 2.4 : 1.45;
          const dmg = Math.max(
            12,
            Math.round(playerBaseAtk * mult * furyMult * resistMult)
          );
          const nextBossHp = Math.max(0, bossHp - dmg);
          setBossHp(nextBossHp);
          setBossGuarding(false);
          triggerCombatAnim(
            'player',
            'combat-anim-special',
            warriorMoveset.accentColor
          );
          triggerCombatAnim('boss', 'combat-anim-hit');
          playTechniqueCombatSound({
            slot: 'ultimate',
            skillName: pMoveset.ultimate.name,
            attacker: playerActor,
            defender: bossActor,
            isCrit: won,
          });
          setBattleLog((prev) => [
            won
              ? `🔥 ¡${warriorEnergy.clashLabel.toUpperCase()} GANADO! ${pMoveset.ultimate.name} (${lockedBattleStage?.stageName || st.stageName}): -${dmg} HP!`
              : `⚡ ${pMoveset.ultimate.name} conectada: -${dmg} HP.`,
            ...prev.slice(0, 5),
          ]);
          if (nextBossHp <= 0) {
            handleFinishVictory(activeChapter);
            setTurnBusy(false);
          } else {
            runBossTurn(activeChapter, playerHp, nextBossHp, false, false);
          }
        } else {
          const honorReduce = selectedBuff === 'honor' ? 0.75 : 1;
          const guardReduce = guarding ? 0.45 : 1;
          if (won) {
            const reflect = Math.round(playerBaseAtk * 1.15);
            const nextBossHp = Math.max(0, bossHp - reflect);
            setBossHp(nextBossHp);
            setGuarding(false);
            triggerCombatAnim('player', 'combat-anim-guard');
            triggerCombatAnim('boss', 'combat-anim-hit');
            playTechniqueCombatSound({
              slot: 'clash_reflect',
              skillName: pMoveset.guard.name,
              attacker: playerActor,
              defender: bossActor,
              isBlocked: true,
            });
            setBattleLog((prev) => [
              `💥 ¡DESVIASTE ${activeChapter.bossSignatureMove}! Contraataque de -${reflect} HP a ${boss.name}!`,
              ...prev.slice(0, 5),
            ]);
            if (nextBossHp <= 0) {
              handleFinishVictory(activeChapter);
            }
            setTurnBusy(false);
          } else {
            const dmg = evadeNextHitRef.current
              ? 0
              : Math.max(
                  6,
                  Math.round(
                    activeChapter.bossAtk *
                      1.6 *
                      honorReduce *
                      guardReduce *
                      (shieldNextHitRef.current ? 0.5 : 1)
                  )
                );
            evadeNextHitRef.current = false;
            shieldNextHitRef.current = false;
            setEvadeNextHit(false);
            setShieldNextHit(false);
            const nextPlayerHp = Math.max(0, playerHp - dmg);
            setPlayerHp(nextPlayerHp);
            setGuarding(false);
            triggerCombatAnim('boss', 'combat-anim-special', boss.auraColor);
            triggerCombatAnim('player', dmg === 0 ? 'combat-anim-guard' : 'combat-anim-hit');
            playTechniqueCombatSound({
              slot: 'ultimate',
              skillName: activeChapter.bossSignatureMove,
              attacker: bossActor,
              defender: playerActor,
              isCrit: dmg > 0,
              isBlocked: guarding || dmg === 0,
            });
            setBattleLog((prev) => [
              dmg === 0
                ? `💨 ¡Shunpo evitó ${activeChapter.bossSignatureMove} (0 HP)!`
                : `💢 ${boss.name} ganó el choque con ${activeChapter.bossSignatureMove}: -${dmg} HP.`,
              ...prev.slice(0, 5),
            ]);
            if (nextPlayerHp <= 0) {
              const revived = tryTriggerStoryAutoRevive();
              if (!revived) {
                setPhase('defeat');
                playTechniqueCombatSound({
                  slot: 'defeat',
                  attacker: bossActor,
                  defender: playerActor,
                  delayMs: 220,
                  eventKey: `story_lose:${battleRunIdRef.current}:${activeChapter.id}`,
                });
              }
            }
            setTurnBusy(false);
          }
        }
      }
    }, 90);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clashActive]);

  const handleTapClash = () => {
    if (!clashActive) return;
    unlockPvpAudio();
    const actors = activeChapter ? getStoryBattleActors(activeChapter) : null;
    playTechniqueCombatSound({
      slot: 'charge',
      skillName: activeChapter?.bossSignatureMove,
      attacker: actors?.playerActor,
    });
    const next = Math.min(100, clashPowerRef.current + 12);
    clashPowerRef.current = next;
    setClashPower(next);
  };

  const handleStrike = () => {
    if (!activeChapter || turnBusy || clashActive) return;
    setTurnBusy(true);
    const { boss, bossActor, playerActor, pMoveset } =
      getStoryBattleActors(activeChapter);
    const furyMult = (selectedBuff === 'fury' ? 1.25 : 1) * (atkBuffTurns > 0 ? 1.3 : 1);
    const critChance = (selectedBuff === 'strategy' ? 0.45 : 0.18) + (atkBuffTurns > 0 ? 0.18 : 0);
    const isCrit = Math.random() < critChance;
    const resistMult = pierceBuffTurns > 0 ? 1 : 1 - (activeChapter.bossDefensePct || 0);
    const wasBossGuarding = bossGuarding && pierceBuffTurns <= 0;
    const guardMult = wasBossGuarding ? 0.55 : 1;
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'physical',
      skillName: pMoveset.physical.name,
      attacker: playerActor,
      defender: bossActor,
      isCrit,
      isBlocked: wasBossGuarding,
    });
    const dmg = Math.max(
      4,
      Math.round(
        playerBaseAtk *
          (0.75 + Math.random() * 0.2) *
          furyMult *
          (isCrit ? 1.4 : 1) *
          resistMult *
          guardMult
      )
    );
    if (atkBuffTurns > 0) setAtkBuffTurns((t) => Math.max(0, t - 1));
    if (pierceBuffTurns > 0) setPierceBuffTurns((t) => Math.max(0, t - 1));
    const nextBossHp = Math.max(0, bossHp - dmg);
    setBossHp(nextBossHp);
    setBossGuarding(false);
    setAura((a) => Math.min(100, a + 30));
    triggerCombatAnim('player', 'combat-anim-attack-right');
    triggerCombatAnim('boss', wasBossGuarding ? 'combat-anim-guard' : 'combat-anim-hit');
    setBattleLog((prev) => [
      wasBossGuarding
        ? `🛡️ ${boss.name} cubrió parte de ${pMoveset.physical.name} (-${dmg} HP).`
        : isCrit
        ? `⚡ ¡CRÍTICO con ${pMoveset.physical.name}! -${dmg} HP (+30% ${warriorEnergy.shortName}).`
        : `👊 ${pMoveset.physical.name}: -${dmg} HP (+30% ${warriorEnergy.shortName}).`,
      ...prev.slice(0, 5),
    ]);

    if (nextBossHp <= 0) {
      handleFinishVictory(activeChapter);
      setTurnBusy(false);
      return;
    }
    runBossTurn(activeChapter, playerHp, nextBossHp, false, bossCharging);
  };

  const handleSpecial = () => {
    if (!activeChapter || turnBusy || clashActive || aura < STORY_SPECIAL_COST) {
      return;
    }
    setTurnBusy(true);
    const { bossActor, playerActor, pMoveset } =
      getStoryBattleActors(activeChapter);
    const furyMult = (selectedBuff === 'fury' ? 1.25 : 1) * (atkBuffTurns > 0 ? 1.3 : 1);
    const critChance = (selectedBuff === 'strategy' ? 0.52 : 0.26) + (atkBuffTurns > 0 ? 0.18 : 0);
    const isCrit = Math.random() < critChance;
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'special',
      skillName: pMoveset.special.name,
      attacker: playerActor,
      defender: bossActor,
      isCrit,
      isBlocked: bossGuarding && pierceBuffTurns <= 0,
    });
    const resistMult = pierceBuffTurns > 0 ? 1 : 1 - (activeChapter.bossDefensePct || 0) * 0.6;
    const guardMult = pierceBuffTurns > 0 ? 1 : bossGuarding ? 0.8 : 1;
    const dmg = Math.max(
      8,
      Math.round(
        playerBaseAtk *
          (1.3 + Math.random() * 0.22) *
          furyMult *
          (isCrit ? 1.45 : 1) *
          resistMult *
          guardMult
      )
    );
    if (atkBuffTurns > 0) setAtkBuffTurns((t) => Math.max(0, t - 1));
    if (pierceBuffTurns > 0) setPierceBuffTurns((t) => Math.max(0, t - 1));
    const nextBossHp = Math.max(0, bossHp - dmg);
    setBossHp(nextBossHp);
    setBossGuarding(false);
    setAura((a) => Math.max(0, a - STORY_SPECIAL_COST));
    triggerCombatAnim(
      'player',
      'combat-anim-special',
      warriorMoveset.accentColor
    );
    triggerCombatAnim('boss', 'combat-anim-hit');
    setBattleLog((prev) => [
      isCrit
        ? `✨ ¡CRÍTICO · ${pMoveset.special.name}! -${dmg} HP (-${STORY_SPECIAL_COST}% ${warriorEnergy.shortName}).`
        : `✨ ${pMoveset.special.name}: -${dmg} HP (-${STORY_SPECIAL_COST}% ${warriorEnergy.shortName}).`,
      ...prev.slice(0, 5),
    ]);

    if (nextBossHp <= 0) {
      handleFinishVictory(activeChapter);
      setTurnBusy(false);
      return;
    }
    runBossTurn(activeChapter, playerHp, nextBossHp, false, bossCharging);
  };

  const handleGuard = () => {
    if (!activeChapter || turnBusy || clashActive) return;
    setTurnBusy(true);
    setGuarding(true);
    const { playerActor, pMoveset } = getStoryBattleActors(activeChapter);
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'guard',
      skillName: pMoveset.guard.name,
      attacker: playerActor,
    });
    const heal = Math.round(playerMaxHp * 0.08);
    const nextHp = Math.min(playerMaxHp, playerHp + heal);
    setPlayerHp(nextHp);
    setAura((a) => Math.min(100, a + 20));
    triggerCombatAnim('player', 'combat-anim-guard');
    setBattleLog((prev) => [
      `🛡️ ${pMoveset.guard.name} · ${warriorEnergy.chargeLabel} (+${heal} HP, +20% ${warriorEnergy.shortName}).`,
      ...prev.slice(0, 5),
    ]);
    runBossTurn(activeChapter, nextHp, bossHp, true, bossCharging);
  };

  const handleUltimate = () => {
    if (!activeChapter || turnBusy || clashActive || aura < 100) return;
    const { playerActor, pMoveset } = getStoryBattleActors(activeChapter);
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'charge',
      skillName: pMoveset.ultimate.name,
      attacker: playerActor,
    });
    setTurnBusy(true);
    setAura(0);
    setClashKind('ultimate');
    clashPowerRef.current = 52;
    setClashPower(52);
    setClashTimeLeft(3400);
    setClashActive(true);
    triggerCombatAnim(
      'player',
      'combat-anim-charge',
      warriorMoveset.accentColor
    );
  };

  const handleUseStoryTacticalItem = (item: ShopItemDef) => {
    if (!activeChapter || turnBusy || clashActive || item.effectKind === 'cosmetic') return;
    const maxBattle = item.perBattleLimit ?? item.storyLimit ?? 1;
    const used = usedItemCounts[item.id] || 0;
    if (used >= maxBattle) return;
    const invEntry = (user.inventory || []).find((e) => e.itemId === item.id && e.quantity > 0);
    if (!invEntry) return;
    if (onConsumeItem && !onConsumeItem(item.id)) return;

    setUsedItemCounts((prev) => ({ ...prev, [item.id]: used + 1 }));
    unlockPvpAudio();
    const val = Number(item.effectValue || 0);
    if (item.effectKind === 'heal_hp') {
      const heal = Math.max(15, Math.round(playerMaxHp * (val > 1 ? val / 100 : val)));
      setPlayerHp((hp) => Math.min(playerMaxHp, hp + heal));
      playConsumeItemSound('heal');
      triggerCombatAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${heal} HP restaurados.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'charge_energy') {
      const charge = Math.round(val);
      setAura((a) => Math.min(100, a + charge));
      playConsumeItemSound('energy');
      triggerCombatAnim('player', 'combat-anim-charge', warriorEnergy.color);
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${charge}% ${warriorEnergy.shortName}.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'temp_guard') {
      const heal = val > 0 ? Math.max(8, Math.round(playerMaxHp * (val > 1 ? val / 100 : val))) : 0;
      if (heal > 0) setPlayerHp((hp) => Math.min(playerMaxHp, hp + heal));
      shieldNextHitRef.current = true;
      setShieldNextHit(true);
      setGuarding(true);
      playConsumeItemSound('buff');
      triggerCombatAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Escudo blindado${heal > 0 ? ` y +${heal} HP` : ''} listos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'atk_crit_buff') {
      const turns = item.turns || 3;
      setAtkBuffTurns(turns);
      playConsumeItemSound('buff');
      triggerCombatAnim('player', 'combat-anim-charge', '#F59E0B');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +25% ATK y Crítico por ${turns} turnos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'evasion_agility') {
      evadeNextHitRef.current = true;
      setEvadeNextHit(true);
      playConsumeItemSound('buff');
      triggerCombatAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Evasión garantizada contra el próximo ataque.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'accuracy_stability') {
      const turns = item.turns || 3;
      setPierceBuffTurns(turns);
      playConsumeItemSound('buff');
      triggerCombatAnim('player', 'combat-anim-charge', '#38BDF8');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Tus ataques atraviesan guardia por ${turns} turnos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'emergency_energy') {
      const boost = Math.round(val || 65);
      setAura((a) => Math.min(100, a + boost));
      playConsumeItemSound('energy');
      triggerCombatAnim('player', 'combat-anim-charge', '#EF4444');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${boost}% ${warriorEnergy.shortName} de emergencia.`, ...prev.slice(0, 5)]);
    }
  };

  const ownedStoryTacticalItems = useMemo(() => {
    const inv = user.inventory || [];
    return inv
      .filter((e) => Number(e.quantity || 0) > 0)
      .map((e) => ({ entry: e, item: getShopItemById(e.itemId) }))
      .filter(
        (row): row is { entry: (typeof inv)[number]; item: ShopItemDef } =>
          Boolean(
            row.item &&
              row.item.category === 'combat_consumable' &&
              row.item.effectKind !== 'auto_revive'
          )
      );
  }, [user.inventory]);

  const ownedStoryAutoReviveQty =
    (user.inventory || []).find((e) => e.itemId === 'tac_phoenix_autorevive')?.quantity || 0;

  if (activeChapter) {
    const boss = getCharacterById(activeChapter.bossCharId);
    const bossStageName =
      boss.stages[
        Math.min(
          boss.stages.length - 1,
          Math.floor((activeChapter.number - 1) / 25)
        )
      ]?.phase || boss.stages[0]?.phase;
    const activeDisplayStageName =
      phase === 'battle' && lockedBattleStage
        ? lockedBattleStage.stageName
        : st.stageName;
    const activeDisplayLevel =
      phase === 'battle' && lockedBattleStage
        ? lockedBattleStage.level
        : st.effectiveLevel;
    const ally = activeChapter.allyCharId
      ? getCharacterById(activeChapter.allyCharId)
      : null;
    const node = activeChapter.nodes[nodeIdx];
    const bossPct = Math.max(
      0,
      Math.round((bossHp / activeChapter.bossHp) * 100)
    );
    const playerPct = Math.max(0, Math.round((playerHp / playerMaxHp) * 100));

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
              Cap. {activeChapter.number} / {STORY_CHAPTERS.length} · {activeChapter.saga}
            </div>
            <h2 className="text-xl font-black text-[#F1F5F9]">
              {activeChapter.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Silenciar combate' : 'Activar sonido'}
              title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
              className="min-h-[40px] w-[40px] rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] flex items-center justify-center text-[#8A92A2] hover:text-[#F1F5F9]"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#38BDF8]" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={exitChapter}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9]"
            >
              ← Mapa
            </button>
          </div>
        </div>

        <section
          className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.05),#07080B_78%)]"
          style={{ borderColor: `${boss.auraColor}55` }}
        >
          {arenaFlashColor && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 pvp-tech-flash"
              style={{
                background: `radial-gradient(circle at 50% 48%, ${arenaFlashColor}44, transparent 72%)`,
              }}
            />
          )}
          <div className="relative z-10 grid grid-cols-2 gap-4 items-center">
            <div className={`flex flex-col items-center text-center ${playerAnim}`}>
              <CharacterAvatar
                charId={warrior.id}
                stageName={activeDisplayStageName}
                level={activeDisplayLevel}
                size="lg"
              />
              <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
                {warrior.name}
              </div>
              <div
                className="text-[11px] font-bold truncate max-w-full"
                style={{ color: warrior.auraColor }}
              >
                {activeDisplayStageName}
              </div>
              {phase === 'battle' && (
                <div className="w-full max-w-[150px] mt-2">
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                    <span className="text-[#22C55E]">HP</span>
                    <span>
                      {playerHp}/{playerMaxHp}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-[#22C55E] transition-all duration-300"
                      style={{ width: `${playerPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mt-1.5 mb-0.5">
                    <span className="truncate" style={{ color: warriorEnergy.color }}>
                      {warriorEnergy.barLabel}
                    </span>
                    <span>{aura}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${aura}%`,
                        background: `linear-gradient(90deg, ${warriorEnergy.barGradientFrom}, ${warriorEnergy.barGradientTo})`,
                      }}
                    />
                  </div>
                  {guarding && (
                    <div className="mt-1.5 text-[11px] font-bold text-[#22C55E]">
                      🛡️ Guardia activa
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`flex flex-col items-center text-center ${bossAnim}`}>
              <CharacterAvatar
                charId={boss.id}
                stageName={bossStageName}
                size="lg"
              />
              <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
                {boss.name}
              </div>
              <div
                className="text-[11px] font-bold truncate max-w-full"
                style={{ color: boss.auraColor }}
              >
                {activeChapter.bossTitle}
              </div>
              {phase === 'battle' && (
                <div className="w-full max-w-[150px] mt-2">
                  <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                    <span className="text-[#EF4444]">HP Jefe</span>
                    <span>
                      {bossHp}/{activeChapter.bossHp}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#EF4444] to-[#F97316] transition-all duration-300"
                      style={{ width: `${bossPct}%` }}
                    />
                  </div>
                  {activeChapter.bossDefensePct ? (
                    <div className="mt-1.5 text-[10px] font-bold text-[#8A92A2] tabular-nums">
                      ATK {activeChapter.bossAtk} · Res. {Math.round(activeChapter.bossDefensePct * 100)}%
                    </div>
                  ) : null}
                  {bossCharging && (
                    <div className="mt-1 text-[11px] font-black text-[#FACC15] animate-pulse">
                      ⚠️ Cargando Técnica
                    </div>
                  )}
                  {bossGuarding && !bossCharging && (
                    <div className="mt-1 text-[11px] font-bold text-[#38BDF8]">
                      🛡️ Jefe en Guardia
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {ally && phase === 'dialogue' && (
            <div className="mt-4 pt-3 border-t border-[#1B1E26]/80 flex items-center justify-center gap-2.5 text-xs text-[#8A92A2]">
              <CharacterAvatar charId={ally.id} size="xs" />
              <span>
                Aliado en escena:{' '}
                <strong className="text-[#F1F5F9]">{ally.name}</strong>
              </span>
            </div>
          )}
        </section>

        {phase === 'dialogue' && node && (
          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            {pendingReply ? (
              <>
                <div className="flex items-start gap-3">
                  <CharacterAvatar
                    charId={pendingReply.replySpeakerCharId}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-[#FACC15]">
                      {pendingReply.replySpeaker}
                    </div>
                    <p className="text-sm text-[#F1F5F9] mt-1 leading-relaxed">
                      “{interpolate(pendingReply.replyText)}”
                    </p>
                    <div className="mt-2.5 text-xs font-bold text-[#38BDF8]">
                      ✨ Ventaja obtenida: {pendingReply.buffLabel}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAdvanceDialogue}
                  className="min-h-[48px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black text-sm inline-flex items-center justify-center gap-2"
                >
                  <Swords className="w-4 h-4" />
                  ¡Iniciar Combate!
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <CharacterAvatar charId={node.speakerCharId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-[#38BDF8]">
                      {node.speaker}
                    </div>
                    <p className="text-sm text-[#F1F5F9] mt-1 leading-relaxed">
                      “{interpolate(node.text)}”
                    </p>
                  </div>
                </div>

                {node.choices && node.choices.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-[#8A92A2]">
                      Elige tu respuesta táctica:
                    </div>
                    {node.choices.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleChooseOption(activeChapter, opt)}
                        className="min-h-[48px] w-full text-left px-4 py-3 rounded-xl bg-[#07080B] border border-[#1B1E26] hover:border-[#FACC15] transition-colors flex items-center justify-between gap-3"
                      >
                        <span className="text-xs sm:text-sm font-bold text-[#F1F5F9]">
                          {opt.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#FACC15] shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAdvanceDialogue}
                    className="min-h-[46px] w-full rounded-xl bg-[#101218] border border-[#38BDF8]/50 text-[#F1F5F9] font-bold text-sm inline-flex items-center justify-center gap-2 hover:border-[#FACC15]"
                  >
                    Continuar
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {phase === 'battle' && (
          <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            {clashActive ? (
              <div className="rounded-2xl bg-[#07080B] border-2 border-[#FACC15] p-4 text-center flex flex-col gap-3">
                <div className="text-sm font-black text-[#FACC15]">
                  ⚡{' '}
                  {clashKind === 'ultimate'
                    ? `¡${warriorEnergy.clashLabel.toUpperCase()}: ${warriorMoveset.ultimate.name.toUpperCase()}!`
                    : `¡BLOQUEA ${activeChapter.bossSignatureMove}!`}
                </div>
                <div className="text-xs text-[#8A92A2] tabular-nums">
                  ¡Toca el botón rápidamente! Tiempo:{' '}
                  {(clashTimeLeft / 1000).toFixed(1)}s
                </div>
                <div className="h-5 rounded-full bg-[#101218] border border-[#1B1E26] overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[#38BDF8] via-[#FACC15] to-[#22C55E] transition-all duration-75"
                    style={{ width: `${Math.round(clashPower)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: '62%' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTapClash}
                  className="min-h-[60px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black text-base active:scale-95 transition-transform shadow-[0_0_20px_rgba(29,78,216,0.35)]"
                >
                  ⚡ ¡{warriorEnergy.chargeLabel.toUpperCase()}! ({Math.round(clashPower)}%)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={turnBusy}
                  onClick={handleStrike}
                  className="min-w-0 min-h-[58px] px-3 py-2 rounded-xl bg-[#101218] border border-[#38BDF8]/50 text-[#F1F5F9] flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 active:scale-[0.98] transition-transform"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                    <Swords className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                    <span className="truncate">{warriorMoveset.physical.name}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-[#38BDF8] truncate max-w-full">
                    Físico · +30% {warriorEnergy.shortName}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={turnBusy || aura < STORY_SPECIAL_COST}
                  onClick={handleSpecial}
                  className={`min-w-0 min-h-[58px] px-3 py-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] transition-transform ${
                    aura >= STORY_SPECIAL_COST && !turnBusy
                      ? 'bg-[#101218] text-[#F1F5F9]'
                      : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] opacity-45 cursor-not-allowed'
                  }`}
                  style={{
                    borderColor:
                      aura >= STORY_SPECIAL_COST && !turnBusy
                        ? `${warriorMoveset.accentColor}99`
                        : '#1B1E26',
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                    <Sparkles
                      className="w-3.5 h-3.5 shrink-0"
                      style={{
                        color:
                          aura >= STORY_SPECIAL_COST
                            ? warriorMoveset.accentColor
                            : '#8A92A2',
                      }}
                    />
                    <span className="truncate">{warriorMoveset.special.name}</span>
                  </span>
                  <span
                    className="text-[10px] font-semibold truncate max-w-full"
                    style={{
                      color:
                        aura >= STORY_SPECIAL_COST ? warriorEnergy.color : '#8A92A2',
                    }}
                  >
                    {aura >= STORY_SPECIAL_COST
                      ? `Especial · -${STORY_SPECIAL_COST}% ${warriorEnergy.shortName}`
                      : `Especial (${aura}/${STORY_SPECIAL_COST}% ${warriorEnergy.shortName})`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={turnBusy}
                  onClick={handleGuard}
                  className="min-w-0 min-h-[58px] px-3 py-2 rounded-xl bg-[#101218] border border-[#22C55E]/50 text-[#F1F5F9] flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 active:scale-[0.98] transition-transform"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                    <Shield className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <span className="truncate">{warriorMoveset.guard.name}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-[#22C55E] truncate max-w-full">
                    +HP · +20% {warriorEnergy.shortName}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={turnBusy || aura < 100}
                  onClick={handleUltimate}
                  className={`min-w-0 min-h-[58px] px-3 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] transition-transform ${
                    aura >= 100 && !turnBusy
                      ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)]'
                      : 'bg-[#07080B] border border-[#1B1E26] text-[#8A92A2] opacity-45 cursor-not-allowed'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{warriorMoveset.ultimate.name}</span>
                  </span>
                  <span className="text-[10px] font-semibold opacity-90 truncate max-w-full">
                    {aura >= 100
                      ? `¡Definitiva · ${warriorEnergy.clashLabel}!`
                      : `Definitiva (${aura}/100%)`}
                  </span>
                </button>
              </div>
            )}

            {/* Mochila Táctica de Historia */}
            {!clashActive && (ownedStoryTacticalItems.length > 0 || ownedStoryAutoReviveQty > 0 || autoReviveUsed > 0) && (
              <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-amber-300">
                    Mochila Táctica (No gasta turno)
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    🔥 Auto-Revivir: {autoReviveUsed}/{STORY_AUTOREVIVE_LIMIT} usado en batalla
                    {ownedStoryAutoReviveQty > 0 ? ` · x${ownedStoryAutoReviveQty} en mochila` : ''}
                  </span>
                </div>
                {ownedStoryTacticalItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ownedStoryTacticalItems.map(({ entry, item }) => {
                      const maxBattle = item.perBattleLimit ?? item.storyLimit ?? 1;
                      const used = usedItemCounts[item.id] || 0;
                      const blocked = turnBusy || used >= maxBattle;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={blocked}
                          onClick={() => handleUseStoryTacticalItem(item)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition ${
                            blocked
                              ? 'bg-[#0A0B0F] border-[#1B1E26] text-slate-500 opacity-55 cursor-not-allowed'
                              : 'bg-[#101218] border-amber-500/40 hover:border-amber-400 text-white'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.name}</span>
                          <span className="text-[10px] text-amber-300 tabular-nums">
                            x{entry.quantity} ({used}/{maxBattle})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {(atkBuffTurns > 0 || pierceBuffTurns > 0 || evadeNextHit || shieldNextHit) && (
                  <div className="flex flex-wrap gap-3 text-[11px] text-sky-300 font-semibold">
                    {atkBuffTurns > 0 && <span>⚔️ +30% ATK/Crít ({atkBuffTurns}t)</span>}
                    {pierceBuffTurns > 0 && <span>🎯 Perforación ({pierceBuffTurns}t)</span>}
                    {evadeNextHit && <span>💨 Evasión lista</span>}
                    {shieldNextHit && <span>🛡️ Escudo -50% listo</span>}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 flex flex-col gap-1.5">
              {battleLog.map((entry, idx) => (
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
        )}

        {(phase === 'victory' || phase === 'defeat') && (
          <section
            className={`rounded-2xl border p-5 text-center flex flex-col gap-4 ${
              phase === 'victory'
                ? 'bg-[radial-gradient(circle_at_50%_15%,rgba(202,138,4,0.07),#0A0B0F_75%)] border-[#FACC15]/55'
                : 'bg-[#0A0B0F] border-[#EF4444]/45'
            }`}
          >
            <div className="text-3xl" aria-hidden="true">
              {phase === 'victory' ? '🏆' : '💥'}
            </div>
            <h3 className="text-xl font-black text-[#F1F5F9]">
              {phase === 'victory'
                ? `¡Capítulo ${activeChapter.number} Superado!`
                : 'Derrota Táctica'}
            </h3>
            <p className="text-sm text-[#8A92A2] leading-relaxed">
              {interpolate(
                phase === 'victory'
                  ? activeChapter.victoryText
                  : activeChapter.defeatText
              )}
            </p>

            {phase === 'victory' && storyVictoryQuote && (
              <div
                className="rounded-xl bg-[#07080B] border px-3.5 py-2.5 text-left"
                style={{ borderColor: `${warriorEnergy.color}66` }}
              >
                <div
                  className="text-[11px] font-extrabold uppercase tracking-wider"
                  style={{ color: warriorEnergy.color }}
                >
                  {warrior.name} ({st.stageName}):
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#F1F5F9] italic mt-0.5 leading-snug">
                  “{storyVictoryQuote}”
                </p>
              </div>
            )}

            {phase === 'victory' && earnedXpThisRun > 0 && (
              <div className="rounded-xl bg-[#07080B] border border-[#22C55E]/40 p-3 text-xs font-extrabold text-[#22C55E] tabular-nums">
                ⚡ Recompensa diaria acreditada: +{earnedXpThisRun} XP
                {earnedCoinsThisRun > 0 ? ` · 🪙 +${earnedCoinsThisRun} monedas` : ''}
                {earnedSecondaryThisRun > 0
                  ? ` · ${SECONDARY_CURRENCY_ICON} +${earnedSecondaryThisRun} ${SECONDARY_CURRENCY_NAME}`
                  : ''}{' '}
                para {warrior.name} · Próximo capítulo nuevo disponible mañana
              </div>
            )}

            {phase === 'victory' && earnedXpThisRun === 0 && (
              <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 text-xs font-bold text-[#8A92A2]">
                Capítulo completado en modo práctica (ya habías reclamado su recompensa diaria).
              </div>
            )}

            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3.5 text-left space-y-2.5">
              <div className="text-xs font-extrabold text-[#38BDF8] flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                Misión Gym ·{' '}
                {activeRoutine
                  ? `Tu Rutina: ${activeRoutine.name}`
                  : activeChapter.missionName}
              </div>
              {activeRoutine ? (
                <>
                  <p className="text-xs text-[#8A92A2]">
                    Basada en tu rutina guardada ({activeRoutine.exercises.length} ejercicios):{' '}
                    <span className="text-[#F1F5F9]">
                      {activeRoutine.exercises
                        .slice(0, 4)
                        .map((re) => {
                          const ex = getExerciseById(re.exId, user);
                          return ex ? `${ex.name} (${re.sets}×${re.targetReps})` : '';
                        })
                        .filter(Boolean)
                        .join(' · ')}
                      {activeRoutine.exercises.length > 4
                        ? ` · +${activeRoutine.exercises.length - 4} más`
                        : ''}
                    </span>
                  </p>
                  {validRoutines.length > 1 && (
                    <select
                      aria-label="Seleccionar rutina para misión gym"
                      value={activeRoutine.id}
                      onChange={(e) => onSetStoryRoutine(e.target.value)}
                      className="w-full min-h-[38px] bg-[#0A0B0F] border border-[#1B1E26] rounded-lg px-2.5 text-xs font-semibold text-[#F1F5F9]"
                    >
                      {validRoutines.map((r) => (
                        <option key={r.id} value={r.id}>
                          Rutina: {r.name} ({r.exercises.length} ej.)
                        </option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#8A92A2]">
                  {activeChapter.missionDesc}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  onStartMissionWorkout(activeChapter, activeRoutine?.id)
                }
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] font-black text-xs inline-flex items-center justify-center gap-2"
              >
                <Dumbbell className="w-4 h-4" />
                {activeRoutine
                  ? `Entrenar "${activeRoutine.name}" (+XP Real)`
                  : 'Entrenar Misión en el Gimnasio (+XP Real)'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => openChapter(activeChapter)}
                className="min-h-[44px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rejugar
              </button>
              <button
                type="button"
                onClick={exitChapter}
                className="min-h-[44px] rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black"
              >
                Volver al Mapa
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  const completedCount = story.completedChapters.length;
  const pct = Math.round((completedCount / STORY_CHAPTERS.length) * 100);
  const sagaStartIdx = (selectedSaga - 1) * 10;
  const visibleChapters = STORY_CHAPTERS.slice(sagaStartIdx, sagaStartIdx + 10);
  const survivalRecord = Math.max(0, Number(user.survivalBestWave || 0));
  const roomRecord = Math.max(0, Number(user.roomBestFloor || 0));

  return (
    <div className="flex flex-col gap-5">
      {/* Combat Mode Switcher: Historia vs Supervivencia vs Torre Anime (Salas) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0A0B0F] border border-[#1B1E26]">
        <button
          type="button"
          onClick={() => {
            clearBossTurnTimer();
            stopAllCombatAudio();
            setCombatSubMode('story');
          }}
          className={`min-h-[44px] px-2 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            combatSubMode === 'story'
              ? 'bg-[#1E40AF] text-[#F1F5F9] shadow-sm'
              : 'text-[#8A92A2] hover:text-[#F1F5F9]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Historia</span>
        </button>
        <button
          type="button"
          onClick={() => {
            clearBossTurnTimer();
            stopAllCombatAudio();
            setCombatSubMode('survival');
          }}
          className={`min-h-[44px] px-2 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            combatSubMode === 'survival'
              ? 'bg-gradient-to-br from-[#EA580C] to-[#9A3412] text-[#F1F5F9] shadow-sm'
              : 'text-[#8A92A2] hover:text-[#F1F5F9]'
          }`}
        >
          <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">
            Supervivencia{survivalRecord > 0 ? ` (${survivalRecord})` : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            clearBossTurnTimer();
            stopAllCombatAudio();
            setCombatSubMode('tower');
          }}
          className={`min-h-[44px] px-2 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
            combatSubMode === 'tower'
              ? 'bg-gradient-to-br from-[#0F766E] to-[#115E59] text-[#F1F5F9] shadow-sm border border-[#2DD4BF]/50'
              : 'text-[#8A92A2] hover:text-[#F1F5F9]'
          }`}
        >
          <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#2DD4BF]" />
          <span className="truncate">
            Salas{roomRecord > 0 ? ` (S.${roomRecord})` : ''}
          </span>
        </button>
      </div>

      {combatSubMode === 'survival' ? (
        <SurvivalModeView
          user={user}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onWaveCleared={onSurvivalWaveCleared}
          onConsumeItem={onConsumeItem}
          onOpenShop={onOpenShop}
        />
      ) : combatSubMode === 'tower' ? (
        <RoomTowerMode
          user={user}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onRoomCleared={onRoomCleared}
          onBuyAccessory={onBuyAccessory}
          onEquipAccessory={onEquipAccessory}
        />
      ) : (
        <>
          {/* Hero Warrior Combat Status + Daily Limit Card */}
          <section
            className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.06),#0A0B0F_72%)]"
            style={{ borderColor: `${warrior.auraColor}55` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <CharacterAvatar
                  charId={warrior.id}
                  stageName={st.stageName}
                  level={st.effectiveLevel}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#FACC15]">
                    Modo Historia · 100 Capítulos (1 por día)
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-[#F1F5F9] truncate">
                    {warrior.name} — {alignmentTitle}
                  </h2>
                  <p className="text-xs text-[#8A92A2] mt-0.5 tabular-nums">
                    Nv.{lv.level} · {st.stageName} · HP {playerMaxHp} · ATK {playerBaseAtk}
                  </p>
                </div>
              </div>

          <div className="bg-[#07080B] border border-[#1B1E26] rounded-xl px-4 py-2.5 text-center shrink-0">
            <div className="text-lg font-black text-[#FACC15] tabular-nums">
              {completedCount} / {STORY_CHAPTERS.length}
            </div>
            <div className="text-[11px] font-semibold text-[#8A92A2]">
              Capítulos ({pct}%)
            </div>
          </div>
        </div>

        <div className="mt-4 h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#38BDF8] to-[#FACC15] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Daily Cooldown Banner */}
        <div
          className={`mt-4 rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 text-xs ${
            dailyStatus.canCompleteNewChapter
              ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#86EFAC]'
              : 'bg-[#FACC15]/10 border-[#FACC15]/40 text-[#FDE68A]'
          }`}
        >
          <CalendarClock className="w-4 h-4 shrink-0" />
          {dailyStatus.canCompleteNewChapter ? (
            <span>
              <strong>Capítulo diario disponible:</strong> completa 1 capítulo nuevo hoy para ganar su XP.
            </span>
          ) : (
            <span>
              <strong>Límite diario alcanzado (1/día):</strong> próximo capítulo nuevo en{' '}
              <strong className="tabular-nums">
                {formatDailyCountdown(dailyStatus.remainingMs)}
              </strong>{' '}
              ({dailyStatus.nextAvailableDate?.toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              ). Puedes seguir haciendo misiones gym o rejugar capítulos completados.
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A92A2] tabular-nums">
            <span>
              🛡️ Honor:{' '}
              <strong className="text-[#22C55E]">{story.alignment.honor}</strong>
            </span>
            <span>
              🔥 Furia:{' '}
              <strong className="text-[#EF4444]">{story.alignment.fury}</strong>
            </span>
            <span>
              🎯 Estrategia:{' '}
              <strong className="text-[#38BDF8]">
                {story.alignment.strategy}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8A92A2] font-semibold whitespace-nowrap">
              🏋️ Tu Rutina Gym:
            </span>
            {validRoutines.length > 1 && activeRoutine ? (
              <select
                aria-label="Tu rutina asignada al Modo Historia"
                value={activeRoutine.id}
                onChange={(e) => onSetStoryRoutine(e.target.value)}
                className="min-h-[34px] max-w-[220px] bg-[#07080B] border border-[#1B1E26] rounded-lg px-2.5 text-xs font-bold text-[#38BDF8]"
              >
                {validRoutines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-[#38BDF8] truncate max-w-[200px]">
                {activeRoutine ? activeRoutine.name : 'Misión base'}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 10 Sagas Selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {Array.from({ length: 10 }, (_, idx) => {
          const sagaNum = idx + 1;
          const slice = STORY_CHAPTERS.slice(idx * 10, idx * 10 + 10);
          const doneInSaga = slice.filter((c) =>
            story.completedChapters.includes(c.id)
          ).length;
          const active = selectedSaga === sagaNum;
          return (
            <button
              key={sagaNum}
              type="button"
              onClick={() => setSelectedSaga(sagaNum)}
              className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                active
                  ? 'bg-[#1E40AF] text-[#F1F5F9] border-[#3B82F6]/60'
                  : 'bg-[#0A0B0F] text-[#8A92A2] border-[#1B1E26] hover:text-[#F1F5F9]'
              }`}
            >
              Saga {sagaNum} ({doneInSaga}/10)
            </button>
          );
        })}
      </div>

      {/* Chapters inside selected Saga */}
      <section className="flex flex-col gap-3">
        {visibleChapters.map((ch) => {
          const globalIdx = ch.number - 1;
          const boss = getCharacterById(ch.bossCharId);
          const completed = story.completedChapters.includes(ch.id);
          const prevCompleted =
            globalIdx === 0 ||
            story.completedChapters.includes(STORY_CHAPTERS[globalIdx - 1].id);
          const levelMet = lv.level >= ch.minLevel;
          const canPlayNew =
            !completed &&
            prevCompleted &&
            levelMet &&
            dailyStatus.canCompleteNewChapter;

          return (
            <div
              key={ch.id}
              className={`rounded-2xl border p-4 transition-colors ${
                completed
                  ? 'bg-[#0A0B0F] border-[#22C55E]/40'
                  : canPlayNew
                  ? 'bg-[#0A0B0F] border-[#FACC15]/70'
                  : 'bg-[#050608] border-[#13161E] opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <CharacterAvatar charId={boss.id} size="md" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[#38BDF8] truncate">
                      Cap. {ch.number} / 100 · {ch.saga}
                    </div>
                    <h3 className="text-base font-black text-[#F1F5F9] truncate">
                      {ch.title}
                    </h3>
                    <p className="text-xs text-[#8A92A2] mt-0.5">
                      {ch.subtitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-bold tabular-nums">
                      <span className="text-[#FACC15]">
                        ⚡ +{ch.xpReward} XP diarios
                      </span>
                      <span className="text-[#8A92A2]">
                        Jefe: {boss.name} (HP {ch.bossHp})
                      </span>
                      <span
                        className={
                          levelMet ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        }
                      >
                        {levelMet
                          ? `Nv.${ch.minLevel}+ listo`
                          : `Requiere Nv.${ch.minLevel}`}
                      </span>
                    </div>
                  </div>
                </div>

                {completed && (
                  <Trophy className="w-5 h-5 text-[#22C55E] shrink-0" />
                )}
                {!completed && !canPlayNew && (
                  <Lock className="w-5 h-5 text-[#8A92A2] shrink-0" />
                )}
              </div>

              <div className="mt-3.5 pt-3 border-t border-[#1B1E26]/70 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={!completed && !canPlayNew}
                  onClick={() => openChapter(ch)}
                  className={`min-h-[44px] flex-1 px-4 rounded-xl text-xs font-black inline-flex items-center justify-center gap-2 ${
                    completed
                      ? 'bg-[#101218] border border-[#22C55E]/40 text-[#F1F5F9]'
                      : canPlayNew
                      ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
                      : 'bg-[#101218] text-[#8A92A2] cursor-not-allowed'
                  }`}
                >
                  {completed ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#22C55E]" />
                      Rejugar Capítulo
                    </>
                  ) : !prevCompleted ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Completa el Cap. {ch.number - 1} primero
                    </>
                  ) : !levelMet ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Sube a Nivel {ch.minLevel} entrenando
                    </>
                  ) : !dailyStatus.canCompleteNewChapter ? (
                    <>
                      <CalendarClock className="w-4 h-4" />
                      Disponible en {formatDailyCountdown(dailyStatus.remainingMs)}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Jugar Capítulo Diario (+{ch.xpReward} XP)
                    </>
                  )}
                </button>

                {(completed || prevCompleted) && (
                  <button
                    type="button"
                    onClick={() =>
                      onStartMissionWorkout(ch, activeRoutine?.id)
                    }
                    title={
                      activeRoutine
                        ? `Entrenar tu rutina: ${activeRoutine.name}`
                        : ch.missionName
                    }
                    className="min-h-[44px] px-4 rounded-xl bg-[#07080B] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Dumbbell className="w-4 h-4" />
                    Misión Gym
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
        </>
      )}
    </div>
  );
}
