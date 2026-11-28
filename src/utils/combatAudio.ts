import { CHARACTERS } from '../data/characters';
import type { CharacterDef, CharacterGender } from '../types/animefit';

const SOUND_STORAGE_KEY = 'animefit_pvp_sound_v1';

export type TechniqueSlot =
  | 'physical'
  | 'special'
  | 'guard'
  | 'ultimate'
  | 'charge'
  | 'clash_reflect'
  | 'victory'
  | 'defeat';

export type CombatSoundKind =
  | 'special'
  | 'ultimate'
  | 'hit'
  | 'crit'
  | 'guard'
  | 'charge'
  | 'victory'
  | 'defeat';

export type SoundArchetype =
  | 'kaioken_surge'
  | 'spirit_bomb_heavy'
  | 'beam_wave'
  | 'lightning_pierce'
  | 'blade_slash'
  | 'fire_flame'
  | 'spiral_vortex'
  | 'flurry_combo'
  | 'heavy_punch'
  | 'guard_barrier'
  | 'aura_charge'
  | 'victory_fanfare'
  | 'defeat_tone';

export interface CombatSoundActor {
  charId?: string;
  stageName?: string;
  level?: number;
  anime?: string;
  energyName?: string;
}

export interface CombatSoundPayload {
  slot: TechniqueSlot;
  skillName?: string;
  attacker?: CombatSoundActor;
  defender?: CombatSoundActor;
  isCrit?: boolean;
  isBlocked?: boolean;
  eventKey?: string;
  delayMs?: number;
}

export interface ResolvedTechniqueSoundProfile {
  archetype: SoundArchetype;
  pitchScale: number;
  noiseBrightness: number;
  defenderWeight: 'heavy' | 'agile' | 'mystic' | 'balanced';
  phaseLift: number;
  isCrit: boolean;
  isBlocked: boolean;
}

const SWORDSMAN_SET = new Set([
  'trunks', 'zoro', 'tanjiro', 'zenitsu', 'inosuke', 'giyu', 'rengoku',
  'tengen', 'muichiro', 'mitsuri', 'shinobu', 'sanemi', 'mikasa', 'levi',
  'ichigo', 'rukia', 'renji', 'byakuya', 'toshiro', 'kenpachi', 'jinwoo',
  'aki', 'asta', 'yuno', 'law', 'shanks', 'maki', 'brook',
]);

const HEAVY_TANK_SET = new Set([
  'broly', 'gyomei', 'allmight', 'kirishima', 'reiner', 'jinbe', 'chopper',
  'buu', 'saitama', 'tsunade', 'todo', 'garou', 'superbuu',
]);

const AGILE_STRIKER_SET = new Set([
  'naruto', 'rocklee', 'guy', 'minato', 'luffy', 'sanji', 'killua',
  'deku', 'iida', 'hawks', 'denji', 'jotaro',
]);

const MYSTIC_SET = new Set([
  'gojo', 'sukuna', 'itachi', 'aizen', 'kurapika', 'hisoka', 'megumi',
  'yuta', 'freezer', 'hit', 'obito', 'madara', 'edward', 'law',
]);

const CHARACTER_BY_ID = new Map<string, CharacterDef>(
  CHARACTERS.map((c) => [c.id, c])
);

let sharedAudioCtx: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;
let globalUnlockInstalled = false;

const activeTimers = new Set<number>();
let activeVoiceAudio: HTMLAudioElement | null = null;
const recentEventKeys = new Map<string, number>();
const lastSlotPlayedAt = new Map<string, number>();
const soundListeners = new Set<(enabled: boolean) => void>();

let combatSoundEnabled: boolean = (() => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
})();

export function getCombatAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
    sharedMasterGain = sharedAudioCtx.createGain();
    sharedMasterGain.gain.value = combatSoundEnabled ? 1 : 0;

    // Gentle compressor prevents distortion when combat cues overlap on mobile speakers
    if (typeof sharedAudioCtx.createDynamicsCompressor === 'function') {
      const comp = sharedAudioCtx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;
      sharedMasterGain.connect(comp);
      comp.connect(sharedAudioCtx.destination);
    } else {
      sharedMasterGain.connect(sharedAudioCtx.destination);
    }
  }
  return sharedAudioCtx;
}

function getMasterOutput(ctx: AudioContext): AudioNode {
  if (!sharedMasterGain) {
    return ctx.destination;
  }
  return sharedMasterGain;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.45);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

function clearScheduledCombatTimers(): void {
  if (typeof window === 'undefined') {
    activeTimers.clear();
    return;
  }
  for (const id of activeTimers) {
    window.clearTimeout(id);
  }
  activeTimers.clear();
}

function stopActiveClipAudio(): void {
  if (!activeVoiceAudio) return;
  try {
    activeVoiceAudio.pause();
    activeVoiceAudio.currentTime = 0;
  } catch {
    // ignore HTMLAudio cleanup errors
  }
  activeVoiceAudio = null;
}

export function stopCombatVoice(): void {
  stopActiveClipAudio();
  try {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.speechSynthesis?.cancel === 'function'
    ) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore unsupported speechSynthesis
  }
}

