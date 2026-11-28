import { CHARACTERS } from './characters.ts';
import type {
  CharacterDef,
  PvpCosmeticLoadout,
  ShopItemCategory,
  ShopItemDef,
  UserProfile,
} from '../types/animefit.ts';

export const DAILY_ITEM_PURCHASE_LIMIT = 5;
export const DAILY_PVP_XP_CAP = 240;
export const DAILY_PVP_COIN_CAP = 120;
export const DAILY_SURVIVAL_COIN_CAP = 40;
export const STORY_AUTOREVIVE_LIMIT = 1;
export const SURVIVAL_AUTOREVIVE_LIMIT = 2;
export const RESALE_RATE = 0.7;

export function toShopLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const SHOP_ITEMS: ShopItemDef[] = [
  // === 1. CÁPSULAS DE XP (4) ===
  {
    id: 'xp_ichiraku_ramen',
    name: 'Tazón Ramen Ichiraku',
    anime: 'Naruto',
    category: 'xp_capsule',
    rarity: 'común',
    price: 45,
    icon: '🍜',
    description: 'Alimento clásico ninja. Otorga +65 XP directos al usarlo desde el inventario.',
    effectKind: 'xp',
    effectValue: 65,
    accentColor: '#F97316',
  },
  {
    id: 'xp_capsule_gravity',
    name: 'Cápsula de Gravedad Corp.',
    anime: 'Dragon Ball',
    category: 'xp_capsule',
    rarity: 'raro',
    price: 85,
    icon: '💊',
    description: 'Entrenamiento comprimido Capsule Corp. Otorga +135 XP inmediatos a tu guerrero.',
    effectKind: 'xp',
    effectValue: 135,
    accentColor: '#38BDF8',
  },
  {
    id: 'xp_philosopher_drop',
    name: 'Fragmento Alquímico Carmesí',
    anime: 'Fullmetal Alchemist',
    category: 'xp_capsule',
    rarity: 'épico',
    price: 140,
    icon: '⚗️',
    description: 'Catalizador de intercambio equivalente. Suma +235 XP directos sin romper el ritmo.',
    effectKind: 'xp',
    effectValue: 235,
    accentColor: '#FACC15',
  },
  {
    id: 'xp_system_essence',
    name: 'Cristal de Misión del Sistema',
    anime: 'Solo Leveling',
    category: 'xp_capsule',
    rarity: 'legendario',
    price: 205,
    icon: '💠',
    description: 'Recompensa oculta del Sistema. Otorga +360 XP para acelerar tu siguiente fase.',
    effectKind: 'xp',
    effectValue: 360,
    accentColor: '#A855F7',
  },

  // === 2. CONSUMIBLES TÁCTICOS (HISTORIA Y SUPERVIVENCIA) (8) ===
  {
    id: 'tac_senzu_bean',
    name: 'Semilla del Ermitaño (Senzu)',
    anime: 'Dragon Ball',
    category: 'combat_consumable',
    rarity: 'raro',
    price: 55,
    icon: '🫘',
    description: 'Recupera al instante +45% de HP máximo en Historia o Supervivencia (máx. 2 por combate/oleada).',
    effectKind: 'heal_hp',
    effectValue: 0.45,
    perBattleLimit: 2,
    accentColor: '#22C55E',
  },
  {
    id: 'tac_akimichi_pill',
    name: 'Píldora de Chakra Akimichi',
    anime: 'Naruto',
    category: 'combat_consumable',
    rarity: 'común',
    price: 50,
    icon: '🟠',
    description: 'Carga +40% de energía al instante en Historia o Supervivencia (máx. 2 por combate).',
    effectKind: 'charge_energy',
    effectValue: 40,
    perBattleLimit: 2,
    accentColor: '#F97316',
  },
  {
    id: 'tac_titan_hardening',
    name: 'Coraza de Endurecimiento',
    anime: 'Attack on Titan',
    category: 'combat_consumable',
    rarity: 'raro',
    price: 60,
    icon: '🧱',
    description: 'Activa guardia blindada inmediata y sana +18% HP sin perder ritmo (máx. 2 por combate).',
    effectKind: 'temp_guard',
    effectValue: 0.18,
    perBattleLimit: 2,
    accentColor: '#F59E0B',
  },
  {
    id: 'tac_plus_ultra_boost',
    name: 'Adrenalina One For All',
    anime: 'My Hero Academia',
    category: 'combat_consumable',
    rarity: 'épico',
    price: 75,
    icon: '⚡',
    description: '+25% de ATK y +25% de probabilidad crítica durante 3 turnos en Historia o Supervivencia (máx. 1 por combate).',
    effectKind: 'atk_crit_buff',
    effectValue: 0.25,
    secondaryValue: 0.25,
    turns: 3,
    perBattleLimit: 1,
    accentColor: '#22C55E',
  },
  {
    id: 'tac_shunpo_step',
    name: 'Paso Flash Shunpo',
    anime: 'Bleach',
    category: 'combat_consumable',
    rarity: 'épico',
    price: 70,
    icon: '💨',
    description: 'Agilidad límite: esquiva por completo el siguiente ataque directo enemigo (máx. 1 por combate).',
    effectKind: 'evasion_agility',
    effectValue: 1,
    perBattleLimit: 1,
    accentColor: '#38BDF8',
  },
  {
    id: 'tac_six_eyes_focus',
    name: 'Precisión de los Seis Ojos',
    anime: 'Jujutsu Kaisen',
    category: 'combat_consumable',
    rarity: 'raro',
    price: 65,
    icon: '👁️',
    description: 'Estabilidad total: tus golpes atraviesan la guardia rival con +15% daño durante 3 turnos (máx. 1 por combate).',
    effectKind: 'accuracy_stability',
    effectValue: 0.15,
    turns: 3,
    perBattleLimit: 1,
    accentColor: '#38BDF8',
  },
  {
    id: 'tac_pochita_core',
    name: 'Núcleo Motosierra de Emergencia',
    anime: 'Chainsaw Man',
    category: 'combat_consumable',
    rarity: 'épico',
    price: 90,
    icon: '🪚',
    description: 'Recarga de emergencia: inyecta +65% de energía en un turno crítico (máx. 1 por combate).',
    effectKind: 'emergency_energy',
    effectValue: 65,
    perBattleLimit: 1,
    accentColor: '#EF4444',
  },
  {
    id: 'tac_phoenix_autorevive',
    name: 'Tótem Fénix: Haki del Despertar',
    anime: 'One Piece',
    category: 'combat_consumable',
    rarity: 'legendario',
    price: 185,
    icon: '🔥',
    description: 'Auto-revivir al caer a 0 HP con 45% HP y +25% energía. Límite estricto: 1 uso por combate en Historia y máx. 2 en toda la racha de Supervivencia.',
    effectKind: 'auto_revive',
    effectValue: 0.45,
    storyLimit: STORY_AUTOREVIVE_LIMIT,
    survivalRunLimit: SURVIVAL_AUTOREVIVE_LIMIT,
    accentColor: '#FACC15',
  },

  // === 3. APOYO DE OLEADAS PARA SUPERVIVENCIA (2) ===
  {
    id: 'surv_slayer_ration',
    name: 'Ración del Cuerpo de Cazadores',
    anime: 'Demon Slayer',
    category: 'survival_support',
    rarity: 'raro',
    price: 80,
    icon: '🍙',
    description: 'Exclusivo de Supervivencia: restaura +35% HP y +25% energía entre turnos (máx. 2 usos en toda la racha).',
    effectKind: 'survival_wave_ration',
    effectValue: 0.35,
    secondaryValue: 25,
    survivalRunLimit: 2,
    accentColor: '#22C55E',
  },
  {
    id: 'surv_mazoku_elixir',
    name: 'Elixir Espiritual Mazoku',
    anime: 'Yu Yu Hakusho',
    category: 'survival_support',
    rarity: 'épico',
    price: 110,
    icon: '🧪',
    description: 'Exclusivo de Supervivencia: cura +22% HP y otorga +28% ATK por 3 turnos (máx. 2 usos en toda la racha).',
    effectKind: 'survival_wave_boost',
    effectValue: 0.22,
    secondaryValue: 0.28,
    turns: 3,
    survivalRunLimit: 2,
    accentColor: '#A855F7',
  },

  // === 4. PERSONALIZACIÓN ESTÉTICA GENERAL (10) ===
  {
    id: 'cos_aura_ssj',
    name: 'Aura Dorada Super Saiyajin',
    anime: 'Dragon Ball',
    category: 'cosmetic_aura',
    rarity: 'épico',
    price: 95,
    icon: '✨',
    description: 'Envuelve el perfil y combates de tu guerrero con un halo dorado Saiyajin (estético).',
    effectKind: 'cosmetic',
    accentColor: '#FACC15',
    cosmeticLabel: 'Aura Dorada Saiyajin',
  },
  {
    id: 'cos_aura_hinokami',
    name: 'Destello Solar Hinokami',
    anime: 'Demon Slayer',
    category: 'cosmetic_aura',
    rarity: 'épico',
    price: 95,
    icon: '🔥',
    description: 'Halo carmesí de la Danza del Dios del Fuego alrededor de tu avatar (estético).',
    effectKind: 'cosmetic',
    accentColor: '#F97316',
    cosmeticLabel: 'Destello Hinokami',
  },
  {
    id: 'cos_aura_monarch',
    name: 'Aura Monarca de las Sombras',
    anime: 'Solo Leveling',
    category: 'cosmetic_aura',
    rarity: 'legendario',
    price: 125,
    icon: '🌑',
    description: 'Resplandor violeta abisal digno de Sung Jin-Woo (estético).',
    effectKind: 'cosmetic',
    accentColor: '#A855F7',
    cosmeticLabel: 'Aura Monarca Sombrío',
  },
  {
    id: 'cos_title_pirate_king',
    name: 'Título: Rey de los Piratas',
    anime: 'One Piece',
    category: 'cosmetic_title',
    rarity: 'épico',
    price: 105,
    icon: '🏴‍☠️',
    description: 'Muestra el título "Rey de los Piratas" en tu ficha de Guerrero y sala PvP.',
    effectKind: 'cosmetic',
    accentColor: '#EF4444',
    cosmeticLabel: 'Rey de los Piratas',
  },
  {
    id: 'cos_title_strongest',
    name: 'Título: El Hechicero Más Fuerte',
    anime: 'Jujutsu Kaisen',
    category: 'cosmetic_title',
    rarity: 'legendario',
    price: 115,
    icon: '♾️',
    description: 'Título honorífico de Satoru Gojo visible en tu perfil y duelos.',
    effectKind: 'cosmetic',
    accentColor: '#38BDF8',
    cosmeticLabel: 'El Hechicero Más Fuerte',
  },
  {
    id: 'cos_emblem_wings',
    name: 'Emblema Alas de la Libertad',
    anime: 'Attack on Titan',
    category: 'cosmetic_emblem',
    rarity: 'raro',
    price: 85,
    icon: '🪽',
    description: 'Insignia del Cuerpo de Exploración junto a tu nombre de atleta.',
    effectKind: 'cosmetic',
    accentColor: '#38BDF8',
    cosmeticLabel: '🪽 Alas de la Libertad',
  },
  {
    id: 'cos_emblem_clover',
    name: 'Sello del Trébol de 5 Hojas',
    anime: 'Black Clover',
    category: 'cosmetic_emblem',
    rarity: 'épico',
    price: 90,
    icon: '🍀',
    description: 'Emblema antimagia del grimorio oscuro para lucir en perfil y arena.',
    effectKind: 'cosmetic',
    accentColor: '#22C55E',
    cosmeticLabel: '🍀 Trébol de 5 Hojas',
  },
  {
    id: 'quote_jotaro_yare',
    name: 'Frase de Victoria: "Yare Yare Daze"',
    anime: "JoJo's Bizarre Adv.",
    category: 'victory_quote',
    rarity: 'épico',
    price: 110,
    icon: '⭐',
    description: 'Agrega una frase extra con voz a la rotación de victoria en PvP, Historia y Supervivencia.',
    effectKind: 'cosmetic',
    accentColor: '#A855F7',
    extraQuote:
      'Yare yare daze... tu técnica aún necesita mil entrenamientos más para igualar mi ritmo.',
  },
  {
    id: 'quote_allmight_plusultra',
    name: 'Frase de Victoria: "¡Plus Ultra!"',
    anime: 'My Hero Academia',
    category: 'victory_quote',
    rarity: 'épico',
    price: 110,
    icon: '💪',
    description: 'Desbloquea una frase heroica extra en la rotación de victoria con voz.',
    effectKind: 'cosmetic',
    accentColor: '#FACC15',
    extraQuote:
      '¡Todo está bien! ¿Por qué? ¡Porque superamos el límite con un verdadero Plus Ultra!',
  },
  {
    id: 'quote_saitama_serious',
    name: 'Frase de Victoria: "Un Golpe Bastó"',
    anime: 'One Punch Man',
    category: 'victory_quote',
    rarity: 'legendario',
    price: 120,
    icon: '🥊',
    description: 'Desbloquea la frase imperturbable de Saitama al ganar combates.',
    effectKind: 'cosmetic',
    accentColor: '#FACC15',
    extraQuote:
      '¡Te derroté! Entrené demasiado en serio hoy... con un solo golpe bastó.',
  },

  // === 5. AMBIENTACIÓN Y ESTILO EXCLUSIVO DE PVP (SIN VENTAJA EN ESTADÍSTICAS) (10) ===
  {
    id: 'pvp_intro_sagittarius',
    name: 'Entrada PvP: Armadura Dorada',
    anime: 'Saint Seiya',
    category: 'pvp_intro',
    rarity: 'épico',
    price: 120,
    icon: '🏹',
    description: 'Banner dorado del Cosmos al iniciar duelos PvP (solo visual, sin ventaja en combate).',
    effectKind: 'cosmetic',
    accentColor: '#FACC15',
    cosmeticLabel: 'Cosmos Dorado de Sagitario',
  },
  {
    id: 'pvp_intro_shrine',
    name: 'Entrada PvP: Relicario Malévolo',
    anime: 'Jujutsu Kaisen',
    category: 'pvp_intro',
    rarity: 'legendario',
    price: 130,
    icon: '⛩️',
    description: 'Presentación carmesí de Expansión de Dominio en la Ronda 1 del PvP (solo visual).',
    effectKind: 'cosmetic',
    accentColor: '#EF4444',
    cosmeticLabel: 'Expansión: Relicario Malévolo',
  },
  {
    id: 'pvp_title_nen_hunter',
    name: 'Marco PvP: Cazador de Estrellas',
    anime: 'Hunter x Hunter',
    category: 'cosmetic_title',
    rarity: 'raro',
    price: 100,
    icon: '🃏',
    description: 'Distintivo de Cazador Profesional para tu tarjeta de duelista (solo visual).',
    effectKind: 'cosmetic',
    accentColor: '#EC4899',
    cosmeticLabel: 'Cazador Licencia 3★',
  },
  {
    id: 'pvp_title_gotei_captain',
    name: 'Marco PvP: Capitán Gotei 13',
    anime: 'Bleach',
    category: 'cosmetic_title',
    rarity: 'épico',
    price: 105,
    icon: '🗡️',
    description: 'Título de Capitán de División del Seireitei en tu ficha y PvP (solo visual).',
    effectKind: 'cosmetic',
    accentColor: '#F97316',
    cosmeticLabel: 'Capitán del Gotei 13',
  },
  {
    id: 'pvp_emote_dattebayo',
    name: 'Emote PvP: "¡Dattebayo!"',
    anime: 'Naruto',
    category: 'pvp_emote',
    rarity: 'común',
    price: 75,
    icon: '🦊',
    description: 'Reacción rápida en vivo con sonido ligero durante duelos PvP (sin efecto en stats).',
    effectKind: 'cosmetic',
    accentColor: '#F97316',
    emoteSoundKey: 'dattebayo',
    emotePhrase: '¡Nunca retrocedo, dattebayo!',
  },
  {
    id: 'pvp_emote_plus_ultra',
    name: 'Emote PvP: "¡Plus Ultra!"',
    anime: 'My Hero Academia',
    category: 'pvp_emote',
    rarity: 'común',
    price: 75,
    icon: '💥',
    description: 'Gesto enérgico en tiempo real durante el duelo PvP (solo ambientación).',
    effectKind: 'cosmetic',
    accentColor: '#22C55E',
    emoteSoundKey: 'plus_ultra',
    emotePhrase: '¡Vamos más allá: Plus Ultra!',
  },
  {
    id: 'pvp_emote_bankai',
    name: 'Emote PvP: "¡Bankai!"',
    anime: 'Bleach',
    category: 'pvp_emote',
    rarity: 'raro',
    price: 85,
    icon: '🌑',
    description: 'Emote de presión espiritual con destello acústico en PvP (solo ambientación).',
    effectKind: 'cosmetic',
    accentColor: '#38BDF8',
    emoteSoundKey: 'bankai',
    emotePhrase: '¡Libera todo tu Reiatsu: Bankai!',
  },
  {
    id: 'pvp_emote_oraora',
    name: 'Emote PvP: "¡ORA ORA!"',
    anime: "JoJo's Bizarre Adv.",
    category: 'pvp_emote',
    rarity: 'raro',
    price: 85,
    icon: '⭐',
    description: 'Ráfaga de Stand en forma de reacción visual y sonora en PvP (solo ambientación).',
    effectKind: 'cosmetic',
    accentColor: '#A855F7',
    emoteSoundKey: 'oraora',
    emotePhrase: '¡ORA ORA ORA! ¡Buen choque!',
  },
  {
    id: 'pvp_finisher_pegasus',
    name: 'Remate Visual: Meteoro de Pegaso',
    anime: 'Saint Seiya',
    category: 'pvp_finisher',
    rarity: 'legendario',
    price: 140,
    icon: '🌠',
    description: 'Efecto visual estelar al ganar un duelo PvP (sin aumento de daño).',
    effectKind: 'cosmetic',
    accentColor: '#38BDF8',
    cosmeticLabel: 'Destello Meteoro de Pegaso',
  },
  {
    id: 'pvp_finisher_blackflash',
    name: 'Remate Visual: Destello Oscuro',
    anime: 'Jujutsu Kaisen',
    category: 'pvp_finisher',
    rarity: 'legendario',
    price: 145,
    icon: '⚡',
    description: 'Destello carmesí y negro al sellar la victoria en PvP (solo visual, cero ventaja).',
    effectKind: 'cosmetic',
    accentColor: '#EF4444',
    cosmeticLabel: 'Sello Destello Oscuro',
  },
];

