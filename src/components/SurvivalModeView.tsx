import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  HeartPulse,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHARACTERS } from '../data/characters';
import { getCharacterPhaseMoveset } from '../data/movesets';
import {
  getShopItemById,
  getUserExtraVictoryQuotes,
  SURVIVAL_AUTOREVIVE_LIMIT,
} from '../data/shopCatalog';
import { pickRotatingVictoryQuote } from '../data/victoryQuotes';
import { PhaseMoveset, ShopItemDef, UserProfile } from '../types/animefit';
import {
  getActiveCharacterStage,
  getCharacterById,
  getLevelInfo,
  getSurvivalWaveXpReward,
  playConsumeItemSound,
  playTechniqueCombatSound,
  speakVictoryVoice,
  stopAllCombatAudio,
  unlockPvpAudio,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';

const SURVIVAL_SPECIAL_COST = 40;

export interface SurvivalWaveClearResult {
  xpEarned: number;
  coinsEarned?: number;
  isNewRecord: boolean;
  nextBestWave: number;
}

interface SurvivalModeViewProps {
  user: UserProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onWaveCleared: (clearedWave: number) => SurvivalWaveClearResult;
  onConsumeItem?: (itemId: string) => boolean;
  onOpenShop?: () => void;
}

type SurvivalPhase = 'idle' | 'battle' | 'wave_clear' | 'defeat';
type CombatAnimClass =
  | ''
  | 'combat-anim-attack-right'
  | 'combat-anim-attack-left'
  | 'combat-anim-hit'
  | 'combat-anim-guard'
  | 'combat-anim-charge'
  | 'combat-anim-special';

interface LockedRunWarrior {
  charId: string;
  name: string;
  level: number;
  stageName: string;
  auraColor: string;
  maxHp: number;
  baseAtk: number;
  moveset: PhaseMoveset;
}

interface WaveEnemy {
  wave: number;
  charId: string;
  name: string;
  stageName: string;
  level: number;
  auraColor: string;
  maxHp: number;
  atk: number;
  defensePct: number;
  signatureMove: string;
  energyName: string;
  energyColor: string;
}

function buildWaveEnemy(
  wave: number,
  playerCharId: string,
  playerMaxHp: number,
  playerBaseAtk: number
): WaveEnemy {
  const pool = CHARACTERS.filter((c) => c.id !== playerCharId);
  const picked = pool[(wave * 7 + 3) % pool.length] || CHARACTERS[0];
  const stageIdx = Math.min(
    picked.stages.length - 1,
    Math.floor((wave - 1) / 2)
  );
  const stage = picked.stages[stageIdx] || picked.stages[0];
  const level = Math.max(1, stage.levelReq + wave * 2);
  const moveset = getCharacterPhaseMoveset(picked.id, level, stage.phase);

  const maxHp = Math.round(playerMaxHp * (0.78 + wave * 0.14) + wave * 28);
  const atk = Math.round(playerBaseAtk * (0.58 + wave * 0.055) + wave * 2.4);
  const defensePct = Math.min(0.32, Number(((wave - 1) * 0.025).toFixed(3)));

  return {
    wave,
    charId: picked.id,
    name: picked.name,
    stageName: stage.phase,
    level,
    auraColor: picked.auraColor,
    maxHp,
    atk,
    defensePct,
    signatureMove: moveset.ultimate.name,
    energyName: moveset.energy.name,
    energyColor: moveset.energy.color,
  };
}

export function SurvivalModeView({
  user,
  soundEnabled,
  onToggleSound,
  onWaveCleared,
  onConsumeItem,
  onOpenShop,
}: SurvivalModeViewProps) {
  const lv = getLevelInfo(user.xp);
  const st = getActiveCharacterStage(user);
  const currentWarrior = st.char;
  const currentMoveset = getCharacterPhaseMoveset(
    currentWarrior.id,
    st.effectiveLevel,
    st.stageName
  );
  const currentMaxHp = useMemo(
    () =>
      Math.round(
        150 +
          lv.level * 18 +
          (user.workoutsDone || 0) * 5 +
          Object.keys(user.prs || {}).length * 8
      ),
    [lv.level, user.workoutsDone, user.prs]
  );
  const currentBaseAtk = useMemo(
    () =>
      Math.round(
        20 + lv.level * 4 + Math.min(28, (user.workoutsDone || 0) * 1.5)
      ),
    [lv.level, user.workoutsDone]
  );

  const bestWave = Math.max(0, Number(user.survivalBestWave || 0));

  const [phase, setPhase] = useState<SurvivalPhase>('idle');
  const [runWarrior, setRunWarrior] = useState<LockedRunWarrior | null>(null);
  const [wave, setWave] = useState(1);
  const [enemy, setEnemy] = useState<WaveEnemy | null>(null);
  const [playerHp, setPlayerHp] = useState(currentMaxHp);
  const [enemyHp, setEnemyHp] = useState(150);
  const [aura, setAura] = useState(30);
  const [playerGuarding, setPlayerGuarding] = useState(false);
  const [enemyGuarding, setEnemyGuarding] = useState(false);
  const [enemyCharging, setEnemyCharging] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [runTotalXp, setRunTotalXp] = useState(0);
  const [runTotalCoins, setRunTotalCoins] = useState(0);
  const [runUsedItemCounts, setRunUsedItemCounts] = useState<Record<string, number>>({});
  const [runAutoReviveUsed, setRunAutoReviveUsed] = useState(0);
  const [atkBuffTurns, setAtkBuffTurns] = useState(0);
  const [pierceBuffTurns, setPierceBuffTurns] = useState(0);
  const [evadeNextHit, setEvadeNextHit] = useState(false);
  const [shieldNextHit, setShieldNextHit] = useState(false);
  const [lastWaveResult, setLastWaveResult] = useState<{
    wave: number;
    xpEarned: number;
    coinsEarned: number;
    isNewRecord: boolean;
    healedHp: number;
    auraAfter: number;
    quote: string | null;
  } | null>(null);

  // Clash mini-game state
  const [clashActive, setClashActive] = useState(false);
  const [clashKind, setClashKind] = useState<'ultimate' | 'defend'>('ultimate');
  const [clashPower, setClashPower] = useState(50);
  const [clashTimeLeft, setClashTimeLeft] = useState(3200);
  const clashPowerRef = useRef(50);

  // Short CSS animations
  const [playerAnim, setPlayerAnim] = useState<CombatAnimClass>('');
  const [enemyAnim, setEnemyAnim] = useState<CombatAnimClass>('');
  const [arenaFlashColor, setArenaFlashColor] = useState<string | null>(null);
  const enemyTurnTimerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const runAutoReviveRef = useRef(0);
  const evadeNextHitRef = useRef(false);
  const shieldNextHitRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const clearEnemyTurnTimer = () => {
    if (enemyTurnTimerRef.current !== null) {
      window.clearTimeout(enemyTurnTimerRef.current);
      enemyTurnTimerRef.current = null;
    }
  };

  const triggerActorAnim = (
    who: 'player' | 'enemy',
    anim: CombatAnimClass,
    flashColor?: string
  ) => {
    if (who === 'player') {
      setPlayerAnim(anim);
      window.setTimeout(() => setPlayerAnim(''), 440);
    } else {
      setEnemyAnim(anim);
      window.setTimeout(() => setEnemyAnim(''), 440);
    }
    if (flashColor) {
      setArenaFlashColor(flashColor);
      window.setTimeout(() => setArenaFlashColor(null), 460);
    }
  };

  useEffect(() => {
    return () => {
      clearEnemyTurnTimer();
      stopAllCombatAudio();
    };
  }, []);

  const tryTriggerSurvivalAutoRevive = (snap: LockedRunWarrior): boolean => {
    if (runAutoReviveRef.current >= SURVIVAL_AUTOREVIVE_LIMIT) return false;
    const invEntry = (userRef.current.inventory || []).find(
      (e) => e.itemId === 'tac_phoenix_autorevive' && Number(e.quantity || 0) > 0
    );
    if (!invEntry) return false;
    if (onConsumeItem && !onConsumeItem('tac_phoenix_autorevive')) return false;

    runAutoReviveRef.current += 1;
    setRunAutoReviveUsed(runAutoReviveRef.current);
    const reviveHp = Math.max(20, Math.round(snap.maxHp * 0.45));
    setPlayerHp(reviveHp);
    setAura((a) => Math.min(100, a + 25));
    setPlayerGuarding(true);
    playConsumeItemSound('auto_revive');
    triggerActorAnim('player', 'combat-anim-charge', '#F97316');
    setBattleLog((prev) => [
      `🔥 ¡LLAMAS DE MARCO ACTIVADAS! Auto-Revivir restauró ${reviveHp} HP y +25% ${snap.moveset.energy.shortName} (${runAutoReviveRef.current}/${SURVIVAL_AUTOREVIVE_LIMIT} usos en esta racha).`,
      ...prev.slice(0, 5),
    ]);
    return true;
  };

  const startSurvivalRun = () => {
    clearEnemyTurnTimer();
    stopAllCombatAudio();
    runIdRef.current += 1;
    runAutoReviveRef.current = 0;
    evadeNextHitRef.current = false;
    shieldNextHitRef.current = false;
    const locked: LockedRunWarrior = {
      charId: currentWarrior.id,
      name: currentWarrior.name,
      level: st.effectiveLevel,
      stageName: st.stageName,
      auraColor: currentWarrior.auraColor,
      maxHp: currentMaxHp,
      baseAtk: currentBaseAtk,
      moveset: currentMoveset,
    };
    const firstEnemy = buildWaveEnemy(1, locked.charId, locked.maxHp, locked.baseAtk);
    setRunWarrior(locked);
    setWave(1);
    setEnemy(firstEnemy);
    setPlayerHp(locked.maxHp);
    setEnemyHp(firstEnemy.maxHp);
    setAura(30);
    setPlayerGuarding(false);
    setEnemyGuarding(false);
    setEnemyCharging(false);
    setTurnBusy(false);
    setClashActive(false);
    setRunTotalXp(0);
    setRunTotalCoins(0);
    setRunUsedItemCounts({});
    setRunAutoReviveUsed(0);
    setAtkBuffTurns(0);
    setPierceBuffTurns(0);
    setEvadeNextHit(false);
    setShieldNextHit(false);
    setLastWaveResult(null);
    setBattleLog([
      `🔥 ¡Supervivencia iniciada! Oleada 1: ${locked.name} (${locked.stageName}) vs ${firstEnemy.name}.`,
    ]);
    setPhase('battle');
  };

  const handleVictoryWave = (
    clearedWave: number,
    snap: LockedRunWarrior,
    hpAtClear: number,
    auraAtClear: number
  ) => {
    clearEnemyTurnTimer();
    const reward = onWaveCleared(clearedWave);
    const coinsEarned = Math.max(0, Number(reward.coinsEarned || 0));
    setRunTotalXp((prev) => prev + reward.xpEarned);
    setRunTotalCoins((prev) => prev + coinsEarned);

    const healAmount = Math.max(12, Math.round(snap.maxHp * 0.22));
    const nextHp = Math.min(snap.maxHp, hpAtClear + healAmount);
    const actualHealed = Math.max(0, nextHp - hpAtClear);
    const nextAura = Math.min(100, auraAtClear + 15);

    setPlayerHp(nextHp);
    setAura(nextAura);
    setPlayerGuarding(false);
    setEnemyGuarding(false);
    setEnemyCharging(false);
    setTurnBusy(false);

    const waveKey = `${runIdRef.current}:${clearedWave}`;
    let quote: string | null = null;
    const snapChar = getCharacterById(snap.charId);

    playTechniqueCombatSound({
      slot: 'victory',
      attacker: { charId: snap.charId, stageName: snap.stageName, level: snap.level, anime: snapChar.anime },
      delayMs: 240,
      eventKey: `surv_win:${waveKey}`,
    });

    if (reward.isNewRecord || clearedWave % 3 === 0) {
      const extraQuotes = getUserExtraVictoryQuotes(userRef.current);
      const picked = pickRotatingVictoryQuote(
        snap.charId,
        snapChar.anime,
        snapChar.gender,
        extraQuotes
      );
      quote = picked.quote;
      speakVictoryVoice(picked.quote, {
        ...picked.voice,
        gender: snapChar.gender,
        delayMs: 650,
        eventKey: `surv_voice:${waveKey}`,
      });
    }

    setLastWaveResult({
      wave: clearedWave,
      xpEarned: reward.xpEarned,
      coinsEarned,
      isNewRecord: reward.isNewRecord,
      healedHp: actualHealed,
      auraAfter: nextAura,
      quote,
    });
    setPhase('wave_clear');
  };

  const advanceToNextWave = () => {
    if (!runWarrior) return;
    clearEnemyTurnTimer();
    stopAllCombatAudio();
    const nextWave = wave + 1;
    const nextEnemy = buildWaveEnemy(
      nextWave,
      runWarrior.charId,
      runWarrior.maxHp,
      runWarrior.baseAtk
    );
    setWave(nextWave);
    setEnemy(nextEnemy);
    setEnemyHp(nextEnemy.maxHp);
    setPlayerGuarding(false);
    setEnemyGuarding(false);
    setEnemyCharging(false);
    setTurnBusy(false);
    setClashActive(false);
    setBattleLog([
      `⚔️ ¡Oleada ${nextWave}! Aparece ${nextEnemy.name} (${nextEnemy.stageName}) con ${nextEnemy.maxHp} HP.`,
      `💚 Recuperación aplicada · Llegas con ${playerHp}/${runWarrior.maxHp} HP y ${aura}% ${runWarrior.moveset.energy.shortName}.`,
    ]);
    setPhase('battle');
  };

  const runEnemyTurn = (
    snap: LockedRunWarrior,
    currEnemy: WaveEnemy,
    currPlayerHp: number,
    currEnemyHp: number,
    currAura: number,
    isPlayerGuarding: boolean,
    wasEnemyCharging: boolean
  ) => {
    clearEnemyTurnTimer();
    enemyTurnTimerRef.current = window.setTimeout(() => {
      enemyTurnTimerRef.current = null;
      const eMoveset = getCharacterPhaseMoveset(
        currEnemy.charId,
        currEnemy.level,
        currEnemy.stageName
      );
      const enemyActor = {
        charId: currEnemy.charId,
        stageName: currEnemy.stageName,
        level: currEnemy.level,
      };
      const playerActor = {
        charId: snap.charId,
        stageName: snap.stageName,
        level: snap.level,
      };

      if (wasEnemyCharging) {
        setEnemyCharging(false);
        setEnemyGuarding(false);
        setClashKind('defend');
        clashPowerRef.current = 46;
        setClashPower(46);
        setClashTimeLeft(3200);
        setClashActive(true);
        triggerActorAnim('enemy', 'combat-anim-charge', currEnemy.energyColor);
        playTechniqueCombatSound({
          slot: 'charge',
          skillName: currEnemy.signatureMove,
          attacker: enemyActor,
          defender: playerActor,
        });
        setBattleLog((prev) => [
          `⚡ ¡${currEnemy.name} desata ${currEnemy.signatureMove}! ¡Toca rápido para bloquear!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      const roll = Math.random();
      const chargeChance = Math.min(0.38, 0.24 + currEnemy.wave * 0.015);
      const guardChance = Math.min(0.28, 0.14 + currEnemy.wave * 0.015);

      if (roll < chargeChance) {
        setEnemyCharging(true);
        setEnemyGuarding(false);
        setPlayerGuarding(false);
        setTurnBusy(false);
        triggerActorAnim('enemy', 'combat-anim-charge', currEnemy.energyColor);
        playTechniqueCombatSound({
          slot: 'charge',
          skillName: currEnemy.signatureMove,
          attacker: enemyActor,
          defender: playerActor,
        });
        setBattleLog((prev) => [
          `⚠️ ¡${currEnemy.name} está concentrando ${currEnemy.energyName} para ${currEnemy.signatureMove}!`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      if (roll < chargeChance + guardChance) {
        const enemyHeal = Math.round(currEnemy.maxHp * 0.05);
        setEnemyHp(Math.min(currEnemy.maxHp, currEnemyHp + enemyHeal));
        setEnemyGuarding(true);
        setPlayerGuarding(false);
        setTurnBusy(false);
        triggerActorAnim('enemy', 'combat-anim-guard');
        playTechniqueCombatSound({
          slot: 'guard',
          skillName: eMoveset.guard.name,
          attacker: enemyActor,
        });
        setBattleLog((prev) => [
          `🛡️ ${currEnemy.name} adopta postura defensiva (+${enemyHeal} HP, reduce tu próximo golpe).`,
          ...prev.slice(0, 5),
        ]);
        return;
      }

      setEnemyGuarding(false);
      if (evadeNextHitRef.current) {
        evadeNextHitRef.current = false;
        setEvadeNextHit(false);
        setPlayerGuarding(false);
        triggerActorAnim('enemy', 'combat-anim-attack-left');
        triggerActorAnim('player', 'combat-anim-guard');
        setBattleLog((prev) => [
          `💨 ¡Shunpo activado! Esquivaste por completo el ataque de ${currEnemy.name} (0 HP).`,
          ...prev.slice(0, 5),
        ]);
        setTurnBusy(false);
        return;
      }

      const guardReduce = isPlayerGuarding ? 0.36 : 1;
      const shieldReduce = shieldNextHitRef.current ? 0.5 : 1;
      if (shieldNextHitRef.current) {
        shieldNextHitRef.current = false;
        setShieldNextHit(false);
      }
      const dmg = Math.max(
        4,
        Math.round(currEnemy.atk * (0.82 + Math.random() * 0.26) * guardReduce * shieldReduce)
      );
      const nextPlayerHp = Math.max(0, currPlayerHp - dmg);
      setPlayerHp(nextPlayerHp);
      setPlayerGuarding(false);
      triggerActorAnim('enemy', 'combat-anim-attack-left');
      triggerActorAnim('player', isPlayerGuarding ? 'combat-anim-guard' : 'combat-anim-hit');
      playTechniqueCombatSound({
        slot: 'physical',
        skillName: eMoveset.physical.name,
        attacker: enemyActor,
        defender: playerActor,
        isBlocked: isPlayerGuarding,
      });

      const counterDmg = isPlayerGuarding ? Math.round(snap.baseAtk * 0.42) : 0;
      let nextEnemyHpAfterCounter = currEnemyHp;
      if (counterDmg > 0) {
        nextEnemyHpAfterCounter = Math.max(0, currEnemyHp - counterDmg);
        setEnemyHp(nextEnemyHpAfterCounter);
      }

      setBattleLog((prev) => [
        isPlayerGuarding
          ? `🛡️ Bloqueaste a ${currEnemy.name} (-${dmg} HP) y contraatacaste (-${counterDmg} HP).`
          : `💥 ${currEnemy.name} te golpeó por -${dmg} HP.`,
        ...prev.slice(0, 5),
      ]);

      if (nextEnemyHpAfterCounter <= 0) {
        handleVictoryWave(currEnemy.wave, snap, nextPlayerHp, currAura);
        return;
      }

      if (nextPlayerHp <= 0) {
        const revived = tryTriggerSurvivalAutoRevive(snap);
        if (!revived) {
          setPhase('defeat');
          playTechniqueCombatSound({
            slot: 'defeat',
            attacker: enemyActor,
            defender: playerActor,
            delayMs: 220,
            eventKey: `surv_lose:${runIdRef.current}:${currEnemy.wave}`,
          });
        }
      }
      setTurnBusy(false);
    }, 440);
  };

  useEffect(() => {
    if (!clashActive || !runWarrior || !enemy) return;
    const started = Date.now();
    const duration = 3200;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const left = Math.max(0, duration - elapsed);
      setClashTimeLeft(left);

      const decay = Math.min(3.5, 1.5 + enemy.wave * 0.12);
      const nextP = Math.max(5, clashPowerRef.current - decay);
      clashPowerRef.current = nextP;
      setClashPower(nextP);

      if (nextP >= 100 || left <= 0) {
        window.clearInterval(timer);
        setClashActive(false);
        const won = clashPowerRef.current >= 62;
        const playerActor = {
          charId: runWarrior.charId,
          stageName: runWarrior.stageName,
          level: runWarrior.level,
        };
        const enemyActor = {
          charId: enemy.charId,
          stageName: enemy.stageName,
          level: enemy.level,
        };

        if (clashKind === 'ultimate') {
          const mult = won ? 2.35 : 1.45;
          const resistMult = 1 - enemy.defensePct * 0.5;
          const dmg = Math.max(
            10,
            Math.round(runWarrior.baseAtk * mult * resistMult)
          );
          const nextEnemyHp = Math.max(0, enemyHp - dmg);
          setEnemyHp(nextEnemyHp);
          setEnemyGuarding(false);
          triggerActorAnim(
            'player',
            'combat-anim-special',
            runWarrior.moveset.accentColor
          );
          triggerActorAnim('enemy', 'combat-anim-hit');
          playTechniqueCombatSound({
            slot: 'ultimate',
            skillName: runWarrior.moveset.ultimate.name,
            attacker: playerActor,
            defender: enemyActor,
            isCrit: won,
          });
          setBattleLog((prev) => [
            won
              ? `🔥 ¡CHOQUE DOMINADO! ${runWarrior.moveset.ultimate.name}: -${dmg} HP!`
              : `⚡ ${runWarrior.moveset.ultimate.name} conectada: -${dmg} HP.`,
            ...prev.slice(0, 5),
          ]);
          if (nextEnemyHp <= 0) {
            handleVictoryWave(enemy.wave, runWarrior, playerHp, aura);
          } else {
            runEnemyTurn(
              runWarrior,
              enemy,
              playerHp,
              nextEnemyHp,
              aura,
              false,
              false
            );
          }
        } else {
          const guardReduce = playerGuarding ? 0.45 : 1;
          if (won) {
            const reflect = Math.round(runWarrior.baseAtk * 1.15);
            const nextEnemyHp = Math.max(0, enemyHp - reflect);
            setEnemyHp(nextEnemyHp);
            setPlayerGuarding(false);
            triggerActorAnim('player', 'combat-anim-guard');
            triggerActorAnim('enemy', 'combat-anim-hit');
            playTechniqueCombatSound({
              slot: 'clash_reflect',
              skillName: runWarrior.moveset.guard.name,
              attacker: playerActor,
              defender: enemyActor,
              isBlocked: true,
            });
            setBattleLog((prev) => [
              `💥 ¡DESVIASTE ${enemy.signatureMove}! Contraataque de -${reflect} HP.`,
              ...prev.slice(0, 5),
            ]);
            if (nextEnemyHp <= 0) {
              handleVictoryWave(enemy.wave, runWarrior, playerHp, aura);
            } else {
              setTurnBusy(false);
            }
          } else {
            const dmg = evadeNextHitRef.current
              ? 0
              : Math.max(
                  6,
                  Math.round(
                    enemy.atk *
                      1.55 *
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
            setPlayerGuarding(false);
            triggerActorAnim('enemy', 'combat-anim-special', enemy.energyColor);
            triggerActorAnim('player', dmg === 0 ? 'combat-anim-guard' : 'combat-anim-hit');
            playTechniqueCombatSound({
              slot: 'ultimate',
              skillName: enemy.signatureMove,
              attacker: enemyActor,
              defender: playerActor,
              isCrit: dmg > 0,
              isBlocked: playerGuarding || dmg === 0,
            });
            setBattleLog((prev) => [
              dmg === 0
                ? `💨 ¡Shunpo evitó el impacto de ${enemy.signatureMove} (0 HP)!`
                : `💢 ${enemy.name} conectó ${enemy.signatureMove}: -${dmg} HP.`,
              ...prev.slice(0, 5),
            ]);
            if (nextPlayerHp <= 0) {
              const revived = tryTriggerSurvivalAutoRevive(runWarrior);
              if (!revived) {
                setPhase('defeat');
                playTechniqueCombatSound({
                  slot: 'defeat',
                  attacker: enemyActor,
                  defender: playerActor,
                  delayMs: 220,
                  eventKey: `surv_lose:${runIdRef.current}:${enemy.wave}`,
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
    playTechniqueCombatSound({
      slot: 'charge',
      skillName: enemy?.signatureMove,
      attacker: runWarrior
        ? {
            charId: runWarrior.charId,
            stageName: runWarrior.stageName,
            level: runWarrior.level,
          }
        : undefined,
    });
    const next = Math.min(100, clashPowerRef.current + 12);
    clashPowerRef.current = next;
    setClashPower(next);
  };

  const handleStrike = () => {
    if (!runWarrior || !enemy || turnBusy || clashActive) return;
    setTurnBusy(true);
    const atkBuffMult = atkBuffTurns > 0 ? 1.3 : 1;
    const critChance = atkBuffTurns > 0 ? 0.38 : 0.2;
    const isCrit = Math.random() < critChance;
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'physical',
      skillName: runWarrior.moveset.physical.name,
      attacker: {
        charId: runWarrior.charId,
        stageName: runWarrior.stageName,
        level: runWarrior.level,
      },
      defender: {
        charId: enemy.charId,
        stageName: enemy.stageName,
        level: enemy.level,
      },
      isCrit,
      isBlocked: enemyGuarding && pierceBuffTurns <= 0,
    });
    const guardMult = pierceBuffTurns > 0 ? 1 : enemyGuarding ? 0.55 : 1;
    const resistMult = pierceBuffTurns > 0 ? 1 : 1 - enemy.defensePct;
    const dmg = Math.max(
      4,
      Math.round(
        runWarrior.baseAtk *
          (0.75 + Math.random() * 0.2) *
          atkBuffMult *
          (isCrit ? 1.4 : 1) *
          resistMult *
          guardMult
      )
    );
    if (atkBuffTurns > 0) setAtkBuffTurns((t) => Math.max(0, t - 1));
    if (pierceBuffTurns > 0) setPierceBuffTurns((t) => Math.max(0, t - 1));
    const nextEnemyHp = Math.max(0, enemyHp - dmg);
    const nextAura = Math.min(100, aura + 30);
    setEnemyHp(nextEnemyHp);
    setEnemyGuarding(false);
    setAura(nextAura);
    triggerActorAnim('player', 'combat-anim-attack-right');
    triggerActorAnim('enemy', 'combat-anim-hit');

    setBattleLog((prev) => [
      isCrit
        ? `⚡ ¡CRÍTICO con ${runWarrior.moveset.physical.name}! -${dmg} HP (+30% ${runWarrior.moveset.energy.shortName}).`
        : enemyGuarding && pierceBuffTurns <= 0
        ? `🛡️ ${enemy.name} cubrió parte de ${runWarrior.moveset.physical.name} (-${dmg} HP).`
        : `👊 ${runWarrior.moveset.physical.name}: -${dmg} HP (+30% ${runWarrior.moveset.energy.shortName}).`,
      ...prev.slice(0, 5),
    ]);

    if (nextEnemyHp <= 0) {
      handleVictoryWave(enemy.wave, runWarrior, playerHp, nextAura);
      return;
    }
    runEnemyTurn(
      runWarrior,
      enemy,
      playerHp,
      nextEnemyHp,
      nextAura,
      false,
      enemyCharging
    );
  };

  const handleSpecial = () => {
    if (
      !runWarrior ||
      !enemy ||
      turnBusy ||
      clashActive ||
      aura < SURVIVAL_SPECIAL_COST
    ) {
      return;
    }
    setTurnBusy(true);
    const atkBuffMult = atkBuffTurns > 0 ? 1.3 : 1;
    const critChance = atkBuffTurns > 0 ? 0.46 : 0.28;
    const isCrit = Math.random() < critChance;
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'special',
      skillName: runWarrior.moveset.special.name,
      attacker: {
        charId: runWarrior.charId,
        stageName: runWarrior.stageName,
        level: runWarrior.level,
      },
      defender: {
        charId: enemy.charId,
        stageName: enemy.stageName,
        level: enemy.level,
      },
      isCrit,
      isBlocked: enemyGuarding && pierceBuffTurns <= 0,
    });
    const guardMult = pierceBuffTurns > 0 ? 1 : enemyGuarding ? 0.78 : 1;
    const resistMult = pierceBuffTurns > 0 ? 1 : 1 - enemy.defensePct * 0.6;
    const dmg = Math.max(
      8,
      Math.round(
        runWarrior.baseAtk *
          (1.3 + Math.random() * 0.22) *
          atkBuffMult *
          (isCrit ? 1.45 : 1) *
          resistMult *
          guardMult
      )
    );
    if (atkBuffTurns > 0) setAtkBuffTurns((t) => Math.max(0, t - 1));
    if (pierceBuffTurns > 0) setPierceBuffTurns((t) => Math.max(0, t - 1));
    const nextEnemyHp = Math.max(0, enemyHp - dmg);
    const nextAura = Math.max(0, aura - SURVIVAL_SPECIAL_COST);
    setEnemyHp(nextEnemyHp);
    setEnemyGuarding(false);
    setAura(nextAura);
    triggerActorAnim(
      'player',
      'combat-anim-special',
      runWarrior.moveset.accentColor
    );
    triggerActorAnim('enemy', 'combat-anim-hit');

    setBattleLog((prev) => [
      isCrit
        ? `✨ ¡CRÍTICO · ${runWarrior.moveset.special.name}! -${dmg} HP (-${SURVIVAL_SPECIAL_COST}% ${runWarrior.moveset.energy.shortName}).`
        : `✨ ${runWarrior.moveset.special.name}: -${dmg} HP (-${SURVIVAL_SPECIAL_COST}% ${runWarrior.moveset.energy.shortName}).`,
      ...prev.slice(0, 5),
    ]);

    if (nextEnemyHp <= 0) {
      handleVictoryWave(enemy.wave, runWarrior, playerHp, nextAura);
      return;
    }
    runEnemyTurn(
      runWarrior,
      enemy,
      playerHp,
      nextEnemyHp,
      nextAura,
      false,
      enemyCharging
    );
  };

  const handleGuard = () => {
    if (!runWarrior || !enemy || turnBusy || clashActive) return;
    setTurnBusy(true);
    setPlayerGuarding(true);
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'guard',
      skillName: runWarrior.moveset.guard.name,
      attacker: {
        charId: runWarrior.charId,
        stageName: runWarrior.stageName,
        level: runWarrior.level,
      },
    });
    const heal = Math.round(runWarrior.maxHp * 0.08);
    const nextHp = Math.min(runWarrior.maxHp, playerHp + heal);
    const nextAura = Math.min(100, aura + 20);
    setPlayerHp(nextHp);
    setAura(nextAura);
    triggerActorAnim('player', 'combat-anim-guard');
    setBattleLog((prev) => [
      `🛡️ ${runWarrior.moveset.guard.name} · ${runWarrior.moveset.energy.chargeLabel} (+${heal} HP, +20% ${runWarrior.moveset.energy.shortName}).`,
      ...prev.slice(0, 5),
    ]);
    runEnemyTurn(
      runWarrior,
      enemy,
      nextHp,
      enemyHp,
      nextAura,
      true,
      enemyCharging
    );
  };

  const handleUltimate = () => {
    if (!runWarrior || !enemy || turnBusy || clashActive || aura < 100) return;
    unlockPvpAudio();
    playTechniqueCombatSound({
      slot: 'charge',
      skillName: runWarrior.moveset.ultimate.name,
      attacker: {
        charId: runWarrior.charId,
        stageName: runWarrior.stageName,
        level: runWarrior.level,
      },
    });
    setTurnBusy(true);
    setAura(0);
    setClashKind('ultimate');
    clashPowerRef.current = 52;
    setClashPower(52);
    setClashTimeLeft(3200);
    setClashActive(true);
    triggerActorAnim(
      'player',
      'combat-anim-charge',
      runWarrior.moveset.accentColor
    );
  };

  const handleUseTacticalItem = (item: ShopItemDef) => {
    if (!runWarrior || turnBusy || clashActive || item.effectKind === 'cosmetic') return;
    const limit = item.survivalRunLimit ?? item.perBattleLimit ?? 2;
    const used = runUsedItemCounts[item.id] || 0;
    if (used >= limit) return;
    const invEntry = (user.inventory || []).find((e) => e.itemId === item.id && e.quantity > 0);
    if (!invEntry) return;
    if (onConsumeItem && !onConsumeItem(item.id)) return;

    setRunUsedItemCounts((prev) => ({ ...prev, [item.id]: used + 1 }));
    unlockPvpAudio();
    const val = Number(item.effectValue || 0);
    const secVal = Number(item.secondaryValue || 0);
    if (item.effectKind === 'heal_hp') {
      const heal = Math.max(15, Math.round(runWarrior.maxHp * (val > 1 ? val / 100 : val)));
      setPlayerHp((hp) => Math.min(runWarrior.maxHp, hp + heal));
      playConsumeItemSound('heal');
      triggerActorAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${heal} HP restaurados.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'charge_energy') {
      const charge = Math.round(val);
      setAura((a) => Math.min(100, a + charge));
      playConsumeItemSound('energy');
      triggerActorAnim('player', 'combat-anim-charge', runWarrior.moveset.energy.color);
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${charge}% ${runWarrior.moveset.energy.shortName}.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'temp_guard') {
      const heal = val > 0 ? Math.max(8, Math.round(runWarrior.maxHp * (val > 1 ? val / 100 : val))) : 0;
      if (heal > 0) setPlayerHp((hp) => Math.min(runWarrior.maxHp, hp + heal));
      shieldNextHitRef.current = true;
      setShieldNextHit(true);
      setPlayerGuarding(true);
      playConsumeItemSound('buff');
      triggerActorAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Escudo blindado${heal > 0 ? ` y +${heal} HP` : ''} listos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'atk_crit_buff') {
      const turns = item.turns || 3;
      setAtkBuffTurns(turns);
      playConsumeItemSound('buff');
      triggerActorAnim('player', 'combat-anim-charge', '#F59E0B');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +25% ATK y Crítico por ${turns} turnos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'evasion_agility') {
      evadeNextHitRef.current = true;
      setEvadeNextHit(true);
      playConsumeItemSound('buff');
      triggerActorAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Evasión garantizada contra el próximo ataque.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'accuracy_stability') {
      const turns = item.turns || 3;
      setPierceBuffTurns(turns);
      playConsumeItemSound('buff');
      triggerActorAnim('player', 'combat-anim-charge', '#38BDF8');
      setBattleLog((prev) => [`${item.icon} ${item.name}: Tus ataques atraviesan guardia por ${turns} turnos.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'emergency_energy') {
      const boost = Math.round(val || 65);
      setAura((a) => Math.min(100, a + boost));
      playConsumeItemSound('energy');
      triggerActorAnim('player', 'combat-anim-charge', '#EF4444');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${boost}% ${runWarrior.moveset.energy.shortName} de emergencia.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'survival_wave_ration') {
      const heal = Math.max(12, Math.round(runWarrior.maxHp * (val > 1 ? val / 100 : val || 0.35)));
      const energyGain = Math.round(secVal || 25);
      setPlayerHp((hp) => Math.min(runWarrior.maxHp, hp + heal));
      setAura((a) => Math.min(100, a + energyGain));
      playConsumeItemSound('heal');
      triggerActorAnim('player', 'combat-anim-guard');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${heal} HP y +${energyGain}% ${runWarrior.moveset.energy.shortName}.`, ...prev.slice(0, 5)]);
    } else if (item.effectKind === 'survival_wave_boost') {
      const heal = Math.max(10, Math.round(runWarrior.maxHp * (val > 1 ? val / 100 : val || 0.22)));
      const turns = item.turns || 3;
      setPlayerHp((hp) => Math.min(runWarrior.maxHp, hp + heal));
      setAtkBuffTurns(turns);
      playConsumeItemSound('buff');
      triggerActorAnim('player', 'combat-anim-charge', '#A855F7');
      setBattleLog((prev) => [`${item.icon} ${item.name}: +${heal} HP y +28% ATK por ${turns} turnos.`, ...prev.slice(0, 5)]);
    }
  };

  const ownedTacticalItems = useMemo(() => {
    const inv = user.inventory || [];
    return inv
      .filter((e) => Number(e.quantity || 0) > 0)
      .map((e) => ({ entry: e, item: getShopItemById(e.itemId) }))
      .filter(
        (row): row is { entry: (typeof inv)[number]; item: ShopItemDef } =>
          Boolean(
            row.item &&
              (row.item.category === 'combat_consumable' ||
                row.item.category === 'survival_support') &&
              row.item.effectKind !== 'auto_revive'
          )
      );
  }, [user.inventory]);

  const ownedAutoReviveQty =
    (user.inventory || []).find((e) => e.itemId === 'tac_phoenix_autorevive')?.quantity || 0;

  const nextRecordWave = bestWave + 1;
  const nextRecordXp = getSurvivalWaveXpReward(nextRecordWave);

  if (phase === 'idle') {
    return (
      <div className="flex flex-col gap-5">
        <section
          className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(249,115,22,0.08),#0A0B0F_72%)]"
          style={{ borderColor: `${currentWarrior.auraColor}55` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <CharacterAvatar
                charId={currentWarrior.id}
                stageName={st.stageName}
                level={lv.level}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-[#F97316]">
                  Modo Supervivencia · Oleadas Infinitas
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#F1F5F9] truncate">
                  {currentWarrior.name} · {st.stageName}
                </h2>
                <p className="text-xs text-[#8A92A2] mt-0.5 tabular-nums">
                  Nv.{lv.level} · HP {currentMaxHp} · ATK {currentBaseAtk} ·{' '}
                  <span style={{ color: currentMoveset.energy.color }}>
                    {currentMoveset.energy.name}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-[#07080B] border border-[#1B1E26] rounded-xl px-4 py-2.5 text-center shrink-0">
              <div className="text-lg font-black text-[#FACC15] tabular-nums">
                {bestWave > 0 ? `Oleada ${bestWave}` : 'Sin récord'}
              </div>
              <div className="text-[11px] font-semibold text-[#8A92A2]">
                Máxima oleada superada
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
              <div className="font-extrabold text-[#F1F5F9] flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-[#EF4444]" />
                Escala Progresiva
              </div>
              <p className="text-[#8A92A2] mt-1 leading-snug">
                Cada oleada aumenta el HP, daño, resistencia e IA defensiva del rival. Tu fase queda fija durante toda la racha.
              </p>
            </div>
            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
              <div className="font-extrabold text-[#F1F5F9] flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-[#22C55E]" />
                Recuperación Controlada
              </div>
              <p className="text-[#8A92A2] mt-1 leading-snug">
                Entre oleadas recuperas +22% de HP y conservas tu energía acumulada (+15% extra) sin reinicio completo.
              </p>
            </div>
            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3">
              <div className="font-extrabold text-[#F1F5F9] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#FACC15]" />
                XP Solo por Récord
              </div>
              <p className="text-[#8A92A2] mt-1 leading-snug tabular-nums">
                {bestWave > 0
                  ? `Solo sumas XP al superar la Oleada ${bestWave}. Oleada ${nextRecordWave} otorga +${nextRecordXp} XP.`
                  : `Ganas XP por cada oleada nueva alcanzada (+${nextRecordXp} XP en Oleada 1, escalando sin límite).`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={startSurvivalRun}
              className="flex-1 min-h-[48px] rounded-xl bg-gradient-to-br from-[#EA580C] to-[#9A3412] text-[#F1F5F9] font-black text-sm inline-flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,88,12,0.28)] active:scale-[0.99] transition-transform"
            >
              <Flame className="w-4 h-4" />
              Iniciar Supervivencia (Oleada 1)
            </button>
            {onOpenShop && (
              <button
                type="button"
                onClick={onOpenShop}
                className="min-h-[48px] px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-black text-xs whitespace-nowrap shrink-0"
              >
                🪙 Tienda Táctica
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!runWarrior || !enemy) return null;

  const warriorEnergy = runWarrior.moveset.energy;
  const playerPct = Math.max(0, Math.round((playerHp / runWarrior.maxHp) * 100));
  const enemyPct = Math.max(0, Math.round((enemyHp / enemy.maxHp) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F97316] tabular-nums">
            Supervivencia · Oleada {wave} · Récord: {Math.max(bestWave, lastWaveResult?.wave || 0)}
          </div>
          <h2 className="text-xl font-black text-[#F1F5F9] truncate">
            {runWarrior.name} vs {enemy.name}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
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
            onClick={() => {
              clearEnemyTurnTimer();
              stopAllCombatAudio();
              setClashActive(false);
              setPhase('idle');
            }}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9]"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Arena Fighters Card */}
      <section
        className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 bg-[radial-gradient(circle_at_50%_15%,rgba(249,115,22,0.06),#07080B_78%)]"
        style={{ borderColor: `${enemy.auraColor}55` }}
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
              charId={runWarrior.charId}
              stageName={runWarrior.stageName}
              level={runWarrior.level}
              size="lg"
            />
            <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
              {runWarrior.name}
            </div>
            <div
              className="text-[11px] font-bold truncate max-w-full"
              style={{ color: runWarrior.auraColor }}
            >
              {runWarrior.stageName}
            </div>
            <div className="w-full max-w-[155px] mt-2">
              <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                <span className="text-[#22C55E]">HP</span>
                <span>
                  {playerHp}/{runWarrior.maxHp}
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
              {playerGuarding && (
                <div className="mt-1.5 text-[11px] font-bold text-[#22C55E]">
                  🛡️ Guardia activa
                </div>
              )}
            </div>
          </div>

          <div className={`flex flex-col items-center text-center ${enemyAnim}`}>
            <CharacterAvatar
              charId={enemy.charId}
              stageName={enemy.stageName}
              level={enemy.level}
              size="lg"
            />
            <div className="text-xs font-extrabold text-[#F1F5F9] mt-2 truncate max-w-full">
              {enemy.name}
            </div>
            <div
              className="text-[11px] font-bold truncate max-w-full"
              style={{ color: enemy.auraColor }}
            >
              Oleada {enemy.wave} · {enemy.stageName}
            </div>
            <div className="w-full max-w-[155px] mt-2">
              <div className="flex justify-between text-[11px] font-bold tabular-nums mb-1">
                <span className="text-[#EF4444]">HP Rival</span>
                <span>
                  {enemyHp}/{enemy.maxHp}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#EF4444] to-[#F97316] transition-all duration-300"
                  style={{ width: `${enemyPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] font-bold text-[#8A92A2] tabular-nums">
                ATK {enemy.atk} · Res. {Math.round(enemy.defensePct * 100)}%
              </div>
              {enemyCharging && (
                <div className="mt-1 text-[11px] font-black text-[#FACC15] animate-pulse">
                  ⚠️ Cargando Técnica
                </div>
              )}
              {enemyGuarding && !enemyCharging && (
                <div className="mt-1 text-[11px] font-bold text-[#38BDF8]">
                  🛡️ Rival en Guardia
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {phase === 'battle' && (
        <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          {clashActive ? (
            <div className="rounded-2xl bg-[#07080B] border-2 border-[#FACC15] p-4 text-center flex flex-col gap-3">
              <div className="text-sm font-black text-[#FACC15]">
                ⚡{' '}
                {clashKind === 'ultimate'
                  ? `¡${warriorEnergy.clashLabel.toUpperCase()}: ${runWarrior.moveset.ultimate.name.toUpperCase()}!`
                  : `¡BLOQUEA ${enemy.signatureMove}!`}
              </div>
              <div className="text-xs text-[#8A92A2] tabular-nums">
                ¡Toca rápido! Tiempo: {(clashTimeLeft / 1000).toFixed(1)}s
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
                  <span className="truncate">{runWarrior.moveset.physical.name}</span>
                </span>
                <span className="text-[10px] font-semibold text-[#38BDF8] truncate max-w-full">
                  Físico · +30% {warriorEnergy.shortName}
                </span>
              </button>

              <button
                type="button"
                disabled={turnBusy || aura < SURVIVAL_SPECIAL_COST}
                onClick={handleSpecial}
                className={`min-w-0 min-h-[58px] px-3 py-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] transition-transform ${
                  aura >= SURVIVAL_SPECIAL_COST && !turnBusy
                    ? 'bg-[#101218] text-[#F1F5F9]'
                    : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] opacity-45 cursor-not-allowed'
                }`}
                style={{
                  borderColor:
                    aura >= SURVIVAL_SPECIAL_COST && !turnBusy
                      ? `${runWarrior.moveset.accentColor}99`
                      : '#1B1E26',
                }}
              >
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black max-w-full">
                  <Sparkles
                    className="w-3.5 h-3.5 shrink-0"
                    style={{
                      color:
                        aura >= SURVIVAL_SPECIAL_COST
                          ? runWarrior.moveset.accentColor
                          : '#8A92A2',
                    }}
                  />
                  <span className="truncate">{runWarrior.moveset.special.name}</span>
                </span>
                <span
                  className="text-[10px] font-semibold truncate max-w-full"
                  style={{
                    color:
                      aura >= SURVIVAL_SPECIAL_COST
                        ? warriorEnergy.color
                        : '#8A92A2',
                  }}
                >
                  {aura >= SURVIVAL_SPECIAL_COST
                    ? `Especial · -${SURVIVAL_SPECIAL_COST}% ${warriorEnergy.shortName}`
                    : `Especial (${aura}/${SURVIVAL_SPECIAL_COST}%)`}
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
                  <span className="truncate">{runWarrior.moveset.guard.name}</span>
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
                  <span className="truncate">{runWarrior.moveset.ultimate.name}</span>
                </span>
                <span className="text-[10px] font-semibold opacity-90 truncate max-w-full">
                  {aura >= 100
                    ? `¡Definitiva · ${warriorEnergy.clashLabel}!`
                    : `Definitiva (${aura}/100%)`}
                </span>
              </button>
            </div>
          )}

          {/* Mochila Táctica de Supervivencia */}
          {!clashActive && (ownedTacticalItems.length > 0 || ownedAutoReviveQty > 0 || runAutoReviveUsed > 0) && (
            <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold uppercase tracking-wider text-amber-300">
                  Mochila Táctica (No gasta turno)
                </span>
                <span className="text-slate-400 tabular-nums">
                  🔥 Auto-Revivir: {runAutoReviveUsed}/{SURVIVAL_AUTOREVIVE_LIMIT} usados en esta racha
                  {ownedAutoReviveQty > 0 ? ` · x${ownedAutoReviveQty} en mochila` : ''}
                </span>
              </div>
              {ownedTacticalItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ownedTacticalItems.map(({ entry, item }) => {
                    const maxRun = item.survivalRunLimit ?? item.perBattleLimit ?? 2;
                    const used = runUsedItemCounts[item.id] || 0;
                    const blocked = turnBusy || used >= maxRun;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => handleUseTacticalItem(item)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition ${
                          blocked
                            ? 'bg-[#0A0B0F] border-[#1B1E26] text-slate-500 opacity-55 cursor-not-allowed'
                            : 'bg-[#101218] border-amber-500/40 hover:border-amber-400 text-white'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.name}</span>
                        <span className="text-[10px] text-amber-300 tabular-nums">
                          x{entry.quantity} ({used}/{maxRun})
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

      {phase === 'wave_clear' && lastWaveResult && (
        <section className="rounded-2xl border border-[#22C55E]/55 bg-[radial-gradient(circle_at_50%_15%,rgba(34,197,94,0.08),#0A0B0F_75%)] p-5 text-center flex flex-col gap-4">
          <div className="text-3xl" aria-hidden="true">
            🏆
          </div>
          <div>
            <h3 className="text-xl font-black text-[#F1F5F9]">
              ¡Oleada {lastWaveResult.wave} Superada!
            </h3>
            <p className="text-xs text-[#8A92A2] mt-1 tabular-nums">
              Recuperación controlada: +{lastWaveResult.healedHp} HP ({playerHp}/{runWarrior.maxHp} HP) · {lastWaveResult.auraAfter}% {warriorEnergy.shortName} listo.
            </p>
          </div>

          {lastWaveResult.isNewRecord ? (
            <div className="rounded-xl bg-[#07080B] border border-[#FACC15]/50 p-3 text-xs font-extrabold text-[#FACC15] tabular-nums">
              ⚡ ¡NUEVO RÉCORD PERSONAL (Oleada {lastWaveResult.wave})! +{lastWaveResult.xpEarned} XP
              {lastWaveResult.coinsEarned > 0 ? ` · 🪙 +${lastWaveResult.coinsEarned} monedas` : ''}
            </div>
          ) : (
            <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3 text-xs font-semibold text-[#8A92A2] tabular-nums">
              Sin XP repetido en oleadas ya alcanzadas (récord actual: Oleada {bestWave}). Supera la Oleada {bestWave} para ganar +{getSurvivalWaveXpReward(bestWave + 1)} XP.
              {lastWaveResult.coinsEarned > 0 && (
                <span className="block text-amber-300 font-bold mt-1">
                  🪙 +{lastWaveResult.coinsEarned} monedas por superar la oleada
                </span>
              )}
            </div>
          )}

          {lastWaveResult.quote && (
            <div
              className="rounded-xl bg-[#07080B] border px-3.5 py-2.5 text-left"
              style={{ borderColor: `${warriorEnergy.color}66` }}
            >
              <div
                className="text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: warriorEnergy.color }}
              >
                {runWarrior.name} ({runWarrior.stageName}):
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#F1F5F9] italic mt-0.5 leading-snug">
                “{lastWaveResult.quote}”
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                clearEnemyTurnTimer();
                stopAllCombatAudio();
                setPhase('idle');
              }}
              className="min-h-[46px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
            >
              Retirarse con Récord
            </button>
            <button
              type="button"
              onClick={advanceToNextWave}
              className="min-h-[46px] rounded-xl bg-gradient-to-br from-[#EA580C] to-[#9A3412] text-[#F1F5F9] text-xs font-black inline-flex items-center justify-center gap-1.5"
            >
              <Flame className="w-4 h-4" />
              Siguiente: Oleada {wave + 1}
            </button>
          </div>
        </section>
      )}

      {phase === 'defeat' && (
        <section className="rounded-2xl border border-[#EF4444]/45 bg-[#0A0B0F] p-5 text-center flex flex-col gap-4">
          <div className="text-3xl" aria-hidden="true">
            💥
          </div>
          <div>
            <h3 className="text-xl font-black text-[#F1F5F9]">
              Caíste en la Oleada {wave}
            </h3>
            <p className="text-xs sm:text-sm text-[#8A92A2] mt-1 tabular-nums">
              Oleadas superadas en este intento: <strong className="text-[#F1F5F9]">{wave - 1}</strong> · Récord máximo: <strong className="text-[#FACC15]">Oleada {bestWave}</strong> · XP en racha: <strong className="text-[#22C55E]">+{runTotalXp} XP</strong>
              {runTotalCoins > 0 ? (
                <> · Monedas: <strong className="text-amber-300">+{runTotalCoins} 🪙</strong></>
              ) : null}
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="min-h-[46px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={startSurvivalRun}
              className="min-h-[46px] rounded-xl bg-gradient-to-br from-[#EA580C] to-[#9A3412] text-[#F1F5F9] text-xs font-black inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