export function stopAllCombatAudio(): void {
  clearScheduledCombatTimers();
  stopCombatVoice();
  try {
    if (sharedAudioCtx && sharedMasterGain) {
      const now = sharedAudioCtx.currentTime;
      sharedMasterGain.gain.cancelScheduledValues(now);
      sharedMasterGain.gain.setValueAtTime(0, now);
    }
  } catch {
    // ignore WebAudio state errors
  }
}

export function getCombatSoundEnabled(): boolean {
  return combatSoundEnabled;
}

export function setCombatSoundEnabled(enabled: boolean): void {
  combatSoundEnabled = Boolean(enabled);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        SOUND_STORAGE_KEY,
        combatSoundEnabled ? '1' : '0'
      );
    }
  } catch {
    // ignore storage errors
  }

  if (combatSoundEnabled) {
    unlockCombatAudio();
    try {
      if (sharedAudioCtx && sharedMasterGain) {
        const now = sharedAudioCtx.currentTime;
        sharedMasterGain.gain.cancelScheduledValues(now);
        sharedMasterGain.gain.setValueAtTime(1, now);
      }
    } catch {
      // ignore WebAudio state errors
    }
  } else {
    stopAllCombatAudio();
  }

  for (const listener of soundListeners) {
    try {
      listener(combatSoundEnabled);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeCombatSound(
  listener: (enabled: boolean) => void
): () => void {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

export function unlockCombatAudio(): void {
  try {
    const ctx = getPvpAudioContextSafe();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (
      sharedMasterGain &&
      ctx &&
      combatSoundEnabled &&
      sharedMasterGain.gain.value === 0
    ) {
      sharedMasterGain.gain.setValueAtTime(1, ctx.currentTime);
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.speechSynthesis?.getVoices === 'function'
    ) {
      window.speechSynthesis.getVoices();
    }
  } catch {
    // ignore mobile WebAudio restrictions cleanly
  }
}

function getPvpAudioContextSafe(): AudioContext | null {
  return getCombatAudioContext();
}

export const unlockPvpAudio = unlockCombatAudio;
export const unlockRestAudio = unlockCombatAudio;

export function installGlobalAudioUnlockOnce(): () => void {
  if (typeof window === 'undefined' || globalUnlockInstalled) {
    return () => {};
  }
  globalUnlockInstalled = true;
  const onFirstInteraction = () => {
    unlockCombatAudio();
    window.removeEventListener('pointerdown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
  };
  window.addEventListener('pointerdown', onFirstInteraction, {
    once: true,
    passive: true,
  });
  window.addEventListener('touchstart', onFirstInteraction, {
    once: true,
    passive: true,
  });
  window.addEventListener('keydown', onFirstInteraction, {
    once: true,
    passive: true,
  });
  return () => {
    window.removeEventListener('pointerdown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
  };
}

function scheduleCombatTimer(fn: () => void, delayMs: number): void {
  if (typeof window === 'undefined') return;
  const id = window.setTimeout(() => {
    activeTimers.delete(id);
    fn();
  }, delayMs);
  activeTimers.add(id);
}

function shouldSkipDuplicateEvent(eventKey?: string): boolean {
  if (!eventKey) return false;
  const now = Date.now();
  const prev = recentEventKeys.get(eventKey);
  if (prev !== undefined && now - prev < 4500) {
    return true;
  }
  recentEventKeys.set(eventKey, now);
  if (recentEventKeys.size > 40) {
    const oldestKey = recentEventKeys.keys().next().value;
    if (oldestKey) recentEventKeys.delete(oldestKey);
  }
  return false;
}

function shouldThrottleSlot(slotKey: string, minGapMs: number): boolean {
  const now = Date.now();
  const prev = lastSlotPlayedAt.get(slotKey) ?? 0;
  if (now - prev < minGapMs) return true;
  lastSlotPlayedAt.set(slotKey, now);
  return false;
}

function resolveActorMeta(actor?: CombatSoundActor): {
  char?: CharacterDef;
  anime: string;
  phaseIdx: number;
} {
  const char = actor?.charId ? CHARACTER_BY_ID.get(actor.charId) : undefined;
  const anime = actor?.anime || char?.anime || '';
  let phaseIdx = 0;
  if (char) {
    if (actor?.stageName) {
      const idx = char.stages.findIndex(
        (s) => s.phase.toLowerCase() === actor.stageName?.trim().toLowerCase()
      );
      if (idx >= 0) phaseIdx = idx;
    } else if (typeof actor?.level === 'number') {
      for (let i = 0; i < char.stages.length; i++) {
        if (actor.level >= char.stages[i].levelReq) phaseIdx = i;
      }
    }
  }
  return { char, anime, phaseIdx };
}

function getAnimeAcousticProfile(anime: string): {
  pitchScale: number;
  noiseBrightness: number;
} {
  switch (anime) {
    case 'Dragon Ball':
      return { pitchScale: 1.05, noiseBrightness: 1.1 };
    case 'Naruto':
      return { pitchScale: 1.0, noiseBrightness: 1.05 };
    case 'One Piece':
      return { pitchScale: 0.88, noiseBrightness: 0.9 };
    case 'Demon Slayer':
      return { pitchScale: 1.12, noiseBrightness: 1.25 };
    case 'Jujutsu Kaisen':
      return { pitchScale: 0.84, noiseBrightness: 0.85 };
    case 'Bleach':
      return { pitchScale: 1.04, noiseBrightness: 1.2 };
    case 'Hunter x Hunter':
      return { pitchScale: 1.08, noiseBrightness: 1.08 };
    case 'Solo Leveling':
      return { pitchScale: 0.82, noiseBrightness: 0.92 };
    case 'My Hero Academia':
      return { pitchScale: 0.96, noiseBrightness: 1.0 };
    case 'Attack on Titan':
      return { pitchScale: 1.02, noiseBrightness: 1.18 };
    case 'One Punch Man':
      return { pitchScale: 0.8, noiseBrightness: 0.95 };
    case 'Chainsaw Man':
      return { pitchScale: 0.9, noiseBrightness: 1.22 };
    case 'Black Clover':
      return { pitchScale: 0.94, noiseBrightness: 1.1 };
    case 'Fullmetal Alchemist':
      return { pitchScale: 1.06, noiseBrightness: 1.12 };
    case 'Saint Seiya':
      return { pitchScale: 1.14, noiseBrightness: 1.16 };
    case 'Yu Yu Hakusho':
      return { pitchScale: 1.02, noiseBrightness: 1.06 };
    case "JoJo's Bizarre Adv.":
      return { pitchScale: 0.86, noiseBrightness: 1.02 };
    default:
      return { pitchScale: 1.0, noiseBrightness: 1.0 };
  }
}

function getDefenderWeight(charId?: string): 'heavy' | 'agile' | 'mystic' | 'balanced' {
  if (!charId) return 'balanced';
  if (HEAVY_TANK_SET.has(charId)) return 'heavy';
  if (SWORDSMAN_SET.has(charId) || AGILE_STRIKER_SET.has(charId)) return 'agile';
  if (MYSTIC_SET.has(charId)) return 'mystic';
  return 'balanced';
}

export function classifyTechniqueArchetype(
  slot: TechniqueSlot,
  skillName = '',
  attackerCharId = '',
  attackerAnime = ''
): SoundArchetype {
  if (slot === 'victory') return 'victory_fanfare';
  if (slot === 'defeat') return 'defeat_tone';
  if (slot === 'charge') return 'aura_charge';
  if (slot === 'guard' || slot === 'clash_reflect') return 'guard_barrier';

  const normalized = skillName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // High-speed surges / transformations / overdrive bursts (distinct from heavy bombs)
  if (
    /kaioken|baryon|puertas|gear|overdrive|cluster|ifrit|red hawk|boogie|kanmuru|ora ora|ora!|velocidad|jet |instinto|ultra ego/.test(
      normalized
    )
  ) {
    return 'kaioken_surge';
  }

  // Massive spirit / cataclysmic heavy energy impacts
  if (
    /genkidama|supernova|bomba biju|gigantic|bajrang|united states|cataclismo|retumbar|juicio|purgatorio|mugetsu|estornudo|golpe serio|meteoro|explosion final|relicario|vacio inconmensurable|infierno|bosatsu|bodhisattva|mano cero|arise|dominio del monarca/.test(
      normalized
    )
  ) {
    return 'spirit_bomb_heavy';
  }

  // Swirling / vortex techniques
  if (
    /rasengan|rasenshuriken|torbellino|tornado|howitzer|shambles|room|espiral/.test(
      normalized
    )
  ) {
    return 'spiral_vortex';
  }

  // Lightning & high-voltage piercing attacks
  if (
    /chidori|kirin|relampago|trueno|electric|kaminari|thunder/.test(normalized)
  ) {
    return 'lightning_pierce';
  }

  // Sharp blade slashes, postures, dismantles
  if (
    /tajo|corte|espada|katana|postura|tatsumaki|oni giri|asura|zangetsu|enma|desmantelar|hender|dagas|kunai|tijeras|danma|cuchilla|estocada|hoja|cuervos|mutilacion|sable|filo/.test(
      normalized
    )
  ) {
    return 'blade_slash';
  }

  // Fire / solar / flame techniques
  if (
    /fuego|llama|amaterasu|entei|diable|hellflame|prominence|incineracion|vals solar|hinokami|tigre de fuego|mar de fuego|ardiente|explosion/.test(
      normalized
    )
  ) {
    return 'fire_flame';
  }

  // Plasma beams & energy waves
  if (
    /kamehameha|galick|destello final|final flash|masenko|makankosappo|rayo|cero|reigan|getsuga|vacio purpura|rojo|azul|descarga|gamma|beam|eraser|granada|kikoho|flecha/.test(
      normalized
    )
  ) {
    return 'beam_wave';
  }

  // Multi-hit flurries
  if (
    /rafaga|combo|gatling|consecutiv|lluvia|asalto|collier|patada|huracan|black flash|destello oscuro|divergente|jajanken/.test(
      normalized
    )
  ) {
    return 'flurry_combo';
  }

  // Heavy physical punches/smashes
  if (
    /golpe|puno|smash|impacto|embestida|piedra|martillo|kong|titanico|brutal|sismico/.test(
      normalized
    )
  ) {
    return 'heavy_punch';
  }

  // Guard words
  if (
    /guardia|barrera|escudo|infinito|blut|susanoo|coraza|muralla|sustitucion|evasion|ken |tambores|temple|sonrisa|oido|lectura|parada|flujo/.test(
      normalized
    )
  ) {
    return 'guard_barrier';
  }

  // Fallback by slot + character role/anime
  if (slot === 'ultimate') {
    if (SWORDSMAN_SET.has(attackerCharId) || attackerAnime === 'Demon Slayer') {
      return 'blade_slash';
    }
    if (HEAVY_TANK_SET.has(attackerCharId)) return 'spirit_bomb_heavy';
    return 'beam_wave';
  }
  if (slot === 'special') {
    if (SWORDSMAN_SET.has(attackerCharId)) return 'blade_slash';
    if (attackerAnime === 'Naruto') return 'spiral_vortex';
    if (HEAVY_TANK_SET.has(attackerCharId)) return 'heavy_punch';
    return 'beam_wave';
  }
  // physical
  if (SWORDSMAN_SET.has(attackerCharId)) return 'blade_slash';
  if (HEAVY_TANK_SET.has(attackerCharId)) return 'heavy_punch';
  return 'flurry_combo';
}

export function resolveTechniqueSoundProfile(
  payload: CombatSoundPayload
): ResolvedTechniqueSoundProfile {
  const attackerMeta = resolveActorMeta(payload.attacker);
  const defenderMeta = resolveActorMeta(payload.defender);
  const animeAcoustic = getAnimeAcousticProfile(attackerMeta.anime);
  const archetype = classifyTechniqueArchetype(
    payload.slot,
    payload.skillName,
    attackerMeta.char?.id || payload.attacker?.charId || '',
    attackerMeta.anime
  );
  const phaseLift = 1 + Math.min(0.14, attackerMeta.phaseIdx * 0.024);

  return {
    archetype,
    pitchScale: animeAcoustic.pitchScale * phaseLift,
    noiseBrightness: animeAcoustic.noiseBrightness,
    defenderWeight: getDefenderWeight(
      defenderMeta.char?.id || payload.defender?.charId
    ),
    phaseLift,
    isCrit: Boolean(payload.isCrit),
    isBlocked: Boolean(payload.isBlocked),
  };
}

function playFilteredNoise(
  ctx: AudioContext,
  start: number,
  duration: number,
  filterType: BiquadFilterType,
  freqStart: number,
  freqEnd: number,
  q: number,
  peakGain: number
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.setValueAtTime(q, start);
  filter.frequency.setValueAtTime(Math.max(40, freqStart), start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(40, freqEnd),
    start + duration
  );

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.025, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOutput(ctx));
  src.start(start);
  src.stop(start + duration + 0.02);
}

function playTone(
  ctx: AudioContext,
  type: OscillatorType,
  start: number,
  duration: number,
  freqStart: number,
  freqEnd: number,
  peakGain: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, freqStart), start);
  if (Math.abs(freqEnd - freqStart) > 1) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(30, freqEnd),
      start + duration
    );
  }
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(
    peakGain,
    start + Math.min(0.02, duration * 0.3)
  );
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(getMasterOutput(ctx));
  osc.start(start);
  osc.stop(start + duration + 0.015);
}

