import { CHARACTERS } from './characters.ts';
import type {
  CharacterDef,
  MoveSkillDef,
  PhaseMoveset,
  TrainingPvpBonus,
} from '../types/animefit.ts';

type CombatRole = 'striker' | 'swordsman' | 'blaster' | 'tank' | 'tactician';

interface CharacterMovesetSpec {
  styleLabel: string;
  elementTag: string;
  /**
   * Keyed by stage index (0 = base phase, 1 = second phase, ...).
   * If a specific phase index is not listed, falls back to nearest lower authored phase
   * or automatic role/anime generator so no phase ever renders empty text.
   */
  byPhaseIndex: Record<
    number,
    {
      physical: MoveSkillDef;
      special: MoveSkillDef;
      guard: MoveSkillDef;
      ultimate: MoveSkillDef;
    }
  >;
}

const SWORDSMAN_IDS = new Set([
  'trunks',
  'zoro',
  'tanjiro',
  'zenitsu',
  'inosuke',
  'giyu',
  'rengoku',
  'tengen',
  'muichiro',
  'mitsuri',
  'shinobu',
  'sanemi',
  'mikasa',
  'levi',
  'ichigo',
  'rukia',
  'renji',
  'byakuya',
  'toshiro',
  'kenpachi',
  'jinwoo',
  'aki',
  'asta',
  'yuno',
  'law',
  'shanks',
  'maki',
  'brook',
]);

const TANK_IDS = new Set([
  'broly',
  'gyomei',
  'allmight',
  'kirishima',
  'reiner',
  'jinbe',
  'chopper',
  'buu',
  'saitama',
  'tsunade',
  'todo',
  'garou',
]);

const TACTICIAN_IDS = new Set([
  'hit',
  'shikamaru',
  'itachi',
  'armin',
  'erwin',
  'aizen',
  'kurapika',
  'hisoka',
  'nanami',
  'robin',
  'nami',
  'usopp',
  'edward',
  'inumaki',
  'megumi',
]);

const BLASTER_IDS = new Set([
  'goku',
  'vegeta',
  'gohan',
  'piccolo',
  'freezer',
  'cell',
  'krilin',
  'tenshinhan',
  'roshi',
  'a17',
  'naruto',
  'sasuke',
  'kakashi',
  'gaara',
  'minato',
  'jiraiya',
  'madara',
  'obito',
  'ace',
  'franky',
  'gojo',
  'yuta',
  'sukuna',
  'bakugo',
  'todoroki',
  'endeavor',
  'uryu',
  'genos',
  'yusuke',
  'seiya',
]);

function inferCombatRole(char: CharacterDef): CombatRole {
  if (SWORDSMAN_IDS.has(char.id)) return 'swordsman';
  if (TANK_IDS.has(char.id)) return 'tank';
  if (TACTICIAN_IDS.has(char.id)) return 'tactician';
  if (BLASTER_IDS.has(char.id)) return 'blaster';
  if (char.icon === '⚔️' || char.icon === '🗡️') return 'swordsman';
  if (char.icon === '🛡️' || char.icon === '🪨') return 'tank';
  return 'striker';
}

interface AnimeFlavor {
  energy: string;
  styleLabel: string;
  elementTag: string;
}

function getAnimeFlavor(anime: string, role: CombatRole): AnimeFlavor {
  const roleSuffix =
    role === 'swordsman'
      ? 'Espadachín'
      : role === 'tank'
      ? 'Coloso'
      : role === 'tactician'
      ? 'Estratega'
      : role === 'blaster'
      ? 'Energía'
      : 'Cuerpo a Cuerpo';

  switch (anime) {
    case 'Dragon Ball':
      return {
        energy: 'Ki',
        styleLabel: `Artes Marciales · ${roleSuffix}`,
        elementTag: 'Ki',
      };
    case 'Naruto':
      return {
        energy: 'Chakra',
        styleLabel: `Shinobi · ${roleSuffix}`,
        elementTag: 'Chakra',
      };
    case 'One Piece':
      return {
        energy: 'Haki',
        styleLabel: `Pirata · ${roleSuffix}`,
        elementTag: 'Haki',
      };
    case 'Demon Slayer':
      return {
        energy: 'Respiración',
        styleLabel: `Cazador · ${roleSuffix}`,
        elementTag: 'Respiración',
      };
    case 'Jujutsu Kaisen':
      return {
        energy: 'Energía Maldita',
        styleLabel: `Hechicero · ${roleSuffix}`,
        elementTag: 'Maldición',
      };
    case 'My Hero Academia':
      return {
        energy: 'Don',
        styleLabel: `Héroe Pro · ${roleSuffix}`,
        elementTag: 'Don',
      };
    case 'Attack on Titan':
      return {
        energy: 'Acero y Titán',
        styleLabel: `Exploración · ${roleSuffix}`,
        elementTag: 'Titán',
      };
    case 'Bleach':
      return {
        energy: 'Reiatsu',
        styleLabel: `Shinigami · ${roleSuffix}`,
        elementTag: 'Reiatsu',
      };
    case 'Hunter x Hunter':
      return {
        energy: 'Nen',
        styleLabel: `Cazador Nen · ${roleSuffix}`,
        elementTag: 'Nen',
      };
    case 'Solo Leveling':
      return {
        energy: 'Sombras',
        styleLabel: `Monarca · ${roleSuffix}`,
        elementTag: 'Sombras',
      };
    default:
      return {
        energy: 'Espíritu',
        styleLabel: `Guerrero · ${roleSuffix}`,
        elementTag: 'Aura',
      };
  }
}

