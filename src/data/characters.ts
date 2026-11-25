import type { CharacterDef } from '../types/animefit.ts';

type RawCharacterTuple = [
  string,
  string,
  string,
  string,
  string,
  [number, string][]
];

const RAW_CHARACTERS: RawCharacterTuple[] = [
  // DRAGON BALL Z / SUPER (14)
  ['goku', 'Goku', 'Dragon Ball', '#FACC15', '🥋', [[1, 'Goku Base'], [5, 'Goku Kaioken'], [10, 'Super Saiyajin'], [18, 'Super Saiyajin 2'], [28, 'Super Saiyajin 3'], [40, 'Super Saiyajin Dios'], [55, 'Super Saiyajin Blue'], [75, 'Ultra Instinto Señal'], [95, 'Ultra Instinto Dominado']]],
  ['vegeta', 'Vegeta', 'Dragon Ball', '#38BDF8', '👑', [[1, 'Príncipe Saiyajin'], [6, 'Super Vegeta'], [15, 'Majin Vegeta'], [28, 'SSJ2 Furioso'], [45, 'Super Saiyajin Blue'], [65, 'SSJ Blue Evolution'], [90, 'Ultra Ego']]],
  ['gohan', 'Gohan', 'Dragon Ball', '#A855F7', '⚡', [[1, 'Gohan Niño'], [7, 'SSJ Tormenta'], [16, 'SSJ2 Celular'], [30, 'Gran Saiyaman'], [45, 'Gohan Definitivo (Místico)'], [75, 'Gohan Beast']]],
  ['piccolo', 'Piccolo', 'Dragon Ball', '#22C55E', '🟢', [[1, 'Guerrero Namekiano'], [8, 'Fusión con Nail'], [18, 'Fusión con Kami'], [40, 'Despertar Potencial'], [70, 'Orange Piccolo']]],
  ['trunks', 'Trunks del Futuro', 'Dragon Ball', '#38BDF8', '🗡️', [[1, 'Trunks Base'], [8, 'Super Saiyajin'], [20, 'Ultra Super Saiyajin'], [40, 'SSJ2 Futuro'], [70, 'Super Saiyajin Rage']]],
  ['freezer', 'Freezer', 'Dragon Ball', '#A855F7', '❄️', [[1, 'Primera Forma'], [8, 'Forma Final'], [20, '100% Poder'], [45, 'Golden Freezer'], [85, 'Black Freezer']]],
  ['cell', 'Cell', 'Dragon Ball', '#22C55E', '🪲', [[1, 'Cell Imperfecto'], [10, 'Cell Semiperfecto'], [25, 'Cell Perfecto'], [50, 'Super Cell Perfecto']]],
  ['buu', 'Majin Buu', 'Dragon Ball', '#EC4899', '🍬', [[1, 'Majin Buu Inocente'], [15, 'Super Buu'], [30, 'Buu Gohan Absorbido'], [55, 'Kid Buu'], [80, 'Fit Buu']]],
  ['broly', 'Broly', 'Dragon Ball', '#22C55E', '💥', [[1, 'Saiyajin Exiliado'], [12, 'Estado Ikari'], [28, 'Super Saiyajin'], [55, 'Super Saiyajin Legendario (Full Power)']]],
  ['krilin', 'Krilin', 'Dragon Ball', '#F97316', '☀️', [[1, 'Monje Shaolin'], [10, 'Potencial Desbloqueado'], [25, 'Kienzan Maestro'], [50, 'Guerrero Z Humano']]],
  ['tenshinhan', 'Ten Shin Han', 'Dragon Ball', '#FACC15', '👁️', [[1, 'Escuela Grulla'], [12, 'Kikoho Maestro'], [30, 'Shin Kikoho'], [55, 'Maestro de Artes Marciales']]],
  ['roshi', 'Maestro Roshi', 'Dragon Ball', '#F97316', '🐢', [[1, 'Ermitaño Tortuga'], [12, 'Kamehameha 100% Musculoso'], [35, 'Modo Máxima Concentración'], [65, 'Sabio Inmortal']]],
  ['a17', 'Androide 17', 'Dragon Ball', '#38BDF8', '🔋', [[1, 'Cyborg Lapis'], [15, 'Energía Ilimitada'], [40, 'Guardabosques'], [75, 'Campeón del Torneo del Poder']]],
  ['hit', 'Hit', 'Dragon Ball', '#A855F7', '⏱️', [[1, 'Asesino del Universo 6'], [20, 'Salto Temporal 0.5s'], [50, 'Salto Temporal Mejorado'], [80, 'Prisión del Tiempo']]],

  // NARUTO / SHIPPUDEN (15)
  ['naruto', 'Naruto Uzumaki', 'Naruto', '#F97316', '🦊', [[1, 'Genin de Konoha'], [5, 'Manto 1 Cola'], [12, '4 Colas Descontrolado'], [20, 'Modo Sabio de los Sapos'], [32, 'Modo Chakra del Kyubi'], [48, 'Modo Kurama Completo'], [68, 'Sabio de los Seis Caminos'], [92, 'Modo Baryon']]],
  ['sasuke', 'Sasuke Uchiha', 'Naruto', '#A855F7', '👁️', [[1, 'Genin Uchiha'], [6, 'Sharingan 3 Aspas'], [14, 'Marca de Maldición Fase 2'], [26, 'Mangekyo Sharingan'], [45, 'Mangekyo Eterno + Susanoo'], [70, 'Rinnegan Supremo']]],
  ['sakura', 'Sakura Haruno', 'Naruto', '#EC4899', '🌸', [[1, 'Kunoichi Genin'], [10, 'Discípula de Tsunade'], [25, 'Fuerza Monstruosa'], [48, 'Sello Byakugo'], [75, 'Sanin de la Nueva Era']]],
  ['kakashi', 'Kakashi Hatake', 'Naruto', '#38BDF8', '⚡', [[1, 'Jonin Relámpago'], [12, 'Sharingan Copiador'], [28, 'Mangekyo Kamui'], [52, 'Doble Mangekyo + Susanoo Perfecto'], [75, 'Sexto Hokage']]],
  ['rocklee', 'Rock Lee', 'Naruto', '#22C55E', '🥋', [[1, 'Taijutsu Genin'], [8, 'Pesas Removidas'], [18, 'Puerta de la Vida (3ª)'], [34, 'Puerta de la Alegría (6ª)'], [60, 'Loto Escondido Maestro']]],
  ['guy', 'Might Guy', 'Naruto', '#22C55E', '🔥', [[1, 'Bestia Verde'], [14, '6ª Puerta - Pavo Real'], [32, '7ª Puerta - Tigre Matutino'], [68, '8ª Puerta - Guy Nocturno']]],
  ['gaara', 'Gaara', 'Naruto', '#F59E0B', '🏜️', [[1, 'Jinchuriki del Shukaku'], [12, 'Escudo de Arena Absoluto'], [28, 'Quinto Kazekage'], [55, 'Arena Dorada de Alianza']]],
  ['itachi', 'Itachi Uchiha', 'Naruto', '#EF4444', '🐦‍⬛', [[1, 'Prodigio ANBU'], [15, 'Mangekyo Tsukuyomi'], [35, 'Susanoo + Espada Totsuka'], [65, 'Itachi Edo Tensei Izanami']]],
  ['minato', 'Minato Namikaze', 'Naruto', '#FACC15', '⚡', [[1, 'Relámpago Amarillo'], [18, 'Hiraishin Nivel 2'], [38, 'Cuarto Hokage'], [65, 'Modo Chakra de Kurama']]],
  ['jiraiya', 'Jiraiya', 'Naruto', '#EF4444', '🐸', [[1, 'Sabio Pervertido'], [18, 'Invocador de Gamabunta'], [42, 'Modo Sabio Imperfecto'], [70, 'Sannin Legendario']]],
  ['tsunade', 'Tsunade', 'Naruto', '#22C55E', '🍶', [[1, 'Kunoichi Médica'], [18, 'Fuerza Titánica'], [40, 'Quinta Hokage'], [68, 'Cien Curaciones Byakugo']]],
  ['shikamaru', 'Shikamaru Nara', 'Naruto', '#94A3B8', '🌑', [[1, 'Estratega Genin'], [12, 'Posesión de Sombra'], [30, 'Chunin Táctico'], [60, 'Consejero / Octavo Hokage']]],
  ['neji', 'Neji Hyuga', 'Naruto', '#38BDF8', '☯️', [[1, 'Genio Hyuga'], [12, 'Puño Suave 64 Palmas'], [28, 'Rotación Celestial'], [55, 'Maestro del Byakugan']]],
  ['madara', 'Madara Uchiha', 'Naruto', '#EF4444', '🪭', [[1, 'Líder Uchiha'], [20, 'Susanoo Perfecto'], [45, 'Rinnegan Despertado'], [78, 'Jinchuriki del Diez Colas']]],
  ['obito', 'Obito Uchiha', 'Naruto', '#F97316', '🌀', [[1, 'Chunin Uchiha'], [15, 'Tobi Enmascarado'], [38, 'Rinnegan + Kamui'], [72, 'Jinchuriki Juubito']]],

  // ONE PIECE (13)
  ['luffy', 'Monkey D. Luffy', 'One Piece', '#EF4444', '👒', [[1, 'Pirata Gomu Gomu'], [8, 'Gear Second'], [18, 'Gear Third'], [30, 'Gear Fourth Boundman'], [45, 'Gear Fourth Snakeman'], [65, 'Haki del Rey Avanzado'], [88, 'Gear Fifth (Nika)']]],
  ['zoro', 'Roronoa Zoro', 'One Piece', '#22C55E', '⚔️', [[1, 'Cazador de Piratas'], [10, 'Santoryu Acero Cortante'], [24, 'Asura Nueve Espadas'], [45, 'Dominio de Enma'], [72, 'Rey del Infierno (Haki Rey)']]],
  ['sanji', 'Vinsmoke Sanji', 'One Piece', '#FACC15', '🦵', [[1, 'Cocinero Pierna Negra'], [10, 'Diable Jambe'], [25, 'Sky Walk'], [45, 'Traje Raid Suit'], [70, 'Ifrit Jambe (Exoesqueleto)']]],
  ['nami', 'Nami', 'One Piece', '#F97316', '⛈️', [[1, 'Navegante'], [12, 'Clima-Tact'], [30, 'Sorcery Clima-Tact'], [58, 'Zeus Emperatriz del Clima']]],
  ['usopp', 'Usopp', 'One Piece', '#F59E0B', '🎯', [[1, 'Tirador de Villa Syrup'], [12, 'Sogeking'], [28, 'Pop Greens'], [55, 'God Usopp (Haki Observación)']]],
  ['chopper', 'Tony Tony Chopper', 'One Piece', '#EC4899', '🦌', [[1, 'Reno Doctor'], [10, 'Heavy Point'], [25, 'Kung Fu Point'], [50, 'Monster Point Controlado']]],
  ['robin', 'Nico Robin', 'One Piece', '#A855F7', '🌺', [[1, 'Hana Hana no Mi'], [15, 'Mil Fleurs'], [38, 'Gigantesco Mano'], [68, 'Demonio Fleur']]],
  ['franky', 'Franky', 'One Piece', '#38BDF8', '🤖', [[1, 'Cyborg BF-36'], [15, 'Franky Centaur'], [35, 'BF-37 Radical Beam'], [62, 'General Franky Shogun']]],
  ['brook', 'Brook', 'One Piece', '#94A3B8', '🎸', [[1, 'Músico Esqueleto'], [15, 'Soul Solid'], [38, 'Alma Helada'], [65, 'Soul King']]],
  ['jinbe', 'Jinbe', 'One Piece', '#38BDF8', '🦈', [[1, 'Caballero del Mar'], [18, 'Karate Gyojin'], [42, 'Vagabond Drill'], [68, 'Timonel Emperador']]],
  ['law', 'Trafalgar Law', 'One Piece', '#FACC15', '🩺', [[1, 'Cirujano de la Muerte'], [15, 'ROOM: Shambles'], [38, 'Gamma Knife'], [70, 'Despertar K-ROOM']]],
  ['ace', 'Portgas D. Ace', 'One Piece', '#F97316', '🔥', [[1, 'Puño de Fuego'], [16, 'Mera Mera no Mi'], [38, 'Comandante de Barbablanca'], [65, 'Entei (Emperador Llama)']]],
  ['shanks', 'Shanks', 'One Piece', '#EF4444', '🦁', [[1, 'Aprendiz de Roger'], [22, 'Capitán Pelirrojo'], [50, 'Yonko de los Mares'], [85, 'Haki del Rey Supremo']]],

  // DEMON SLAYER (12)
  ['tanjiro', 'Tanjiro Kamado', 'Demon Slayer', '#22C55E', '🌊', [[1, 'Aspirante Selección Final'], [8, 'Respiración del Agua'], [18, 'Danza del Dios del Fuego'], [35, 'Marca del Cazador'], [60, 'Mundo Transparente'], [85, 'Decimotercera Postura Solar']]],
  ['nezuko', 'Nezuko Kamado', 'Demon Slayer', '#EC4899', '🎋', [[1, 'Demonio Dormida'], [10, 'Arte Demoníaco Sangre Explosiva'], [28, 'Forma Demonio Adulta'], [60, 'Conquistadora del Sol']]],
  ['zenitsu', 'Zenitsu Agatsuma', 'Demon Slayer', '#FACC15', '⚡', [[1, 'Cazador Asustado'], [10, '1ª Postura: Destello del Relámpago'], [28, 'Velocidad Divina'], [62, '7ª Postura: Dios del Trueno Llameante']]],
  ['inosuke', 'Inosuke Hashibira', 'Demon Slayer', '#38BDF8', '🐗', [[1, 'Salvaje de la Montaña'], [12, 'Respiración de la Bestia'], [30, 'Sentido Espacial Extremo'], [58, 'Pilar Bestia']]],
  ['giyu', 'Giyu Tomioka', 'Demon Slayer', '#38BDF8', '💧', [[1, 'Cazador del Agua'], [16, 'Pilar del Agua'], [38, '11ª Postura: Calma'], [68, 'Pilar con Marca']]],
  ['rengoku', 'Kyojuro Rengoku', 'Demon Slayer', '#F97316', '🔥', [[1, 'Espadachín de la Llama'], [18, 'Pilar de la Llama'], [42, '9ª Postura: Purgatorio'], [72, 'Corazón Ardiente Inmortal']]],
  ['tengen', 'Tengen Uzui', 'Demon Slayer', '#EC4899', '💎', [[1, 'Shinobi Cazador'], [18, 'Pilar del Sonido'], [42, 'Partitura Musical Completa'], [68, 'Dios del Festival']]],
  ['muichiro', 'Muichiro Tokito', 'Demon Slayer', '#38BDF8', '🌫️', [[1, 'Prodigio de la Niebla'], [18, 'Pilar de la Niebla'], [40, '7ª Postura: Neblina'], [70, 'Espada Carmesí + Marca']]],
  ['mitsuri', 'Mitsuri Kanroji', 'Demon Slayer', '#EC4899', '💗', [[1, 'Fuerza Sobrehumana'], [18, 'Pilar del Amor'], [42, 'Látigo Carmesí'], [68, 'Marca del Amor']]],
  ['shinobu', 'Shinobu Kocho', 'Demon Slayer', '#A855F7', '🦋', [[1, 'Farmacéutica'], [16, 'Pilar del Insecto'], [40, 'Danza del Ciempiés'], [65, 'Veneno de Glicinia Letal']]],
  ['sanemi', 'Sanemi Shinazugawa', 'Demon Slayer', '#22C55E', '🌪️', [[1, 'Cazador Marechi'], [18, 'Pilar del Viento'], [44, 'Tifón Destructor'], [72, 'Marca + Mundo Transparente']]],
  ['gyomei', 'Gyomei Himejima', 'Demon Slayer', '#F59E0B', '🪨', [[1, 'Monje Gigante'], [20, 'Pilar de la Roca'], [48, 'Respiración de la Roca Máxima'], [80, 'Cazador Más Fuerte']]],

  // JUJUTSU KAISEN (10)
  ['yuji', 'Yuji Itadori', 'Jujutsu Kaisen', '#EF4444', '👊', [[1, 'Recipiente de Sukuna'], [10, 'Puño Divergente'], [24, 'Destello Oscuro (Black Flash)'], [48, 'Manipulación de Sangre'], [76, 'Expansión de Dominio']]],
  ['megumi', 'Megumi Fushiguro', 'Jujutsu Kaisen', '#38BDF8', '🐺', [[1, 'Técnica Diez Sombras'], [14, 'Nue y Perros Divinos'], [35, 'Jardín de las Sombras Quimérico'], [68, 'Ritual de Mahoraga']]],
  ['nobara', 'Nobara Kugisaki', 'Jujutsu Kaisen', '#F97316', '🔨', [[1, 'Hechicera de Grado 3'], [14, 'Técnica Muñeco de Paja'], [35, 'Resonancia Destello Oscuro'], [62, 'Maestra de Maldiciones']]],
  ['gojo', 'Satoru Gojo', 'Jujutsu Kaisen', '#38BDF8', '♾️', [[1, 'Ojos Seis + Infinito'], [18, 'Azul y Rojo Invertido'], [42, 'Vacío Púrpura'], [78, 'Vacío Inconmensurable (El Más Fuerte)']]],
  ['yuta', 'Yuta Okkotsu', 'Jujutsu Kaisen', '#A855F7', '💍', [[1, 'Maldición de Rika'], [18, 'Hechicero Grado Especial'], [44, 'Copia de Técnicas'], [74, 'Amor Mutuo Verdadero']]],
  ['maki', 'Maki Zenin', 'Jujutsu Kaisen', '#22C55E', '🔱', [[1, 'Sin Energía Maldita'], [16, 'Maestra en Armas Malditas'], [42, 'Restricción Celestial Total'], [75, 'Igual a Toji Zenin']]],
  ['nanami', 'Kento Nanami', 'Jujutsu Kaisen', '#FACC15', '👔', [[1, 'Hechicero Grado 1'], [15, 'Técnica Ratio 7:3'], [38, 'Tiempo Extra (Overtime)'], [62, 'Colapso Crítico']]],
  ['inumaki', 'Toge Inumaki', 'Jujutsu Kaisen', '#94A3B8', '🍙', [[1, 'Discurso Maldito'], [14, '¡No te muevas!'], [35, '¡Explota!'], [60, 'Grado Semi-1 Supremo']]],
  ['todo', 'Aoi Todo', 'Jujutsu Kaisen', '#A855F7', '👏', [[1, 'Besto Friendo'], [16, 'Boogie Woogie'], [40, '530,000 IQ Black Flash'], [68, 'Vibraslap Boogie Woogie']]],
  ['sukuna', 'Ryomen Sukuna', 'Jujutsu Kaisen', '#EF4444', '⛩️', [[1, 'Rey de las Maldiciones (2 Dedos)'], [20, '15 Dedos: Desmantelar'], [48, 'Relicario Malévolo'], [85, 'Forma Verdadera Heian']]],

  // MY HERO ACADEMIA (9)
  ['deku', 'Izuku Midoriya', 'My Hero Academia', '#22C55E', '🥦', [[1, 'Sin Don (Aspirante)'], [8, 'One For All 5%'], [18, 'Full Cowl 20%'], [32, 'Látigo Negro + Flotar'], [52, 'Faux 100%'], [78, 'Gearshift + Overdrive']]],
  ['bakugo', 'Katsuki Bakugo', 'My Hero Academia', '#F97316', '💥', [[1, 'Explosión Base'], [12, 'Howitzer Impact'], [32, 'AP Shot'], [55, 'Cluster'], [80, 'Despertar Velocidad Luz']]],
  ['todoroki', 'Shoto Todoroki', 'My Hero Academia', '#38BDF8', '❄️', [[1, 'Mitad Frío'], [14, 'Fuego y Hielo'], [36, 'Flashfreeze Heatwave'], [68, 'Phosphor']]],
  ['allmight', 'All Might', 'My Hero Academia', '#FACC15', '💪', [[1, 'Símbolo de la Paz'], [20, 'Detroit Smash'], [48, 'United States of Smash'], [75, 'Armored All Might']]],
  ['uraraka', 'Ochaco Uraraka', 'My Hero Academia', '#EC4899', '☄️', [[1, 'Gravedad Cero'], [14, 'Lluvia de Meteoros'], [36, 'Gunhead Martial Arts'], [64, 'Despertar Gravedad Masiva']]],
  ['iida', 'Tenya Iida', 'My Hero Academia', '#38BDF8', '🏎️', [[1, 'Motor en Piernas'], [14, 'Recipro Burst'], [36, 'Recipro Turbo'], [62, 'Ingenium Supersónico']]],
  ['kirishima', 'Eijiro Kirishima', 'My Hero Academia', '#EF4444', '🛡️', [[1, 'Endurecimiento'], [15, 'Red Riot'], [38, 'Red Riot Unbreakable'], [65, 'Muro Inquebrantable']]],
  ['endeavor', 'Endeavor', 'My Hero Academia', '#F97316', '🔥', [[1, 'Héroe Número 2'], [20, 'Hellflame'], [45, 'Prominence Burn'], [72, 'Héroe Número 1']]],
  ['hawks', 'Hawks', 'My Hero Academia', '#FACC15', '🪶', [[1, 'Alas Rígidas'], [18, 'Plumas Veloces'], [42, 'Héroe alado #2'], [68, 'Velocidad del Sonido']]],

  // ATTACK ON TITAN (8)
  ['eren', 'Eren Jaeger', 'Attack on Titan', '#22C55E', '🔑', [[1, 'Recluta 104'], [10, 'Titán de Ataque'], [25, 'Endurecimiento'], [48, 'Titán Martillo de Guerra'], [80, 'Titán Fundador (Retumbar)']]],
  ['mikasa', 'Mikasa Ackerman', 'Attack on Titan', '#EF4444', '🧣', [[1, 'Prodigio Cuerpo de Exploración'], [14, 'Poder Ackerman'], [35, 'Lanzas Relámpago'], [68, 'Guerrera Definitiva']]],
  ['armin', 'Armin Arlert', 'Attack on Titan', '#FACC15', '🌊', [[1, 'Estratega'], [18, 'Comandante Táctico'], [42, 'Titán Colosal'], [72, '15º Comandante']]],
  ['levi', 'Levi Ackerman', 'Attack on Titan', '#38BDF8', '⚔️', [[1, 'Subterráneo'], [16, 'Capitán de Escuadrón'], [40, 'El Soldado Más Fuerte'], [75, 'Acero Ackerman Imparable']]],
  ['erwin', 'Erwin Smith', 'Attack on Titan', '#FACC15', '🐎', [[1, 'Oficial Exploración'], [18, 'Comandante'], [45, 'Carga Suicida Shinzo wo Sasageyo']]],
  ['reiner', 'Reiner Braun', 'Attack on Titan', '#F59E0B', '🛡️', [[1, 'Guerrero Marley'], [16, 'Titán Acorazado'], [42, 'Coraza Indestructible']]],
  ['annie', 'Annie Leonhart', 'Attack on Titan', '#38BDF8', '💎', [[1, 'Artista Marcial'], [16, 'Titán Hembra'], [42, 'Cristalización Total']]],
  ['historia', 'Historia Reiss', 'Attack on Titan', '#FACC15', '👑', [[1, 'Krista Lenz'], [15, 'Sangre Real'], [40, 'Reina de Paradis']]],

  // BLEACH (8)
  ['ichigo', 'Ichigo Kurosaki', 'Bleach', '#F97316', '🗡️', [[1, 'Shinigami Sustituto'], [10, 'Shikai Zangetsu'], [22, 'Bankai Tensa Zangetsu'], [36, 'Máscara Vizard'], [52, 'Vasto Lorde'], [70, 'Mugetsu'], [90, 'Verdadero Bankai Horn of Salvation']]],
  ['rukia', 'Rukia Kuchiki', 'Bleach', '#38BDF8', '❄️', [[1, 'Shinigami Escuadrón 13'], [16, 'Sode no Shirayuki'], [42, 'Bankai Hakka no Togame'], [68, 'Capitana']]],
  ['renji', 'Renji Abarai', 'Bleach', '#EF4444', '🐍', [[1, 'Teniente 6'], [15, 'Zabimaru'], [38, 'Hihio Zabimaru'], [66, 'Soo Zabimaru (Verdadero Bankai)']]],
  ['byakuya', 'Byakuya Kuchiki', 'Bleach', '#EC4899', '🌸', [[1, 'Capitán Noble'], [18, 'Senbonzakura'], [42, 'Bankai Kageyoshi'], [72, 'Palacio Real Despertado']]],
  ['toshiro', 'Toshiro Hitsugaya', 'Bleach', '#38BDF8', '🐉', [[1, 'Capitán Prodigio'], [18, 'Hyorinmaru'], [42, 'Daiguren Hyorinmaru'], [74, 'Forma Adulta Completa']]],
  ['kenpachi', 'Kenpachi Zaraki', 'Bleach', '#FACC15', '💀', [[1, 'Capitán 11 sin Parche'], [20, 'Kendo a Dos Manos'], [48, 'Shikai Nozarashi'], [80, 'Bankai Demonio Zaraki']]],
  ['uryu', 'Uryu Ishida', 'Bleach', '#38BDF8', '🏹', [[1, 'Quincy'], [16, 'Letzt Stil'], [42, 'Sternritter A'], [72, 'Antithesis']]],
  ['aizen', 'Sosuke Aizen', 'Bleach', '#A855F7', '🦋', [[1, 'Capitán Ilusión'], [20, 'Hogyoku Despertado'], [48, 'Forma Mariposa'], [82, 'Muken Inmortal']]],

  // HUNTER X HUNTER (6)
  ['gon', 'Gon Freecss', 'Hunter x Hunter', '#22C55E', '🎣', [[1, 'Aspirante Cazador'], [12, 'Usuario de Nen (Jajanken)'], [35, 'Cazador de Hormigas'], [72, 'Gon Adulto (Sacrificio Total)']]],
  ['killua', 'Killua Zoldyck', 'Hunter x Hunter', '#38BDF8', '⚡', [[1, 'Asesino Zoldyck'], [12, 'Palma Eléctrica'], [35, 'Kanmuru (Velocidad Divina)'], [70, 'Relámpago Supremo']]],
  ['kurapika', 'Kurapika', 'Hunter x Hunter', '#EF4444', '⛓️', [[1, 'Superviviente Kurta'], [14, 'Ojos Escarlata'], [38, 'Emperor Time'], [68, 'Cadena del Juicio']]],
  ['leorio', 'Leorio Paradinight', 'Hunter x Hunter', '#38BDF8', '💼', [[1, 'Estudiante Médico'], [15, 'Puño Teletransportado'], [40, 'Cazador Zodiaco']]],
  ['hisoka', 'Hisoka Morow', 'Hunter x Hunter', '#EC4899', '🃏', [[1, 'Mago Letal'], [18, 'Bungee Gum'], [45, 'Textura Engañosa'], [72, 'Renacimiento Post-Mortem']]],
  ['netero', 'Isaac Netero', 'Hunter x Hunter', '#FACC15', '🙏', [[1, 'Gran Maestro Shingen-Ryu'], [22, 'Presidente Cazadores'], [52, 'Bodhisattva Guanyin 100 Tipos'], [82, 'Mano Cero']]],

  // OTROS SHONEN Y ANIME FAMOSOS (13)
  ['jinwoo', 'Sung Jin-Woo', 'Solo Leveling', '#A855F7', '🗡️', [[1, 'Cazador Rango E (Más Débil)'], [8, 'Jugador del Sistema'], [20, 'Nigromante (Arise)'], [40, 'Monarca de las Sombras'], [70, 'Rango S Nacional'], [95, 'Monarca Absoluto']]],
  ['saitama', 'Saitama', 'One Punch Man', '#FACC15', '🥊', [[1, 'Héroe por Diversión (100 Flexiones)'], [15, 'Limitador Roto'], [45, 'Golpe Serio'], [90, 'Estornudo Destructor de Júpiter']]],
  ['genos', 'Genos', 'One Punch Man', '#F97316', '🔥', [[1, 'Cyborg Demonio'], [16, 'Incineración Máxima'], [40, 'Armadura Dragón'], [68, 'Modo 10 Segundos']]],
  ['garou', 'Garou', 'One Punch Man', '#EF4444', '🐺', [[1, 'Cazador de Héroes'], [16, 'Puño Agua Fluyente'], [42, 'Garou Monstruo'], [80, 'Garou Cósmico']]],
  ['denji', 'Denji', 'Chainsaw Man', '#EF4444', '🪚', [[1, 'Cazador con Pochita'], [14, 'Hombre Motosierra'], [40, 'Motosierra de Sangre'], [72, 'Héroe del Infierno (Pochita Negro)']]],
  ['aki', 'Aki Hayakawa', 'Chainsaw Man', '#38BDF8', '🦊', [[1, 'Seguridad Pública'], [15, 'Contrato Zorro'], [38, 'Espada Ángel']]],
  ['power', 'Power', 'Chainsaw Man', '#EF4444', '🩸', [[1, 'Poseída de Sangre'], [16, 'Martillo de Sangre'], [42, 'Demonio de la Sangre Verdadero']]],
  ['asta', 'Asta', 'Black Clover', '#94A3B8', '🗡️', [[1, 'Sin Magia (Entrenamiento Físico)'], [12, 'Espada Antimagia'], [28, 'Forma Black Asta'], [55, 'Devil Union'], [85, 'True Devil Union + Zetten']]],
  ['yuno', 'Yuno', 'Black Clover', '#22C55E', '🍀', [[1, 'Trébol de 4 Hojas'], [14, 'Sylph Espada'], [35, 'Spirit Dive'], [68, 'Magia Estelar']]],
  ['edward', 'Edward Elric', 'Fullmetal Alchemist', '#FACC15', '⚗️', [[1, 'Alquimista Automail'], [16, 'Alquimia sin Círculo'], [40, 'Alquimista de Acero'], [65, 'Verdad Alquímica']]],
  ['yusuke', 'Yusuke Urameshi', 'Yu Yu Hakusho', '#22C55E', '👉', [[1, 'Detective Espiritual'], [14, 'Reigan Supremo'], [38, 'Energía Sagrada'], [68, 'Forma Mazoku']]],
  ['seiya', 'Seiya de Pegaso', 'Saint Seiya', '#38BDF8', '🐎', [[1, 'Caballero de Bronce'], [15, 'Séptimo Sentido (Meteoros)'], [40, 'Armadura Dorada Sagitario'], [75, 'Armadura Divina Kamei']]],
  ['jotaro', 'Jotaro Kujo', "JoJo's Bizarre Adv.", '#A855F7', '⭐', [[1, 'Delincuente Juvenil'], [14, 'Star Platinum (ORA ORA)'], [38, 'Star Platinum: The World'], [70, 'Leyenda Stardust']]]
];

const FEMALE_CHAR_IDS = new Set([
  'sakura',
  'tsunade',
  'nami',
  'robin',
  'nezuko',
  'mitsuri',
  'shinobu',
  'nobara',
  'maki',
  'uraraka',
  'mikasa',
  'annie',
  'historia',
  'rukia',
  'power',
]);

export const CHARACTERS: CharacterDef[] = RAW_CHARACTERS.map(
  ([id, name, anime, auraColor, icon, stages]) => ({
    id,
    name,
    anime,
    auraColor,
    icon,
    gender: FEMALE_CHAR_IDS.has(id) ? 'F' : 'M',
    stages: stages.map(([levelReq, phase]) => ({ levelReq, phase })),
  })
);

