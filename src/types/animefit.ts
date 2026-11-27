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
  targetReps: string;
  notes?: string;
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

export interface UserProfile {
  username: string;
  email: string;
  pass?: string;
  charId: string;
  xp: number;
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
  story?: StoryProgress;
  profileSetup?: AthleteProfileSetup;
  wellness?: DailyWellnessState;
}

export interface MoveSkillDef {
  name: string;
  effect: string;
}

export interface PhaseMoveset {
  stageName: string;
  styleLabel: string;
  elementTag: string;
  accentColor: string;
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
  ultBoostPct?: number;
  streakLabel?: string | null;
  streakCount?: number;
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

export interface PvpMatchState {
  id: string;
  status: 'active' | 'finished';
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
  damageDealt?: Record<string, number>;
  xpRewards?: Record<string, number>;
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

export type MainTab = 'entrenar' | 'historia' | 'pvp' | 'personaje' | 'ranking';
export type RankingSubTab = 'global' | 'publicas' | 'social';

export interface WorkoutSummaryInfo {
  earnedXp: number;
  completedSets: number;
  prCount: number;
  oneRmRecordCount?: number;
  totalVolume: number;
  prevLevel: number;
  newLevel: number;
  evolved: boolean;
  stageName: string;
  charIcon: string;
}
