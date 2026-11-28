export type VictoryVoiceTone =
  | 'deep'
  | 'heroic'
  | 'energetic'
  | 'calm'
  | 'sharp'
  | 'feminine';

export interface VictoryVoiceProfile {
  pitch: number;
  rate: number;
  tone?: VictoryVoiceTone;
  audioClipUrl?: string;
}

export interface CharacterVictoryVoice {
  quotes: string[];
  voice: VictoryVoiceProfile;
}

const LAST_QUOTE_STORAGE_KEY = 'animefit_last_victory_quote_v1';
const memoryLastQuoteMap = new Map<string, number>();

const CHARACTER_VICTORY_CATALOG: Record<string, CharacterVictoryVoice> = {
  // DRAGON BALL (14)
  goku: {
    quotes: [
      '¡Te derroté! ¡Qué buen combate, sigamos superando nuestros límites!',
      '¡Aún te falta entrenamiento! Cuando quieras volvemos a pelear.',
      '¡Ese poder no bastó hoy! Entrena duro y dame la revancha.',
    ],
    voice: { pitch: 1.06, rate: 1.05, tone: 'energetic' },
  },
  vegeta: {
    quotes: [
      '¡Te derroté, insecto! Jamás subestimes al príncipe Saiyajin.',
      '¡Hmph! Aún te falta mucho entrenamiento para alcanzar mi nivel.',
      '¡La victoria pertenece únicamente al orgullo de la élite Saiyajin!',
    ],
    voice: { pitch: 0.84, rate: 1.02, tone: 'sharp' },
  },
  gohan: {
    quotes: [
      '¡Te derroté! Proteger a los demás siempre despierta mi verdadero poder.',
      '¡Buen combate, pero aún te falta pulir tu técnica!',
      '¡Superaste una gran prueba, aunque esta victoria es mía!',
    ],
    voice: { pitch: 1.02, rate: 1.03, tone: 'heroic' },
  },
  piccolo: {
    quotes: [
      'Te derroté. Concentra tu mente antes de volver a desafiarme.',
      'Aún te falta disciplina; dejaste demasiados espacios abiertos.',
      'Un guerrero Namekiano nunca desperdicia un movimiento. Buen intento.',
    ],
    voice: { pitch: 0.78, rate: 0.96, tone: 'deep' },
  },
  trunks: {
    quotes: [
      '¡Te derroté! No pienso vacilar ni un segundo en el campo de batalla.',
      'Aún te falta entrenamiento si quieres sobrevivir a combates reales.',
      '¡Por el futuro que juré proteger, esta pelea ya terminó!',
    ],
    voice: { pitch: 0.96, rate: 1.04, tone: 'heroic' },
  },
  freezer: {
    quotes: [
      '¡Jojojo! Te derroté con apenas una fracción de mi verdadero poder.',
      'Qué patético esfuerzo... aún te falta muchísimo para entretenerme.',
      'Aprende cuál es tu lugar frente al emperador del universo.',
    ],
    voice: { pitch: 1.08, rate: 0.96, tone: 'sharp' },
  },
  cell: {
    quotes: [
      'Te derroté. La perfección absoluta jamás puede ser igualada.',
      'Buen intento, pero tu poder sigue siendo inferior al mío.',
      'Aún te falta evolucionar si pretendes darme un combate digno.',
    ],
    voice: { pitch: 0.86, rate: 0.98, tone: 'calm' },
  },
  buu: {
    quotes: [
      '¡Jajaja! ¡Buu te derrotó! ¡Ahora quiero algo dulce!',
      '¡Eres fuerte, pero Buu es mucho más fuerte que tú!',
      '¡Buu ganó la pelea! ¡Vuelve cuando entrenes más!',
    ],
    voice: { pitch: 1.18, rate: 1.06, tone: 'energetic' },
  },
  broly: {
    quotes: [
      '¡Grrr! ¡Mi poder sigue creciendo... te derroté por completo!',
      '¡Nadie resiste el choque de mi furia desatada!',
      '¡Todavía no puedes detener este torrente de poder!',
    ],
    voice: { pitch: 0.74, rate: 0.98, tone: 'deep' },
  },
  krilin: {
    quotes: [
      '¡Lo logré, te derroté! Nunca subestimes a un guerrero de la Tierra.',
      '¡Uf, estuvo intenso! Aún te falta cuidar tu guardia ante un Kienzan.',
      '¡Eso demuestra que entrenar todos los días sí vale la pena!',
    ],
    voice: { pitch: 1.08, rate: 1.05, tone: 'energetic' },
  },
  tenshinhan: {
    quotes: [
      'Te derroté. Cada hora de disciplina marcial marcó la diferencia.',
      'Aún te falta controlar tu Ki frente a un Kikoho bien plantado.',
      'Buen intercambio, pero mis tres ojos leyeron tu guardia.',
    ],
    voice: { pitch: 0.88, rate: 0.98, tone: 'calm' },
  },
  roshi: {
    quotes: [
      '¡Te derroté, jovencito! La escuela Tortuga sigue invicta.',
      '¡Jojo! Aún te falta mucho entrenamiento, vuelve a entrenar más duro.',
      'La experiencia y la calma siempre vencen a la fuerza bruta.',
    ],
    voice: { pitch: 0.86, rate: 0.94, tone: 'calm' },
  },
  a17: {
    quotes: [
      'Te derroté. Cuando tienes energía ilimitada, el desgaste juega a mi favor.',
      'No estuvo mal, pero aún te falta resistencia para seguir mi ritmo.',
      'Misión cumplida. Ahora vuelve a entrenar si quieres revancha.',
    ],
    voice: { pitch: 0.95, rate: 1.0, tone: 'calm' },
  },
  hit: {
    quotes: [
      'Te derroté en una décima de segundo. El Salto Temporal no perdona.',
      'Aún te falta anticipación; ya había golpeado antes de que parpadearas.',
      'Contrato cerrado. Entrena tus reflejos para la próxima vez.',
    ],
    voice: { pitch: 0.78, rate: 0.93, tone: 'deep' },
  },

  // NARUTO (15)
  naruto: {
    quotes: [
      '¡Te derroté, dattebayo! ¡Nunca retrocedo a mi palabra ninja!',
      '¡Aún te falta entrenamiento, pero diste una gran pelea!',
      '¡Este es el poder de quien nunca se rinde! ¡Nos vemos en la revancha!',
    ],
    voice: { pitch: 1.12, rate: 1.08, tone: 'energetic' },
  },
  sasuke: {
    quotes: [
      'Te derroté. Todavía estás muy lejos de mi nivel.',
      'Ese chakra no es suficiente para detenerme. Entrena más.',
      'Tu ritmo fue predecible frente a mis ojos desde el inicio.',
    ],
    voice: { pitch: 0.88, rate: 0.98, tone: 'sharp' },
  },
  sakura: {
    quotes: [
      '¡Te derroté! ¡Shannaro! ¡Ni un paso atrás!',
      '¡Aún te falta control y fuerza para resistir un impacto directo!',
      '¡Todo mi entrenamiento por fin dio frutos en la arena!',
    ],
    voice: { pitch: 1.24, rate: 1.05, tone: 'feminine' },
  },
  kakashi: {
    quotes: [
      'Te derroté. Leí tus movimientos mil pasos antes de que atacaras.',
      'No estuvo mal, pero aún te falta entrenamiento para sorprenderme.',
      'Hora de guardar mi libro... el duelo ya terminó.',
    ],
    voice: { pitch: 0.88, rate: 0.96, tone: 'calm' },
  },
  rocklee: {
    quotes: [
      '¡Te derroté con el fuego de la juventud! ¡Mil flexiones más ahora!',
      '¡Tu esfuerzo fue admirable, pero mi taijutsu ardió más fuerte!',
      '¡Aún te falta entrenamiento físico! ¡La constancia lo vence todo!',
    ],
    voice: { pitch: 1.06, rate: 1.08, tone: 'energetic' },
  },
  guy: {
    quotes: [
      '¡Te derroté! ¡Las llamas de la juventud brillaron al máximo!',
      '¡Soberbio duelo! ¡Entrena diez veces más y volvamos a chocar!',
      '¡La bestia verde de Konoha jamás retrocede!',
    ],
    voice: { pitch: 0.88, rate: 1.06, tone: 'heroic' },
  },
  gaara: {
    quotes: [
      'Te derroté. Mi escudo de arena protegió cada ángulo del combate.',
      'Aún te falta firmeza; la furia sin control se desmorona como arena.',
      'El vínculo con quienes protejo me vuelve inquebrantable.',
    ],
    voice: { pitch: 0.85, rate: 0.94, tone: 'calm' },
  },
  itachi: {
    quotes: [
      'Te derroté. Caíste en mi ritmo desde el primer instante.',
      'Toda técnica tiene un punto débil; aún te falta verlo con claridad.',
      'Este combate ya estaba decidido antes de comenzar.',
    ],
    voice: { pitch: 0.82, rate: 0.93, tone: 'calm' },
  },
  minato: {
    quotes: [
      'Te derroté en un abrir y cerrar de ojos. La velocidad decide el duelo.',
      'Buena estrategia, aunque aún te falta anticipar el Destello Amarillo.',
      'Gran combate. Sigue puliendo tus reflejos para la próxima.',
    ],
    voice: { pitch: 0.96, rate: 1.02, tone: 'heroic' },
  },
  jiraiya: {
    quotes: [
      '¡Te derroté! ¡El gran Sabio de los Sapos sigue en forma!',
      '¡Buen espíritu, pero aún te falta dominio del Modo Sabio!',
      'Esto da para un gran capítulo nuevo. ¡Sigue entrenando duro!',
    ],
    voice: { pitch: 0.86, rate: 1.0, tone: 'heroic' },
  },
  tsunade: {
    quotes: [
      '¡Te derroté de un solo impacto! ¡Nunca subestimes a una Sannin!',
      'Aún te falta aguante físico si pretendes frenar mi puño.',
      '¡Bien peleado! Ahora descansa, hidrátate y vuelve más fuerte.',
    ],
    voice: { pitch: 1.14, rate: 1.0, tone: 'feminine' },
  },
  shikamaru: {
    quotes: [
      'Qué fastidio... pero te derroté tal como lo calculé hace cinco turnos.',
      'Aún te falta leer la estrategia detrás de cada sombra.',
      'Jaque mate. Buen combate, aunque fue bastante agotador.',
    ],
    voice: { pitch: 0.9, rate: 0.95, tone: 'calm' },
  },
  neji: {
    quotes: [
      'Te derroté. Mis ojos vieron cada punto de chakra en tu guardia.',
      'Aún te falta precisión para atravesar la Rotación Celestial.',
      'El destino de este combate se decidió con entrenamiento puro.',
    ],
    voice: { pitch: 0.94, rate: 0.98, tone: 'sharp' },
  },
  madara: {
    quotes: [
      'Te derroté. ¿Eso es todo el poder que puedes mostrarme?',
      'Aún te falta mucho para hacerme bailar en serio en el combate.',
      'Nadie que subestime el poder absoluto sale en pie.',
    ],
    voice: { pitch: 0.76, rate: 0.94, tone: 'deep' },
  },
  obito: {
    quotes: [
      'Te derroté. Tus golpes atravesaron el vacío sin tocarme.',
      'Aún te falta velocidad para superar mi Kamui en la arena.',
      'Este combate termina aquí; vuelve cuando tu determinación crezca.',
    ],
    voice: { pitch: 0.84, rate: 0.97, tone: 'deep' },
  },

  // ONE PIECE (13)
  luffy: {
    quotes: [
      '¡Te derroté! ¡Shishishi! ¡Estuvo genial esa pelea!',
      '¡Aún te falta entrenamiento para frenar al futuro Rey de los Piratas!',
      '¡Siempre peleo con todo lo que tengo! ¡Vamos por carne ahora!',
    ],
    voice: { pitch: 1.14, rate: 1.08, tone: 'energetic' },
  },
  zoro: {
    quotes: [
      'Te derroté. Mis espadas no dudaron ni un segundo.',
      'Aún te falta acero y temple para hacerme retroceder.',
      'El camino al mejor espadachín del mundo no permite derrotas.',
    ],
    voice: { pitch: 0.8, rate: 0.95, tone: 'deep' },
  },
  sanji: {
    quotes: [
      'Te derroté. Mis patadas arden más que cualquier cocina.',
      'Aún te falta equilibrio si quieres resistir el Diable Jambe.',
      'Buen intento, pero el combate ya está servido.',
    ],
    voice: { pitch: 0.94, rate: 1.02, tone: 'sharp' },
  },
  nami: {
    quotes: [
      '¡Te derroté! ¡Nadie controla la tormenta y las finanzas mejor que yo!',
      '¡Aún te falta prever los cambios de clima en el campo de batalla!',
      '¡Victoria limpia! Y ni se te ocurra deberme una revancha.',
    ],
    voice: { pitch: 1.24, rate: 1.05, tone: 'feminine' },
  },
  usopp: {
    quotes: [
      '¡Te derroté! ¡El gran Capitán Usopp nunca falla un disparo decisivo!',
      '¡Aún te falta entrenar puntería y reflejos frente a Sogeking!',
      '¡Mi ejército de ocho mil guerreros celebra esta victoria!',
    ],
    voice: { pitch: 1.08, rate: 1.07, tone: 'energetic' },
  },
  chopper: {
    quotes: [
      '¡Te derroté! ¡No me halagues por ganar, tonto! ¡Jijiji!',
      '¡Aunque sea médico, mi Rumble Ball pega muy fuerte!',
      '¡Estuviste genial! Pero aún te falta entrenar más para ganarme.',
    ],
    voice: { pitch: 1.28, rate: 1.08, tone: 'energetic' },
  },
  robin: {
    quotes: [
      'Te derroté. Cuando florecen cien manos a tu alrededor, no hay escape.',
      'Aún te falta cuidar tu retaguardia; fue un combate interesante.',
      'Qué victoria tan serena. Sigamos avanzando hacia el próximo objetivo.',
    ],
    voice: { pitch: 1.16, rate: 0.95, tone: 'feminine' },
  },
  franky: {
    quotes: [
      '¡SÚPER! ¡Te derroté a pura potencia ciborg y hierro bien entrenado!',
      '¡Aún te falta blindaje para aguantar un Radical Beam directo!',
      '¡Esta semana mi motor funcionó al ciento por ciento! ¡Ow!',
    ],
    voice: { pitch: 0.82, rate: 1.03, tone: 'deep' },
  },
  brook: {
    quotes: [
      '¡Yohohoho! ¡Te derroté con un corte tan rápido que heló hasta mis huesos!',
      '¡Aún te falta ritmo para seguir mi melodía de batalla! ¡Aunque no tengo oídos!',
      '¡Un duelo brillante como la música del Soul King!',
    ],
    voice: { pitch: 1.04, rate: 1.04, tone: 'sharp' },
  },
  jinbe: {
    quotes: [
      'Te derroté. El Karate Gyojin golpea incluso a través de tu defensa.',
      'Aún te falta calma en medio de la marea del combate.',
      'Honorable combate. Sigue fortaleciendo tu cuerpo y tu espíritu.',
    ],
    voice: { pitch: 0.76, rate: 0.94, tone: 'deep' },
  },
  law: {
    quotes: [
      'Te derroté. Dentro de mi ROOM yo decido cada intercambio.',
      'Aún te falta resistencia para sobrevivir a un Gamma Knife.',
      'Operación terminada. Vuelve a entrenar si quieres otra consulta.',
    ],
    voice: { pitch: 0.86, rate: 0.97, tone: 'calm' },
  },
  ace: {
    quotes: [
      '¡Te derroté! ¡Estas llamas jamás se apagan en medio del duelo!',
      '¡Estuvo cerca, pero aún te falta superar mi fuego!',
      '¡Gracias por el combate! Sigue haciéndote más fuerte.',
    ],
    voice: { pitch: 0.94, rate: 1.03, tone: 'heroic' },
  },
  shanks: {
    quotes: [
      'Te derroté. La verdadera fuerza nace de mantener la calma.',
      'Tienes potencial, pero aún te falta dominar tu Haki por completo.',
      'Gran duelo. Nos veremos cuando estés listo para otro choque.',
    ],
    voice: { pitch: 0.84, rate: 0.96, tone: 'calm' },
  },

  // DEMON SLAYER (12)
  tanjiro: {
    quotes: [
      '¡Te derroté! Cada respiración y cada esfuerzo de entrenamiento contó.',
      '¡Respeto tu espíritu, pero hoy mi postura fue más firme!',
      '¡Aún te falta entrenamiento, sigamos esforzándonos sin rendirnos!',
    ],
    voice: { pitch: 1.05, rate: 1.02, tone: 'heroic' },
  },
  nezuko: {
    quotes: [
      '¡Mmmh! ¡Te derroté protegiendo a los míos con toda mi fuerza!',
      '¡Mis llamas demoníacas nunca se rinden en combate!',
      '¡Nadie podrá detener nuestra marcha hacia adelante!',
    ],
    voice: { pitch: 1.28, rate: 1.02, tone: 'feminine' },
  },
  zenitsu: {
    quotes: [
      '¡¿Qué?! ¡¿Te derroté?! ¡El Destello del Relámpago sí funcionó!',
      '¡No puedo creer que haya ganado! ¡La velocidad del rayo es invencible!',
      '¡Aún te falta velocidad para seguirle el paso a mi única postura!',
    ],
    voice: { pitch: 1.18, rate: 1.1, tone: 'energetic' },
  },
  inosuke: {
    quotes: [
      '¡Jajaja! ¡El gran rey de la montaña te derrotó por completo!',
      '¡Aún te falta salvajismo para igualar mis colmillos!',
      '¡Nadie vence a Inosuke-sama! ¡Traigan al siguiente rival!',
    ],
    voice: { pitch: 0.96, rate: 1.08, tone: 'energetic' },
  },
  giyu: {
    quotes: [
      'Te derroté. La Undécima Postura acalla cualquier tormenta.',
      'Aún te falta fluidez en tu respiración. No bajes el ritmo.',
      'Combate terminado. Sigue entrenando en silencio.',
    ],
    voice: { pitch: 0.84, rate: 0.94, tone: 'calm' },
  },
  rengoku: {
    quotes: [
      '¡Te derroté! ¡Haz arder tu corazón y supera tus límites!',
      '¡Espléndido combate! ¡Aún te falta pulir esa llama interior!',
      '¡Mi espíritu jamás vacilará! ¡Umai!',
    ],
    voice: { pitch: 0.92, rate: 1.03, tone: 'heroic' },
  },
  tengen: {
    quotes: [
      '¡Te derroté de la forma más extravagante posible!',
      '¡Aún te falta brillo y ritmo en tu partitura de combate!',
      '¡Victoria deslumbrante! Así pelea el Pilar del Sonido.',
    ],
    voice: { pitch: 0.88, rate: 1.04, tone: 'heroic' },
  },
  muichiro: {
    quotes: [
      'Te derroté... ¿cómo se llamaba esa técnica que intentaste usar?',
      'Aún te falta claridad; te perdiste por completo en mi niebla.',
      'Todo terminó en un instante. Vuelve cuando entrenes más.',
    ],
    voice: { pitch: 1.08, rate: 0.96, tone: 'calm' },
  },
  mitsuri: {
    quotes: [
      '¡Kyaa! ¡Te derroté! ¡Qué combate tan emocionante tuvimos!',
      '¡Estuviste increíble, pero aún te falta aguantar mi fuerza total!',
      '¡Vamos a comer algo rico después de este gran entrenamiento!',
    ],
    voice: { pitch: 1.28, rate: 1.06, tone: 'feminine' },
  },
  shinobu: {
    quotes: [
      'Ara ara... te derroté antes de que notaras la estocada.',
      'Aún te falta rapidez para esquivar el aguijón del Pilar del Insecto.',
      'Qué combate tan interesante. Cuida tu guardia la próxima vez.',
    ],
    voice: { pitch: 1.24, rate: 0.98, tone: 'feminine' },
  },
  sanemi: {
    quotes: [
      '¡Te derroté! ¡Un vendaval de cortes no deja nada en pie!',
      '¡Aún te falta agallas y resistencia para frenarme!',
      '¡Levántate, entrena más duro y vuelve si te atreves!',
    ],
    voice: { pitch: 0.88, rate: 1.07, tone: 'sharp' },
  },
  gyomei: {
    quotes: [
      'Namu Amida Butsu... te derroté con la firmeza de la roca.',
      'Posees un espíritu noble, pero aún te falta temple para mover la montaña.',
      'Que este combate fortalezca tu cuerpo y tu voluntad.',
    ],
    voice: { pitch: 0.72, rate: 0.91, tone: 'deep' },
  },

  // JUJUTSU KAISEN (10)
  yuji: {
    quotes: [
      '¡Te derroté! ¡Ese Destello Oscuro entró justo a tiempo!',
      '¡No pienso perder ante nadie! ¡Aún te falta aguante!',
      '¡Buen combate! Cada entrenamiento pesado se nota en cada golpe.',
    ],
    voice: { pitch: 1.02, rate: 1.05, tone: 'energetic' },
  },
  megumi: {
    quotes: [
      'Te derroté. Mis sombras cercaron cada una de tus salidas.',
      'Aún te falta lectura táctica; te precipitaste al atacar.',
      'Bien peleado. Ahora sigamos con el entrenamiento.',
    ],
    voice: { pitch: 0.9, rate: 0.97, tone: 'calm' },
  },
  nobara: {
    quotes: [
      '¡Te derroté! ¡Un clavo directo y Resonancia sellaron este duelo!',
      '¡Aún te falta estilo y guardia para enfrentarte a mí!',
      '¡Victoria total! Ni se te ocurra subestimarme otra vez.',
    ],
    voice: { pitch: 1.22, rate: 1.05, tone: 'feminine' },
  },
  gojo: {
    quotes: [
      'Tranquilo, te derroté porque simplemente soy el más fuerte.',
      'Aún te falta entrenamiento para tocar siquiera mi Infinito.',
      'Buen intento, pero el resultado de este duelo ya estaba claro.',
    ],
    voice: { pitch: 0.96, rate: 1.03, tone: 'calm' },
  },
  yuta: {
    quotes: [
      'Te derroté. Proteger a quienes quiero me da fuerza infinita.',
      'Aún te falta controlar tu energía frente a Rika y a mí.',
      'Gracias por el duelo; me ayudó a pulir aún más mi técnica.',
    ],
    voice: { pitch: 0.98, rate: 0.99, tone: 'heroic' },
  },
  maki: {
    quotes: [
      'Te derroté sin necesidad de trucos: pura velocidad y acero.',
      'Aún te falta resistencia física para seguir mi ritmo en combate.',
      'La Restricción Celestial no perdona una guardia abierta.',
    ],
    voice: { pitch: 1.15, rate: 1.03, tone: 'feminine' },
  },
  nanami: {
    quotes: [
      'Te derroté en el punto exacto siete a tres. El turno terminó a tiempo.',
      'Aún te falta disciplina; odio hacer horas extra en la arena.',
      'Trabajo terminado. Revisa tus fundamentos y vuelve mañana.',
    ],
    voice: { pitch: 0.8, rate: 0.94, tone: 'deep' },
  },
  inumaki: {
    quotes: [
      'Salmón... ¡te derroté! Atún con mayonesa.',
      'Hojuelas de bonito... aún te falta bloquear el Discurso Maldito.',
      'Alga kelp. ¡Gran combate! A seguir entrenando.',
    ],
    voice: { pitch: 1.04, rate: 0.98, tone: 'calm' },
  },
  todo: {
    quotes: [
      '¡Te derroté, besto friendo! ¡Ese intercambio fue pura poesía!',
      '¡Con un intelecto de quinientos treinta mil, ya anticipé tu golpe!',
      '¡Vuelve más fuerte y choquemos puños otra vez!',
    ],
    voice: { pitch: 0.82, rate: 1.05, tone: 'deep' },
  },
  sukuna: {
    quotes: [
      'Te derroté. Conoce tu lugar ante el Rey de las Maldiciones.',
      'Patético. Aún te falta mucho para llegar a entretenerme.',
      'Frente a mi dominio, cualquier resistencia es inútil.',
    ],
    voice: { pitch: 0.72, rate: 0.93, tone: 'deep' },
  },

  // MY HERO ACADEMIA (9)
  deku: {
    quotes: [
      '¡Te derroté! ¡Plus Ultra! ¡Todo el entrenamiento valió la pena!',
      '¡Analicé cada movimiento y lo di todo al cien por ciento!',
      '¡Aún te falta pulir tu guardia, pero nos haremos más fuertes juntos!',
    ],
    voice: { pitch: 1.08, rate: 1.05, tone: 'heroic' },
  },
  bakugo: {
    quotes: [
      '¡Te derroté, extra! ¡Nadie supera mis explosiones en la arena!',
      '¡¿Eso es todo lo que tienes?! ¡Vuelve cuando entrenes de verdad!',
      '¡La victoria total siempre será mía, recuérdalo bien!',
    ],
    voice: { pitch: 0.95, rate: 1.1, tone: 'sharp' },
  },
  todoroki: {
    quotes: [
      'Te derroté. Combinar hielo y fuego decidió el ritmo de la pelea.',
      'Aún te falta adaptarte a cambios bruscos de temperatura y presión.',
      'Buen combate. Sigo usando mi propio poder para avanzar.',
    ],
    voice: { pitch: 0.9, rate: 0.96, tone: 'calm' },
  },
  allmight: {
    quotes: [
      '¡Te derroté! ¡No temas, porque la victoria ya está aquí!',
      '¡Excelente espíritu! ¡Sigue entrenando para ir Plus Ultra!',
      '¡Un verdadero héroe siempre rompe sus propios límites!',
    ],
    voice: { pitch: 0.8, rate: 1.0, tone: 'heroic' },
  },
  uraraka: {
    quotes: [
      '¡Te derroté! ¡Gravedad cero y trabajo duro siempre funcionan!',
      '¡Aún te falta equilibrio cuando pierdes el apoyo del suelo!',
      '¡Lo di todo en esta pelea! ¡Sigamos entrenando con ánimo!',
    ],
    voice: { pitch: 1.26, rate: 1.05, tone: 'feminine' },
  },
  iida: {
    quotes: [
      '¡Te derroté a máxima velocidad con mi Recipro Burst!',
      '¡Aún te falta disciplina y ritmo para seguir mi aceleración!',
      '¡Excelente combate! Como delegado, te felicito por tu esfuerzo.',
    ],
    voice: { pitch: 0.94, rate: 1.04, tone: 'sharp' },
  },
  kirishima: {
    quotes: [
      '¡Te derroté aguantando cada golpe de frente! ¡Eso es muy varonil!',
      '¡Aún te falta dureza para quebrar mi Red Riot Unbreakable!',
      '¡Gran choque de espíritu! ¡Volvamos a entrenar juntos pronto!',
    ],
    voice: { pitch: 0.96, rate: 1.05, tone: 'energetic' },
  },
  endeavor: {
    quotes: [
      'Te derroté. Solo las llamas más intensas sobreviven en la cima.',
      'Aún te falta potencia para soportar un Prominence Burn.',
      'No te conformes. Mira hacia adelante y supera tus récords.',
    ],
    voice: { pitch: 0.76, rate: 0.96, tone: 'deep' },
  },
  hawks: {
    quotes: [
      'Te derroté antes de que notaras cuántas plumas había en el aire.',
      'Aún te falta velocidad; prefiero terminar las peleas rápido y sin estrés.',
      'Buen intento. Nos vemos cuando quieras volar otro round.',
    ],
    voice: { pitch: 0.98, rate: 1.04, tone: 'calm' },
  },

  // ATTACK ON TITAN (8)
  eren: {
    quotes: [
      '¡Te derroté! Seguiré avanzando hasta destruir todo obstáculo.',
      'Quien no lucha con todo no puede ganar. Entrena más fuerte.',
      'No retrocederé ni un paso. La victoria es mía.',
    ],
    voice: { pitch: 0.92, rate: 1.03, tone: 'sharp' },
  },
  mikasa: {
    quotes: [
      'Te derroté. El combate terminó más rápido de lo que esperabas.',
      'Aún te falta precisión; no bajes la guardia nunca.',
      'Mientras tenga fuerzas para luchar, no pienso caer.',
    ],
    voice: { pitch: 1.16, rate: 0.98, tone: 'feminine' },
  },
  armin: {
    quotes: [
      'Te derroté. La estrategia siempre encuentra la grieta en la muralla.',
      'Aún te falta observar todo el tablero antes de lanzar tu ataque.',
      'Quien no puede sacrificar comodidad tampoco puede cambiar el resultado.',
    ],
    voice: { pitch: 1.06, rate: 1.0, tone: 'calm' },
  },
  levi: {
    quotes: [
      'Te derroté. Un movimiento limpio basta para acabar esto.',
      'Demasiados movimientos innecesarios. Aún te falta disciplina.',
      'No te arrepientas del combate; vuelve a entrenar y mejora.',
    ],
    voice: { pitch: 0.8, rate: 0.95, tone: 'deep' },
  },
  erwin: {
    quotes: [
      '¡Te derroté! ¡Entreguen sus corazones en cada entrenamiento!',
      'Aún te falta convicción para sostener la línea de vanguardia.',
      '¡Avanzamos hacia la victoria sin dudar un solo segundo!',
    ],
    voice: { pitch: 0.78, rate: 0.96, tone: 'deep' },
  },
  reiner: {
    quotes: [
      'Te derroté. Mi coraza resistió cada embate sin ceder terreno.',
      'Aún te falta fuerza de choque para atravesar al Titán Acorazado.',
      'Seguimos en pie como guerreros hasta el último aliento.',
    ],
    voice: { pitch: 0.8, rate: 0.95, tone: 'deep' },
  },
  annie: {
    quotes: [
      'Te derroté. Mi técnica marcial aprovecha tu propia fuerza en tu contra.',
      'Aún te falta equilibrio; te desequilibraste desde el segundo intercambio.',
      'Duelo terminado. No pierdas tiempo y mejora tu guardia.',
    ],
    voice: { pitch: 1.15, rate: 0.96, tone: 'feminine' },
  },
  historia: {
    quotes: [
      '¡Te derroté! Ya no vivo escondida: peleo con mi propia fuerza.',
      '¡Aún te falta determinación para frenar a la Reina de Paradis!',
      '¡Buen combate! Cada entrenamiento cuenta para protegernos.',
    ],
    voice: { pitch: 1.24, rate: 1.0, tone: 'feminine' },
  },

  // BLEACH (8)
  ichigo: {
    quotes: [
      '¡Te derroté! Mi Getsuga cortó tu ofensiva por la mitad.',
      '¡No estuvo nada mal, pero aún te falta filo para detenerme!',
      '¡Sigo entrenando para proteger a todos y ganar cada duelo!',
    ],
    voice: { pitch: 0.92, rate: 1.03, tone: 'heroic' },
  },
  rukia: {
    quotes: [
      'Te derroté. El frío absoluto de Sode no Shirayuki selló tu avance.',
      'Aún te falta templarte antes de cruzar espadas con un Shinigami.',
      'Danza blanca completada. Retoma tu entrenamiento con honor.',
    ],
    voice: { pitch: 1.18, rate: 0.99, tone: 'feminine' },
  },
  renji: {
    quotes: [
      '¡Te derroté! ¡Ruge, Zabimaru, que esta victoria es nuestra!',
      '¡Aún te falta aguante para frenar mi Bankai en la arena!',
      '¡Buena pelea! Cuando entrenes más, volvemos a medir fuerzas.',
    ],
    voice: { pitch: 0.9, rate: 1.05, tone: 'energetic' },
  },
  byakuya: {
    quotes: [
      'Te derroté. Dispersa tu orgullo como los pétalos de Senbonzakura.',
      'Aún te falta elegancia y precisión en cada movimiento.',
      'Un noble combate se define en calma. El resultado era inevitable.',
    ],
    voice: { pitch: 0.82, rate: 0.93, tone: 'calm' },
  },
  toshiro: {
    quotes: [
      'Te derroté. Los cielos helados de Hyorinmaru congelaron tu ofensiva.',
      'Aún te falta madurez táctica; no subestimes a un Capitán.',
      'Combate cerrado. Sigue entrenando tu presión espiritual.',
    ],
    voice: { pitch: 0.96, rate: 0.99, tone: 'sharp' },
  },
  kenpachi: {
    quotes: [
      '¡Jajaja! ¡Te derroté! ¡Qué bien se siente cortar sin contenerse!',
      '¡Aún te falta aguantar un tajo a dos manos! ¡Entrena y vuelve!',
      '¡No te mueras tan rápido, necesito peleas todavía más intensas!',
    ],
    voice: { pitch: 0.74, rate: 1.02, tone: 'deep' },
  },
  uryu: {
    quotes: [
      'Te derroté. Cada flecha espiritual dio en tu punto ciego.',
      'Aún te falta calcular distancias frente al orgullo Quincy.',
      'Duelo concluido con precisión quirúrgica.',
    ],
    voice: { pitch: 0.94, rate: 0.98, tone: 'calm' },
  },
  aizen: {
    quotes: [
      'Te derroté. ¿Desde cuándo creíste que tenías alguna oportunidad?',
      'Tu derrota formaba parte de mi plan desde el primer segundo.',
      'Aún te falta comprender la verdadera cima del poder.',
    ],
    voice: { pitch: 0.82, rate: 0.93, tone: 'calm' },
  },

  // HUNTER X HUNTER (6)
  gon: {
    quotes: [
      '¡Te derroté! ¡Mi Jajanken dio justo en el blanco!',
      '¡Estuvo súper divertido! ¡Entrena más y volvamos a pelear!',
      '¡Cuando pongo todo mi Nen en un golpe, nadie me detiene!',
    ],
    voice: { pitch: 1.12, rate: 1.06, tone: 'energetic' },
  },
  killua: {
    quotes: [
      'Te derroté antes de que pudieras reaccionar al relámpago.',
      'Buen intento, pero aún te falta velocidad para seguirme.',
      'Listo, trabajo terminado. Intenta sorprenderme la próxima vez.',
    ],
    voice: { pitch: 1.04, rate: 1.05, tone: 'sharp' },
  },
  kurapika: {
    quotes: [
      'Te derroté. Mis cadenas sellaron el combate bajo juramento.',
      'Aún te falta control emocional para enfrentar los Ojos Escarlata.',
      'La determinación absoluta nunca vacila en la batalla.',
    ],
    voice: { pitch: 1.02, rate: 0.98, tone: 'calm' },
  },
  leorio: {
    quotes: [
      '¡Te derroté! ¡Nunca subestimes el puño de un futuro doctor!',
      '¡Aún te falta cubrir la guardia frente a un ataque sorpresa!',
      '¡Gran pelea! Ahora asegúrate de recuperar energías como se debe.',
    ],
    voice: { pitch: 0.88, rate: 1.03, tone: 'energetic' },
  },
  hisoka: {
    quotes: [
      'Fufufu... te derroté, aunque todavía eres una fruta algo verde.',
      'Aún te falta madurar tu Nen para darme un duelo verdaderamente delicioso.',
      'Qué gran espectáculo... ¡promete volver mucho más fuerte!',
    ],
    voice: { pitch: 1.02, rate: 0.97, tone: 'sharp' },
  },
  netero: {
    quotes: [
      '¡Jajaja! ¡Te derroté! La gratitud en cada golpe supera al tiempo.',
      'Aún te falta entrenar diez mil golpes diarios con devoción.',
      'Espléndida juventud. Sigue buscando tu propia cima.',
    ],
    voice: { pitch: 0.84, rate: 0.95, tone: 'calm' },
  },

  // OTROS SHONEN Y ANIME FAMOSOS (13)
  jinwoo: {
    quotes: [
      'Te derroté. Este duelo ya superó tu nivel actual.',
      'Aún te falta subir de rango si quieres desafiar al Monarca.',
      'Cada entrenamiento me vuelve imparable. Victoria asegurada.',
    ],
    voice: { pitch: 0.82, rate: 0.97, tone: 'deep' },
  },
  saitama: {
    quotes: [
      'Te derroté. Bueno... supongo que con un golpe bastó otra vez.',
      'Aún te falta hacer cien flexiones al día para aguantarme.',
      '¿Ya terminó? Qué pena, esperaba que durara un poco más.',
    ],
    voice: { pitch: 0.94, rate: 0.96, tone: 'calm' },
  },
  genos: {
    quotes: [
      'Objetivo neutralizado: te derroté tras analizar tu patrón de ataque.',
      'Aún te falta potencia defensiva para resistir mi Incineración Máxima.',
      'Seguiré actualizándome para ser digno discípulo del maestro.',
    ],
    voice: { pitch: 0.92, rate: 1.02, tone: 'sharp' },
  },
  garou: {
    quotes: [
      'Te derroté. Tu estilo de pelea ya lo absorbí y lo superé.',
      'Aún te falta instinto de caza si pretendes frenar al monstruo.',
      '¡Sigue evolucionando o quédate atrás en la arena!',
    ],
    voice: { pitch: 0.84, rate: 1.04, tone: 'sharp' },
  },
  denji: {
    quotes: [
      '¡Jajaja! ¡Te derroté a puro motosierrazo! ¡Eso estuvo brutal!',
      '¡Aún te falta aguante para pararme cuando acelero el motor!',
      '¡Victoria asegurada! Ahora me merezco una buena comida.',
    ],
    voice: { pitch: 1.0, rate: 1.07, tone: 'energetic' },
  },
  aki: {
    quotes: [
      'Te derroté. Un contrato cumplido con calma y precisión.',
      'Aún te falta disciplina; no malgastes energía en golpes inútiles.',
      'Trabajo cerrado. Prepara mejor tu guardia para la siguiente.',
    ],
    voice: { pitch: 0.86, rate: 0.96, tone: 'calm' },
  },
  power: {
    quotes: [
      '¡Jajaja! ¡Inclínate ante la grandiosa Power, porque te derroté!',
      '¡Aún te falta ingenio y fuerza frente a mi martillo de sangre!',
      '¡Premio Nobel de combate para mí! ¡Vuelve cuando seas más fuerte!',
    ],
    voice: { pitch: 1.24, rate: 1.08, tone: 'feminine' },
  },
  asta: {
    quotes: [
      '¡Te derroté! ¡Mi magia es no rendirme jamás!',
      '¡Aún te falta entrenar sin descanso! ¡Vamos por más series!',
      '¡Aunque no tenga magia, mi esfuerzo rompe cualquier muro!',
    ],
    voice: { pitch: 1.08, rate: 1.1, tone: 'energetic' },
  },
  yuno: {
    quotes: [
      'Te derroté. El viento y las estrellas siempre marcan mi camino.',
      'Aún te falta velocidad para seguirle el paso a mi Spirit Dive.',
      'Buen intento, pero yo seré el próximo Rey Mago.',
    ],
    voice: { pitch: 0.9, rate: 0.98, tone: 'calm' },
  },
  edward: {
    quotes: [
      '¡Te derroté! ¡El intercambio equivalente premió mi entrenamiento!',
      '¡Aún te falta estrategia frente a un Alquimista Estatal!',
      '¡Y ni se te ocurra decirme bajito después de perder!',
    ],
    voice: { pitch: 1.04, rate: 1.05, tone: 'energetic' },
  },
  yusuke: {
    quotes: [
      '¡Te derroté! ¡Un disparo del Reigan bastó para cerrar esto!',
      '¡Estuviste duro, pero aún te falta entrenar el espíritu de pelea!',
      '¡Buen duelo! Cuando quieras volvemos a chocar puños.',
    ],
    voice: { pitch: 0.94, rate: 1.04, tone: 'heroic' },
  },
  seiya: {
    quotes: [
      '¡Te derroté! ¡Hice arder mi Cosmos hasta el Séptimo Sentido!',
      '¡Los Meteoros de Pegaso no retroceden ante ningún enemigo!',
      '¡Mientras siga de pie, el milagro de la victoria siempre volverá!',
    ],
    voice: { pitch: 1.02, rate: 1.04, tone: 'heroic' },
  },
  jotaro: {
    quotes: [
      'Yare yare daze... te derroté. No había forma de que ganaras.',
      'Aún te falta velocidad para enfrentar a Star Platinum.',
      'Buen intento, pero este duelo ya quedó saldado.',
    ],
    voice: { pitch: 0.76, rate: 0.94, tone: 'deep' },
  },
};