const SHOP_ITEM_BY_ID = new Map<string, ShopItemDef>(
  SHOP_ITEMS.map((item) => [item.id, item])
);

export function getShopItemById(itemId: string): ShopItemDef | undefined {
  return SHOP_ITEM_BY_ID.get(itemId);
}

export function getResaleValue(purchasePrice: number): number {
  const safe = Math.max(0, Number(purchasePrice || 0));
  return Math.floor(safe * RESALE_RATE);
}

export function getCharacterShopPrice(charOrId: CharacterDef | string): number {
  const char =
    typeof charOrId === 'string'
      ? CHARACTERS.find((c) => c.id === charOrId) || CHARACTERS[0]
      : charOrId;
  const maxReq = char.stages.reduce(
    (max, st) => Math.max(max, Number(st.levelReq || 1)),
    1
  );
  // Clearly above every shop item (items <= 205, characters 680 - 1180)
  return Math.round((460 + char.stages.length * 55 + maxReq * 2.4) / 5) * 5;
}

function hashSeedString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export interface DailyShopRotation {
  dateKey: string;
  items: ShopItemDef[];
  characters: CharacterDef[];
}

export function getDailyShopRotation(
  dateKey: string = toShopLocalDateKey(new Date())
): DailyShopRotation {
  const safeKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : toShopLocalDateKey(new Date());
  const rand = createMulberry32(hashSeedString(`animefit_daily_shop_v1:${safeKey}`));

  // Pick 6 diverse items deterministically for this local calendar date:
  // 1 XP capsule, 2 tactical combat / survival consumables, 1 general aesthetic/quote,
  // 1 PvP style item, and 1 flex slot from remaining items.
  const xpPool = seededShuffle(
    SHOP_ITEMS.filter((i) => i.category === 'xp_capsule'),
    rand
  );
  const combatPool = seededShuffle(
    SHOP_ITEMS.filter(
      (i) =>
        i.category === 'combat_consumable' || i.category === 'survival_support'
    ),
    rand
  );
  const aestheticPool = seededShuffle(
    SHOP_ITEMS.filter(
      (i) =>
        i.category === 'cosmetic_aura' ||
        i.category === 'cosmetic_emblem' ||
        i.category === 'victory_quote'
    ),
    rand
  );
  const pvpPool = seededShuffle(
    SHOP_ITEMS.filter(
      (i) =>
        i.category === 'pvp_intro' ||
        i.category === 'pvp_emote' ||
        i.category === 'pvp_finisher' ||
        i.category === 'cosmetic_title'
    ),
    rand
  );

  const selected: ShopItemDef[] = [];
  const usedIds = new Set<string>();
  const pushUnique = (item?: ShopItemDef) => {
    if (!item || usedIds.has(item.id) || selected.length >= 6) return;
    usedIds.add(item.id);
    selected.push(item);
  };

  pushUnique(xpPool[0]);
  pushUnique(combatPool[0]);
  pushUnique(combatPool[1]);
  pushUnique(aestheticPool[0]);
  pushUnique(pvpPool[0]);

  const remainingPool = seededShuffle(
    SHOP_ITEMS.filter((i) => !usedIds.has(i.id)),
    rand
  );
  for (const item of remainingPool) {
    if (selected.length >= 6) break;
    pushUnique(item);
  }

  const charPool = seededShuffle(CHARACTERS, rand);
  const characters = charPool.slice(0, 2);

  return {
    dateKey: safeKey,
    items: selected,
    characters,
  };
}

