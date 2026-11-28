import type {
  AccessorySlot,
  AnimeAccessoryDef,
  EquippedAccessories,
  UserProfile,
} from '../types/animefit';
import { toShopLocalDateKey } from './shopCatalog';

/**
 * Secondary anime-themed currency: Berries (One Piece), visually separated from
 * main gold coins (#FACC15) by its teal-cyan color (#2DD4BF) and distinct emblem.
 */
export const SECONDARY_CURRENCY_NAME = 'Berries';
export const SECONDARY_CURRENCY_SHORT = 'Berries';
export const SECONDARY_CURRENCY_COLOR = '#2DD4BF';
export const SECONDARY_CURRENCY_ICON = '🫐';

export const ACCESSORY_DAILY_SHOP_SIZE = 10;
export const ACCESSORY_DAILY_PURCHASE_LIMIT = 2;

export const ACCESSORY_SLOT_LABELS: Record<AccessorySlot, string> = {
  helm: 'Casco / Frente',
  armor: 'Armadura / Capa',
  ring: 'Anillo / Sello',
  amulet: 'Amuleto / Reliquia',
};

export const ACCESSORY_SLOT_ICONS: Record<AccessorySlot, string> = {
  helm: '🪖',
  armor: '🥋',
  ring: '💍',
  amulet: '🔮',
};