const CUSTOM_MOVESETS: Record<string, CharacterMovesetSpec> = {
  goku: {
    styleLabel: 'Artes Marciales Saiyajin',
    elementTag: 'Ki Solar',
    byPhaseIndex: {
      0: {
        physical: { name: 'Ráfaga de Puños', effect: 'Golpe físico ágil · +30% Ki' },
        special: { name: 'Kamehameha', effect: '40% Ki · Daño alto y rompe guardia' },
        guard: { name: 'Guardia Tortuga', effect: 'Bloqueo + contraataque · +8% HP' },
        ultimate: { name: 'Genkidama', effect: '100% Ki · Choque de Ki masivo' },
      },
      1: {
        physical: { name: 'Asalto Kaioken', effect: 'Golpe veloz carmesí · +30% Ki' },
        special: { name: 'Kamehameha Kaioken', effect: '40% Ki · Impacto sobrecargado' },
        guard: { name: 'Pulso Kaioken', effect: 'Defensa con aura · +8% HP' },
        ultimate: { name: 'Kaioken ×20', effect: '100% Ki · Choque explosivo' },
      },
      2: {
        physical: { name: 'Combo Super Saiyajin', effect: 'Golpes dorados · +30% Ki' },
        special: { name: 'Kamehameha Instantáneo', effect: '40% Ki · Daño crítico alto' },
        guard: { name: 'Aura Dorada Firme', effect: 'Bloqueo reforzado · +8% HP' },
        ultimate: { name: 'Super Kamehameha', effect: '100% Ki · Definitiva devastadora' },
      },
      5: {
        physical: { name: 'Impacto Divino', effect: 'Golpe con Ki divino · +30% Ki' },
        special: { name: 'Kamehameha Divino', effect: '40% Ki · Penetra defensa' },
        guard: { name: 'Barrera de Ki Dios', effect: 'Absorbe impacto · +8% HP' },
        ultimate: { name: 'Puño del Dragón Dios', effect: '100% Ki · Choque celestial' },
      },
      7: {
        physical: { name: 'Golpe Invisible', effect: 'Reflejo automático · +30% Ki' },
        special: { name: 'Kamehameha Instinto', effect: '40% Ki · Onda plateada' },
        guard: { name: 'Evasión Ultra Instinto', effect: 'Esquiva y recupera +8% HP' },
        ultimate: { name: 'Destello Plateado Supremo', effect: '100% Ki · Definitiva absoluta' },
      },
    },
  },
  vegeta: {
    styleLabel: 'Orgullo Saiyajin',
    elementTag: 'Ki Real',
    byPhaseIndex: {
      0: {
        physical: { name: 'Combo Real Saiyajin', effect: 'Ataque agresivo · +30% Ki' },
        special: { name: 'Cañón Galick', effect: '40% Ki · Rayo púrpura perforante' },
        guard: { name: 'Postura de Príncipe', effect: 'Bloqueo + contraataque · +8% HP' },
        ultimate: { name: 'Destello Final', effect: '100% Ki · Descarga total de Ki' },
      },
      2: {
        physical: { name: 'Golpe Majin Brutal', effect: 'Impacto implacable · +30% Ki' },
        special: { name: 'Anillos de Ki', effect: '40% Ki · Ataque de presión' },
        guard: { name: 'Orgullo Inquebrantable', effect: 'Resiste golpe · +8% HP' },
        ultimate: { name: 'Explosión Final', effect: '100% Ki · Choque total' },
      },
      4: {
        physical: { name: 'Ráfaga Blue', effect: 'Combo divino veloz · +30% Ki' },
        special: { name: 'Gamma Burst Flash', effect: '40% Ki · Daño expansivo' },
        guard: { name: 'Escudo Evolution', effect: 'Guardia de élite · +8% HP' },
        ultimate: { name: 'Final Flash Evolution', effect: '100% Ki · Máxima potencia' },
      },
      6: {
        physical: { name: 'Puño Destructor', effect: 'Golpe de destrucción · +30% Ki' },
        special: { name: 'Hakai Concentrado', effect: '40% Ki · Rompe defensas' },
        guard: { name: 'Llama del Ultra Ego', effect: 'Convierte dolor en +8% HP' },
        ultimate: { name: 'Juicio Ultra Ego', effect: '100% Ki · Choque destructor' },
      },
    },
  },
  gohan: {
    styleLabel: 'Potencial Oculto',
    elementTag: 'Ki Místico',
    byPhaseIndex: {
      0: {
        physical: { name: 'Golpe de Furia', effect: 'Ataque rápido · +30% Ki' },
        special: { name: 'Masenko', effect: '40% Ki · Ráfaga dorada' },
        guard: { name: 'Guardia Concentrada', effect: 'Bloqueo firme · +8% HP' },
        ultimate: { name: 'Kamehameha Padre-Hijo', effect: '100% Ki · Choque legendario' },
      },
      4: {
        physical: { name: 'Combo Místico', effect: 'Presión precisa · +30% Ki' },
        special: { name: 'Super Masenko', effect: '40% Ki · Impacto penetrante' },
        guard: { name: 'Temple Místico', effect: 'Bloqueo +8% HP · +20% Ki' },
        ultimate: { name: 'Makankosappo Beast', effect: '100% Ki · Perforación suprema' },
      },
    },
  },
  piccolo: {
    styleLabel: 'Guerrero Namekiano',
    elementTag: 'Ki Esmeralda',
    byPhaseIndex: {
      0: {
        physical: { name: 'Golpe Extensible', effect: 'Alcance táctico · +30% Ki' },
        special: { name: 'Makankosappo', effect: '40% Ki · Rayo espiral perforante' },
        guard: { name: 'Regeneración Namek', effect: 'Bloqueo + cura +8% HP' },
        ultimate: { name: 'Granada de Zona Infernal', effect: '100% Ki · Lluvia de Ki' },
      },
      4: {
        physical: { name: 'Puño Orange Colosal', effect: 'Impacto pesado · +30% Ki' },
        special: { name: 'Makankosappo Orange', effect: '40% Ki · Rompe defensas' },
        guard: { name: 'Coraza Orange', effect: 'Escudo regenerativo · +8% HP' },
        ultimate: { name: 'Explosión Namekiana Suprema', effect: '100% Ki · Definitiva' },
      },
    },
  },
  trunks: {
    styleLabel: 'Espadachín del Futuro',
    elementTag: 'Acero & Ki',
    byPhaseIndex: {
      0: {
        physical: { name: 'Tajo Relámpago', effect: 'Corte veloz · +30% Ki' },
        special: { name: 'Ataque Ardiente', effect: '40% Ki · Esfera de Ki veloz' },
        guard: { name: 'Parada con Espada', effect: 'Bloqueo metálico · +8% HP' },
        ultimate: { name: 'Espada de la Esperanza', effect: '100% Ki · Corte definitivo' },
      },
    },
  },
  freezer: {
    styleLabel: 'Emperador Galáctico',
    elementTag: 'Ki Frío',
    byPhaseIndex: {
      0: {
        physical: { name: 'Látigo de Cola', effect: 'Ataque punzante · +30% Ki' },
        special: { name: 'Rayo Mortal', effect: '40% Ki · Disparo perforante' },
        guard: { name: 'Barrera Telequinética', effect: 'Bloqueo psíquico · +8% HP' },
        ultimate: { name: 'Supernova Emperador', effect: '100% Ki · Estrella destructora' },
      },
      3: {
        physical: { name: 'Asalto Golden', effect: 'Combo implacable · +30% Ki' },
        special: { name: 'Rayo Mortal Dorado', effect: '40% Ki · Alta penetración' },
        guard: { name: 'Aura Áurea', effect: 'Defensa imperial · +8% HP' },
        ultimate: { name: 'Supernova Golden', effect: '100% Ki · Estallido dorado' },
      },
    },
  },
  broly: {
    styleLabel: 'Fuerza Legendaria',
    elementTag: 'Ki Salvaje',
    byPhaseIndex: {
      0: {
        physical: { name: 'Embestida Salvaje', effect: 'Golpe brutal · +30% Ki' },
        special: { name: 'Cañón Eraser', effect: '40% Ki · Esfera esmeralda' },
        guard: { name: 'Resistencia Colosal', effect: 'Absorbe impacto · +8% HP' },
        ultimate: { name: 'Gigantic Meteor', effect: '100% Ki · Explosión cataclísmica' },
      },
    },
  },
  naruto: {
    styleLabel: 'Ninjutsu de Konoha',
    elementTag: 'Chakra',
    byPhaseIndex: {
      0: {
        physical: { name: 'Combo de Clones', effect: 'Ataque múltiple · +30% Ki' },
        special: { name: 'Rasengan', effect: '40% Ki · Esfera espiral potente' },
        guard: { name: 'Sustitución Ninja', effect: 'Evade y recupera +8% HP' },
        ultimate: { name: 'Odama Rasengan', effect: '100% Ki · Choque de Chakra' },
      },
      3: {
        physical: { name: 'Kata de los Sapos', effect: 'Golpe invisible · +30% Ki' },
        special: { name: 'Rasenshuriken', effect: '40% Ki · Corte celular de viento' },
        guard: { name: 'Percepción Sabia', effect: 'Anticipa y sana +8% HP' },
        ultimate: { name: 'Arte Sabio: Super Rasenshuriken', effect: '100% Ki · Tormenta' },
      },
      5: {
        physical: { name: 'Garra de Kurama', effect: 'Embestida dorada · +30% Ki' },
        special: { name: 'Bomba Biju', effect: '40% Ki · Detonación masiva' },
        guard: { name: 'Manto de Kurama', effect: 'Escudo de Chakra · +8% HP' },
        ultimate: { name: 'Rasenshuriken Seis Caminos', effect: '100% Ki · Definitiva' },
      },
      7: {
        physical: { name: 'Impacto Baryon', effect: 'Golpe nuclear · +30% Ki' },
        special: { name: 'Rasengan Baryon', effect: '40% Ki · Drena guardia rival' },
        guard: { name: 'Aura Baryon', effect: 'Escudo ígneo · +8% HP' },
        ultimate: { name: 'Estallido Final Baryon', effect: '100% Ki · Máximo poder' },
      },
    },
  },
  sasuke: {
    styleLabel: 'Linaje Uchiha',
    elementTag: 'Rayo & Fuego',
    byPhaseIndex: {
      0: {
        physical: { name: 'Lluvia de Kunai y Taijutsu', effect: 'Ataque veloz · +30% Ki' },
        special: { name: 'Chidori', effect: '40% Ki · Lanza eléctrica perforante' },
        guard: { name: 'Lectura Sharingan', effect: 'Bloquea y contragolpea · +8% HP' },
        ultimate: { name: 'Kirin', effect: '100% Ki · Rayo celestial' },
      },
      3: {
        physical: { name: 'Espada Chidori', effect: 'Corte electrificado · +30% Ki' },
        special: { name: 'Amaterasu', effect: '40% Ki · Llamas negras' },
        guard: { name: 'Costilla de Susanoo', effect: 'Escudo violeta · +8% HP' },
        ultimate: { name: 'Flecha de Indra', effect: '100% Ki · Choque definitivo' },
      },
    },
  },
  rocklee: {
    styleLabel: 'Taijutsu Puro',
    elementTag: 'Puertas Internas',
    byPhaseIndex: {
      0: {
        physical: { name: 'Huracán de la Hoja', effect: 'Patada giratoria · +30% Ki' },
        special: { name: 'Loto Primario', effect: '40% Ki · Llave devastadora' },
        guard: { name: 'Postura Puño Fuerte', effect: 'Contraataque físico · +8% HP' },
        ultimate: { name: 'Loto Escondido', effect: '100% Ki · Asalto supersónico' },
      },
    },
  },
  guy: {
    styleLabel: 'Maestro de las 8 Puertas',
    elementTag: 'Vapor Carmesí',
    byPhaseIndex: {
      0: {
        physical: { name: 'Entrada Dinámica', effect: 'Patada frontal · +30% Ki' },
        special: { name: 'Pavo Real Matutino', effect: '40% Ki · Ráfaga ardiente' },
        guard: { name: 'Espíritu de Juventud', effect: 'Resistencia +8% HP · +20% Ki' },
        ultimate: { name: 'Polilla Nocturna (Guy Nocturno)', effect: '100% Ki · Impacto dragón' },
      },
    },
  },
  itachi: {
    styleLabel: 'Ilusión y Fuego Uchiha',
    elementTag: 'Genjutsu',
    byPhaseIndex: {
      0: {
        physical: { name: 'Danza de Cuervos', effect: 'Ataque preciso · +30% Ki' },
        special: { name: 'Tsukuyomi', effect: '40% Ki · Impacto mental directo' },
        guard: { name: 'Espejo de Yata', effect: 'Bloqueo absoluto · +8% HP' },
        ultimate: { name: 'Espada Totsuka del Susanoo', effect: '100% Ki · Sellado total' },
      },
    },
  },
  luffy: {
    styleLabel: 'Lucha Gomu Gomu & Haki',
    elementTag: 'Haki del Rey',
    byPhaseIndex: {
      0: {
        physical: { name: 'Gomu Gomu no Pistol', effect: 'Golpe elástico · +30% Ki' },
        special: { name: 'Gomu Gomu no Bazooka', effect: '40% Ki · Empuje de alto impacto' },
        guard: { name: 'Gomu Gomu no Balloon', effect: 'Rebota golpes · +8% HP' },
        ultimate: { name: 'Gomu Gomu no Gatling', effect: '100% Ki · Lluvia de puños' },
      },
      1: {
        physical: { name: 'Jet Pistol', effect: 'Golpe a velocidad vapor · +30% Ki' },
        special: { name: 'Red Hawk', effect: '40% Ki · Puño ardiente Haki' },
        guard: { name: 'Haki de Observación', effect: 'Esquiva y cura +8% HP' },
        ultimate: { name: 'Jet Gatling', effect: '100% Ki · Choque supersónico' },
      },
      3: {
        physical: { name: 'Kong Gun', effect: 'Impacto comprimido · +30% Ki' },
        special: { name: 'Rhino Schneider', effect: '40% Ki · Rompe defensas' },
        guard: { name: 'Armadura Boundman', effect: 'Rebote blindado · +8% HP' },
        ultimate: { name: 'King Kong Gun', effect: '100% Ki · Golpe destructor' },
      },
      6: {
        physical: { name: 'Puño Blanco Nika', effect: 'Golpe libre elástico · +30% Ki' },
        special: { name: 'Gomu Gomu no Kaminari', effect: '40% Ki · Rayo en mano' },
        guard: { name: 'Tambores de Liberación', effect: 'Recupera +8% HP y bloquea' },
        ultimate: { name: 'Bajrang Gun', effect: '100% Ki · Puño colosal del cielo' },
      },
    },
  },
  zoro: {
    styleLabel: 'Santoryu (Tres Espadas)',
    elementTag: 'Acero & Haki',
    byPhaseIndex: {
      0: {
        physical: { name: 'Oni Giri', effect: 'Corte cruzado · +30% Ki' },
        special: { name: 'Tatsumaki', effect: '40% Ki · Torbellino cortante' },
        guard: { name: 'Guardia Tres Filos', effect: 'Bloqueo + contraataque · +8% HP' },
        ultimate: { name: 'Asura: Nueve Espadas', effect: '100% Ki · Tajo demoníaco' },
      },
      3: {
        physical: { name: 'Tajo de Enma', effect: 'Corte con Haki negro · +30% Ki' },
        special: { name: 'Dragon Quake', effect: '40% Ki · Presión cortante' },
        guard: { name: 'Templanza del Rey', effect: 'Resiste golpe · +8% HP' },
        ultimate: { name: 'Rey del Infierno: Tres Mil Mundos', effect: '100% Ki · Definitiva' },
      },
    },
  },
  sanji: {
    styleLabel: 'Estilo Pierna Negra',
    elementTag: 'Fuego Azul',
    byPhaseIndex: {
      0: {
        physical: { name: 'Collier Shot', effect: 'Patada precisa · +30% Ki' },
        special: { name: 'Diable Jambe', effect: '40% Ki · Patada llameante' },
        guard: { name: 'Sky Walk Evasivo', effect: 'Agilidad aérea · +8% HP' },
        ultimate: { name: 'Boeuf Burst (Ifrit Jambe)', effect: '100% Ki · Ráfaga ígnea' },
      },
    },
  },
  tanjiro: {
    styleLabel: 'Espadachín de Respiración',
    elementTag: 'Agua / Sol',
    byPhaseIndex: {
      0: {
        physical: { name: '1ª Postura: Tajo de Agua', effect: 'Corte fluido · +30% Ki' },
        special: { name: '2ª Postura: Rueda de Agua', effect: '40% Ki · Giro cortante' },
        guard: { name: 'Flujo Constante', effect: 'Desvía golpes · +8% HP' },
        ultimate: { name: '10ª Postura: Dragón del Cambio', effect: '100% Ki · Tajo ascendente' },
      },
      2: {
        physical: { name: 'Vals Solar', effect: 'Corte ardiente · +30% Ki' },
        special: { name: 'Cielo Azul Claro', effect: '40% Ki · Arco de llamas' },
        guard: { name: 'Respiración Total', effect: 'Estabiliza ritmo · +8% HP' },
        ultimate: { name: 'Danza del Dios del Fuego (Hinokami)', effect: '100% Ki · Definitiva solar' },
      },
    },
  },
  zenitsu: {
    styleLabel: 'Respiración del Rayo',
    elementTag: 'Relámpago',
    byPhaseIndex: {
      0: {
        physical: { name: 'Corte Relámpago', effect: 'Estocada veloz · +30% Ki' },
        special: { name: '1ª Postura: Destello', effect: '40% Ki · Velocidad eléctrica' },
        guard: { name: 'Oído Agudo', effect: 'Anticipa peligro · +8% HP' },
        ultimate: { name: '7ª Postura: Dios del Trueno Llameante', effect: '100% Ki · Dragón eléctrico' },
      },
    },
  },
  rengoku: {
    styleLabel: 'Pilar de la Llama',
    elementTag: 'Fuego Noble',
    byPhaseIndex: {
      0: {
        physical: { name: '1ª Postura: Mar de Fuego', effect: 'Corte frontal · +30% Ki' },
        special: { name: '5ª Postura: Tigre de Fuego', effect: '40% Ki · Embate ardiente' },
        guard: { name: '4ª Postura: Ola de Llamas', effect: 'Muro protector · +8% HP' },
        ultimate: { name: '9ª Postura: Purgatorio', effect: '100% Ki · Corazón ardiente' },
      },
    },
  },
  gojo: {
    styleLabel: 'Seis Ojos e Infinito',
    elementTag: 'Vacío Azul',
    byPhaseIndex: {
      0: {
        physical: { name: 'Golpe Reforzado Azul', effect: 'Impacto por atracción · +30% Ki' },
        special: { name: 'Ritual Inverso: Rojo', effect: '40% Ki · Repulsión explosiva' },
        guard: { name: 'Barrera del Infinito', effect: 'Detiene ataques · +8% HP' },
        ultimate: { name: 'Vacío Púrpura', effect: '100% Ki · Masa imaginaria' },
      },
    },
  },
  yuji: {
    styleLabel: 'Combate Maldito Físico',
    elementTag: 'Destello Oscuro',
    byPhaseIndex: {
      0: {
        physical: { name: 'Puño Divergente', effect: 'Doble impacto · +30% Ki' },
        special: { name: 'Destello Oscuro (Black Flash)', effect: '40% Ki · Crítico oscuro' },
        guard: { name: 'Guardia de Acero', effect: 'Resistencia física · +8% HP' },
        ultimate: { name: 'Cadena de Black Flash', effect: '100% Ki · Ráfaga imparable' },
      },
    },
  },
  sukuna: {
    styleLabel: 'Rey de las Maldiciones',
    elementTag: 'Cortes & Fuego',
    byPhaseIndex: {
      0: {
        physical: { name: 'Corte Desmantelar', effect: 'Tajo invisible · +30% Ki' },
        special: { name: 'Hender (Cleave)', effect: '40% Ki · Se adapta a defensa' },
        guard: { name: 'Barrera Maldita', effect: 'Regenera +8% HP · +20% Ki' },
        ultimate: { name: 'Relicario Malévolo', effect: '100% Ki · Expansión de dominio' },
      },
    },
  },
  deku: {
    styleLabel: 'Sucesor One For All',
    elementTag: 'Relámpago Verde',
    byPhaseIndex: {
      0: {
        physical: { name: 'Delaware Smash', effect: 'Choque de aire · +30% Ki' },
        special: { name: 'Detroit Smash', effect: '40% Ki · Puño devastador' },
        guard: { name: 'Látigo Negro Defensivo', effect: 'Amarra y cura +8% HP' },
        ultimate: { name: 'United States of World Smash', effect: '100% Ki · 100% Overdrive' },
      },
    },
  },
  bakugo: {
    styleLabel: 'Explosión Táctica',
    elementTag: 'Nitroglicerina',
    byPhaseIndex: {
      0: {
        physical: { name: 'Detonación Directa', effect: 'Impacto rápido · +30% Ki' },
        special: { name: 'AP Shot', effect: '40% Ki · Perforación concentrada' },
        guard: { name: 'Stun Grenade', effect: 'Ciega y protege · +8% HP' },
        ultimate: { name: 'Howitzer Impact', effect: '100% Ki · Tornado explosivo' },
      },
    },
  },
  allmight: {
    styleLabel: 'Símbolo de la Paz',
    elementTag: 'Fuerza Pura',
    byPhaseIndex: {
      0: {
        physical: { name: 'Texas Smash', effect: 'Presión de aire · +30% Ki' },
        special: { name: 'Carolina Smash', effect: '40% Ki · Doble golpe cruzado' },
        guard: { name: 'Sonrisa Invencible', effect: 'Aguante heroico · +8% HP' },
        ultimate: { name: 'United States of Smash', effect: '100% Ki · Golpe definitivo' },
      },
    },
  },
  eren: {
    styleLabel: 'Portador de Titanes',
    elementTag: 'Furia Titán',
    byPhaseIndex: {
      0: {
        physical: { name: 'Corte con Cuchillas DMT', effect: 'Ataque rápido · +30% Ki' },
        special: { name: 'Puño Endurecido', effect: '40% Ki · Impacto cristalino' },
        guard: { name: 'Endurecimiento Cristal', effect: 'Coraza firme · +8% HP' },
        ultimate: { name: 'Retumbar del Titán Fundador', effect: '100% Ki · Choque colosal' },
      },
    },
  },
  levi: {
    styleLabel: 'Acero Ackerman',
    elementTag: 'Cuchillas DMT',
    byPhaseIndex: {
      0: {
        physical: { name: 'Corte Giratorio', effect: 'Tajo relámpago · +30% Ki' },
        special: { name: 'Lanza Relámpago', effect: '40% Ki · Detona armaduras' },
        guard: { name: 'Evasión Ackerman', effect: 'Desvío ágil · +8% HP' },
        ultimate: { name: 'Torbellino Soldado Más Fuerte', effect: '100% Ki · Lluvia de cortes' },
      },
    },
  },
  ichigo: {
    styleLabel: 'Shinigami & Hollow',
    elementTag: 'Reiatsu',
    byPhaseIndex: {
      0: {
        physical: { name: 'Tajo de Zangetsu', effect: 'Corte pesado · +30% Ki' },
        special: { name: 'Getsuga Tensho', effect: '40% Ki · Luna creciente de energía' },
        guard: { name: 'Blut Vene', effect: 'Endurecimiento espiritual · +8% HP' },
        ultimate: { name: 'Getsuga Tensho Negro', effect: '100% Ki · Descarga Bankai' },
      },
      4: {
        physical: { name: 'Corte Vasto Lorde', effect: 'Zarpazo espiritual · +30% Ki' },
        special: { name: 'Cero Oscuras', effect: '40% Ki · Rayo destructor' },
        guard: { name: 'Regeneración Hollow', effect: 'Recupera +8% HP · +20% Ki' },
        ultimate: { name: 'Mugetsu (Getsuga Final)', effect: '100% Ki · Oscuridad absoluta' },
      },
    },
  },
  jinwoo: {
    styleLabel: 'Monarca de las Sombras',
    elementTag: 'Maná Oscuro',
    byPhaseIndex: {
      0: {
        physical: { name: 'Corte con Dagas de Kasaka', effect: 'Combo letal · +30% Ki' },
        special: { name: 'Mutilación Vital', effect: '40% Ki · Daño crítico alto' },
        guard: { name: 'Intercambio de Sombras', effect: 'Evade y recupera +8% HP' },
        ultimate: { name: 'Dominio del Monarca (¡Arise!)', effect: '100% Ki · Ejército sombrío' },
      },
    },
  },
  saitama: {
    styleLabel: 'Limitador Roto',
    elementTag: 'Fuerza Absoluta',
    byPhaseIndex: {
      0: {
        physical: { name: 'Golpe Normal', effect: 'Puño simple · +30% Ki' },
        special: { name: 'Golpes Normales Consecutivos', effect: '40% Ki · Ráfaga brutal' },
        guard: { name: 'Cara Imperturbable', effect: 'Aguanta todo · +8% HP' },
        ultimate: { name: 'Golpe Serio', effect: '100% Ki · Onda expansiva total' },
      },
    },
  },
  gon: {
    styleLabel: 'Intensificador de Nen',
    elementTag: 'Nen',
    byPhaseIndex: {
      0: {
        physical: { name: 'Jajanken: Tijeras', effect: 'Corte Nen · +30% Ki' },
        special: { name: 'Jajanken: Papel', effect: '40% Ki · Esfera de emisión' },
        guard: { name: 'Ken Defensivo', effect: 'Envuelve el cuerpo · +8% HP' },
        ultimate: { name: 'Jajanken: Piedra', effect: '100% Ki · Puño máximo' },
      },
    },
  },
  killua: {
    styleLabel: 'Transmutador Eléctrico',
    elementTag: 'Rayo Nen',
    byPhaseIndex: {
      0: {
        physical: { name: 'Garras Asesinas', effect: 'Ataque veloz · +30% Ki' },
        special: { name: 'Palma Eléctrica', effect: '40% Ki · Descarga directa' },
        guard: { name: 'Paso Eco', effect: 'Ilusión evasiva · +8% HP' },
        ultimate: { name: 'Kanmuru: Velocidad Divina', effect: '100% Ki · Relámpago letal' },
      },
    },
  },
  asta: {
    styleLabel: 'Caballero Antimagia',
    elementTag: 'Antimagia',
    byPhaseIndex: {
      0: {
        physical: { name: 'Tajo Danma', effect: 'Espadazo pesado · +30% Ki' },
        special: { name: 'Corte Negro (Black Slash)', effect: '40% Ki · Anula defensas' },
        guard: { name: 'Bloqueo Antimagia', effect: 'Desvía energía · +8% HP' },
        ultimate: { name: 'Devil Union: Zetten', effect: '100% Ki · Tajo definitivo' },
      },
    },
  },
  jotaro: {
    styleLabel: 'Usuario de Stand',
    elementTag: 'Star Platinum',
    byPhaseIndex: {
      0: {
        physical: { name: '¡ORA! Certero', effect: 'Puño ultrarrápido · +30% Ki' },
        special: { name: 'Star Finger', effect: '40% Ki · Estocada perforante' },
        guard: { name: 'Bloqueo Stand', effect: 'Star Platinum defiende · +8% HP' },
        ultimate: { name: 'Star Platinum: The World (ORA ORA)', effect: '100% Ki · Ráfaga temporal' },
      },
    },
  },
};

