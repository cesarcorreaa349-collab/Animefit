import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  HeartPulse,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  ACCESSORY_SLOT_ICONS,
  getEquippedAccessoriesList,
  SECONDARY_CURRENCY_COLOR,
  SECONDARY_CURRENCY_ICON,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { getCharacterImageCandidates } from '../data/characterImages';
import { CHARACTERS } from '../data/characters';
import { getCharacterPhaseMoveset } from '../data/movesets';
import { AnimeAccessoryDef, UserProfile } from '../types/animefit';
import {
  getActiveCharacterStage,
  getLevelInfo,
  playRoomTowerSound,
  unlockPvpAudio,
} from '../utils/animefit';
import { AccessoryShopPanel } from './AccessoryShopPanel';
import { CharacterAvatar } from './CharacterAvatar';

export interface RoomClearRewardResult {
  totalSecondaryEarned: number;
  baseSecondary: number;
  firstBossBonus: number;
  isBossRoom: boolean;
  isFirstBossMilestone: boolean;
  isNewBestFloor: boolean;
  nextBestFloor: number;
  nextBossMilestones: number[];
}

interface RoomTowerModeProps {
  user: UserProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRoomCleared: (clearedRoom: number) => RoomClearRewardResult;
  onBuyAccessory: (accessoryId: string) => void;
  onEquipAccessory: (
    accessoryId: string | null,
    slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
  ) => void;
}

type TowerScreenState =
  | 'LOBBY'
  | 'PLAYING'
  | 'PAUSED'
  | 'UPGRADE_PICK'
  | 'RESPITE'
  | 'GAME_OVER';

interface TierTheme {
  tierIndex: number;
  rangeLabel: string;
  name: string;
  modifierLabel: string;
  bgTop: string;
  bgBottom: string;
  gridColor: string;
  borderColor: string;
  pillarColor: string;
  enemySpeedMult: number;
  projSpeedMult: number;
  animePool: string[];
}

const ARENA_W = 420;
const ARENA_H = 560;
const WALL_PAD = 24;
const PLAYER_RADIUS = 17;

function getTierTheme(roomNumber: number): TierTheme {
  const tierIdx = Math.floor((Math.max(1, roomNumber) - 1) / 10);
  const start = tierIdx * 10 + 1;
  const end = start + 9;
  const rangeLabel = `Salas ${start}–${end}`;

  const presets: Omit<TierTheme, 'tierIndex' | 'rangeLabel'>[] = [
    {
      name: 'Cámara de Gravedad',
      modifierLabel: 'Gravedad estándar · Proyectiles equilibrados',
      bgTop: '#07111E',
      bgBottom: '#04080F',
      gridColor: 'rgba(56, 189, 248, 0.08)',
      borderColor: '#38BDF8',
      pillarColor: '#1E293B',
      enemySpeedMult: 1,
      projSpeedMult: 1,
      animePool: ['Dragon Ball', 'My Hero Academia', 'One Punch Man'],
    },
    {
      name: 'Valle del Fin',
      modifierLabel: '+12% velocidad de enemigos · Emboscadas ágiles',
      bgTop: '#071914',
      bgBottom: '#040B09',
      gridColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: '#10B981',
      pillarColor: '#132A24',
      enemySpeedMult: 1.12,
      projSpeedMult: 1.06,
      animePool: ['Naruto', 'Demon Slayer', 'Hunter x Hunter'],
    },
    {
      name: 'Dominio Maldito',
      modifierLabel: '+16% velocidad proyectiles · Pilares centrales',
      bgTop: '#1A0817',
      bgBottom: '#09040C',
      gridColor: 'rgba(236, 72, 153, 0.08)',
      borderColor: '#EC4899',
      pillarColor: '#2B132C',
      enemySpeedMult: 1.16,
      projSpeedMult: 1.16,
      animePool: ['Jujutsu Kaisen', 'Chainsaw Man', 'Bleach'],
    },
    {
      name: 'Gran Línea (Grand Line)',
      modifierLabel: '+20% ritmo de oleada · Corredores tácticos',
      bgTop: '#061B20',
      bgBottom: '#030B10',
      gridColor: 'rgba(45, 212, 191, 0.09)',
      borderColor: '#2DD4BF',
      pillarColor: '#13313A',
      enemySpeedMult: 1.2,
      projSpeedMult: 1.2,
      animePool: ['One Piece', 'Black Clover', 'Attack on Titan'],
    },
    {
      name: 'Palacio del Monarca',
      modifierLabel: 'Tramo Élite · Enemigos y jefes potenciados',
      bgTop: '#160F24',
      bgBottom: '#07050D',
      gridColor: 'rgba(168, 85, 247, 0.09)',
      borderColor: '#A855F7',
      pillarColor: '#271A42',
      enemySpeedMult: 1.25 + Math.min(0.25, (tierIdx - 4) * 0.05),
      projSpeedMult: 1.24 + Math.min(0.25, (tierIdx - 4) * 0.05),
      animePool: ['Solo Leveling', 'Saint Seiya', 'Fullmetal Alchemist', "JoJo's Bizarre Adv."],
    },
  ];

  const base = presets[Math.min(presets.length - 1, tierIdx)];
  return {
    tierIndex: tierIdx,
    rangeLabel,
    ...base,
  };
}

interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PlayerRunState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  baseDmg: number;
  moveSpeed: number;
  attackRate: number; // shots per second
  attackTimer: number;
  multiShot: number;
  pierce: number;
  bounce: number;
  critChance: number;
  vampiricHeal: number;
  shieldCharges: number;
  invulnTimer: number;
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirY: number;
  facingAngle: number;
}

type EnemyBehavior = 'chaser' | 'shooter' | 'dasher' | 'boss';

interface RoomEnemy {
  id: number;
  charId: string;
  name: string;
  stageName: string;
  anime: string;
  auraColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  atk: number;
  behavior: EnemyBehavior;
  actionTimer: number;
  telegraphKind: 'none' | 'dash_line' | 'boss_radial' | 'boss_aoe' | 'boss_charge';
  telegraphTimer: number;
  telegraphMax: number;
  targetX: number;
  targetY: number;
  aoePoints: Array<{ x: number; y: number; r: number }>;
  bossPhase2Triggered: boolean;
  hitFlashTimer: number;
}

interface RoomProjectile {
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  pierceLeft: number;
  bounceLeft: number;
  hitEnemyIds: Set<number>;
  isCrit?: boolean;
  life: number;
}

interface RoomParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface UpgradeChoice {
  id: string;
  icon: string;
  title: string;
  desc: string;
  accent: string;
  apply: (p: PlayerRunState) => void;
}

const UPGRADE_POOL: UpgradeChoice[] = [
  {
    id: 'upg_multishot',
    icon: '⚡',
    title: 'Ráfaga Doble (+1 Proyectil)',
    desc: 'Dispara 1 proyectil adicional en abanico cada ataque.',
    accent: '#38BDF8',
    apply: (p) => {
      p.multiShot = Math.min(4, p.multiShot + 1);
    },
  },
  {
    id: 'upg_atk_speed',
    icon: '🔥',
    title: 'Ritmo Relámpago (+24% Cadencia)',
    desc: 'Disparas más rápido al quedarte quieto.',
    accent: '#F59E0B',
    apply: (p) => {
      p.attackRate = Math.min(5.2, Number((p.attackRate * 1.24).toFixed(2)));
    },
  },
  {
    id: 'upg_dmg_boost',
    icon: '💥',
    title: 'Concentración de Energía (+25% Daño)',
    desc: 'Aumenta el daño de todos tus proyectiles.',
    accent: '#EF4444',
    apply: (p) => {
      p.baseDmg = Math.round(p.baseDmg * 1.25);
    },
  },
  {
    id: 'upg_pierce',
    icon: '🗡️',
    title: 'Técnica Perforante (+1 Perforación)',
    desc: 'Tus ataques atraviesan enemigos adicionales.',
    accent: '#A855F7',
    apply: (p) => {
      p.pierce = Math.min(3, p.pierce + 1);
    },
  },
  {
    id: 'upg_bounce',
    icon: '🌀',
    title: 'Rebote Dimensional (+1 Rebote)',
    desc: 'Tus proyectiles rebotan en los bordes de la sala.',
    accent: '#2DD4BF',
    apply: (p) => {
      p.bounce = Math.min(2, p.bounce + 1);
    },
  },
  {
    id: 'upg_vamp',
    icon: '🩸',
    title: 'Aura Vital (+HP al eliminar)',
    desc: 'Recuperas +6 HP por cada enemigo derrotado y +15% HP máx.',
    accent: '#22C55E',
    apply: (p) => {
      p.vampiricHeal += 6;
      const bonus = Math.round(p.maxHp * 0.15);
      p.maxHp += bonus;
      p.hp = Math.min(p.maxHp, p.hp + bonus);
    },
  },
  {
    id: 'upg_crit',
    icon: '🎯',
    title: 'Instinto Crítico (+18% Crítico)',
    desc: 'Aumenta la probabilidad de golpe crítico (×1.65 daño).',
    accent: '#FACC15',
    apply: (p) => {
      p.critChance = Math.min(0.75, Number((p.critChance + 0.18).toFixed(2)));
    },
  },
  {
    id: 'upg_speed_shield',
    icon: '🛡️',
    title: 'Paso Flash + Escudo (+15% Vel.)',
    desc: 'Te mueves más rápido y obtienes +1 escudo protector por sala.',
    accent: '#60A5FA',
    apply: (p) => {
      p.moveSpeed = Math.min(275, Math.round(p.moveSpeed * 1.15));
      p.shieldCharges += 1;
    },
  },
];