function playReceiverImpactLayer(
  ctx: AudioContext,
  now: number,
  offsetSec: number,
  profile: ResolvedTechniqueSoundProfile
): void {
  const t = now + offsetSec;
  if (profile.isBlocked) {
    // Blocked shield clang + damped body thump
    playTone(ctx, 'triangle', t, 0.11, 880, 520, 0.055);
    playFilteredNoise(ctx, t, 0.08, 'bandpass', 1450, 720, 3.2, 0.04);
    return;
  }

  if (profile.defenderWeight === 'heavy') {
    // Deep armored/colossal thud
    playTone(ctx, 'sine', t, 0.15, 115, 42, 0.095);
    playFilteredNoise(ctx, t, 0.11, 'lowpass', 420, 120, 1.2, 0.055);
  } else if (profile.defenderWeight === 'agile') {
    // Crisp snappy recoil
    playTone(ctx, 'triangle', t, 0.09, 340, 125, 0.065);
    playFilteredNoise(ctx, t, 0.07, 'bandpass', 1800, 680, 1.8, 0.045);
  } else if (profile.defenderWeight === 'mystic') {
    // Resonant mystic dispersion
    playTone(ctx, 'sine', t, 0.14, 290, 110, 0.06);
    playTone(ctx, 'triangle', t + 0.02, 0.12, 620, 310, 0.035);
  } else {
    // Balanced impact
    playTone(ctx, 'sine', t, 0.11, 165, 62, 0.075);
    playFilteredNoise(ctx, t, 0.08, 'bandpass', 900, 260, 1.3, 0.045);
  }

  if (profile.isCrit) {
    // Sharp critical burst snap
    playTone(ctx, 'square', t, 0.11, 520, 1180, 0.045);
    playFilteredNoise(ctx, t + 0.015, 0.09, 'highpass', 2400, 1100, 1.5, 0.05);
  }
}

