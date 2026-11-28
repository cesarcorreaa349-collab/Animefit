export interface EvolutionStage {
  levelReq: number;
  phase: string;
}

export type CharacterGender = 'M' | 'F';

export interface CharacterDef {
  id: string;
  name: string;
  anime: string;
  auraColor: string;
  icon: string;
  gender: CharacterGender;
  stages: EvolutionStage[];
}

export type ExerciseMuscle =
  | 'Pecho'
  | 'Espalda'
  | 'Piernas'
  | 'Glúteos'
  | 'Hombros'
  | 'Bíceps'
  | 'Tríceps'
  | 'Abdomen'
  | 'Cardio';

export type ExerciseLocationType =
  | 'Máquinas Gym'
  | 'Pesos Libres'
  | 'Casa'
  | 'Calistenia';

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: ExerciseMuscle;
  type: ExerciseLocationType;
  subTag: string;
  isCardio: boolean;
  isBodyweight: boolean;
  cues: string;
}

export interface RoutineSetTemplate {
  weight: number | '';
  reps: number | '';
}

export interface RoutineExerciseItem {
  exId: string;
  sets: number;
  targetReps: string;
  plannedSets?: RoutineSetTemplate[];
  notes?: string;
}

export interface RoutineFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Routine {
  id: string;
  name: string;
  published: boolean;
  author: string;
  likes: number;
  exercises: RoutineExerciseItem[];
  folderId?: string;
}

export interface WorkoutSet {
  weight: number | '';
  reps: number | '';
  done: boolean;
  isPR: boolean;
  isOneRmPR?: boolean;
}

export interface ActiveWorkoutExercise {
  exId: string;
  exName?: string;
  targetReps: string;
  notes?: string;
  baselinePr?: number;
  baselineHasPrior?: boolean;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  name: string;
  startedAt: number;
  restEndAt: number | null;
  restDuration: number;
  exercises: ActiveWorkoutExercise[];
}

export interface WorkoutHistoryEntry {
  date: string;
  name: string;
  durationMs: number;
  sets: number;
  volume: number;
  xp: number;
  exercises: ActiveWorkoutExercise[];
}

export type StoryAlignmentKey = 'honor' | 'fury' | 'strategy';

export interface StoryAlignment {
  honor: number;
  fury: number;
  strategy: number;
}

export interface StoryProgress {
  completedChapters: string[];
  choices: Record<string, StoryAlignmentKey>;
  currentChapterId: string | null;
  currentNodeIndex: number;
  alignment: StoryAlignment;
  claimedRewards: string[];
  lastChapterCompletedAt?: string | null;
}

export interface StoryChoiceOption {
  id: string;
  label: string;
  alignment: StoryAlignmentKey;
  buffLabel: string;
  replySpeaker: string;
  replySpeakerCharId: string;
  replyText: string;
}

export interface StorySceneNode {
  speaker: string;
  speakerCharId: string;
  text: string;
  choices?: StoryChoiceOption[];
}

export interface StoryChapter {
  id: string;
  number: number;
  saga: string;
  title: string;
  subtitle: string;
  minLevel: number;
  bossCharId: string;
  bossTitle: string;
  bossHp: number;
  bossAtk: number;
  bossDefensePct?: number;
  bossSignatureMove: string;
  allyCharId?: string;
  xpReward: number;
  missionName: string;
  missionDesc: string;
  missionExercises: RoutineExerciseItem[];
  nodes: StorySceneNode[];
  victoryText: string;
  defeatText: string;
}

export type AthleteSex = 'masculino' | 'femenino';
export type ExperienceUnit = 'meses' | 'años';

export interface AthleteProfileSetup {
  age: number;
  sex: AthleteSex;
  weightKg: number;
  heightCm: number;
  experienceValue: number;
  experienceUnit: ExperienceUnit;
  trainingStyles: string[];
  completedAt: string;
}

export type SleepQuality = 'mala' | 'regular' | 'buena' | 'excelente';

export interface DailyWellnessLog {
  date: string;
  steps: number;
  stepGoal: number;
  sleepHours: number;
  sleepGoal: number;
  sleepQuality?: SleepQuality;
  bedTime?: string;
  wakeTime?: string;
  stepsXpAwarded?: boolean;
  sleepXpAwarded?: boolean;
}

export interface DailyWellnessState {
  stepGoal: number;
  sleepGoal: number;
  logs: Record<string, DailyWellnessLog>;
}

export interface FriendNotification {
  id: string;
  fromUsername: string;
  fromCharId: string;
  fromLevel: number;
  createdAt: string;
  read: boolean;
}

