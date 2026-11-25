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
  Zap,
} from 'lucide-react';
import { STORY_CHAPTERS } from '../data/storyCampaign';
import {
  StoryAlignmentKey,
  StoryChapter,
  StoryChoiceOption,
  StoryProgress,
  UserProfile,
} from '../types/animefit';
import {
  formatWeeklyCountdown,
  getCharacterById,
  getCharacterStage,
  getExerciseById,
  getLevelInfo,
  getStoryWeeklyStatus,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';

interface StoryTabProps {
  user: UserProfile;
  onUpdateStory: (story: StoryProgress) => void;
  onCompleteChapter: (chapter: StoryChapter) => boolean;
  onStartMissionWorkout: (chapter: StoryChapter, routineId?: string) => void;
  onSetStoryRoutine: (routineId: string) => void;
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
}: StoryTabProps) {
  const story: StoryProgress = user.story || DEFAULT_STORY;
  const lv = getLevelInfo(user.xp);
  const st = getCharacterStage(user.charId, lv.level);
  const warrior = st.char;

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

  const weeklyStatus = getStoryWeeklyStatus(story.lastChapterCompletedAt);

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

  // Battle state
  const [playerHp, setPlayerHp] = useState(120);
  const [bossHp, setBossHp] = useState(110);
  const [aura, setAura] = useState(35);
  const [guarding, setGuarding] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [bossCharging, setBossCharging] = useState(false);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [shakeTarget, setShakeTarget] = useState<'player' | 'boss' | null>(null);

  // Interactive Ki Clash mini-game state
  const [clashActive, setClashActive] = useState(false);
  const [clashPower, setClashPower] = useState(50);
  const [clashTimeLeft, setClashTimeLeft] = useState(3500);
  const [clashKind, setClashKind] = useState<'ultimate' | 'defend'>('ultimate');
  const clashPowerRef = useRef(50);

  const activeChapter = useMemo(
    () => STORY_CHAPTERS.find((c) => c.id === activeChapterId) || null,
    [activeChapterId]
  );

  const playerMaxHp = useMemo(
    () =>
      Math.round(
        115 +
          lv.level * 14 +
          (user.workoutsDone || 0) * 4 +
          Object.keys(user.prs || {}).length * 6
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
    if (honor === 0 && fury === 0 && strategy === 0) return 'Aprendiz del Ki';
    if (honor >= fury && honor >= strategy) return 'Guardián Honorable';
    if (fury >= honor && fury >= strategy) return 'Aura Indomable';
    return 'Estratega Supremo';
  }, [story.alignment]);

  const interpolate = (raw: string) =>
    raw
      .replace(/\{WARRIOR\}/g, warrior.name)
      .replace(/\{STAGE\}/g, st.stageName);

  const triggerShake = (target: 'player' | 'boss') => {
    setShakeTarget(target);
    window.setTimeout(() => setShakeTarget(null), 320);
  };

  const openChapter = (ch: StoryChapter) => {
    const idx = STORY_CHAPTERS.findIndex((item) => item.id === ch.id);
    const alreadyDone = story.completedChapters.includes(ch.id);
    const prevDone =
      idx === 0 || story.completedChapters.includes(STORY_CHAPTERS[idx - 1].id);
    const weeklyNow = getStoryWeeklyStatus(story.lastChapterCompletedAt);

    if (!alreadyDone) {
      if (!prevDone || lv.level < ch.minLevel || !weeklyNow.canCompleteNewChapter) {
        return;
      }
    }

    setActiveChapterId(ch.id);
    setPhase('dialogue');
    setNodeIdx(0);
    setPendingReply(null);
    setEarnedXpThisRun(0);
    setSelectedBuff(story.choices[ch.id] || null);
    setClashActive(false);
    onUpdateStory({
      ...story,
      currentChapterId: ch.id,
      currentNodeIndex: 0,
    });
  };

  const exitChapter = () => {
    setActiveChapterId(null);
    setClashActive(false);
    onUpdateStory({
      ...story,
      currentChapterId: null,
      currentNodeIndex: 0,
    });
  };

  const startBattle = (ch: StoryChapter, buff: StoryAlignmentKey | null) => {
    setPhase('battle');
    setPlayerHp(playerMaxHp);
    setBossHp(ch.bossHp);
    setAura(40);
    setGuarding(false);
    setBossCharging(false);
    setTurnBusy(false);
    setClashActive(false);
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

  const handleFinishVictory = (ch: StoryChapter) => {
    setPhase('victory');
    const rewarded = onCompleteChapter(ch);
    setEarnedXpThisRun(rewarded ? ch.xpReward : 0);
  };

  const runBossTurn = (
    ch: StoryChapter,
    currentPlayerHp: number,
    isGuarding: boolean,
    wasCharging: boolean
  ) => {
    window.setTimeout(() => {
      const boss = getCharacterById(ch.bossCharId);

      if (wasCharging) {
        setBossCharging(false);
        setClashKind('defend');
        clashPowerRef.current = 48;
        setClashPower(48);
        setClashTimeLeft(3400);
        setClashActive(true);
        setBattleLog((prev) => [
          `⚡ ¡${boss.name} lanza ${ch.bossSignatureMove}! ¡Toca rápido para bloquear!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      const willChargeNext = Math.random() < 0.34;
      if (willChargeNext) {
        setBossCharging(true);
        setGuarding(false);
        setTurnBusy(false);
        setBattleLog((prev) => [
          `⚠️ ¡${boss.name} está concentrando energía para ${ch.bossSignatureMove}!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      const honorReduce = selectedBuff === 'honor' ? 0.75 : 1;
      const guardReduce = isGuarding ? 0.35 : 1;
      const dmg = Math.max(
        4,
        Math.round(ch.bossAtk * (0.85 + Math.random() * 0.3) * honorReduce * guardReduce)
      );
      const nextHp = Math.max(0, currentPlayerHp - dmg);
      setPlayerHp(nextHp);
      setGuarding(false);
      triggerShake('player');

      const counterDmg = isGuarding ? Math.round(playerBaseAtk * 0.55) : 0;
      if (counterDmg > 0) {
        setBossHp((b) => {
          const nextB = Math.max(0, b - counterDmg);
          if (nextB === 0) {
            handleFinishVictory(ch);
          }
          return nextB;
        });
      }

      setBattleLog((prev) => [
        isGuarding
          ? `🛡️ Bloqueaste a ${boss.name} (-${dmg} HP) y contraatacaste (-${counterDmg} HP).`
          : `💥 ${boss.name} te golpeó por ${dmg} HP.`,
        ...prev.slice(0, 5),
      ]);

      if (nextHp <= 0) {
        setPhase('defeat');
        setTurnBusy(false);
      } else {
        setTurnBusy(false);
      }
    }, 520);
  };

  useEffect(() => {
    if (!clashActive || !activeChapter) return;
    const started = Date.now();
    const duration = 3400;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const left = Math.max(0, duration - elapsed);
      setClashTimeLeft(left);

      const decay = Math.min(3.4, 1.4 + activeChapter.number * 0.02);
      const nextP = Math.max(5, clashPowerRef.current - decay);
      clashPowerRef.current = nextP;
      setClashPower(nextP);

      if (nextP >= 100 || left <= 0) {
        window.clearInterval(timer);
        setClashActive(false);
        const won = clashPowerRef.current >= 62;
        const boss = getCharacterById(activeChapter.bossCharId);

        if (clashKind === 'ultimate') {
          const furyMult = selectedBuff === 'fury' ? 1.25 : 1;
          const mult = won ? 2.4 : 1.45;
          const dmg = Math.round(playerBaseAtk * mult * furyMult);
          const nextBossHp = Math.max(0, bossHp - dmg);
          setBossHp(nextBossHp);
          triggerShake('boss');
          setBattleLog((prev) => [
            won
              ? `🔥 ¡CHOQUE GANADO! Técnica Definitiva de ${st.stageName}: -${dmg} HP!`
              : `⚡ Técnica Definitiva conectada: -${dmg} HP.`,
            ...prev.slice(0, 5),
          ]);
          if (nextBossHp <= 0) {
            handleFinishVictory(activeChapter);
            setTurnBusy(false);
          } else {
            runBossTurn(activeChapter, playerHp, false, false);
          }
        } else {
          const honorReduce = selectedBuff === 'honor' ? 0.75 : 1;
          const guardReduce = guarding ? 0.45 : 1;
          if (won) {
            const reflect = Math.round(playerBaseAtk * 1.15);
            const nextBossHp = Math.max(0, bossHp - reflect);
            setBossHp(nextBossHp);
            setGuarding(false);
            triggerShake('boss');
            setBattleLog((prev) => [
              `💥 ¡DESVIASTE ${activeChapter.bossSignatureMove}! Contraataque de -${reflect} HP a ${boss.name}!`,
              ...prev.slice(0, 5),
            ]);
            if (nextBossHp <= 0) {
              handleFinishVictory(activeChapter);
            }
            setTurnBusy(false);
          } else {
            const dmg = Math.max(
              8,
              Math.round(activeChapter.bossAtk * 1.6 * honorReduce * guardReduce)
            );
            const nextPlayerHp = Math.max(0, playerHp - dmg);
            setPlayerHp(nextPlayerHp);
            setGuarding(false);
            triggerShake('player');
            setBattleLog((prev) => [
              `💢 ${boss.name} ganó el choque con ${activeChapter.bossSignatureMove}: -${dmg} HP.`,
              ...prev.slice(0, 5),
            ]);
            if (nextPlayerHp <= 0) {
              setPhase('defeat');
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
    const next = Math.min(100, clashPowerRef.current + 12);
    clashPowerRef.current = next;
    setClashPower(next);
  };

  const handleStrike = () => {
    if (!activeChapter || turnBusy || clashActive) return;
    setTurnBusy(true);
    const furyMult = selectedBuff === 'fury' ? 1.25 : 1;
    const critChance = selectedBuff === 'strategy' ? 0.45 : 0.18;
    const isCrit = Math.random() < critChance;
    const dmg = Math.round(
      playerBaseAtk * (0.9 + Math.random() * 0.25) * furyMult * (isCrit ? 1.55 : 1)
    );
    const nextBossHp = Math.max(0, bossHp - dmg);
    setBossHp(nextBossHp);
    setAura((a) => Math.min(100, a + 30));
    triggerShake('boss');
    setBattleLog((prev) => [
      isCrit
        ? `⚡ ¡CRÍTICO de ${warrior.name}! -${dmg} HP.`
        : `👊 Golpe de Ki conectado: -${dmg} HP.`,
      ...prev.slice(0, 5),
    ]);

    if (nextBossHp <= 0) {
      handleFinishVictory(activeChapter);
      setTurnBusy(false);
      return;
    }
    runBossTurn(activeChapter, playerHp, false, bossCharging);
  };

  const handleGuard = () => {
    if (!activeChapter || turnBusy || clashActive) return;
    setTurnBusy(true);
    setGuarding(true);
    const heal = Math.round(playerMaxHp * 0.08);
    const nextHp = Math.min(playerMaxHp, playerHp + heal);
    setPlayerHp(nextHp);
    setAura((a) => Math.min(100, a + 20));
    setBattleLog((prev) => [
      `🛡️ Postura de Guardia (+${heal} HP, +20% Aura).`,
      ...prev.slice(0, 5),
    ]);
    runBossTurn(activeChapter, nextHp, true, bossCharging);
  };

  const handleUltimate = () => {
    if (!activeChapter || turnBusy || clashActive || aura < 100) return;
    setTurnBusy(true);
    setAura(0);
    setClashKind('ultimate');
    clashPowerRef.current = 52;
    setClashPower(52);
    setClashTimeLeft(3400);
    setClashActive(true);
  };

  if (activeChapter) {
    const boss = getCharacterById(activeChapter.bossCharId);
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
          <button
            type="button"
            onClick={exitChapter}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9]"
          >
            ← Mapa
          </button>
        </div>

        <section
          className="rounded-2xl border p-4 sm:p-5 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.05),#07080B_78%)]"
          style={{ borderColor: `${boss.auraColor}55` }}
        >
          <div className="grid grid-cols-2 gap-4 items-center">
            <div
              className={`flex flex-col items-center text-center transition-transform duration-150 ${
                shakeTarget === 'player' ? 'translate-x-1.5 scale-95' : ''
              }`}
            >
              <CharacterAvatar charId={warrior.id} size="lg" />
              <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
                {warrior.name}
              </div>
              <div
                className="text-[11px] font-bold truncate max-w-full"
                style={{ color: warrior.auraColor }}
              >
                {st.stageName}
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
                    <span className="text-[#FACC15]">Aura Ki</span>
                    <span>{aura}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#38BDF8] to-[#FACC15] transition-all duration-300"
                      style={{ width: `${aura}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className={`flex flex-col items-center text-center transition-transform duration-150 ${
                shakeTarget === 'boss' ? '-translate-x-1.5 scale-95' : ''
              }`}
            >
              <CharacterAvatar charId={boss.id} size="lg" />
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
                  {bossCharging && (
                    <div className="mt-1.5 text-[11px] font-black text-[#FACC15] animate-pulse">
                      ⚠️ Cargando Técnica
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
                    ? '¡CHOQUE DE TÉCNICA DEFINITIVA!'
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
                  ⚡ ¡IMPULSAR KI! ({Math.round(clashPower)}%)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={turnBusy}
                  onClick={handleStrike}
                  className="min-h-[50px] px-4 rounded-xl bg-[#101218] border border-[#38BDF8]/50 text-[#F1F5F9] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Swords className="w-4 h-4 text-[#38BDF8]" />
                  Golpe de Ki
                </button>

                <button
                  type="button"
                  disabled={turnBusy}
                  onClick={handleGuard}
                  className="min-h-[50px] px-4 rounded-xl bg-[#101218] border border-[#22C55E]/50 text-[#F1F5F9] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Shield className="w-4 h-4 text-[#22C55E]" />
                  Guardia (+HP)
                </button>

                <button
                  type="button"
                  disabled={turnBusy || aura < 100}
                  onClick={handleUltimate}
                  className={`min-h-[50px] px-4 rounded-xl font-black text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] ${
                    aura >= 100
                      ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)]'
                      : 'bg-[#07080B] border border-[#1B1E26] text-[#8A92A2] opacity-60'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  {aura >= 100 ? '¡Definitiva!' : `Definitiva (${aura}%)`}
                </button>
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

            {phase === 'victory' && earnedXpThisRun > 0 && (
              <div className="rounded-xl bg-[#07080B] border border-[#22C55E]/40 p-3 text-xs font-extrabold text-[#22C55E]">
                ⚡ Recompensa semanal acreditada: +{earnedXpThisRun} XP para{' '}
                {warrior.name} · Próximo capítulo nuevo en 7 días
              </div>
            )}

            {phase === 'victory' && earnedXpThisRun === 0 && (
              <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 text-xs font-bold text-[#8A92A2]">
                Capítulo completado en modo práctica (ya habías reclamado su recompensa semanal).
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

  return (
    <div className="flex flex-col gap-5">
      {/* Hero Warrior Combat Status + Weekly Limit Card */}
      <section
        className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.06),#0A0B0F_72%)]"
        style={{ borderColor: `${warrior.auraColor}55` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <CharacterAvatar charId={warrior.id} size="md" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FACC15]">
                Modo Historia · 100 Capítulos Semanales
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#F1F5F9] truncate">
                {warrior.name} — {alignmentTitle}
              </h2>
              <p className="text-xs text-[#8A92A2] mt-0.5 tabular-nums">
                Nv.{lv.level} · HP {playerMaxHp} · ATK {playerBaseAtk} ·{' '}
                {user.workoutsDone || 0} entrenamientos
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

        {/* Weekly Cooldown Banner */}
        <div
          className={`mt-4 rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 text-xs ${
            weeklyStatus.canCompleteNewChapter
              ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#86EFAC]'
              : 'bg-[#FACC15]/10 border-[#FACC15]/40 text-[#FDE68A]'
          }`}
        >
          <CalendarClock className="w-4 h-4 shrink-0" />
          {weeklyStatus.canCompleteNewChapter ? (
            <span>
              <strong>Capítulo semanal disponible:</strong> completa 1 capítulo nuevo esta semana para ganar su XP.
            </span>
          ) : (
            <span>
              <strong>Límite semanal alcanzado (1/semana):</strong> próximo capítulo nuevo en{' '}
              <strong className="tabular-nums">
                {formatWeeklyCountdown(weeklyStatus.remainingMs)}
              </strong>{' '}
              ({weeklyStatus.nextAvailableDate?.toLocaleDateString('es-ES', {
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
            weeklyStatus.canCompleteNewChapter;

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
                        ⚡ +{ch.xpReward} XP semanal
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
                  ) : !weeklyStatus.canCompleteNewChapter ? (
                    <>
                      <CalendarClock className="w-4 h-4" />
                      Disponible en {formatWeeklyCountdown(weeklyStatus.remainingMs)}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Jugar Capítulo Semanal (+{ch.xpReward} XP)
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
    </div>
  );
}