export const ANIME_ACCESSORIES: AnimeAccessoryDef[] = [
  // ================= HELM / FRENTE (8) =================
  {
    id: 'acc_helm_konoha_band',
    name: 'Bandana Ninja de Konoha',
    anime: 'Naruto',
    slot: 'helm',
    rarity: 'común',
    price: 38,
    icon: '🥷',
    accentColor: '#38BDF8',
    secondaryColor: '#94A3B8',
    visualShape: 'band',
    description: 'Protector frontal metálico grabado con la hoja oculta de Konoha.',
    roomVisualNote: 'Cinta frontal azul-acero sobre tu miniatura en salas.',
  },
  {
    id: 'acc_helm_luffy_strawhat',
    name: 'Sombrero de Paja del Rey Pirata',
    anime: 'One Piece',
    slot: 'helm',
    rarity: 'legendario',
    price: 92,
    icon: '👒',
    accentColor: '#F59E0B',
    secondaryColor: '#EF4444',
    visualShape: 'straw_hat',
    description: 'El legendario sombrero dorado con cinta carmesí heredado de Shanks.',
    roomVisualNote: 'Sombrero dorado con cinta roja visible sobre tu guerrero.',
  },
  {
    id: 'acc_helm_saiyan_scouter',
    name: 'Rastreador Scouter Saiyajin',
    anime: 'Dragon Ball',
    slot: 'helm',
    rarity: 'raro',
    price: 54,
    icon: '📟',
    accentColor: '#22C55E',
    secondaryColor: '#86EFAC',
    visualShape: 'visor',
    description: 'Visor táctico de élite usado para medir niveles de poder en combate.',
    roomVisualNote: 'Visor verde luminoso lateral en el sprite de sala.',
  },
  {
    id: 'acc_helm_gojo_blindfold',
    name: 'Venda de los Seis Ojos',
    anime: 'Jujutsu Kaisen',
    slot: 'helm',
    rarity: 'épico',
    price: 74,
    icon: '🕶️',
    accentColor: '#60A5FA',
    secondaryColor: '#1E293B',
    visualShape: 'visor',
    description: 'Banda oscura de Satoru Gojo impregnada con energía del Infinito.',
    roomVisualNote: 'Banda azul-noche con brillo infinito en la frente.',
  },
  {
    id: 'acc_helm_ichigo_mask',
    name: 'Máscara Hollow Carmesí',
    anime: 'Bleach',
    slot: 'helm',
    rarity: 'épico',
    price: 78,
    icon: '🎭',
    accentColor: '#F8FAFC',
    secondaryColor: '#DC2626',
    visualShape: 'mask',
    description: 'Fragmento de máscara Hollow de Ichigo Kurosaki con franjas rojas.',
    roomVisualNote: 'Cresta marfil y carmesí en el rostro de la miniatura.',
  },
  {
    id: 'acc_helm_pegasus_crown',
    name: 'Diadema de Pegaso Dorado',
    anime: 'Saint Seiya',
    slot: 'helm',
    rarity: 'legendario',
    price: 96,
    icon: '👑',
    accentColor: '#FDE047',
    secondaryColor: '#38BDF8',
    visualShape: 'crown',
    description: 'Corona alada forjada con polvo estelar del Santuario de Atena.',
    roomVisualNote: 'Diadema dorada con destello cósmico alado.',
  },
  {
    id: 'acc_helm_jotaro_cap',
    name: 'Gorra Estrella Platino',
    anime: "JoJo's Bizarre Adv.",
    slot: 'helm',
    rarity: 'raro',
    price: 56,
    icon: '🧢',
    accentColor: '#8B5CF6',
    secondaryColor: '#FACC15',
    visualShape: 'band',
    description: 'Inconfundible gorra con insignia dorada de la familia Joestar.',
    roomVisualNote: 'Visera violeta con insignia dorada frontal.',
  },
  {
    id: 'acc_helm_pochita_crest',
    name: 'Cresta Motosierra Pochita',
    anime: 'Chainsaw Man',
    slot: 'helm',
    rarity: 'raro',
    price: 58,
    icon: '🪚',
    accentColor: '#F97316',
    secondaryColor: '#94A3B8',
    visualShape: 'crown',
    description: 'Cuerda de arranque y filo naranja inspirado en el demonio motosierra.',
    roomVisualNote: 'Asta metálica naranja sobre el perfil en salas.',
  },

  // ================= ARMOR / CAPA (8) =================
  {
    id: 'acc_armor_saiyan_plate',
    name: 'Armadura Real Saiyajin',
    anime: 'Dragon Ball',
    slot: 'armor',
    rarity: 'épico',
    price: 76,
    icon: '🛡️',
    accentColor: '#2563EB',
    secondaryColor: '#FACC15',
    visualShape: 'vest',
    description: 'Coraza de combate del príncipe Vegeta diseñada para resistir gravedad extrema.',
    roomVisualNote: 'Hombreras azul-dorado rodeando tu guerrero en salas.',
  },
  {
    id: 'acc_armor_tanjiro_haori',
    name: 'Haori a Cuadros de Tanjiro',
    anime: 'Demon Slayer',
    slot: 'armor',
    rarity: 'raro',
    price: 52,
    icon: '👘',
    accentColor: '#10B981',
    secondaryColor: '#0F172A',
    visualShape: 'cape',
    description: 'Tradicional haori esmeralda y negro del Cuerpo de Exterminadores.',
    roomVisualNote: 'Manto verde esmeralda tras tu miniatura al moverte.',
  },
  {
    id: 'acc_armor_survey_cloak',
    name: 'Capa Alas de la Libertad',
    anime: 'Attack on Titan',
    slot: 'armor',
    rarity: 'raro',
    price: 50,
    icon: '🧥',
    accentColor: '#15803D',
    secondaryColor: '#E2E8F0',
    visualShape: 'cape',
    description: 'Capa verde oliva de la Legión de Reconocimiento para maniobras rápidas.',
    roomVisualNote: 'Capa verde bosque con emblema alado detrás del sprite.',
  },
  {
    id: 'acc_armor_akatsuki_cloak',
    name: 'Capa Nubes Rojas Akatsuki',
    anime: 'Naruto',
    slot: 'armor',
    rarity: 'legendario',
    price: 94,
    icon: '☁️',
    accentColor: '#DC2626',
    secondaryColor: '#111827',
    visualShape: 'cape',
    description: 'Túnica negra adornada con nubes carmesí de los ninjas renegados.',
    roomVisualNote: 'Manto oscuro con aura carmesí flotante.',
  },
  {
    id: 'acc_armor_blackbulls_cape',
    name: 'Manto de los Toros Negros',
    anime: 'Black Clover',
    slot: 'armor',
    rarity: 'raro',
    price: 55,
    icon: '🐂',
    accentColor: '#1E293B',
    secondaryColor: '#F59E0B',
    visualShape: 'cape',
    description: 'Capa corta de la orden mágica más indomable del Reino del Trébol.',
    roomVisualNote: 'Capa oscura con ribete dorado antimagia.',
  },
  {
    id: 'acc_armor_saitama_cape',
    name: 'Capa Blanca de Héroe Calvo',
    anime: 'One Punch Man',
    slot: 'armor',
    rarity: 'común',
    price: 42,
    icon: '🦸',
    accentColor: '#F8FAFC',
    secondaryColor: '#EF4444',
    visualShape: 'cape',
    description: 'Capa blanca impecable y traje amarillo de entrenamiento extremo.',
    roomVisualNote: 'Estela blanca limpia tras cada desplazamiento.',
  },
  {
    id: 'acc_armor_edward_coat',
    name: 'Abrigo Carmesí de Flamel',
    anime: 'Fullmetal Alchemist',
    slot: 'armor',
    rarity: 'épico',
    price: 72,
    icon: '⚗️',
    accentColor: '#B91C1C',
    secondaryColor: '#FDE047',
    visualShape: 'cape',
    description: 'Abrigo rojo de Edward Elric con la cruz de Flamel estampada en la espalda.',
    roomVisualNote: 'Manto rojo alquímico envolviendo el contorno.',
  },
  {
    id: 'acc_armor_shanks_coat',
    name: 'Abrigo de Capitán Pelirrojo',
    anime: 'One Piece',
    slot: 'armor',
    rarity: 'legendario',
    price: 95,
    icon: '🏴‍☠️',
    accentColor: '#0F172A',
    secondaryColor: '#F43F5E',
    visualShape: 'vest',
    description: 'Capa de los Cuatro Emperadores llevada sobre los hombros con Haki del Rey.',
    roomVisualNote: 'Capa imperial oscura con chispas rojas.',
  },

  // ================= RING / SELLO (8) =================
  {
    id: 'acc_ring_akatsuki_seal',
    name: 'Anillo Escarlata de Itachi',
    anime: 'Naruto',
    slot: 'ring',
    rarity: 'épico',
    price: 68,
    icon: '💍',
    accentColor: '#EF4444',
    secondaryColor: '#FCA5A5',
    visualShape: 'aura_ring',
    description: 'Anillo con el kanji Bermellón usado por los miembros de Akatsuki.',
    roomVisualNote: 'Anillo orbital escarlata girando en torno al personaje.',
  },
  {
    id: 'acc_ring_shadow_monarch',
    name: 'Sello del Monarca de las Sombras',
    anime: 'Solo Leveling',
    slot: 'ring',
    rarity: 'legendario',
    price: 98,
    icon: '🖤',
    accentColor: '#8B5CF6',
    secondaryColor: '#38BDF8',
    visualShape: 'orb_orbit',
    description: 'Anillo de Sung Jin-Woo que resuena con el ejército de sombras.',
    roomVisualNote: 'Orbe violeta oscuro orbitando tu miniatura.',
  },
  {
    id: 'acc_ring_hunter_badge',
    name: 'Anillo Licencia de Cazador',
    anime: 'Hunter x Hunter',
    slot: 'ring',
    rarity: 'común',
    price: 36,
    icon: '🪪',
    accentColor: '#38BDF8',
    secondaryColor: '#FACC15',
    visualShape: 'aura_ring',
    description: 'Sello de acero reservado para quienes superaron el Examen del Cazador.',
    roomVisualNote: 'Aro celeste giratorio alrededor del guerrero.',
  },
  {
    id: 'acc_ring_sukuna_curse',
    name: 'Sello del Relicario Maldito',
    anime: 'Jujutsu Kaisen',
    slot: 'ring',
    rarity: 'épico',
    price: 75,
    icon: '🩸',
    accentColor: '#DC2626',
    secondaryColor: '#A855F7',
    visualShape: 'aura_ring',
    description: 'Tatuaje anular de energía maldita concentrada del Rey de las Maldiciones.',
    roomVisualNote: 'Aro de runas oscuras y carmesí en órbita.',
  },
  {
    id: 'acc_ring_alchemist_watch',
    name: 'Reloj de Alquimista Estatal',
    anime: 'Fullmetal Alchemist',
    slot: 'ring',
    rarity: 'raro',
    price: 54,
    icon: '⌚',
    accentColor: '#CBD5E1',
    secondaryColor: '#38BDF8',
    visualShape: 'orb_orbit',
    description: 'Emblema de plata de la milicia de Amestris grabado con la fecha del juramento.',
    roomVisualNote: 'Relicario plateado orbitando suave al guerrero.',
  },
  {
    id: 'acc_ring_shinigami_badge',
    name: 'Insignia de Shinigami Sustituto',
    anime: 'Bleach',
    slot: 'ring',
    rarity: 'raro',
    price: 52,
    icon: '💀',
    accentColor: '#F97316',
    secondaryColor: '#F8FAFC',
    visualShape: 'aura_ring',
    description: 'Medallón espiritual de Karakura que condensa el Reiatsu del portador.',
    roomVisualNote: 'Aura espiritual naranja girando en órbita.',
  },
  {
    id: 'acc_ring_spirit_yusuke',
    name: 'Anillo de Energía Espiritual',
    anime: 'Yu Yu Hakusho',
    slot: 'ring',
    rarity: 'común',
    price: 40,
    icon: '🧿',
    accentColor: '#0EA5E9',
    secondaryColor: '#2DD4BF',
    visualShape: 'orb_orbit',
    description: 'Concentrador de Reigun usado por el Detective Espiritual Yusuke Urameshi.',
    roomVisualNote: 'Esfera turquesa de energía espiritual en órbita.',
  },
  {
    id: 'acc_ring_potara_z',
    name: 'Pendiente Sello Kaio-shin',
    anime: 'Dragon Ball',
    slot: 'ring',
    rarity: 'legendario',
    price: 90,
    icon: '✨',
    accentColor: '#FACC15',
    secondaryColor: '#22C55E',
    visualShape: 'orb_orbit',
    description: 'Reliquia dorada de los dioses de la creación que simboliza la unión de poder.',
    roomVisualNote: 'Destello dorado-esmeralda orbitando junto al sprite.',
  },

  // ================= AMULET / RELIQUIA (8) =================
  {
    id: 'acc_amulet_4star_ball',
    name: 'Esfera del Dragón de 4 Estrellas',
    anime: 'Dragon Ball',
    slot: 'amulet',
    rarity: 'legendario',
    price: 96,
    icon: '🟠',
    accentColor: '#F97316',
    secondaryColor: '#EF4444',
    visualShape: 'star_crest',
    description: 'El tesoro más querido de Goku, irradiando luz ámbar con cuatro estrellas.',
    roomVisualNote: 'Emblema esférico naranja brillante en tu pecho/halo.',
  },
  {
    id: 'acc_amulet_hanafuda',
    name: 'Pendiente Hanafuda del Sol',
    anime: 'Demon Slayer',
    slot: 'amulet',
    rarity: 'épico',
    price: 70,
    icon: '🌅',
    accentColor: '#F43F5E',
    secondaryColor: '#F8FAFC',
    visualShape: 'star_crest',
    description: 'Talismán solar heredado por los portadores de la Respiración del Sol.',
    roomVisualNote: 'Destello solar nacarado pulsando en sala.',
  },
  {
    id: 'acc_amulet_grimoire5',
    name: 'Grimorio del Trébol de 5 Hojas',
    anime: 'Black Clover',
    slot: 'amulet',
    rarity: 'épico',
    price: 76,
    icon: '📕',
    accentColor: '#EF4444',
    secondaryColor: '#1E293B',
    visualShape: 'star_crest',
    description: 'Tomo prohibido donde habita la antimagia carmesí de Asta.',
    roomVisualNote: 'Runa oscura y roja proyectada junto al personaje.',
  },
  {
    id: 'acc_amulet_allmight_emblem',
    name: 'Medalla Símbolo de la Paz',
    anime: 'My Hero Academia',
    slot: 'amulet',
    rarity: 'raro',
    price: 54,
    icon: '🏅',
    accentColor: '#3B82F6',
    secondaryColor: '#FACC15',
    visualShape: 'star_crest',
    description: 'Emblema dorado inspirado en el legado heroico de One For All.',
    roomVisualNote: 'Chispa azul-dorada estilo One For All.',
  },
  {
    id: 'acc_amulet_kurapika_chain',
    name: 'Cadena del Juicio de Kurapika',
    anime: 'Hunter x Hunter',
    slot: 'amulet',
    rarity: 'raro',
    price: 58,
    icon: '⛓️',
    accentColor: '#94A3B8',
    secondaryColor: '#EF4444',
    visualShape: 'star_crest',
    description: 'Eslabón de Nen materializado por el último superviviente del clan Kurta.',
    roomVisualNote: 'Brillo plateado con núcleo escarlata.',
  },
  {
    id: 'acc_amulet_kasaka_fang',
    name: 'Colgante Colmillo de Kasaka',
    anime: 'Solo Leveling',
    slot: 'amulet',
    rarity: 'común',
    price: 44,
    icon: '🗡️',
    accentColor: '#06B6D4',
    secondaryColor: '#A855F7',
    visualShape: 'star_crest',
    description: 'Reliquia de mazmorra forjada del primer jefe derrotado por Jin-Woo.',
    roomVisualNote: 'Destello cian-violeta en el aura de sala.',
  },
  {
    id: 'acc_amulet_mera_fruit',
    name: 'Talismán Mera Mera de Ace',
    anime: 'One Piece',
    slot: 'amulet',
    rarity: 'épico',
    price: 78,
    icon: '🔥',
    accentColor: '#FB923C',
    secondaryColor: '#EF4444',
    visualShape: 'star_crest',
    description: 'Fruta espiral ardiente en miniatura que honra la voluntad del Puño de Fuego.',
    roomVisualNote: 'Llama espiral cálida danzando junto al sprite.',
  },
  {
    id: 'acc_amulet_joestar_star',
    name: 'Estrella Dorada Joestar',
    anime: "JoJo's Bizarre Adv.",
    slot: 'amulet',
    rarity: 'común',
    price: 42,
    icon: '⭐',
    accentColor: '#C084FC',
    secondaryColor: '#FDE047',
    visualShape: 'star_crest',
    description: 'La icónica marca estelar del destino heredada de generación en generación.',
    roomVisualNote: 'Estrella dorada brillante sobre tu aura.',
  },
];