function buildRoomObstacles(roomNumber: number, isBoss: boolean): ObstacleRect[] {
  if (isBoss) {
    // 2 small corner pillars for boss cover without trapping dash patterns
    return [
      { x: 76, y: 150, w: 38, h: 38 },
      { x: ARENA_W - 114, y: 150, w: 38, h: 38 },
    ];
  }
  const layout = roomNumber % 4;
  if (layout === 1) {
    return [
      { x: 96, y: 170, w: 42, h: 42 },
      { x: ARENA_W - 138, y: 170, w: 42, h: 42 },
      { x: 96, y: 340, w: 42, h: 42 },
      { x: ARENA_W - 138, y: 340, w: 42, h: 42 },
    ];
  }
  if (layout === 2) {
    return [
      { x: ARENA_W / 2 - 46, y: 235, w: 92, h: 32 },
      { x: 66, y: 325, w: 36, h: 36 },
      { x: ARENA_W - 102, y: 325, w: 36, h: 36 },
    ];
  }
  if (layout === 3) {
    return [
      { x: 112, y: 195, w: 36, h: 72 },
      { x: ARENA_W - 148, y: 265, w: 36, h: 72 },
    ];
  }
  return [
    { x: ARENA_W / 2 - 22, y: 185, w: 44, h: 44 },
    { x: ARENA_W / 2 - 22, y: 330, w: 44, h: 44 },
  ];
}

function circleRectResolve(
  cx: number,
  cy: number,
  r: number,
  rect: ObstacleRect
): { x: number; y: number; hit: boolean } {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) return { x: cx, y: cy, hit: false };
  const dist = Math.sqrt(distSq);
  if (dist < 0.001) {
    return { x: cx, y: cy - r, hit: true };
  }
  const push = r - dist;
  return {
    x: cx + (dx / dist) * push,
    y: cy + (dy / dist) * push,
    hit: true,
  };
}

function pointInRect(px: number, py: number, rect: ObstacleRect): boolean {
  return (
    px >= rect.x &&
    px <= rect.x + rect.w &&
    py >= rect.y &&
    py <= rect.y + rect.h
  );
}