function buildAutomaticStageMoveset(
  char: CharacterDef,
  stageIndex: number,
  stageName: string
): PhaseMoveset {
  const role = inferCombatRole(char);
  const flavor = getAnimeFlavor(char.anime, role);
  const tierLabel =
    stageIndex === 0
      ? 'Base'
      : stageIndex === char.stages.length - 1
      ? 'Supremo'
      : 'Despertado';
  const shortStage = stageName.split('(')[0].trim();

  if (role === 'swordsman') {
    return {
      stageName,
      styleLabel: flavor.styleLabel,
      elementTag: flavor.elementTag,
      accentColor: char.auraColor || '#38BDF8',
      physical: {
        name: stageIndex === 0 ? 'Tajo Rápido' : `Tajo ${tierLabel}`,
        effect: `Corte ágil con ${flavor.energy} · +30% Ki`,
      },
      special: {
        name: `Estocada ${flavor.elementTag}`,
        effect: `40% Ki · Corte penetrante (${shortStage})`,
      },
      guard: {
        name: 'Parada con Hoja',
        effect: 'Desvía golpes + contraataque · +8% HP',
      },
      ultimate: {
        name: `Corte Definitivo: ${shortStage}`,
        effect: `100% Ki · Tajo maestro en Choque de Ki`,
      },
      isFallback: true,
    };
  }

  if (role === 'tank') {
    return {
      stageName,
      styleLabel: flavor.styleLabel,
      elementTag: flavor.elementTag,
      accentColor: char.auraColor || '#F59E0B',
      physical: {
        name: stageIndex === 0 ? 'Golpe Titánico' : `Embestida ${tierLabel}`,
        effect: 'Impacto físico pesado · +30% Ki',
      },
      special: {
        name: `Choque Sísmico ${flavor.elementTag}`,
        effect: `40% Ki · Quebranta guardia rival`,
      },
      guard: {
        name: 'Muralla Inquebrantable',
        effect: 'Blindaje máximo + recupera +8% HP',
      },
      ultimate: {
        name: `Cataclismo de ${char.name.split(' ')[0]}`,
        effect: `100% Ki · Impacto demoledor (${shortStage})`,
      },
      isFallback: true,
    };
  }

  if (role === 'tactician') {
    return {
      stageName,
      styleLabel: flavor.styleLabel,
      elementTag: flavor.elementTag,
      accentColor: char.auraColor || '#A855F7',
      physical: {
        name: stageIndex === 0 ? 'Golpe Preciso' : `Asalto Táctico ${tierLabel}`,
        effect: `Ataque calculado · +30% Ki`,
      },
      special: {
        name: `Sello ${flavor.elementTag}`,
        effect: `40% Ki · Daño técnico perforante`,
      },
      guard: {
        name: 'Lectura Estratégica',
        effect: 'Anticipa al rival · +8% HP · +20% Ki',
      },
      ultimate: {
        name: `Jaque Mate: ${shortStage}`,
        effect: `100% Ki · Técnica maestra en Choque`,
      },
      isFallback: true,
    };
  }

  if (role === 'blaster') {
    return {
      stageName,
      styleLabel: flavor.styleLabel,
      elementTag: flavor.elementTag,
      accentColor: char.auraColor || '#FACC15',
      physical: {
        name: stageIndex === 0 ? `Golpe de ${flavor.energy}` : `Combo ${tierLabel}`,
        effect: `Ráfaga cercana · +30% Ki`,
      },
      special: {
        name: `Descarga de ${flavor.energy}`,
        effect: `40% Ki · Proyectil de alta potencia`,
      },
      guard: {
        name: `Barrera de ${flavor.energy}`,
        effect: 'Escudo energético · +8% HP · +20% Ki',
      },
      ultimate: {
        name: `Supernova ${shortStage}`,
        effect: `100% Ki · Descarga máxima de ${flavor.energy}`,
      },
      isFallback: true,
    };
  }

  // striker fallback
  return {
    stageName,
    styleLabel: flavor.styleLabel,
    elementTag: flavor.elementTag,
    accentColor: char.auraColor || '#38BDF8',
    physical: {
      name: stageIndex === 0 ? 'Combo Marcial' : `Ráfaga ${tierLabel}`,
      effect: 'Golpes consecutivos · +30% Ki',
    },
    special: {
      name: `Impacto ${flavor.elementTag}`,
      effect: `40% Ki · Golpe cargado de ${flavor.energy}`,
    },
    guard: {
      name: 'Guardia de Combate',
      effect: 'Bloqueo + contraataque · +8% HP',
    },
    ultimate: {
      name: `Golpe Supremo: ${shortStage}`,
      effect: `100% Ki · Choque de Ki definitivo`,
    },
    isFallback: true,
  };
}