function synthesizeCombatProfile(
  ctx: AudioContext,
  profile: ResolvedTechniqueSoundProfile
): void {
  const now = ctx.currentTime;
  const p = profile.pitchScale;
  const nb = profile.noiseBrightness;

  switch (profile.archetype) {
    case 'kaioken_surge': {
      // Rapid overdrive pulse + triple staccato surge (markedly different from Genkidama)
      playTone(ctx, 'sawtooth', now, 0.12, 260 * p, 640 * p, 0.055);
      playTone(ctx, 'triangle', now + 0.06, 0.09, 440 * p, 880 * p, 0.06);
      playTone(ctx, 'sawtooth', now + 0.13, 0.09, 540 * p, 1080 * p, 0.065);
      playFilteredNoise(ctx, now + 0.04, 0.18, 'bandpass', 900 * nb, 2600 * nb, 1.8, 0.055);
      playReceiverImpactLayer(ctx, now, 0.14, profile);
      break;
    }

    case 'spirit_bomb_heavy': {
      // Deep gathering drop -> colossal sub-bass detonation + shockwave tail
      playTone(ctx, 'sine', now, 0.14, 340 * p, 95 * p, 0.055);
      playTone(ctx, 'sine', now + 0.12, 0.34, 130 * p, 38, 0.115);
      playTone(ctx, 'sawtooth', now + 0.13, 0.28, 190 * p, 58, 0.06);
      playFilteredNoise(ctx, now + 0.12, 0.34, 'lowpass', 1400 * nb, 160, 0.9, 0.09);
      playReceiverImpactLayer(ctx, now, 0.16, profile);
      break;
    }

    case 'beam_wave': {
      // Harmonic energy lock -> sweeping plasma beam surge
      playTone(ctx, 'sine', now, 0.08, 420 * p, 780 * p, 0.05);
      playTone(ctx, 'sawtooth', now + 0.06, 0.24, 280 * p, 860 * p, 0.058);
      playTone(ctx, 'triangle', now + 0.07, 0.24, 560 * p, 1140 * p, 0.048);
      playFilteredNoise(ctx, now + 0.06, 0.22, 'bandpass', 650 * nb, 2100 * nb, 1.4, 0.055);
      playReceiverImpactLayer(ctx, now, 0.13, profile);
      break;
    }

    case 'lightning_pierce': {
      // High-frequency electric chirp + crackling spark bursts
      playTone(ctx, 'square', now, 0.07, 1350 * p, 520 * p, 0.045);
      playTone(ctx, 'sawtooth', now + 0.04, 0.12, 920 * p, 2250 * p, 0.05);
      playFilteredNoise(ctx, now, 0.15, 'highpass', 2600 * nb, 1300 * nb, 2.2, 0.065);
      playReceiverImpactLayer(ctx, now, 0.09, profile);
      break;
    }

    case 'blade_slash': {
      // Razor air-whoosh + steel harmonic ring
      playFilteredNoise(ctx, now, 0.12, 'highpass', 2200 * nb, 750 * nb, 1.4, 0.07);
      playTone(ctx, 'triangle', now, 0.11, 1480 * p, 420 * p, 0.05);
      playTone(ctx, 'sine', now + 0.025, 0.12, 2100 * p, 1680 * p, 0.032);
      playReceiverImpactLayer(ctx, now, 0.07, profile);
      break;
    }

    case 'fire_flame': {
      // Warm roaring flame flare + crackle
      playFilteredNoise(ctx, now, 0.24, 'bandpass', 460 * nb, 1280 * nb, 0.85, 0.08);
      playTone(ctx, 'sawtooth', now, 0.19, 170 * p, 310 * p, 0.055);
      playTone(ctx, 'triangle', now + 0.04, 0.16, 360 * p, 210 * p, 0.045);
      playReceiverImpactLayer(ctx, now, 0.1, profile);
      break;
    }

    case 'spiral_vortex': {
      // Dual spiraling harmonic hum + pressurized air snap
      playTone(ctx, 'triangle', now, 0.2, 280 * p, 920 * p, 0.065);
      playTone(ctx, 'sine', now + 0.02, 0.19, 294 * p, 965 * p, 0.055);
      playFilteredNoise(ctx, now + 0.04, 0.18, 'bandpass', 720 * nb, 2300 * nb, 2.1, 0.055);
      playReceiverImpactLayer(ctx, now, 0.12, profile);
      break;
    }

    case 'flurry_combo': {
      // 3 crisp rhythmic strike snaps
      playTone(ctx, 'square', now, 0.06, 230 * p, 105 * p, 0.042);
      playTone(ctx, 'square', now + 0.055, 0.06, 275 * p, 120 * p, 0.044);
      playTone(ctx, 'triangle', now + 0.11, 0.09, 340 * p, 130 * p, 0.055);
      playFilteredNoise(ctx, now + 0.05, 0.1, 'bandpass', 1100 * nb, 600 * nb, 1.3, 0.04);
      playReceiverImpactLayer(ctx, now, 0.11, profile);
      break;
    }

    case 'heavy_punch': {
      // Heavy low-mid body smash
      playTone(ctx, 'triangle', now, 0.13, 195 * p, 52, 0.09);
      playTone(ctx, 'square', now, 0.07, 135 * p, 64, 0.042);
      playFilteredNoise(ctx, now, 0.1, 'lowpass', 680 * nb, 180, 1.0, 0.055);
      playReceiverImpactLayer(ctx, now, 0.06, profile);
      break;
    }

    case 'guard_barrier': {
      // Crystalline barrier resonance
      playTone(ctx, 'sine', now, 0.13, 420 * p, 560 * p, 0.055);
      playTone(ctx, 'triangle', now + 0.025, 0.12, 630 * p, 840 * p, 0.04);
      if (profile.isBlocked) {
        playFilteredNoise(ctx, now + 0.03, 0.08, 'bandpass', 1500, 900, 2.6, 0.035);
      }
      break;
    }

    case 'aura_charge': {
      playTone(ctx, 'sine', now, 0.085, 360 * p, 740 * p, 0.04);
      break;
    }

    case 'victory_fanfare': {
      const notes = [
        { freq: 523.25, start: 0, dur: 0.14, peak: 0.065 },
        { freq: 659.25, start: 0.1, dur: 0.14, peak: 0.07 },
        { freq: 783.99, start: 0.2, dur: 0.16, peak: 0.075 },
        { freq: 1046.5, start: 0.3, dur: 0.28, peak: 0.085 },
      ];
      for (const n of notes) {
        playTone(ctx, 'triangle', now + n.start, n.dur, n.freq, n.freq, n.peak);
      }
      break;
    }

    case 'defeat_tone': {
      playTone(ctx, 'triangle', now, 0.16, 311.13, 295, 0.055);
      playTone(ctx, 'triangle', now + 0.14, 0.24, 246.94, 220, 0.05);
      break;
    }
  }
}