const ACCESSORY_BY_ID = new Map<string, AnimeAccessoryDef>(
  ANIME_ACCESSORIES.map((item) => [item.id, item])
);

export function getAccessoryById(id?: string | null): AnimeAccessoryDef | undefined {
  if (!id) return undefined;
  return ACCESSORY_BY_ID.get(id);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Deterministic daily rotation of EXACTLY 10 anime accessories keyed by local calendar date YYYY-MM-DD.
 * Balances across all 4 accessory slots so each day offers varied options.
 */
export function getDailyAccessoryShopRotation(
  dateKey: string = toShopLocalDateKey(new Date())
): {
  dateKey: string;
  items: AnimeAccessoryDef[];
} {
  const rng = seededRandom(hashSeed(`animefit_accessories_v1:${dateKey}`));
  const slots: AccessorySlot[] = ['helm', 'armor', 'ring', 'amulet'];
  const chosen: AnimeAccessoryDef[] = [];
  const chosenIds = new Set<string>();

  // Guarantee at least 2 accessories per slot (8 items) for clean variety
  for (const slot of slots) {
    const pool = shuffleWithRng(
      ANIME_ACCESSORIES.filter((a) => a.slot === slot),
      rng
    );
    for (const item of pool.slice(0, 2)) {
      chosen.push(item);
      chosenIds.add(item.id);
    }
  }

  // Fill remaining 2 items to reach exact 10 daily accessories
  const remainingPool = shuffleWithRng(
    ANIME_ACCESSORIES.filter((a) => !chosenIds.has(a.id)),
    rng
  );
  for (const item of remainingPool) {
    if (chosen.length >= ACCESSORY_DAILY_SHOP_SIZE) break;
    chosen.push(item);
    chosenIds.add(item.id);
  }

  return {
    dateKey,
    items: chosen.slice(0, ACCESSORY_DAILY_SHOP_SIZE),
  };
}

export function getUserAccessoryDailyPurchasesCount(
  user: Pick<UserProfile, 'accessoryShopDailyPurchases'>,
  dateKey: string = toShopLocalDateKey(new Date())
): number {
  const tracker = user.accessoryShopDailyPurchases;
  if (!tracker || tracker.dateKey !== dateKey) return 0;
  return Math.max(0, Math.floor(Number(tracker.itemsBought || 0)));
}

export function getOwnedAccessoryIds(
  user: Pick<UserProfile, 'ownedAccessories'>
): string[] {
  if (!Array.isArray(user.ownedAccessories)) return [];
  return Array.from(
    new Set(
      user.ownedAccessories
        .map(String)
        .filter((id) => ACCESSORY_BY_ID.has(id))
    )
  );
}

export function getEquippedAccessoriesList(
  equipped?: EquippedAccessories | null
): AnimeAccessoryDef[] {
  if (!equipped) return [];
  const ids = [
    equipped.helmId,
    equipped.armorId,
    equipped.ringId,
    equipped.amuletId,
  ];
  const out: AnimeAccessoryDef[] = [];
  for (const id of ids) {
    const def = getAccessoryById(id);
    if (def) out.push(def);
  }
  return out;
}

export function getAccessorySlotKey(
  slot: AccessorySlot
): keyof EquippedAccessories {
  switch (slot) {
    case 'helm':
      return 'helmId';
    case 'armor':
      return 'armorId';
    case 'ring':
      return 'ringId';
    case 'amulet':
      return 'amuletId';
  }
}