const ANIME_FALLBACK_QUOTES: Record<string, string[]> = {
  'Dragon Ball': [
    '¡Te derroté! El entrenamiento intenso siempre eleva nuestro Ki al límite.',
    '¡Aún te falta entrenamiento! Vuelve más fuerte para la revancha.',
    '¡Nadie puede frenar a un verdadero guerrero en combate!',
  ],
  Naruto: [
    '¡Te derroté! La voluntad ninja y el entrenamiento deciden la batalla.',
    '¡Aún te falta dominio del chakra para superar mi técnica!',
    '¡Un verdadero shinobi jamás retrocede ante un desafío!',
  ],
  'One Piece': [
    '¡Te derroté! Mi Haki y mi determinación dominaron el combate.',
    '¡Aún te falta entrenar en los mares para hacerme caer!',
    '¡Victoria asegurada! Ningún obstáculo frena esta aventura.',
  ],
  'Demon Slayer': [
    '¡Te derroté! Mi respiración se mantuvo firme hasta el último corte.',
    '¡Aún te falta pulir tu postura en cada entrenamiento!',
    '¡Seguiré adelante con el corazón ardiendo sin rendirme!',
  ],
  'Jujutsu Kaisen': [
    'Te derroté. Mi energía maldita dominó todo el terreno del duelo.',
    'Aún te falta control para resistir un impacto de técnica maldita.',
    'La diferencia de entrenamiento quedó clara en este combate.',
  ],
  'My Hero Academia': [
    '¡Te derroté! ¡Ir Plus Ultra en cada entrenamiento hace la diferencia!',
    '¡Gran combate, pero aún te falta potencia para frenarme!',
    '¡La victoria pertenece a quien nunca deja de esforzarse!',
  ],
  'Attack on Titan': [
    'Te derroté. En el campo de batalla solo sobrevive quien no duda.',
    'Aún te falta precisión; cada segundo de entrenamiento cuenta.',
    '¡Seguimos avanzando sin importar qué rival esté enfrente!',
  ],
  Bleach: [
    'Te derroté. Mi presión espiritual superó tu guardia por completo.',
    'Aún te falta afilar tu técnica para cruzar espadas conmigo.',
    'La victoria está sellada bajo el filo de mi poder.',
  ],
  'Hunter x Hunter': [
    '¡Te derroté! Mi control del Nen leyó toda tu estrategia.',
    '¡Aún te falta entrenamiento para sorprender a un verdadero cazador!',
    '¡Excelente combate, pero esta victoria ya es mía!',
  ],
  'Solo Leveling': [
    'Te derroté. Sube de nivel y vuelve cuando estés listo.',
    'Aún te falta velocidad y maná para desafiarme.',
    'Cada entrenamiento desbloquea un rango superior.',
  ],
  'One Punch Man': [
    'Te derroté. Entrenar todos los días sin excusas sí marca la diferencia.',
    'Buen intento, pero aún te falta resistencia para aguantar mis golpes.',
    'Combate terminado. ¡A seguir rompiendo límites!',
  ],
  'Chainsaw Man': [
    '¡Te derroté! ¡Pura intensidad hasta el final del combate!',
    '¡Aún te falta aguante para frenar esta ofensiva!',
    '¡Victoria limpia en la arena! Vamos por el siguiente desafío.',
  ],
  'Black Clover': [
    '¡Te derroté! ¡No rendirse jamás supera cualquier límite!',
    '¡Aún te falta entrenamiento diario para igualar mi ritmo!',
    '¡Seguimos superando muros en cada batalla!',
  ],
  'Fullmetal Alchemist': [
    '¡Te derroté! El entrenamiento constante es el verdadero intercambio equivalente.',
    'Aún te falta lectura táctica en el combate.',
    'Victoria asegurada. Sigamos avanzando sin dudar.',
  ],
  'Yu Yu Hakusho': [
    '¡Te derroté! La energía espiritual respondió en el momento justo.',
    'Aún te falta temple para aguantar mi disparo decisivo.',
    '¡Buen combate! Nos vemos en la próxima revancha.',
  ],
  'Saint Seiya': [
    '¡Te derroté! ¡Mi Cosmos ardió hasta alcanzar la victoria!',
    'Aún te falta despertar tu verdadero potencial en la arena.',
    '¡Un verdadero caballero jamás se rinde!',
  ],
  "JoJo's Bizarre Adv.": [
    'Te derroté. Mi Stand ya había sellado el resultado del duelo.',
    'Aún te falta velocidad y reflejos para sorprenderme.',
    'Combate terminado. Vuelve cuando pulas tu técnica.',
  ],
};