export function playTechniqueCombatSound(payload: CombatSoundPayload): void {
  if (!combatSoundEnabled) return;
  if (shouldSkipDuplicateEvent(payload.eventKey)) return;

  const exec = () => {
    if (!combatSoundEnabled) return;
    const throttleKey = `${payload.slot}:${payload.skillName || ''}`;
    const minGap = payload.slot === 'charge' ? 38 : 50;
    if (!payload.eventKey && shouldThrottleSlot(throttleKey, minGap)) {
      return;
    }

    try {
      const ctx = getCombatAudioContext();
      if (!ctx) return;
      if (sharedMasterGain && sharedMasterGain.gain.value === 0) {
        sharedMasterGain.gain.setValueAtTime(1, ctx.currentTime);
      }
      const profile = resolveTechniqueSoundProfile(payload);
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            if (combatSoundEnabled) {
              synthesizeCombatProfile(ctx, profile);
            }
          })
          .catch(() => {
            // ignore mobile WebAudio restrictions
          });
        return;
      }
      synthesizeCombatProfile(ctx, profile);
    } catch {
      // ignore mobile WebAudio restrictions cleanly
    }
  };

  if (payload.delayMs && payload.delayMs > 0) {
    scheduleCombatTimer(exec, payload.delayMs);
  } else {
    exec();
  }
}