export function getCharacterPhaseMoveset(
  charId: string,
  level: number,
  stageNameOverride?: string
): PhaseMoveset {
  const found = CHARACTERS.find((c) => c.id === charId);
  if (!found) {
    const cleanStage = stageNameOverride?.trim() || 'Guerrero Base';
    const genericChar: CharacterDef = {
      id: charId || 'guerrero',
      name: cleanStage,
      anime: 'Shonen',
      auraColor: '#38BDF8',
      icon: '⚡',
      gender: 'M',
      stages: [{ levelReq: 1, phase: cleanStage }],
    };
    return buildAutomaticStageMoveset(genericChar, 0, cleanStage);
  }
  const char = found;
  let stageIdx = 0;
  let stageName = char.stages[0]?.phase || 'Guerrero Base';

  for (let i = 0; i < char.stages.length; i++) {
    if (level >= char.stages[i].levelReq) {
      stageIdx = i;
      stageName = char.stages[i].phase;
    }
  }

  if (stageNameOverride && stageNameOverride.trim()) {
    const matchedIdx = char.stages.findIndex(
      (s) => s.phase.toLowerCase() === stageNameOverride.trim().toLowerCase()
    );
    if (matchedIdx >= 0) {
      stageIdx = matchedIdx;
      stageName = char.stages[matchedIdx].phase;
    } else {
      stageName = stageNameOverride.trim();
    }
  }

  const custom = CUSTOM_MOVESETS[char.id];
  if (custom) {
    // Pick exact authored phase or nearest lower authored phase for smooth progression
    let chosen = custom.byPhaseIndex[stageIdx];
    if (!chosen) {
      const authoredIndices = Object.keys(custom.byPhaseIndex)
        .map(Number)
        .filter((n) => !Number.isNaN(n) && n <= stageIdx)
        .sort((a, b) => b - a);
      if (authoredIndices.length > 0) {
        chosen = custom.byPhaseIndex[authoredIndices[0]];
      }
    }
    if (chosen) {
      return {
        stageName,
        styleLabel: custom.styleLabel,
        elementTag: custom.elementTag,
        accentColor: char.auraColor || '#FACC15',
        physical: chosen.physical,
        special: chosen.special,
        guard: chosen.guard,
        ultimate: chosen.ultimate,
        isFallback: false,
      };
    }
  }

  return buildAutomaticStageMoveset(char, stageIdx, stageName);
}