export function getUnlockedCharacterIds(
  user: Pick<UserProfile, 'charId' | 'unlockedChars'>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (id?: string) => {
    const clean = String(id || '').trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };
  add(user.charId || 'goku');
  for (const id of user.unlockedChars || []) {
    add(id);
  }
  return out;
}

export function getCharacterEffectiveXp(
  user: Pick<UserProfile, 'xp' | 'charXpOffsets'>,
  charId: string
): number {
  const totalXp = Math.max(0, Number(user.xp || 0));
  const offset = Math.max(0, Number(user.charXpOffsets?.[charId] || 0));
  return Math.max(0, totalXp - offset);
}

export function getUserDailyShopPurchasesCount(
  user: Pick<UserProfile, 'shopDailyPurchases'>,
  dateKey: string = toShopLocalDateKey(new Date())
): number {
  const tracker = user.shopDailyPurchases;
  if (!tracker || tracker.dateKey !== dateKey) return 0;
  return Math.max(0, Math.floor(Number(tracker.itemsBought || 0)));
}

export function getUserPvpDailyXpEarned(
  user: Pick<UserProfile, 'pvpDailyXp'>,
  dateKey: string = toShopLocalDateKey(new Date())
): number {
  const tracker = user.pvpDailyXp;
  if (!tracker || tracker.dateKey !== dateKey) return 0;
  return Math.max(0, Math.floor(Number(tracker.xpEarned || 0)));
}