export function playPvpEffectSound(
  kind: CombatSoundKind,
  opts?: Omit<CombatSoundPayload, 'slot'>
): void {
  const slotMap: Record<CombatSoundKind, TechniqueSlot> = {
    special: 'special',
    ultimate: 'ultimate',
    hit: 'physical',
    crit: 'physical',
    guard: 'guard',
    charge: 'charge',
    victory: 'victory',
    defeat: 'defeat',
  };
  playTechniqueCombatSound({
    ...opts,
    slot: slotMap[kind],
    isCrit: opts?.isCrit ?? kind === 'crit',
  });
}

export interface SpeakVictoryVoiceOptions {
  pitch?: number;
  rate?: number;
  tone?: 'deep' | 'heroic' | 'energetic' | 'calm' | 'sharp' | 'feminine';
  audioClipUrl?: string;
  gender?: CharacterGender;
  eventKey?: string;
  delayMs?: number;
}

function selectPreferredSpanishVoice(
  voices: SpeechSynthesisVoice[],
  gender?: CharacterGender,
  tone?: SpeakVictoryVoiceOptions['tone']
): SpeechSynthesisVoice | undefined {
  const spanishVoices = voices.filter((v) =>
    (v.lang || '').toLowerCase().startsWith('es')
  );
  if (spanishVoices.length === 0) return undefined;

  const preferFem = gender === 'F' || tone === 'feminine';
  const femRegex = /female|mujer|sabina|helena|paulina|monica|lucia|laura|maria|sofia|carmen|elena|camila|mia|valeria|paloma/i;
  const maleRegex = /male|hombre|jorge|pablo|diego|raul|carlos|enrique|alvaro|mateo|andres|juan/i;

  const genderMatched = spanishVoices.find((v) =>
    preferFem ? femRegex.test(v.name) : maleRegex.test(v.name)
  );
  if (genderMatched) return genderMatched;

  return (
    spanishVoices.find((v) => v.lang?.toLowerCase().startsWith('es-419')) ||
    spanishVoices.find((v) => v.lang?.toLowerCase().startsWith('es-es')) ||
    spanishVoices[0]
  );
}