export function RoomTowerMode({
  user,
  soundEnabled,
  onToggleSound,
  onRoomCleared,
  onBuyAccessory,
  onEquipAccessory,
}: RoomTowerModeProps) {
  const [screen, setScreen] = useState<TowerScreenState>('LOBBY');
  const [showAccessoryShop, setShowAccessoryShop] = useState(false);

  const lv = getLevelInfo(user.xp);
  const activeStage = getActiveCharacterStage(user);
  const warrior = activeStage.char;
  const warriorMoveset = getCharacterPhaseMoveset(
    warrior.id,
    activeStage.effectiveLevel,
    activeStage.stageName
  );
  const equippedAccessories = useMemo(
    () => getEquippedAccessoriesList(user.equippedAccessories),
    [user.equippedAccessories]
  );

  // Persistent records
  const bestFloor = Math.max(0, Math.floor(Number(user.roomBestFloor || 0)));
  const bossMilestones = useMemo(
    () =>
      Array.isArray(user.roomBossMilestonesDefeated)
        ? [...user.roomBossMilestonesDefeated].sort((a, b) => a - b)
        : [],
    [user.roomBossMilestonesDefeated]
  );
  const secondaryBalance = Math.max(
    0,
    Math.floor(Number(user.secondaryCoins || 0))
  );

  // HUD mirror state updated throttled from game loop
  const [hudState, setHudState] = useState({
    room: 1,
    hp: 200,
    maxHp: 200,
    shield: 0,
    dashReadyPct: 100,
    portalOpen: false,
    bossName: '' as string,
    bossStage: '' as string,
    bossHp: 0,
    bossMaxHp: 0,
    bossPhase2: false,
    enemiesLeft: 0,
    runSecondaryEarned: 0,
    pauseReason: 'manual' as 'manual' | 'blur',
    bannerText: '',
  });
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeChoice[]>([]);
  const [lastClearSummary, setLastClearSummary] =
    useState<RoomClearRewardResult | null>(null);
  const [runReport, setRunReport] = useState({
    reachedRoom: 1,
    clearedRooms: 0,
    secondaryEarned: 0,
    bossesDefeatedThisRun: [] as number[],
  });

  // Refs for 60fps canvas loop (zero React re-renders per frame)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<TowerScreenState>('LOBBY');
  screenRef.current = screen;

  const imgCacheRef = useRef<Map<string, HTMLImageElement | 'error'>>(new Map());
  const nextEnemyIdRef = useRef(1);

  const playerRef = useRef<PlayerRunState>({
    x: ARENA_W / 2,
    y: ARENA_H - 90,
    vx: 0,
    vy: 0,
    hp: 200,
    maxHp: 200,
    baseDmg: 28,
    moveSpeed: 175,
    attackRate: 2.1,
    attackTimer: 0,
    multiShot: 1,
    pierce: 0,
    bounce: 0,
    critChance: 0.14,
    vampiricHeal: 0,
    shieldCharges: 0,
    invulnTimer: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashDirX: 0,
    dashDirY: -1,
    facingAngle: -Math.PI / 2,
  });

  const roomStateRef = useRef({
    room: 1,
    clearedRooms: 0,
    runSecondaryEarned: 0,
    bossesDefeatedThisRun: [] as number[],
    portalOpen: false,
    roomHandledClear: false,
    obstacles: [] as ObstacleRect[],
    enemies: [] as RoomEnemy[],
    projectiles: [] as RoomProjectile[],
    particles: [] as RoomParticle[],
    floats: [] as FloatingText[],
    bannerText: '',
    bannerTimer: 0,
    shakeTimer: 0,
    animTime: 0,
  });

  // Input refs (WASD/Arrows + Pointer Virtual Joystick)
  const keysRef = useRef<Set<string>>(new Set());
  const joyRef = useRef<{
    active: boolean;
    pointerId: number | null;
    originX: number;
    originY: number;
    curX: number;
    curY: number;
    dx: number;
    dy: number;
  }>({
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    curX: 0,
    curY: 0,
    dx: 0,
    dy: 0,
  });

  const onRoomClearedRef = useRef(onRoomCleared);
  onRoomClearedRef.current = onRoomCleared;
  const userRef = useRef(user);
  userRef.current = user;
  const activeStageRef = useRef(activeStage);
  activeStageRef.current = activeStage;
  const warriorMovesetRef = useRef(warriorMoveset);
  warriorMovesetRef.current = warriorMoveset;
  const equippedRef = useRef<AnimeAccessoryDef[]>(equippedAccessories);
  equippedRef.current = equippedAccessories;

  const ensureCharImage = useCallback(
    (charId: string, stageName?: string, level?: number): HTMLImageElement | null => {
      const key = `${charId}:${stageName || ''}`;
      const cached = imgCacheRef.current.get(key);
      if (cached === 'error') return null;
      if (cached) {
        return cached.complete && cached.naturalWidth > 0 ? cached : null;
      }

      const candidates = getCharacterImageCandidates(charId, stageName, level);
      if (candidates.length === 0) {
        imgCacheRef.current.set(key, 'error');
        return null;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      let candIdx = 0;
      img.onerror = () => {
        candIdx += 1;
        if (candIdx < candidates.length) {
          img.src = candidates[candIdx];
        } else {
          imgCacheRef.current.set(key, 'error');
        }
      };
      img.src = candidates[0];
      imgCacheRef.current.set(key, img);
      return null;
    },
    []
  );

  // Preload player's active phase image right away
  useEffect(() => {
    ensureCharImage(warrior.id, activeStage.stageName, activeStage.effectiveLevel);
  }, [warrior.id, activeStage.stageName, activeStage.effectiveLevel, ensureCharImage]);

  const clearInputs = useCallback(() => {
    keysRef.current.clear();
    joyRef.current.active = false;
    joyRef.current.pointerId = null;
    joyRef.current.dx = 0;
    joyRef.current.dy = 0;
  }, []);

  const spawnRoom = useCallback(
    (roomNum: number) => {
      const rs = roomStateRef.current;
      const p = playerRef.current;
      const theme = getTierTheme(roomNum);
      const isBossRoom = roomNum % 10 === 0;
      const isRespiteRoom = roomNum % 5 === 0 && !isBossRoom;

      rs.room = roomNum;
      rs.portalOpen = false;
      rs.roomHandledClear = false;
      rs.projectiles = [];
      rs.particles = [];
      rs.floats = [];
      rs.enemies = [];
      rs.obstacles = isRespiteRoom ? [] : buildRoomObstacles(roomNum, isBossRoom);

      p.x = ARENA_W / 2;
      p.y = ARENA_H - 76;
      p.vx = 0;
      p.vy = 0;
      p.attackTimer = 0.2;
      p.invulnTimer = 0.7;

      if (isRespiteRoom) {
        rs.bannerText = `Campamento · Sala ${roomNum}`;
        rs.bannerTimer = 2.4;
        setScreen('RESPITE');
        playRoomTowerSound('respite', {
          charId: activeStageRef.current.char.id,
          anime: activeStageRef.current.char.anime,
        });
        return;
      }

      const tierCandidates = CHARACTERS.filter(
        (c) =>
          c.id !== activeStageRef.current.char.id &&
          theme.animePool.includes(c.anime)
      );
      const fallbackCandidates = CHARACTERS.filter(
        (c) => c.id !== activeStageRef.current.char.id
      );
      const pool = tierCandidates.length > 0 ? tierCandidates : fallbackCandidates;

      if (isBossRoom) {
        const bossChar =
          pool[(Math.floor(roomNum / 10) * 5 + roomNum) % pool.length] ||
          CHARACTERS[0];
        const stageIdx = Math.min(
          bossChar.stages.length - 1,
          Math.floor(roomNum / 15)
        );
        const stageObj = bossChar.stages[stageIdx] || bossChar.stages[0];
        const bossMaxHp = Math.round(280 + roomNum * 38 + Math.pow(roomNum, 1.32) * 4);
        const bossAtk = Math.round(16 + roomNum * 1.15);

        ensureCharImage(bossChar.id, stageObj.phase, stageObj.levelReq);

        rs.enemies.push({
          id: nextEnemyIdRef.current++,
          charId: bossChar.id,
          name: bossChar.name,
          stageName: stageObj.phase,
          anime: bossChar.anime,
          auraColor: bossChar.auraColor,
          x: ARENA_W / 2,
          y: 120,
          vx: 0,
          vy: 0,
          radius: 28,
          hp: bossMaxHp,
          maxHp: bossMaxHp,
          atk: bossAtk,
          behavior: 'boss',
          actionTimer: 1.4,
          telegraphKind: 'none',
          telegraphTimer: 0,
          telegraphMax: 0.9,
          targetX: ARENA_W / 2,
          targetY: ARENA_H / 2,
          aoePoints: [],
          bossPhase2Triggered: false,
          hitFlashTimer: 0,
        });

        rs.bannerText = `JEFE SALA ${roomNum}: ${bossChar.name.toUpperCase()}`;
        rs.bannerTimer = 3.0;
        playRoomTowerSound('boss_warn', {
          charId: bossChar.id,
          anime: bossChar.anime,
        });
      } else {
        const enemyCount = Math.min(6, 3 + Math.floor((roomNum - 1) / 4));
        const spawnSlots = [
          { x: 85, y: 110 },
          { x: ARENA_W - 85, y: 110 },
          { x: ARENA_W / 2, y: 95 },
          { x: 75, y: 205 },
          { x: ARENA_W - 75, y: 205 },
          { x: ARENA_W / 2, y: 175 },
        ];
        const behaviors: EnemyBehavior[] = ['chaser', 'shooter', 'dasher'];

        for (let i = 0; i < enemyCount; i++) {
          const picked = pool[(roomNum * 3 + i * 7) % pool.length] || CHARACTERS[0];
          const stageIdx = Math.min(
            picked.stages.length - 1,
            Math.floor(roomNum / 14)
          );
          const stageObj = picked.stages[stageIdx] || picked.stages[0];
          const pos = spawnSlots[i % spawnSlots.length];
          const behavior =
            roomNum <= 2 && i === 0
              ? 'chaser'
              : behaviors[(roomNum + i) % behaviors.length];

          const hp = Math.round(52 + roomNum * 13 + Math.floor(roomNum / 10) * 28);
          const atk = Math.round(11 + roomNum * 0.75);

          ensureCharImage(picked.id, stageObj.phase, stageObj.levelReq);

          rs.enemies.push({
            id: nextEnemyIdRef.current++,
            charId: picked.id,
            name: picked.name,
            stageName: stageObj.phase,
            anime: picked.anime,
            auraColor: picked.auraColor,
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: 0,
            radius: 16,
            hp,
            maxHp: hp,
            atk,
            behavior,
            actionTimer: 0.75 + i * 0.25,
            telegraphKind: 'none',
            telegraphTimer: 0,
            telegraphMax: 0.65,
            targetX: pos.x,
            targetY: pos.y,
            aoePoints: [],
            bossPhase2Triggered: false,
            hitFlashTimer: 0,
          });
        }

        rs.bannerText = `Sala ${roomNum} · ${theme.name}`;
        rs.bannerTimer = 2.0;
      }

      setHudState((prev) => ({
        ...prev,
        room: roomNum,
        hp: p.hp,
        maxHp: p.maxHp,
        shield: p.shieldCharges,
        portalOpen: false,
        enemiesLeft: rs.enemies.length,
        bossName: isBossRoom ? rs.enemies[0]?.name || '' : '',
        bossStage: isBossRoom ? rs.enemies[0]?.stageName || '' : '',
        bossHp: isBossRoom ? rs.enemies[0]?.hp || 0 : 0,
        bossMaxHp: isBossRoom ? rs.enemies[0]?.maxHp || 0 : 0,
        bossPhase2: false,
        bannerText: rs.bannerText,
      }));
    },
    [ensureCharImage]
  );

  const startNewTowerRun = useCallback(() => {
    unlockPvpAudio();
    clearInputs();
    const u = userRef.current;
    const st = activeStageRef.current;
    const baseLv = getLevelInfo(u.xp).level;
    const startMaxHp = Math.round(170 + baseLv * 12 + (u.workoutsDone || 0) * 3);
    const startDmg = Math.round(24 + baseLv * 2.1 + st.stageIndex * 4);

    playerRef.current = {
      x: ARENA_W / 2,
      y: ARENA_H - 76,
      vx: 0,
      vy: 0,
      hp: startMaxHp,
      maxHp: startMaxHp,
      baseDmg: startDmg,
      moveSpeed: 178,
      attackRate: 2.15,
      attackTimer: 0.2,
      multiShot: 1,
      pierce: 0,
      bounce: 0,
      critChance: 0.14,
      vampiricHeal: 0,
      shieldCharges: 0,
      invulnTimer: 0.8,
      dashCooldown: 0,
      dashTimer: 0,
      dashDirX: 0,
      dashDirY: -1,
      facingAngle: -Math.PI / 2,
    };

    roomStateRef.current.runSecondaryEarned = 0;
    roomStateRef.current.clearedRooms = 0;
    roomStateRef.current.bossesDefeatedThisRun = [];
    setLastClearSummary(null);
    setShowAccessoryShop(false);
    setScreen('PLAYING');
    spawnRoom(1);
  }, [clearInputs, spawnRoom]);

  const handleRoomClearedTransition = useCallback(() => {
    const rs = roomStateRef.current;
    if (rs.roomHandledClear) return;
    rs.roomHandledClear = true;

    const clearedRoom = rs.room;
    const reward = onRoomClearedRef.current(clearedRoom);
    rs.clearedRooms += 1;
    rs.runSecondaryEarned += reward.totalSecondaryEarned;
    if (reward.isBossRoom) {
      rs.bossesDefeatedThisRun = [...rs.bossesDefeatedThisRun, clearedRoom];
      playRoomTowerSound('boss_defeat', {
        charId: activeStageRef.current.char.id,
        anime: activeStageRef.current.char.anime,
      });
    } else {
      playRoomTowerSound('room_clear', {
        charId: activeStageRef.current.char.id,
        anime: activeStageRef.current.char.anime,
      });
    }

    setLastClearSummary(reward);
    clearInputs();

    // Pick 3 random in-run upgrades
    const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
    setUpgradeChoices(shuffled.slice(0, 3));
    setScreen('UPGRADE_PICK');
  }, [clearInputs]);

  const handlePickUpgrade = useCallback(
    (choice: UpgradeChoice) => {
      unlockPvpAudio();
      playRoomTowerSound('upgrade', {
        charId: activeStageRef.current.char.id,
        anime: activeStageRef.current.char.anime,
      });
      choice.apply(playerRef.current);
      const nextRoom = roomStateRef.current.room + 1;
      setScreen('PLAYING');
      spawnRoom(nextRoom);
    },
    [spawnRoom]
  );

  const handleRespiteChoice = useCallback(
    (mode: 'heal' | 'focus') => {
      unlockPvpAudio();
      const rs = roomStateRef.current;
      const p = playerRef.current;
      if (mode === 'heal') {
        const healAmt = Math.round(p.maxHp * 0.35);
        p.hp = Math.min(p.maxHp, p.hp + healAmt);
      } else {
        const healAmt = Math.round(p.maxHp * 0.15);
        p.hp = Math.min(p.maxHp, p.hp + healAmt);
        p.baseDmg = Math.round(p.baseDmg * 1.18);
      }
      const reward = onRoomClearedRef.current(rs.room);
      rs.clearedRooms += 1;
      rs.runSecondaryEarned += reward.totalSecondaryEarned;
      playRoomTowerSound('upgrade', {
        charId: activeStageRef.current.char.id,
        anime: activeStageRef.current.char.anime,
      });
      const nextRoom = rs.room + 1;
      setScreen('PLAYING');
      spawnRoom(nextRoom);
    },
    [spawnRoom]
  );

  const triggerDash = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    const p = playerRef.current;
    if (p.dashCooldown > 0 || p.dashTimer > 0) return;

    unlockPvpAudio();
    let dx = 0;
    let dy = 0;
    if (joyRef.current.active) {
      dx = joyRef.current.dx;
      dy = joyRef.current.dy;
    } else {
      const keys = keysRef.current;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
    }
    const len = Math.hypot(dx, dy);
    if (len > 0.05) {
      p.dashDirX = dx / len;
      p.dashDirY = dy / len;
    } else {
      p.dashDirX = Math.cos(p.facingAngle);
      p.dashDirY = Math.sin(p.facingAngle);
    }
    p.dashTimer = 0.18;
    p.invulnTimer = Math.max(p.invulnTimer, 0.24);
    p.dashCooldown = 1.8;
    playRoomTowerSound('dash', {
      charId: activeStageRef.current.char.id,
      anime: activeStageRef.current.char.anime,
    });
  }, []);

  // Auto-pause on blur / visibilitychange + keyboard listeners + cleanup on unmount
  useEffect(() => {
    const onBlur = () => {
      if (screenRef.current === 'PLAYING') {
        clearInputs();
        setHudState((prev) => ({ ...prev, pauseReason: 'blur' }));
        setScreen('PAUSED');
      }
    };
    const onVisibility = () => {
      if (document.hidden && screenRef.current === 'PLAYING') {
        clearInputs();
        setHudState((prev) => ({ ...prev, pauseReason: 'blur' }));
        setScreen('PAUSED');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(
          key
        )
      ) {
        if (screenRef.current === 'PLAYING') {
          e.preventDefault();
        }
        keysRef.current.add(key);
      } else if (key === ' ' || key === 'shift') {
        if (screenRef.current === 'PLAYING') {
          e.preventDefault();
          triggerDash();
        }
      } else if (key === 'escape') {
        if (screenRef.current === 'PLAYING') {
          clearInputs();
          setHudState((prev) => ({ ...prev, pauseReason: 'manual' }));
          setScreen('PAUSED');
        } else if (screenRef.current === 'PAUSED') {
          setScreen('PLAYING');
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInputs();
    };
  }, [clearInputs, triggerDash]);

  // Main 60FPS single-source game loop when actively PLAYING
  useEffect(() => {
    if (screen !== 'PLAYING') return;

    let rafId = 0;
    let lastTs = performance.now();
    let hudSyncAccum = 0;

    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 110
    ) => {
      const rs = roomStateRef.current;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = speed * (0.4 + Math.random() * 0.8);
        rs.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 2.2 + Math.random() * 2.2,
          color,
          life: 0.32 + Math.random() * 0.2,
          maxLife: 0.45,
        });
      }
      if (rs.particles.length > 90) {
        rs.particles.splice(0, rs.particles.length - 90);
      }
    };

    const damagePlayer = (rawDmg: number) => {
      const p = playerRef.current;
      const rs = roomStateRef.current;
      if (p.invulnTimer > 0 || screenRef.current !== 'PLAYING') return;

      if (p.shieldCharges > 0) {
        p.shieldCharges -= 1;
        p.invulnTimer = 0.75;
        rs.floats.push({
          x: p.x,
          y: p.y - 24,
          text: '🛡️ ESCUDO',
          color: '#38BDF8',
          life: 0.75,
        });
        spawnParticles(p.x, p.y, '#38BDF8', 10, 130);
        playRoomTowerSound('dash', {
          charId: activeStageRef.current.char.id,
          anime: activeStageRef.current.char.anime,
        });
        return;
      }

      const dmg = Math.max(4, Math.round(rawDmg));
      p.hp = Math.max(0, p.hp - dmg);
      p.invulnTimer = 0.7;
      rs.shakeTimer = 0.22;
      rs.floats.push({
        x: p.x,
        y: p.y - 24,
        text: `-${dmg}`,
        color: '#EF4444',
        life: 0.75,
      });
      spawnParticles(p.x, p.y, '#EF4444', 10, 140);
      playRoomTowerSound('damage', {
        charId: activeStageRef.current.char.id,
        anime: activeStageRef.current.char.anime,
      });

      if (p.hp <= 0) {
        clearInputs();
        setRunReport({
          reachedRoom: rs.room,
          clearedRooms: rs.clearedRooms,
          secondaryEarned: rs.runSecondaryEarned,
          bossesDefeatedThisRun: [...rs.bossesDefeatedThisRun],
        });
        setScreen('GAME_OVER');
      }
    };

    const stepSimulation = (dt: number) => {
      const rs = roomStateRef.current;
      const p = playerRef.current;
      const theme = getTierTheme(rs.room);
      const actorMeta = {
        charId: activeStageRef.current.char.id,
        stageName: activeStageRef.current.stageName,
        anime: activeStageRef.current.char.anime,
      };

      rs.animTime += dt;
      if (rs.bannerTimer > 0) rs.bannerTimer = Math.max(0, rs.bannerTimer - dt);
      if (rs.shakeTimer > 0) rs.shakeTimer = Math.max(0, rs.shakeTimer - dt);
      if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);

      // 1. Player Movement (Dash or Joystick/Keyboard)
      let moveX = 0;
      let moveY = 0;
      if (p.dashTimer > 0) {
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.vx = p.dashDirX * 430;
        p.vy = p.dashDirY * 430;
      } else {
        if (joyRef.current.active) {
          moveX = joyRef.current.dx;
          moveY = joyRef.current.dy;
        } else {
          const keys = keysRef.current;
          if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
          if (keys.has('s') || keys.has('arrowdown')) moveY += 1;
          if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
          if (keys.has('d') || keys.has('arrowright')) moveX += 1;
          const mag = Math.hypot(moveX, moveY);
          if (mag > 1) {
            moveX /= mag;
            moveY /= mag;
          }
        }
        p.vx = moveX * p.moveSpeed;
        p.vy = moveY * p.moveSpeed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Arena bounds & obstacle collisions
      p.x = Math.max(WALL_PAD + PLAYER_RADIUS, Math.min(ARENA_W - WALL_PAD - PLAYER_RADIUS, p.x));
      p.y = Math.max(WALL_PAD + PLAYER_RADIUS, Math.min(ARENA_H - WALL_PAD - PLAYER_RADIUS, p.y));
      for (const obs of rs.obstacles) {
        const res = circleRectResolve(p.x, p.y, PLAYER_RADIUS, obs);
        p.x = res.x;
        p.y = res.y;
      }

      const playerSpeed = Math.hypot(p.vx, p.vy);
      if (playerSpeed > 8) {
        p.facingAngle = Math.atan2(p.vy, p.vx);
      }

      // 2. Archero Auto-Attack ONLY when standing still!
      let nearestEnemy: RoomEnemy | null = null;
      let nearestDist = Infinity;
      for (const e of rs.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }

      if (playerSpeed < 8 && nearestEnemy) {
        p.facingAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
        p.attackTimer -= dt;
        if (p.attackTimer <= 0) {
          p.attackTimer = 1 / p.attackRate;
          const count = p.multiShot;
          const spread = 0.16;
          const baseAngle = p.facingAngle;
          const shotColor = warriorMovesetRef.current.accentColor || '#38BDF8';
          const isCrit = Math.random() < p.critChance;
          const dmg = Math.round(p.baseDmg * (isCrit ? 1.65 : 1));

          for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * spread;
            const ang = baseAngle + offset;
            rs.projectiles.push({
              fromPlayer: true,
              x: p.x + Math.cos(ang) * 16,
              y: p.y + Math.sin(ang) * 16,
              vx: Math.cos(ang) * 390,
              vy: Math.sin(ang) * 390,
              radius: isCrit ? 6.5 : 5,
              damage: dmg,
              color: isCrit ? '#FACC15' : shotColor,
              pierceLeft: p.pierce,
              bounceLeft: p.bounce,
              hitEnemyIds: new Set(),
              isCrit,
              life: 2.4,
            });
          }
          playRoomTowerSound('shot', actorMeta);
        }
      } else {
        // Reset slightly so stopping feels snappy
        p.attackTimer = Math.min(p.attackTimer, 0.12);
      }

      // 3. Enemies & Boss AI + Telegraphed Attacks
      for (const e of rs.enemies) {
        if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);

        const toPlayerX = p.x - e.x;
        const toPlayerY = p.y - e.y;
        const distToPlayer = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
        const dirX = toPlayerX / distToPlayer;
        const dirY = toPlayerY / distToPlayer;

        // Boss phase 2 trigger below 50% HP
        if (
          e.behavior === 'boss' &&
          !e.bossPhase2Triggered &&
          e.hp <= e.maxHp * 0.5
        ) {
          e.bossPhase2Triggered = true;
          rs.bannerText = '⚡ ¡JEFE EN FASE 2 (<50% HP)!';
          rs.bannerTimer = 2.4;
          rs.shakeTimer = 0.25;
          spawnParticles(e.x, e.y, '#EF4444', 18, 175);
          playRoomTowerSound('boss_phase2', { charId: e.charId, anime: e.anime });
        }

        if (e.telegraphKind !== 'none') {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            // Execute telegraphed attack!
            if (e.telegraphKind === 'dash_line' || e.telegraphKind === 'boss_charge') {
              const ang = Math.atan2(e.targetY - e.y, e.targetX - e.x);
              const dashSpd = e.telegraphKind === 'boss_charge' ? 310 : 260;
              e.vx = Math.cos(ang) * dashSpd;
              e.vy = Math.sin(ang) * dashSpd;
              e.actionTimer = e.behavior === 'boss' ? 1.15 : 1.5;
            } else if (e.telegraphKind === 'boss_radial') {
              const count = e.bossPhase2Triggered ? 12 : 8;
              const baseAng = Math.atan2(p.y - e.y, p.x - e.x);
              const spd = (e.bossPhase2Triggered ? 215 : 185) * theme.projSpeedMult;
              for (let k = 0; k < count; k++) {
                const a = baseAng + (Math.PI * 2 * k) / count;
                rs.projectiles.push({
                  fromPlayer: false,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(a) * spd,
                  vy: Math.sin(a) * spd,
                  radius: 6,
                  damage: e.atk,
                  color: '#EF4444',
                  pierceLeft: 0,
                  bounceLeft: 0,
                  hitEnemyIds: new Set(),
                  life: 3.5,
                });
              }
              playRoomTowerSound('shot', { charId: e.charId, anime: e.anime });
              e.actionTimer = e.bossPhase2Triggered ? 1.1 : 1.55;
            } else if (e.telegraphKind === 'boss_aoe') {
              for (const zone of e.aoePoints) {
                spawnParticles(zone.x, zone.y, '#F97316', 12, 130);
                if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.r + PLAYER_RADIUS * 0.7) {
                  damagePlayer(e.atk * 1.25);
                }
              }
              playRoomTowerSound('hit', { charId: e.charId, anime: e.anime });
              e.actionTimer = e.bossPhase2Triggered ? 1.05 : 1.45;
            }
            e.telegraphKind = 'none';
            e.aoePoints = [];
          } else {
            // Stand still while telegraphing
            e.vx *= 0.85;
            e.vy *= 0.85;
          }
        } else {
          e.actionTimer -= dt;
          if (e.behavior === 'chaser') {
            const spd = (68 + Math.min(35, rs.room * 1.4)) * theme.enemySpeedMult;
            e.vx = dirX * spd;
            e.vy = dirY * spd;
          } else if (e.behavior === 'shooter') {
            const desiredDist = 175;
            const spd = 48 * theme.enemySpeedMult;
            if (distToPlayer < desiredDist - 25) {
              e.vx = -dirX * spd;
              e.vy = -dirY * spd;
            } else if (distToPlayer > desiredDist + 30) {
              e.vx = dirX * spd;
              e.vy = dirY * spd;
            } else {
              e.vx = -dirY * spd * 0.6;
              e.vy = dirX * spd * 0.6;
            }
            if (e.actionTimer <= 0) {
              e.actionTimer = Math.max(1.1, 2.0 - rs.room * 0.02);
              const spdProj = 165 * theme.projSpeedMult;
              const ang = Math.atan2(p.y - e.y, p.x - e.x);
              rs.projectiles.push({
                fromPlayer: false,
                x: e.x,
                y: e.y,
                vx: Math.cos(ang) * spdProj,
                vy: Math.sin(ang) * spdProj,
                radius: 5.5,
                damage: e.atk,
                color: e.auraColor || '#F97316',
                pierceLeft: 0,
                bounceLeft: 0,
                hitEnemyIds: new Set(),
                life: 3.5,
              });
            }
          } else if (e.behavior === 'dasher') {
            if (e.actionTimer <= 0) {
              e.telegraphKind = 'dash_line';
              e.telegraphMax = 0.65;
              e.telegraphTimer = 0.65;
              e.targetX = p.x;
              e.targetY = p.y;
            } else {
              // Gentle drift + friction after dash
              e.vx = e.vx * 0.94 + dirX * 35 * dt * 10;
              e.vy = e.vy * 0.94 + dirY * 35 * dt * 10;
            }
          } else if (e.behavior === 'boss') {
            const spd = (e.bossPhase2Triggered ? 72 : 52) * theme.enemySpeedMult;
            e.vx = e.vx * 0.9 + dirX * spd * 0.1;
            e.vy = e.vy * 0.9 + dirY * spd * 0.1;
            if (e.actionTimer <= 0) {
              const roll = Math.random();
              if (roll < 0.38) {
                e.telegraphKind = 'boss_radial';
                e.telegraphMax = e.bossPhase2Triggered ? 0.72 : 0.9;
                e.telegraphTimer = e.telegraphMax;
              } else if (roll < 0.72) {
                e.telegraphKind = 'boss_aoe';
                e.telegraphMax = e.bossPhase2Triggered ? 0.78 : 0.96;
                e.telegraphTimer = e.telegraphMax;
                e.aoePoints = [
                  { x: p.x, y: p.y, r: 42 },
                  ...(e.bossPhase2Triggered
                    ? [
                        {
                          x: Math.max(60, Math.min(ARENA_W - 60, p.x + (Math.random() > 0.5 ? 76 : -76))),
                          y: Math.max(80, Math.min(ARENA_H - 80, p.y - 54)),
                          r: 38,
                        },
                      ]
                    : []),
                ];
              } else {
                e.telegraphKind = 'boss_charge';
                e.telegraphMax = e.bossPhase2Triggered ? 0.65 : 0.82;
                e.telegraphTimer = e.telegraphMax;
                e.targetX = p.x;
                e.targetY = p.y;
              }
              playRoomTowerSound('boss_warn', { charId: e.charId, anime: e.anime });
            }
          }
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.x = Math.max(WALL_PAD + e.radius, Math.min(ARENA_W - WALL_PAD - e.radius, e.x));
        e.y = Math.max(WALL_PAD + e.radius, Math.min(ARENA_H - WALL_PAD - e.radius, e.y));
        for (const obs of rs.obstacles) {
          const res = circleRectResolve(e.x, e.y, e.radius, obs);
          e.x = res.x;
          e.y = res.y;
        }

        // Contact damage with player
        if (Math.hypot(p.x - e.x, p.y - e.y) < PLAYER_RADIUS + e.radius - 2) {
          damagePlayer(e.atk);
        }
      }

      // 4. Projectiles update & collisions
      const survivingProj: RoomProjectile[] = [];
      for (const proj of rs.projectiles) {
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.life -= dt;
        if (proj.life <= 0) continue;

        // Wall check / bounce
        let bouncedOrDead = false;
        if (proj.x - proj.radius < WALL_PAD || proj.x + proj.radius > ARENA_W - WALL_PAD) {
          if (proj.bounceLeft > 0) {
            proj.vx *= -1;
            proj.x = Math.max(WALL_PAD + proj.radius, Math.min(ARENA_W - WALL_PAD - proj.radius, proj.x));
            proj.bounceLeft -= 1;
          } else {
            bouncedOrDead = true;
          }
        }
        if (proj.y - proj.radius < WALL_PAD || proj.y + proj.radius > ARENA_H - WALL_PAD) {
          if (proj.bounceLeft > 0) {
            proj.vy *= -1;
            proj.y = Math.max(WALL_PAD + proj.radius, Math.min(ARENA_H - WALL_PAD - proj.radius, proj.y));
            proj.bounceLeft -= 1;
          } else {
            bouncedOrDead = true;
          }
        }
        if (bouncedOrDead) continue;

        // Obstacle collision
        if (rs.obstacles.some((o) => pointInRect(proj.x, proj.y, o))) {
          spawnParticles(proj.x, proj.y, proj.color, 4, 70);
          continue;
        }

        if (proj.fromPlayer) {
          let consumed = false;
          for (const e of rs.enemies) {
            if (proj.hitEnemyIds.has(e.id)) continue;
            if (Math.hypot(proj.x - e.x, proj.y - e.y) <= proj.radius + e.radius) {
              proj.hitEnemyIds.add(e.id);
              e.hp = Math.max(0, e.hp - proj.damage);
              e.hitFlashTimer = 0.12;
              rs.floats.push({
                x: e.x + (Math.random() * 14 - 7),
                y: e.y - e.radius - 6,
                text: proj.isCrit ? `CRIT ${proj.damage}!` : `${proj.damage}`,
                color: proj.isCrit ? '#FACC15' : '#F8FAFC',
                life: 0.55,
              });
              spawnParticles(proj.x, proj.y, proj.color, 6, 110);
              playRoomTowerSound('hit', actorMeta);

              if (proj.pierceLeft > 0) {
                proj.pierceLeft -= 1;
              } else {
                consumed = true;
                break;
              }
            }
          }
          if (!consumed) survivingProj.push(proj);
        } else {
          if (Math.hypot(proj.x - p.x, proj.y - p.y) <= proj.radius + PLAYER_RADIUS - 2) {
            damagePlayer(proj.damage);
            continue;
          }
          survivingProj.push(proj);
        }
      }
      rs.projectiles = survivingProj;

      // Remove defeated enemies & apply vampiric heal
      const remainingEnemies: RoomEnemy[] = [];
      for (const e of rs.enemies) {
        if (e.hp <= 0) {
          spawnParticles(e.x, e.y, e.auraColor || '#FACC15', e.behavior === 'boss' ? 22 : 11, 160);
          if (p.vampiricHeal > 0) {
            p.hp = Math.min(p.maxHp, p.hp + p.vampiricHeal);
          }
        } else {
          remainingEnemies.push(e);
        }
      }
      rs.enemies = remainingEnemies;

      // Open portal once room enemies are cleared
      if (rs.enemies.length === 0 && !rs.portalOpen) {
        rs.portalOpen = true;
        rs.projectiles = [];
        rs.bannerText = '¡Sala Limpia! Entra al portal superior';
        rs.bannerTimer = 3.0;
        playRoomTowerSound('room_clear', actorMeta);
      }

      // Check stepping into top portal
      if (rs.portalOpen) {
        const portalDist = Math.hypot(p.x - ARENA_W / 2, p.y - 38);
        if (portalDist <= 30) {
          handleRoomClearedTransition();
          return;
        }
      }

      // Particles & Floating text
      rs.particles = rs.particles.filter((pt) => {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        return pt.life > 0;
      });
      rs.floats = rs.floats.filter((fl) => {
        fl.y -= 28 * dt;
        fl.life -= dt;
        return fl.life > 0;
      });
    };

    const drawCircularCharacter = (
      ctx: CanvasRenderingContext2D,
      charId: string,
      stageName: string,
      level: number,
      x: number,
      y: number,
      radius: number,
      borderColor: string,
      fallbackLabel: string,
      flashWhite = false
    ) => {
      const img = ensureCharImage(charId, stageName, level);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0F19';
      ctx.fill();
      ctx.clip();

      if (img) {
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = borderColor;
        ctx.font = `900 ${Math.round(radius * 0.9)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallbackLabel.slice(0, 2).toUpperCase(), x, y + 1);
      }
      if (flashWhite) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = borderColor;
      ctx.stroke();
    };

    const drawEquippedAccessoriesOverlay = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      animTime: number
    ) => {
      for (const acc of equippedRef.current) {
        if (acc.slot === 'armor') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, r + 4, Math.PI * 0.15, Math.PI * 0.85);
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = acc.accentColor;
          ctx.stroke();
          ctx.restore();
        } else if (acc.slot === 'ring') {
          const orbitAng = animTime * 3.1;
          const ox = x + Math.cos(orbitAng) * (r + 8);
          const oy = y + Math.sin(orbitAng) * (r + 8);
          ctx.save();
          ctx.beginPath();
          ctx.arc(ox, oy, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = acc.accentColor;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = acc.secondaryColor;
          ctx.stroke();
          ctx.restore();
        } else if (acc.slot === 'helm') {
          ctx.save();
          if (acc.visualShape === 'straw_hat') {
            ctx.beginPath();
            ctx.ellipse(x, y - r - 2, r * 0.85, 4.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = acc.accentColor;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y - r - 3, r * 0.45, Math.PI, 0);
            ctx.fillStyle = acc.accentColor;
            ctx.fill();
            ctx.fillStyle = acc.secondaryColor;
            ctx.fillRect(x - r * 0.44, y - r - 4, r * 0.88, 2.2);
          } else {
            ctx.beginPath();
            ctx.roundRect(x - r * 0.65, y - r - 3, r * 1.3, 5, 2.5);
            ctx.fillStyle = acc.accentColor;
            ctx.fill();
            ctx.strokeStyle = acc.secondaryColor;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
          ctx.restore();
        } else if (acc.slot === 'amulet') {
          const pulse = 1 + Math.sin(animTime * 4.5) * 0.2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y + r - 1, 3.6 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = acc.accentColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    const renderArena = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.round(ARENA_W * dpr);
      const targetH = Math.round(ARENA_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const rs = roomStateRef.current;
      const p = playerRef.current;
      const theme = getTierTheme(rs.room);

      if (rs.shakeTimer > 0) {
        ctx.translate(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        );
      }

      // Arena gradient floor
      const grad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
      grad.addColorStop(0, theme.bgTop);
      grad.addColorStop(1, theme.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Floor grid
      ctx.strokeStyle = theme.gridColor;
      ctx.lineWidth = 1;
      for (let gx = WALL_PAD; gx <= ARENA_W - WALL_PAD; gx += 36) {
        ctx.beginPath();
        ctx.moveTo(gx, WALL_PAD);
        ctx.lineTo(gx, ARENA_H - WALL_PAD);
        ctx.stroke();
      }
      for (let gy = WALL_PAD; gy <= ARENA_H - WALL_PAD; gy += 36) {
        ctx.beginPath();
        ctx.moveTo(WALL_PAD, gy);
        ctx.lineTo(ARENA_W - WALL_PAD, gy);
        ctx.stroke();
      }

      // Arena border frame
      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(
        WALL_PAD - 2,
        WALL_PAD - 2,
        ARENA_W - WALL_PAD * 2 + 4,
        ARENA_H - WALL_PAD * 2 + 4
      );

      // Top Portal Gate
      ctx.save();
      const portalPulse = 0.75 + Math.sin(rs.animTime * 5) * 0.25;
      ctx.beginPath();
      ctx.ellipse(ARENA_W / 2, 32, 34, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = rs.portalOpen
        ? `rgba(45, 212, 191, ${0.42 * portalPulse})`
        : 'rgba(100, 116, 139, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rs.portalOpen ? '#2DD4BF' : '#475569';
      ctx.stroke();
      ctx.fillStyle = rs.portalOpen ? '#99F6E4' : '#94A3B8';
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        rs.portalOpen ? 'PORTAL ABIERTO ▲' : 'SALA SELLADA',
        ARENA_W / 2,
        16
      );
      ctx.restore();

      // Obstacles
      for (const obs of rs.obstacles) {
        ctx.fillStyle = theme.pillarColor;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Enemy & Boss Telegraph Zones (drawn beneath characters)
      for (const e of rs.enemies) {
        if (e.telegraphKind === 'dash_line' || e.telegraphKind === 'boss_charge') {
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([7, 5]);
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.targetX, e.targetY);
          ctx.lineWidth = e.telegraphKind === 'boss_charge' ? 24 : 10;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.26)';
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#EF4444';
          ctx.stroke();
          ctx.restore();
        } else if (e.telegraphKind === 'boss_radial') {
          const count = e.bossPhase2Triggered ? 12 : 8;
          const baseAng = Math.atan2(p.y - e.y, p.x - e.x);
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 5]);
          for (let k = 0; k < count; k++) {
            const a = baseAng + (Math.PI * 2 * k) / count;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + Math.cos(a) * 190, e.y + Math.sin(a) * 190);
            ctx.stroke();
          }
          ctx.restore();
        } else if (e.telegraphKind === 'boss_aoe') {
          const progress = 1 - Math.max(0, e.telegraphTimer / Math.max(0.1, e.telegraphMax));
          for (const z of e.aoePoints) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#EF4444';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(z.x, z.y, z.r * progress, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Target Reticle under nearest enemy when player standing still
      let lockTarget: RoomEnemy | null = null;
      let minD = Infinity;
      for (const e of rs.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < minD) {
          minD = d;
          lockTarget = e;
        }
      }
      if (lockTarget) {
        ctx.save();
        ctx.translate(lockTarget.x, lockTarget.y);
        ctx.rotate(rs.animTime * 2.5);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, lockTarget.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Enemies & Boss Miniatures
      for (const e of rs.enemies) {
        drawCircularCharacter(
          ctx,
          e.charId,
          e.stageName,
          rs.room,
          e.x,
          e.y,
          e.radius,
          e.behavior === 'boss' && e.bossPhase2Triggered
            ? '#EF4444'
            : e.auraColor || '#F97316',
          e.name,
          e.hitFlashTimer > 0
        );

        // Mini HP bar for normal enemies
        if (e.behavior !== 'boss') {
          const bw = 28;
          const pct = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = '#020617';
          ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw, 4);
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw * pct, 4);
        }
      }

      // Player Miniature Warrior + Aura + Equipped Accessories
      const pSt = activeStageRef.current;
      const pAura = p.invulnTimer > 0 && Math.floor(rs.animTime * 20) % 2 === 0
        ? '#FFFFFF'
        : warriorMovesetRef.current.accentColor || pSt.char.auraColor;

      // Subtle phase aura glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
      ctx.fillStyle = `${pAura}28`;
      ctx.fill();
      ctx.restore();

      drawCircularCharacter(
        ctx,
        pSt.char.id,
        pSt.stageName,
        pSt.effectiveLevel,
        p.x,
        p.y,
        PLAYER_RADIUS,
        pAura,
        pSt.char.name
      );
      drawEquippedAccessoriesOverlay(ctx, p.x, p.y, PLAYER_RADIUS, rs.animTime);

      // Shield indicator around player
      if (p.shieldCharges > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Projectiles
      for (const proj of rs.projectiles) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fillStyle = proj.color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
        ctx.restore();
      }

      // Particles
      for (const pt of rs.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
        ctx.restore();
      }

      // Floating numbers
      for (const fl of rs.floats) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, fl.life * 2);
        ctx.fillStyle = fl.color;
        ctx.font = '900 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.restore();
      }

      // Virtual Joystick Visual (only while active touch drag)
      if (joyRef.current.active) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(joyRef.current.originX, joyRef.current.originY, 34, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(
          joyRef.current.originX + joyRef.current.dx * 24,
          joyRef.current.originY + joyRef.current.dy * 24,
          14,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = 'rgba(45, 212, 191, 0.85)';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    const tick = (now: number) => {
      if (screenRef.current !== 'PLAYING') return;
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      stepSimulation(dt);
      renderArena();

      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.09) {
        hudSyncAccum = 0;
        const rs = roomStateRef.current;
        const p = playerRef.current;
        const boss = rs.enemies.find((e) => e.behavior === 'boss');
        setHudState((prev) => ({
          ...prev,
          room: rs.room,
          hp: Math.max(0, Math.round(p.hp)),
          maxHp: Math.round(p.maxHp),
          shield: p.shieldCharges,
          dashReadyPct:
            p.dashCooldown <= 0
              ? 100
              : Math.round(((1.8 - p.dashCooldown) / 1.8) * 100),
          portalOpen: rs.portalOpen,
          enemiesLeft: rs.enemies.length,
          bossName: boss ? boss.name : '',
          bossStage: boss ? boss.stageName : '',
          bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
          bossMaxHp: boss ? Math.round(boss.maxHp) : 0,
          bossPhase2: Boolean(boss?.bossPhase2Triggered),
          runSecondaryEarned: rs.runSecondaryEarned,
          bannerText: rs.bannerTimer > 0 ? rs.bannerText : '',
        }));
      }

      if (screenRef.current === 'PLAYING') {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [screen, clearInputs, ensureCharImage, handleRoomClearedTransition]);

  // Canvas pointer handlers for fluid mobile virtual joystick
  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: ARENA_W / 2, y: ARENA_H / 2 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * ARENA_W,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * ARENA_H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'PLAYING') return;
    unlockPvpAudio();
    const pt = toCanvasCoords(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    joyRef.current = {
      active: true,
      pointerId: e.pointerId,
      originX: pt.x,
      originY: pt.y,
      curX: pt.x,
      curY: pt.y,
      dx: 0,
      dy: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!joyRef.current.active || joyRef.current.pointerId !== e.pointerId) return;
    const pt = toCanvasCoords(e.clientX, e.clientY);
    const rx = pt.x - joyRef.current.originX;
    const ry = pt.y - joyRef.current.originY;
    const dist = Math.hypot(rx, ry);
    const maxR = 32;
    const clamped = Math.min(1, dist / maxR);
    joyRef.current.curX = pt.x;
    joyRef.current.curY = pt.y;
    if (dist > 3) {
      joyRef.current.dx = (rx / dist) * clamped;
      joyRef.current.dy = (ry / dist) * clamped;
    } else {
      joyRef.current.dx = 0;
      joyRef.current.dy = 0;
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (joyRef.current.pointerId === e.pointerId) {
      joyRef.current.active = false;
      joyRef.current.pointerId = null;
      joyRef.current.dx = 0;
      joyRef.current.dy = 0;
    }
  };

  const activeTier = getTierTheme(hudState.room);

  // ================= LOBBY VIEW =================
  if (screen === 'LOBBY') {
    return (
      <div className="flex flex-col gap-5">
        <section
          className="rounded-2xl border p-5 bg-[radial-gradient(circle_at_15%_15%,rgba(45,212,191,0.09),#0A0B0F_75%)]"
          style={{ borderColor: `${SECONDARY_CURRENCY_COLOR}55` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <CharacterAvatar
                charId={warrior.id}
                stageName={activeStage.stageName}
                level={activeStage.effectiveLevel}
                size="md"
              />
              <div className="min-w-0">
                <div
                  className="text-xs font-black uppercase tracking-wider"
                  style={{ color: SECONDARY_CURRENCY_COLOR }}
                >
                  Torre Anime por Salas (Estilo Archero)
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#F1F5F9] truncate">
                  {warrior.name} · {activeStage.stageName}
                </h2>
                <p className="text-xs text-[#8A92A2] mt-0.5 tabular-nums">
                  Nv.{lv.level} · Energía: {warriorMoveset.energy.name} · Jefes cada 10 salas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleSound}
                aria-label={soundEnabled ? 'Silenciar efectos' : 'Activar efectos'}
                className="min-h-[42px] px-3 rounded-xl bg-[#07080B] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] inline-flex items-center gap-1.5"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#2DD4BF]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#8A92A2]" />
                )}
              </button>
              <div
                className="rounded-xl border bg-[#07080B] px-3.5 py-2 text-right tabular-nums"
                style={{ borderColor: `${SECONDARY_CURRENCY_COLOR}55` }}
              >
                <div
                  className="text-[10px] font-bold uppercase"
                  style={{ color: SECONDARY_CURRENCY_COLOR }}
                >
                  {SECONDARY_CURRENCY_NAME}
                </div>
                <div
                  className="text-base font-black"
                  style={{ color: SECONDARY_CURRENCY_COLOR }}
                >
                  {SECONDARY_CURRENCY_ICON} {secondaryBalance.toLocaleString('es-ES')}
                </div>
              </div>
            </div>
          </div>

          {/* Records & Milestones Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
            <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sala Máxima Alcanzada
              </div>
              <div className="text-base font-black text-white tabular-nums mt-0.5 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-teal-300" />
                {bestFloor > 0 ? `Sala ${bestFloor}` : 'Sin récord aún'}
              </div>
            </div>

            <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Hitos de Jefes (x10)
              </div>
              <div className="text-base font-black text-amber-300 tabular-nums mt-0.5">
                {bossMilestones.length > 0
                  ? bossMilestones.map((m) => `S.${m}`).join(' · ')
                  : 'Sala 10 pendiente'}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-xl border border-[#1B1E26] bg-[#07080B] px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Accesorios Equipados
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 truncate">
                {equippedAccessories.length > 0
                  ? equippedAccessories
                      .map((a) => `${a.icon} ${a.name}`)
                      .join(' · ')
                  : 'Ninguno equipado (Presencia visual en sala)'}
              </div>
            </div>
          </div>

          {/* Quick Controls Breakdown */}
          <div className="mt-4 rounded-xl border border-[#1B1E26] bg-[#07080B] p-3.5 text-xs text-[#8A92A2] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <strong className="text-[#F1F5F9]">1. Movimiento Fluido:</strong> Arrastra en la arena (joystick táctil) o usa WASD/Flechas.
            </div>
            <div>
              <strong className="text-[#2DD4BF]">2. Quieto = Auto-Ataque:</strong> Detente para disparar energía automáticamente al enemigo más cercano.
            </div>
            <div>
              <strong className="text-[#F59E0B]">3. Jefes y Descanso:</strong> Santuario cada 5 salas · Jefe con patrones telegrafiados cada 10 salas.
            </div>
          </div>

          {/* Primary Actions */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={startNewTowerRun}
              className="min-h-[48px] px-4 rounded-xl text-slate-950 font-black text-sm inline-flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: SECONDARY_CURRENCY_COLOR }}
            >
              <Swords className="w-4 h-4" />
              <span>Entrar a la Torre (Sala 1)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAccessoryShop((v) => !v)}
              className="min-h-[48px] px-4 rounded-xl bg-[#07080B] border border-[#2DD4BF]/50 text-[#2DD4BF] font-black text-sm inline-flex items-center justify-center gap-2 hover:bg-[#2DD4BF]/10 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {showAccessoryShop
                  ? 'Ocultar Tienda de Accesorios'
                  : 'Mini-Tienda de Accesorios (10 diarios)'}
              </span>
            </button>
          </div>
        </section>

        {showAccessoryShop && (
          <AccessoryShopPanel
            user={user}
            onBuyAccessory={onBuyAccessory}
            onEquipAccessory={onEquipAccessory}
            compact
          />
        )}
      </div>
    );
  }

  // ================= ACTIVE PLAY / PAUSED / UPGRADE / RESPITE / GAME_OVER =================
  return (
    <div className="flex flex-col gap-3">
      {/* Compact Top Game HUD */}
      <div className="rounded-2xl border border-[#1B1E26] bg-[#0A0B0F] p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="px-2.5 py-1 rounded-lg border text-xs font-black tabular-nums"
            style={{
              borderColor: `${activeTier.borderColor}66`,
              color: activeTier.borderColor,
            }}
          >
            Sala {hudState.room}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white truncate">
              {activeTier.name} ({activeTier.rangeLabel})
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {activeTier.modifierLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 tabular-nums">
          <span
            className="text-xs font-black px-2.5 py-1 rounded-lg border bg-[#07080B]"
            style={{
              borderColor: `${SECONDARY_CURRENCY_COLOR}44`,
              color: SECONDARY_CURRENCY_COLOR,
            }}
          >
            {SECONDARY_CURRENCY_ICON} +{hudState.runSecondaryEarned}
          </span>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Silenciar audio' : 'Activar audio'}
            className="min-h-[36px] min-w-[36px] rounded-lg bg-[#07080B] border border-[#1B1E26] flex items-center justify-center text-slate-200"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#2DD4BF]" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (screen === 'PLAYING') {
                clearInputs();
                setHudState((prev) => ({ ...prev, pauseReason: 'manual' }));
                setScreen('PAUSED');
              } else if (screen === 'PAUSED') {
                setScreen('PLAYING');
              }
            }}
            aria-label="Pausar juego"
            className="min-h-[36px] min-w-[36px] rounded-lg bg-[#07080B] border border-[#1B1E26] flex items-center justify-center text-slate-200"
          >
            {screen === 'PAUSED' ? (
              <Play className="w-4 h-4 text-teal-300" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Player HP & Boss HP Bars */}
      <div className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] px-3 py-2 flex flex-col gap-1.5 tabular-nums">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-emerald-300">
            HP: {hudState.hp} / {hudState.maxHp}
            {hudState.shield > 0 ? ` · 🛡️×${hudState.shield}` : ''}
          </span>
          <span className="text-slate-400">
            {hudState.portalOpen
              ? '✅ Portal abierto'
              : `Enemigos: ${hudState.enemiesLeft}`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[#030406] border border-[#1B1E26] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#10B981] to-[#2DD4BF] transition-all duration-100"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, (hudState.hp / Math.max(1, hudState.maxHp)) * 100)
              )}%`,
            }}
          />
        </div>

        {hudState.bossName && hudState.bossMaxHp > 0 && (
          <div className="pt-1 border-t border-[#1B1E26]/70">
            <div className="flex items-center justify-between text-[11px] font-black">
              <span className="text-rose-400 truncate">
                👑 JEFE: {hudState.bossName} ({hudState.bossStage})
              </span>
              <span className="text-rose-300">
                {hudState.bossPhase2 ? '⚡ FASE 2 · ' : ''}
                {hudState.bossHp}/{hudState.bossMaxHp}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#030406] border border-rose-900/50 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-[#DC2626] to-[#F97316] transition-all duration-100"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (hudState.bossHp / hudState.bossMaxHp) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Arena Canvas + Modals/Overlays */}
      <div className="relative mx-auto w-full max-w-[420px] rounded-2xl overflow-hidden border border-[#1B1E26] bg-[#04060A]">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className="w-full h-auto block touch-none select-none cursor-crosshair"
          style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}
        />

        {/* Room banner toast */}
        {hudState.bannerText && screen === 'PLAYING' && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#030406]/85 border border-[#2DD4BF]/50 text-[11px] font-black text-[#F1F5F9] whitespace-nowrap">
            {hudState.bannerText}
          </div>
        )}

        {/* Quick Dash + Portal Step Button */}
        {screen === 'PLAYING' && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {hudState.portalOpen && (
              <button
                type="button"
                onClick={handleRoomClearedTransition}
                className="min-h-[42px] px-3 rounded-xl bg-teal-400 text-slate-950 font-black text-xs shadow-lg"
              >
                Entrar al Portal ▲
              </button>
            )}
            <button
              type="button"
              onClick={triggerDash}
              disabled={hudState.dashReadyPct < 100}
              className={`min-h-[44px] min-w-[78px] px-3 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition ${
                hudState.dashReadyPct >= 100
                  ? 'bg-[#0A0B0F]/90 border-[#2DD4BF] text-[#2DD4BF] active:scale-95'
                  : 'bg-[#07080B]/80 border-[#1B1E26] text-slate-500'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>
                {hudState.dashReadyPct >= 100 ? 'Dash' : `${hudState.dashReadyPct}%`}
              </span>
            </button>
          </div>
        )}

        {/* Equipped Accessories Mini-Badges inside active arena */}
        {equippedAccessories.length > 0 && screen === 'PLAYING' && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#030406]/75 border border-[#1B1E26] text-[11px]">
            {equippedAccessories.map((a) => (
              <span key={a.id} title={a.name}>
                {a.icon}
              </span>
            ))}
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {screen === 'PAUSED' && (
          <div className="absolute inset-0 bg-[#030406]/88 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="w-full max-w-xs rounded-2xl border border-[#2DD4BF]/40 bg-[#0A0B0F] p-5 text-center space-y-3">
              <div className="text-sm font-black text-[#2DD4BF] uppercase tracking-wider">
                Torre en Pausa
              </div>
              <p className="text-xs text-slate-400">
                {hudState.pauseReason === 'blur'
                  ? 'Se pausó automáticamente al cambiar de ventana o pestaña.'
                  : 'Partida pausada en Sala ' + hudState.room + '.'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('PLAYING')}
                  className="min-h-[44px] rounded-xl font-black text-xs text-slate-950 inline-flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: SECONDARY_CURRENCY_COLOR }}
                >
                  <Play className="w-4 h-4" />
                  Reanudar Combate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearInputs();
                    setScreen('LOBBY');
                  }}
                  className="min-h-[42px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-slate-300"
                >
                  Salir al Vestíbulo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UPGRADE PICK OVERLAY */}
        {screen === 'UPGRADE_PICK' && (
          <div className="absolute inset-0 bg-[#030406]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full rounded-2xl border border-[#2DD4BF]/50 bg-[#0A0B0F] p-4 space-y-3">
              <div className="text-center">
                <div className="text-xs font-black uppercase tracking-wider text-teal-300">
                  Sala {hudState.room} Completada
                </div>
                {lastClearSummary && (
                  <div className="text-xs font-bold text-slate-200 mt-0.5 tabular-nums">
                    {SECONDARY_CURRENCY_ICON} +{lastClearSummary.totalSecondaryEarned}{' '}
                    {SECONDARY_CURRENCY_NAME}
                    {lastClearSummary.isFirstBossMilestone && (
                      <span className="text-amber-300 ml-1">
                        (¡Incluye bono 1.ª derrota de Jefe!)
                      </span>
                    )}
                  </div>
                )}
                <h4 className="text-sm font-black text-white mt-2">
                  Elige 1 mejora temporal para esta incursión:
                </h4>
              </div>

              <div className="flex flex-col gap-2">
                {upgradeChoices.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handlePickUpgrade(u)}
                    className="min-h-[54px] w-full text-left rounded-xl border bg-[#07080B] hover:bg-[#101622] px-3.5 py-2.5 flex items-center gap-3 transition active:scale-[0.98]"
                    style={{ borderColor: `${u.accent}66` }}
                  >
                    <span className="text-xl shrink-0">{u.icon}</span>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-black truncate"
                        style={{ color: u.accent }}
                      >
                        {u.title}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        {u.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESPITE SANCTUARY OVERLAY (Sala 5, 15, 25...) */}
        {screen === 'RESPITE' && (
          <div className="absolute inset-0 bg-[#030406]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full rounded-2xl border border-emerald-400/50 bg-[#0A0B0F] p-5 text-center space-y-3.5">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Santuario de Descanso · Sala {hudState.room}
              </div>
              <h4 className="text-base font-black text-white">
                Respiro antes del siguiente tramo exigente
              </h4>
              <p className="text-xs text-slate-400">
                Recupera fuerzas antes de enfrentar el resto del piso y al Jefe de Sala{' '}
                {Math.ceil(hudState.room / 10) * 10}.
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleRespiteChoice('heal')}
                  className="min-h-[52px] w-full rounded-xl border border-emerald-400/60 bg-emerald-500/15 hover:bg-emerald-500/25 px-4 py-2.5 text-left flex items-center gap-3 transition"
                >
                  <HeartPulse className="w-5 h-5 text-emerald-300 shrink-0" />
                  <div>
                    <div className="text-xs font-black text-emerald-200">
                      Descanso Profundo (+35% HP)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Cura gran parte de tu vida y continúa a Sala {hudState.room + 1}.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRespiteChoice('focus')}
                  className="min-h-[52px] w-full rounded-xl border border-sky-400/60 bg-sky-500/15 hover:bg-sky-500/25 px-4 py-2.5 text-left flex items-center gap-3 transition"
                >
                  <Flame className="w-5 h-5 text-sky-300 shrink-0" />
                  <div>
                    <div className="text-xs font-black text-sky-200">
                      Concentración de Batalla (+18% Daño y +15% HP)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Potencia tus disparos para el Jefe y recupera un poco de vida.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {screen === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-[#030406]/92 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="w-full max-w-xs rounded-2xl border border-rose-500/45 bg-[#0A0B0F] p-5 text-center space-y-3.5">
              <div className="text-xs font-black uppercase tracking-wider text-rose-400">
                Fin de Incursión
              </div>
              <h4 className="text-lg font-black text-white">
                Caíste en la Sala {runReport.reachedRoom}
              </h4>

              <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] p-3 text-xs space-y-1.5 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">Salas superadas:</span>
                  <strong className="text-white">{runReport.clearedRooms}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tu récord histórico:</span>
                  <strong className="text-teal-300">Sala {bestFloor}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ganado en esta incursión:</span>
                  <strong style={{ color: SECONDARY_CURRENCY_COLOR }}>
                    {SECONDARY_CURRENCY_ICON} +{runReport.secondaryEarned}{' '}
                    {SECONDARY_CURRENCY_NAME}
                  </strong>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={startNewTowerRun}
                  className="min-h-[44px] rounded-xl font-black text-xs text-slate-950 inline-flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: SECONDARY_CURRENCY_COLOR }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Jugar de Nuevo (Sala 1)
                </button>
                <button
                  type="button"
                  onClick={() => setScreen('LOBBY')}
                  className="min-h-[42px] rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-slate-300"
                >
                  Volver al Vestíbulo / Tienda Accesorios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle footer hint */}
      <div className="text-[11px] text-center text-slate-400 flex flex-wrap items-center justify-center gap-3">
        <span>
          <Sparkles className="w-3 h-3 inline mr-1 text-teal-300" />
          Detente para disparar · Arrastra para moverte
        </span>
        <span>
          <Shield className="w-3 h-3 inline mr-1 text-sky-300" />
          Espacio/Dash para esquivar patrones rojos
        </span>
      </div>
    </div>
  );
}