export function getUserExtraVictoryQuotes(
  user: Pick<UserProfile, 'inventory'>
): string[] {
  const quotes: string[] = [];
  for (const entry of user.inventory || []) {
    if (!entry || entry.quantity <= 0) continue;
    const def = getShopItemById(entry.itemId);
    if (def?.category === 'victory_quote' && def.extraQuote) {
      quotes.push(def.extraQuote);
    }
  }
  return quotes;
}

export function getUserOwnedPvpEmotes(
  user: Pick<UserProfile, 'inventory'>
): ShopItemDef[] {
  const emotes: ShopItemDef[] = [];
  for (const entry of user.inventory || []) {
    if (!entry || entry.quantity <= 0) continue;
    const def = getShopItemById(entry.itemId);
    if (def?.category === 'pvp_emote') {
      emotes.push(def);
    }
  }
  return emotes;
}

export function buildUserPvpCosmeticLoadout(
  user: Pick<UserProfile, 'equippedCosmetics' | 'inventory'>
): PvpCosmeticLoadout {
  const ownedIds = new Set(
    (user.inventory || [])
      .filter((e) => e && e.quantity > 0)
      .map((e) => e.itemId)
  );
  const ownedEmotes = (user.inventory || [])
    .filter((e) => e && e.quantity > 0 && getShopItemById(e.itemId)?.category === 'pvp_emote')
    .map((e) => e.itemId);
  const eq = user.equippedCosmetics || {};

  const auraDef =
    eq.auraId && ownedIds.has(eq.auraId) ? getShopItemById(eq.auraId) : undefined;
  const titleDef =
    eq.titleId && ownedIds.has(eq.titleId)
      ? getShopItemById(eq.titleId)
      : undefined;
  const emblemDef =
    eq.emblemId && ownedIds.has(eq.emblemId)
      ? getShopItemById(eq.emblemId)
      : undefined;
  const introDef =
    eq.pvpIntroId && ownedIds.has(eq.pvpIntroId)
      ? getShopItemById(eq.pvpIntroId)
      : undefined;
  const finisherDef =
    eq.pvpFinisherId && ownedIds.has(eq.pvpFinisherId)
      ? getShopItemById(eq.pvpFinisherId)
      : undefined;

  return {
    title: titleDef?.cosmeticLabel || null,
    titleName: titleDef?.cosmeticLabel || null,
    emblem: emblemDef?.cosmeticLabel || null,
    emblemIcon: emblemDef?.icon || null,
    auraColor: auraDef?.accentColor || null,
    auraLabel: auraDef?.cosmeticLabel || null,
    introBanner: introDef?.cosmeticLabel || null,
    introColor: introDef?.accentColor || null,
    pvpIntro: introDef
      ? {
          icon: introDef.icon,
          bannerText: introDef.cosmeticLabel || introDef.name,
          color: introDef.accentColor || '#FACC15',
        }
      : null,
    finisherId: finisherDef?.id || null,
    finisherLabel: finisherDef?.cosmeticLabel || null,
    pvpFinisher: finisherDef
      ? {
          id: finisherDef.id,
          icon: finisherDef.icon,
          title: finisherDef.cosmeticLabel || finisherDef.name,
          color: finisherDef.accentColor || '#38BDF8',
        }
      : null,
    ownedEmotes,
  };
}

export function getCategoryLabel(cat: ShopItemCategory): string {
  switch (cat) {
    case 'xp_capsule':
      return 'Cápsula XP';
    case 'combat_consumable':
      return 'Consumible Táctico';
    case 'survival_support':
      return 'Apoyo Supervivencia';
    case 'cosmetic_aura':
      return 'Aura Estética';
    case 'cosmetic_title':
      return 'Título';
    case 'cosmetic_emblem':
      return 'Emblema';
    case 'victory_quote':
      return 'Frase de Victoria';
    case 'pvp_intro':
      return 'Entrada PvP';
    case 'pvp_emote':
      return 'Emote PvP';
    case 'pvp_finisher':
      return 'Remate Visual PvP';
    default:
      return 'Objeto';
  }
}

export function isSingleOwnershipCosmetic(category: ShopItemCategory): boolean {
  return (
    category === 'cosmetic_aura' ||
    category === 'cosmetic_title' ||
    category === 'cosmetic_emblem' ||
    category === 'victory_quote' ||
    category === 'pvp_intro' ||
    category === 'pvp_emote' ||
    category === 'pvp_finisher'
  );
}