export type ShopItemCategory =
  | 'xp_capsule'
  | 'combat_consumable'
  | 'survival_support'
  | 'cosmetic_aura'
  | 'cosmetic_title'
  | 'cosmetic_emblem'
  | 'victory_quote'
  | 'pvp_intro'
  | 'pvp_emote'
  | 'pvp_finisher';

export type ShopItemRarity = 'común' | 'raro' | 'épico' | 'legendario';

export type ShopItemEffectKind =
  | 'xp'
  | 'heal_hp'
  | 'auto_revive'
  | 'charge_energy'
  | 'emergency_energy'
  | 'temp_guard'
  | 'atk_crit_buff'
  | 'evasion_agility'
  | 'accuracy_stability'
  | 'survival_wave_ration'
  | 'survival_wave_boost'
  | 'cosmetic';

export interface ShopItemDef {
  id: string;
  name: string;
  anime: string;
  category: ShopItemCategory;
  rarity: ShopItemRarity;
  price: number;
  icon: string;
  description: string;
  effectKind: ShopItemEffectKind;
  effectValue?: number;
  secondaryValue?: number;
  turns?: number;
  perBattleLimit?: number;
  storyLimit?: number;
  survivalRunLimit?: number;
  accentColor?: string;
  cosmeticLabel?: string;
  extraQuote?: string;
  emoteSoundKey?: string;
  emotePhrase?: string;
}

export interface UserInventoryEntry {
  itemId: string;
  quantity: number;
  lastBuyPrice?: number;
}

export interface EquippedCosmetics {
  auraId?: string | null;
  titleId?: string | null;
  emblemId?: string | null;
  pvpIntroId?: string | null;
  pvpFinisherId?: string | null;
}

export interface DailyShopPurchaseTracker {
  dateKey: string;
  itemsBought: number;
}

export interface DailyPvpXpTracker {
  dateKey: string;
  xpEarned: number;
  coinsEarned?: number;
}

export interface DailySurvivalCoinTracker {
  dateKey: string;
  coinsEarned: number;
}

export interface PvpCosmeticLoadout {
  title?: string | null;
  titleName?: string | null;
  emblem?: string | null;
  emblemIcon?: string | null;
  auraColor?: string | null;
  auraLabel?: string | null;
  introBanner?: string | null;
  introColor?: string | null;
  pvpIntro?: {
    icon: string;
    bannerText: string;
    color: string;
  } | null;
  finisherId?: string | null;
  finisherLabel?: string | null;
  pvpFinisher?: {
    id: string;
    icon: string;
    title: string;
    color: string;
  } | null;
  ownedEmotes?: string[];
}

export type AccessorySlot = 'helm' | 'armor' | 'ring' | 'amulet';

export type AccessoryVisualStyle =
  | 'band'
  | 'straw_hat'
  | 'visor'
  | 'mask'
  | 'crown'
  | 'cape'
  | 'vest'
  | 'aura_ring'
  | 'orb_orbit'
  | 'star_crest';

export interface AnimeAccessoryDef {
  id: string;
  name: string;
  anime: string;
  slot: AccessorySlot;
  rarity: ShopItemRarity;
  price: number;
  icon: string;
  accentColor: string;
  secondaryColor: string;
  visualShape: AccessoryVisualStyle;
  description: string;
  roomVisualNote: string;
}

export interface EquippedAccessories {
  helmId?: string | null;
  armorId?: string | null;
  ringId?: string | null;
  amuletId?: string | null;
}

export interface DailyAccessoryPurchaseTracker {
  dateKey: string;
  itemsBought: number;
}

export interface UserProfile {
  username: string;
  email: string;
  pass?: string;
  charId: string;
  xp: number;
  coins?: number;
  secondaryCoins?: number;
  unlockedChars?: string[];
  charXpOffsets?: Record<string, number>;
  inventory?: UserInventoryEntry[];
  equippedCosmetics?: EquippedCosmetics;
  ownedAccessories?: string[];
  equippedAccessories?: EquippedAccessories;
  shopDailyPurchases?: DailyShopPurchaseTracker;
  accessoryShopDailyPurchases?: DailyAccessoryPurchaseTracker;
  pvpDailyXp?: DailyPvpXpTracker;
  survivalDailyCoins?: DailySurvivalCoinTracker;
  workoutsDone: number;
  prs: Record<string, number>;
  oneRmRecords?: Record<string, number>;
  history: WorkoutHistoryEntry[];
  friends: string[];
  friendNotifications?: FriendNotification[];
  groups: string[];
  customExercises: ExerciseDef[];
  routines: Routine[];
  routineFolders?: RoutineFolder[];
  storyRoutineId?: string;
  pvpWins?: number;
  pvpLosses?: number;
  survivalBestWave?: number;
  roomBestFloor?: number;
  roomBossMilestonesDefeated?: number[];
  dailyStreakCount?: number;
  dailyStreakBest?: number;
  dailyStreakLastDate?: string | null;
  story?: StoryProgress;
  profileSetup?: AthleteProfileSetup;
  wellness?: DailyWellnessState;
}