function speakNow(quote: string, options?: SpeakVictoryVoiceOptions): boolean {
  if (!combatSoundEnabled || !quote) return false;
  if (shouldSkipDuplicateEvent(options?.eventKey)) return false;

  // Optional custom audio clip hook with safe fallback to speechSynthesis
  if (options?.audioClipUrl && typeof Audio !== 'undefined') {
    try {
      stopCombatVoice();
      const clip = new Audio(options.audioClipUrl);
      clip.volume = 0.9;
      activeVoiceAudio = clip;
      const p = clip.play();
      if (p && typeof p.catch === 'function') {
        void p.catch(() => {
          activeVoiceAudio = null;
          speakNow(quote, { ...options, audioClipUrl: undefined, eventKey: undefined });
        });
      }
      return true;
    } catch {
      activeVoiceAudio = null;
    }
  }

  try {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof window.SpeechSynthesisUtterance === 'undefined'
    ) {
      return false;
    }
    const synth = window.speechSynthesis;
    if (!synth || typeof synth.speak !== 'function') return false;
    synth.cancel();

    const utterance = new window.SpeechSynthesisUtterance(quote);
    utterance.lang = 'es-ES';
    utterance.pitch = Math.max(0.55, Math.min(1.55, options?.pitch ?? 1.0));
    utterance.rate = Math.max(0.78, Math.min(1.32, options?.rate ?? 1.02));
    utterance.volume = 0.95;

    const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
    const chosenVoice = selectPreferredSpanishVoice(
      voices,
      options?.gender,
      options?.tone
    );
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function speakVictoryVoice(
  quote: string,
  profileOrOptions?: SpeakVictoryVoiceOptions
): boolean {
  if (!combatSoundEnabled || !quote) return false;
  if (profileOrOptions?.delayMs && profileOrOptions.delayMs > 0) {
    scheduleCombatTimer(() => {
      speakNow(quote, { ...profileOrOptions, delayMs: 0 });
    }, profileOrOptions.delayMs);
    return true;
  }
  return speakNow(quote, profileOrOptions);
}

function playSimpleSynthTone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0
): void {
  const startAt = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startAt);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(40, freqEnd),
    startAt + durationSec
  );
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
  osc.connect(gain);
  gain.connect(getMasterOutput(ctx));
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

export function playPvpEmoteSound(
  soundKey: string,
  eventKey?: string
): boolean {
  if (!combatSoundEnabled) return false;
  if (shouldSkipDuplicateEvent(eventKey)) return false;
  if (shouldThrottleSlot(`emote:${soundKey}`, 320)) return false;
  const ctx = getPvpAudioContextSafe();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  try {
    if (soundKey === 'bankai') {
      playSimpleSynthTone(ctx, 220, 110, 0.24, 'sawtooth', 0.14, 0);
      playSimpleSynthTone(ctx, 440, 880, 0.2, 'triangle', 0.12, 0.06);
    } else if (soundKey === 'oraora') {
      playSimpleSynthTone(ctx, 320, 140, 0.09, 'square', 0.12, 0);
      playSimpleSynthTone(ctx, 360, 150, 0.09, 'square', 0.12, 0.08);
      playSimpleSynthTone(ctx, 420, 170, 0.11, 'square', 0.14, 0.16);
    } else if (soundKey === 'plus_ultra') {
      playSimpleSynthTone(ctx, 392, 587, 0.14, 'triangle', 0.14, 0);
      playSimpleSynthTone(ctx, 587, 880, 0.18, 'sine', 0.14, 0.09);
    } else {
      // dattebayo / default spirited chime
      playSimpleSynthTone(ctx, 440, 660, 0.12, 'triangle', 0.13, 0);
      playSimpleSynthTone(ctx, 660, 988, 0.14, 'sine', 0.12, 0.08);
    }
    return true;
  } catch {
    return false;
  }
}

export function playShopCoinSound(mode: 'buy' | 'sell' | 'earn' = 'buy'): boolean {
  if (!combatSoundEnabled) return false;
  if (shouldThrottleSlot(`shop_${mode}`, 160)) return false;
  const ctx = getPvpAudioContextSafe();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  try {
    if (mode === 'sell') {
      playSimpleSynthTone(ctx, 660, 880, 0.1, 'sine', 0.11, 0);
      playSimpleSynthTone(ctx, 880, 1175, 0.13, 'triangle', 0.1, 0.07);
    } else if (mode === 'earn') {
      playSimpleSynthTone(ctx, 587, 784, 0.09, 'sine', 0.1, 0);
      playSimpleSynthTone(ctx, 784, 1046, 0.14, 'sine', 0.11, 0.06);
    } else {
      playSimpleSynthTone(ctx, 523, 784, 0.09, 'triangle', 0.12, 0);
      playSimpleSynthTone(ctx, 784, 1046, 0.14, 'sine', 0.12, 0.07);
    }
    return true;
  } catch {
    return false;
  }
}