/**
 * Balanced training/streak bonus for PvP:
 * - Rewards consistency in workouts without breaking match fairness.
 * - Capped at +15% starting Aura Ki (50% max vs 35% base) and +12% Ultimate damage.
 */
export function computeTrainingPvpBonus(
  workoutsDone: number,
  historyDates: string[] = []
): TrainingPvpBonus {
  const safeWorkouts = Math.max(0, Math.round(Number(workoutsDone) || 0));

  // Compute active training streak (sessions separated by <= 3 days, most recent <= 4 days ago)
  const dayKeys = Array.from(
    new Set(
      (historyDates || [])
        .map((d) => {
          const ts = Date.parse(String(d || ''));
          if (!Number.isFinite(ts)) return null;
          const dt = new Date(ts);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
            2,
            '0'
          )}-${String(dt.getDate()).padStart(2, '0')}`;
        })
        .filter((k): k is string => Boolean(k))
    )
  ).sort((a, b) => (a > b ? -1 : 1));

  let streakCount = 0;
  if (dayKeys.length > 0) {
    const today = new Date();
    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    const parseMidnight = (k: string) => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    const latestMs = parseMidnight(dayKeys[0]);
    const daysSinceLatest = Math.floor((todayMidnight - latestMs) / 86400000);
    if (daysSinceLatest <= 4) {
      streakCount = 1;
      for (let i = 1; i < dayKeys.length; i++) {
        const prevMs = parseMidnight(dayKeys[i - 1]);
        const curMs = parseMidnight(dayKeys[i]);
        const gapDays = Math.round((prevMs - curMs) / 86400000);
        if (gapDays <= 3) {
          streakCount += 1;
        } else {
          break;
        }
      }
    }
  }

  if (streakCount >= 6 || safeWorkouts >= 25) {
    return {
      workoutsDone: safeWorkouts,
      streakCount: Math.max(streakCount, 6),
      bonusAura: 15,
      ultBoostPct: 12,
      badgeLabel:
        streakCount >= 6
          ? `Racha Élite x${streakCount}`
          : `${safeWorkouts} Entrenos Élite`,
    };
  }

  if (streakCount >= 3 || safeWorkouts >= 10) {
    return {
      workoutsDone: safeWorkouts,
      streakCount: Math.max(streakCount, 3),
      bonusAura: 10,
      ultBoostPct: 8,
      badgeLabel:
        streakCount >= 3
          ? `Racha Activa x${streakCount}`
          : `${safeWorkouts} Entrenos`,
    };
  }

  if (streakCount >= 1 || safeWorkouts >= 1) {
    return {
      workoutsDone: safeWorkouts,
      streakCount: Math.max(streakCount, 1),
      bonusAura: 5,
      ultBoostPct: 4,
      badgeLabel:
        streakCount >= 2
          ? `Racha x${streakCount}`
          : streakCount === 1
          ? 'Entreno Reciente'
          : `${safeWorkouts} Entreno${safeWorkouts > 1 ? 's' : ''}`,
    };
  }

  return {
    workoutsDone: 0,
    streakCount: 0,
    bonusAura: 0,
    ultBoostPct: 0,
    badgeLabel: null,
  };
}