const DEFAULT_FALLBACK_QUOTES: string[] = [
  '¡Te derroté! La constancia de mis entrenamientos marcó la diferencia.',
  '¡Victoria asegurada! Aún te falta entrenamiento para superarme.',
  '¡Gran combate, pero esta vez la cima de la arena es mía!',
];

function readLastQuoteMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of memoryLastQuoteMap.entries()) {
    out[k] = v;
  }
  if (typeof window === 'undefined') return out;
  try {
    const raw = window.localStorage.getItem(LAST_QUOTE_STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed || {})) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = v;
      }
    }
  } catch {
    // ignore storage errors
  }
  return out;
}

function saveLastQuoteIndex(charId: string, index: number): void {
  memoryLastQuoteMap.set(charId, index);
  if (typeof window === 'undefined') return;
  try {
    const map = readLastQuoteMap();
    map[charId] = index;
    window.localStorage.setItem(LAST_QUOTE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function getVictoryCatalogForCharacter(
  charId: string,
  anime = '',
  gender: 'M' | 'F' = 'M'
): CharacterVictoryVoice {
  const custom = CHARACTER_VICTORY_CATALOG[charId];
  if (custom && custom.quotes.length > 0) {
    return custom;
  }
  const animeQuotes = ANIME_FALLBACK_QUOTES[anime] || DEFAULT_FALLBACK_QUOTES;
  const defaultVoice: VictoryVoiceProfile =
    gender === 'F'
      ? { pitch: 1.18, rate: 1.02, tone: 'feminine' }
      : { pitch: 0.94, rate: 1.0, tone: 'heroic' };
  return {
    quotes: animeQuotes,
    voice: defaultVoice,
  };
}

export function pickRotatingVictoryQuote(
  charId: string,
  anime = '',
  gender: 'M' | 'F' = 'M',
  extraQuotes: string[] = []
): { quote: string; voice: VictoryVoiceProfile; index: number } {
  const entry = getVictoryCatalogForCharacter(charId, anime, gender);
  const cleanedExtras = extraQuotes
    .map((q) => String(q || '').trim())
    .filter((q) => q.length > 0 && !entry.quotes.includes(q));
  const quotes = [...entry.quotes, ...cleanedExtras];
  if (quotes.length === 1) {
    return { quote: quotes[0], voice: entry.voice, index: 0 };
  }
  const lastMap = readLastQuoteMap();
  const prevIdx = typeof lastMap[charId] === 'number' ? lastMap[charId] : -1;
  const candidates = quotes
    .map((_, idx) => idx)
    .filter((idx) => idx !== prevIdx);
  const nextIdx =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : 0;
  saveLastQuoteIndex(charId, nextIdx);
  return {
    quote: quotes[nextIdx],
    voice: entry.voice,
    index: nextIdx,
  };
}