export function playConsumeItemSound(
  kind: 'heal' | 'energy' | 'buff' | 'revive' | 'auto_revive' = 'heal'
): boolean {
  if (!combatSoundEnabled) return false;
  if (shouldThrottleSlot(`item_${kind}`, 180)) return false;
  const ctx = getPvpAudioContextSafe();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  try {
    if (kind === 'revive' || kind === 'auto_revive') {
      playSimpleSynthTone(ctx, 330, 523, 0.14, 'triangle', 0.15, 0);
      playSimpleSynthTone(ctx, 523, 784, 0.16, 'sine', 0.15, 0.1);
      playSimpleSynthTone(ctx, 784, 1175, 0.24, 'sine', 0.16, 0.2);
    } else if (kind === 'energy') {
      playSimpleSynthTone(ctx, 260, 680, 0.22, 'sawtooth', 0.11, 0);
      playSimpleSynthTone(ctx, 520, 960, 0.18, 'sine', 0.1, 0.06);
    } else if (kind === 'buff') {
      playSimpleSynthTone(ctx, 349, 523, 0.12, 'square', 0.09, 0);
      playSimpleSynthTone(ctx, 523, 784, 0.16, 'triangle', 0.11, 0.08);
    } else {
      playSimpleSynthTone(ctx, 440, 660, 0.14, 'sine', 0.12, 0);
      playSimpleSynthTone(ctx, 660, 880, 0.16, 'sine', 0.11, 0.08);
    }
    return true;
  } catch {
    return false;
  }
}

export type RoomTowerSoundKind =
  | 'shot'
  | 'hit'
  | 'damage'
  | 'dash'
  | 'boss_warn'
  | 'boss_phase2'
  | 'boss_defeat'
  | 'room_clear'
  | 'upgrade'
  | 'respite';

export function playRoomTowerSound(
  kind: RoomTowerSoundKind,
  actor?: CombatSoundActor
): boolean {
  if (!combatSoundEnabled) return false;
  const minGap = kind === 'shot' ? 95 : kind === 'hit' ? 75 : 140;
  if (shouldThrottleSlot(`room:${kind}`, minGap)) return false;

  const ctx = getPvpAudioContextSafe();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  try {
    const meta = resolveActorMeta(actor);
    const animeAcoustic = getAnimeAcousticProfile(meta.anime);
    const p = animeAcoustic.pitchScale * (1 + Math.min(0.12, meta.phaseIdx * 0.02));

    switch (kind) {
      case 'shot':
        playSimpleSynthTone(ctx, 540 * p, 290 * p, 0.075, 'triangle', 0.075, 0);
        break;
      case 'hit':
        playSimpleSynthTone(ctx, 210 * p, 82, 0.075, 'square', 0.055, 0);
        break;
      case 'damage':
        playSimpleSynthTone(ctx, 180, 62, 0.14, 'sawtooth', 0.105, 0);
        playSimpleSynthTone(ctx, 320, 140, 0.1, 'triangle', 0.06, 0.02);
        break;
      case 'dash':
        playSimpleSynthTone(ctx, 420 * p, 880 * p, 0.09, 'sine', 0.075, 0);
        break;
      case 'boss_warn':
        playSimpleSynthTone(ctx, 220, 440, 0.14, 'sawtooth', 0.085, 0);
        playSimpleSynthTone(ctx, 220, 440, 0.14, 'sawtooth', 0.085, 0.14);
        break;
      case 'boss_phase2':
        playSimpleSynthTone(ctx, 140, 560, 0.28, 'sawtooth', 0.12, 0);
        playSimpleSynthTone(ctx, 280, 740, 0.24, 'triangle', 0.1, 0.08);
        break;
      case 'boss_defeat':
        playSimpleSynthTone(ctx, 160, 42, 0.28, 'sawtooth', 0.13, 0);
        playSimpleSynthTone(ctx, 523.25, 783.99, 0.16, 'triangle', 0.1, 0.14);
        playSimpleSynthTone(ctx, 783.99, 1046.5, 0.24, 'sine', 0.11, 0.26);
        break;
      case 'room_clear':
        playSimpleSynthTone(ctx, 523.25, 659.25, 0.11, 'sine', 0.09, 0);
        playSimpleSynthTone(ctx, 659.25, 987.77, 0.15, 'triangle', 0.095, 0.07);
        break;
      case 'upgrade':
        playSimpleSynthTone(ctx, 440, 659.25, 0.11, 'triangle', 0.1, 0);
        playSimpleSynthTone(ctx, 659.25, 880, 0.14, 'sine', 0.1, 0.07);
        playSimpleSynthTone(ctx, 880, 1174.66, 0.18, 'sine', 0.11, 0.14);
        break;
      case 'respite':
        playSimpleSynthTone(ctx, 392, 523.25, 0.16, 'sine', 0.09, 0);
        playSimpleSynthTone(ctx, 523.25, 659.25, 0.2, 'triangle', 0.085, 0.1);
        break;
    }
    return true;
  } catch {
    return false;
  }
}