export interface MoveSkillDef {
  name: string;
  effect: string;
}

export interface CharacterEnergyProfile {
  name: string;
  shortName: string;
  barLabel: string;
  chargeLabel: string;
  clashLabel: string;
  color: string;
  barGradientFrom: string;
  barGradientTo: string;
}

export interface PhaseMoveset {
  stageName: string;
  styleLabel: string;
  elementTag: string;
  accentColor: string;
  energy: CharacterEnergyProfile;
  physical: MoveSkillDef;
  special: MoveSkillDef;
  guard: MoveSkillDef;
  ultimate: MoveSkillDef;
  isFallback: boolean;
}

export interface TrainingPvpBonus {
  workoutsDone: number;
  streakCount: number;
  bonusAura: number;
  ultBoostPct: number;
  badgeLabel: string | null;
}

export interface PvpFighterState {
  username: string;
  charId: string;
  stageName: string;
  level: number;
  hp: number;
  maxHp: number;
  baseAtk: number;
  critChance: number;
  aura: number;
  guarding: boolean;
  auraColor?: string;
  energyName?: string;
  energyColor?: string;
  ultBoostPct?: number;
  streakLabel?: string | null;
  streakCount?: number;
  cosmetics?: PvpCosmeticLoadout;
}

export interface PvpClashState {
  initiator: string;
  endsAt: number;
  taps: Record<string, number>;
}

export interface PvpPlayerConnectionStatus {
  connected: boolean;
  reconnectingUntil?: number | null;
}

export interface PvpCombatEvent {
  id: string;
  actor: string;
  target?: string;
  action:
    | 'strike'
    | 'special'
    | 'guard'
    | 'ultimate'
    | 'clash_win'
    | 'clash_reflect'
    | 'timeout'
    | 'forfeit'
    | 'disconnect';
  damage?: number;
  heal?: number;
  auraGain?: number;
  crit?: boolean;
  blocked?: boolean;
  skillName?: string;
  auraColor?: string;
  label: string;
}

export type PvpMatchKind = 'public_random' | 'friend_duel' | 'private_room';

export interface PvpEmoteEvent {
  id: string;
  sender: string;
  emoteId: string;
  label: string;
  icon: string;
  phrase: string;
  soundKey: string;
  ts: number;
}

export interface PvpMatchState {
  id: string;
  status: 'active' | 'finished';
  matchKind?: PvpMatchKind;
  turn: string;
  turnEndsAt?: number;
  turnDurationMs?: number;
  round: number;
  winner: string | null;
  players: Record<string, PvpFighterState>;
  playerOrder: [string, string];
  playerStatus?: Record<string, PvpPlayerConnectionStatus>;
  clash: PvpClashState | null;
  lastEvent?: PvpCombatEvent | null;
  lastEmote?: PvpEmoteEvent | null;
  damageDealt?: Record<string, number>;
  xpRewards?: Record<string, number>;
  coinRewards?: Record<string, number>;
  xpCapNotices?: Record<string, string>;
  rematchRequestedBy?: string[];
  log: string[];
  rewardsGranted?: boolean;
}

export interface PvpInvite {
  id: string;
  fromUsername: string;
  fromCharId: string;
  fromLevel: number;
  toUsername: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  desc: string;
  members: string[];
}

export interface AppDB {
  users: Record<string, UserProfile>;
  groups: CommunityGroup[];
  sessionUser: string | null;
  activeWorkouts: Record<string, ActiveWorkout>;
}

export type MainTab =
  | 'entrenar'
  | 'historia'
  | 'pvp'
  | 'personaje'
  | 'ranking'
  | 'tienda';
export type RankingSubTab = 'global' | 'publicas' | 'social';

export interface WorkoutSummaryInfo {
  earnedXp: number;
  earnedCoins?: number;
  baseVolumeXp: number;
  prBonusXp: number;
  surpassedExerciseCount: number;
  completedSets: number;
  prCount: number;
  oneRmRecordCount?: number;
  totalVolume: number;
  prevLevel: number;
  newLevel: number;
  evolved: boolean;
  stageName: string;
  charIcon: string;
  auraColor: string;
  streakCount: number;
  prevStreakCount: number;
  pausedSundayToday: boolean;
}
