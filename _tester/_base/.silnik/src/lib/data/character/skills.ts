/**
 * Bazowe umiejętności CoC 7e, opisy dla tooltipów + limity podczas tworzenia.
 *
 * IND-123 (sesja 90) - wyodrębnione z character-wizard.tsx Faza 1.
 * Zaktualizowane w ramach Issue #210 (Podręcznik Badacza CoC 7ed RAW).
 */

export const SKILL_DESCRIPTIONS: Record<string, string> = {
  Antropologia:
    'Wiedza o kulturach i społeczeństwach ludzkich. Używaj do rozumienia obcych zwyczajów i rytuałów.',
  Archeologia:
    'Znajomość starożytnych cywilizacji i artefaktów. Identyfikacja historycznych przedmiotów.',
  Biblioteka:
    'Zdolność znajdowania informacji w archiwach, bibliotekach i dokumentach pisanych.',
  'Broń Artyleryjska':
    'Obsługa dział polowych, moździerzy i wielkokalibrowej artylerii wojskowej. Baza: 01%',
  'Broń Palna':
    'Umiejętność strzelania z pistoletów i rewolwerów. Baza: 20%',
  'Broń Palna (Broń Ciężka)':
    'Strzelanie z ciężkich karabinów przeciwpancernych, granatników i broni wsparcia. Baza: 10%',
  'Broń Palna (Karabin)':
    'Umiejętność strzelania z karabinów i strzelb. Baza: 25%',
  'Broń Palna (Karabin Maszynowy)':
    'Obsługa ciężkich i lekkich karabinów maszynowych ze statywu lub dwójnogu. Baza: 10%',
  'Broń Palna (Krótka)':
    'Precyzyjne strzelanie z pistoletów samopowtarzalnych i rewolwerów. Baza: 20%',
  'Broń Palna (Łuk)':
    'Strzelanie z łuków tradycyjnych, bloczkowych i kusz. Baza: 15%',
  'Broń Palna (Miotacz Ognia)':
    'Użycie wojskowych miotaczy ognia i mieszanek zapalających. Baza: 10%',
  'Broń Palna (Pistolet Maszynowy)':
    'Prowadzenie ognia pojedynczego i ciągłego z pistoletów maszynowych (np. Thompson, MP 18). Baza: 15%',
  Elektryka:
    'Naprawa i obsługa urządzeń elektrycznych. Praca z okablowaniem i systemami.',
  Gadanina:
    'Umiejętność przekonywania i oszukiwania. Skuteczna przy krótkich interakcjach.',
  Historia:
    'Wiedza o wydarzeniach historycznych. Rozpoznawanie kontekstu i znaczenia.',
  Jeździectwo:
    'Umiejętność jazdy konnej. Kontrola wierzchowca w trudnych sytuacjach.',
  'Język Obcy': 'Znajomość obcego języka. Wartość = % opanowania języka.',
  'Język Ojczysty': 'Biegłość w języku ojczystym. Automatycznie = WYK.',
  Komputery:
    'Obsługa systemów komputerowych (era współczesna). Programowanie i hacking.',
  Księgowość:
    'Analiza finansowa i dokumentacji księgowej. Wykrywanie malwersacji.',
  Mechanika:
    'Naprawa maszyn i urządzeń mechanicznych. Silniki, zamki, mechanizmy.',
  Medycyna: 'Profesjonalna wiedza medyczna. Diagnozowanie i leczenie chorób.',
  'Mity Cthulhu':
    'Zakazana wiedza o Wielkich Przedwiecznych, bóstwach i kosmicznej grozie. Baza: 00%, obniża maksymalną Poczytalność.',
  Nauka:
    'Wiedza naukowa w konkretnej specjalizacji (biologia, chemia, fizyka itp.).',
  Nasłuchiwanie:
    'Zdolność słyszenia ukrytych dźwięków. Podsłuchiwanie rozmów. Baza: 20%',
  'Obsługa Ciężkiego Sprzętu':
    'Prowadzenie traktorów, buldożerów, dźwigów i ciężkich maszyn budowlanych. Baza: 01%',
  Okultyzm:
    'Wiedza o okultyzmie, magii i nadprzyrodzoności. Nie dotyczy Mitów Cthulhu.',
  Orientacja: 'Zdolność nawigacji i odnajdywania drogi. Mapy, gwiazdy, teren.',
  'Pierwsza Pomoc':
    'Podstawowa pomoc medyczna. Opatrywanie ran i stabilizacja. Baza: 30%',
  Pilotowanie:
    'Prowadzenie pojazdów powietrznych lub wodnych. Wymaga specjalizacji.',
  Pływanie: 'Umiejętność pływania i nurkowania. Baza: 20%',
  Prawo:
    'Znajomość prawa i procedur prawnych. Używane przez prawników i detektywów.',
  'Prowadzenie Samochodu':
    'Umiejętność prowadzenia samochodów. Pościgi i manewry. Baza: 20%',
  Przebranie: 'Maskowanie tożsamości. Zmienianie wyglądu, głosu, postawy.',
  Przetrwanie:
    'Umiejętność przeżycia w dziczy. Znajdowanie wody, jedzenia, schronienia.',
  Perswazja: 'Przekonywanie poprzez argumenty i logikę. Baza: 10%',
  Psychoanaliza:
    'Terapia zaburzeń emocjonalnych, tłumienie ataków histerii i leczenie obłędu. Baza: 01%',
  Psychologia:
    'Rozumienie ludzkich motywacji i emocji. Wykrywanie kłamstw. Baza: 10%',
  Rzucanie: 'Celne rzucanie przedmiotami. Granaty, noże, kamienie. Baza: 20%',
  Skok: 'Zdolność skakania na odległość lub wysokość. Baza: 20%',
  Skradanie: 'Ciche poruszanie się bez zwracania uwagi. Baza: 20%',
  Spostrzegawczość: 'Dostrzeganie szczegółów i ukrytych rzeczy. Baza: 25%',
  'Sztuka/Rzemiosło':
    'Umiejętność artystyczna lub rzemieślnicza. Wymaga specjalizacji.',
  Ślusarstwo: 'Otwieranie zamków i sejfów bez klucza. Narzędzia włamywacza.',
  Tropienie: 'Śledzenie śladów ludzi i zwierząt. Baza: 10%',
  Unik: 'Unikanie ataków w walce. Automatycznie = ZR/2',
  Ukrywanie: 'Chowanie przedmiotów lub siebie. Baza: 20%',
  'Urok Osobisty': 'Charyzma i osobisty magnetyzm. Baza: 15%',
  'Walka Wręcz':
    'Walka bez broni lub bronią białą. Bijatyka, miecze, noże. Baza: 25%',
  'Walka Wręcz (Bijatyka)':
    'Walka wręcz na gołe pięści, kopniaki, zapasy i użycie improwizowanej broni podręcznej. Baza: 25%',
  'Walka Wręcz (Broń Obuchowa)':
    'Walka pałkami, maczugami, młotami bojowymi i kijami. Baza: 10%',
  'Walka Wręcz (Szabla/Miecz)':
    'Walka szablą, szpadą, mieczem lub rapierem. Baza: 10%',
  'Wiedza o Naturze':
    'Znajomość fauny, flory, klimatu i zjawisk w świecie przyrody. Baza: 10%',
  'Wiedza Tajemna':
    'Znajomość zapomnianych wierzeń, hermetyzmu, alchemii i tajnych stowarzyszeń. Baza: 01%',
  Wspinaczka: 'Wspinanie się po budynkach, klifach, drzewach. Baza: 20%',
  Wycena: 'Określanie wartości przedmiotów. Antyki, biżuteria, dzieła sztuki.',
  Zastraszanie: 'Zastraszanie i groźby. Wymuszanie posłuszeństwa. Baza: 15%',
  'Zręczne Palce':
    'Kradzież kieszonkowa, kuglarstwo, otwieranie prostych skrytek i ukrywanie drobiazgów w dłoni. Baza: 10%',
  Majętność:
    'Status materialny postaci. Określa styl życia i dostęp do pieniędzy.',
};

// Bazowe umiejętności (Unik i Język Ojczysty są obliczane dynamicznie)
export const BASE_SKILLS: Record<string, number> = {
  Antropologia: 1,
  Archeologia: 1,
  Biblioteka: 20,
  'Broń Artyleryjska': 1,
  'Broń Palna': 20,
  'Broń Palna (Broń Ciężka)': 10,
  'Broń Palna (Karabin)': 25,
  'Broń Palna (Karabin Maszynowy)': 10,
  'Broń Palna (Krótka)': 20,
  'Broń Palna (Łuk)': 15,
  'Broń Palna (Miotacz Ognia)': 10,
  'Broń Palna (Pistolet Maszynowy)': 15,
  Elektryka: 10,
  Gadanina: 5,
  Historia: 5,
  Jeździectwo: 5,
  'Język Obcy': 1,
  'Język Ojczysty': 0, // Ustawiane dynamicznie = WYK
  Komputery: 5,
  Księgowość: 5,
  Mechanika: 10,
  Medycyna: 1,
  'Mity Cthulhu': 0,
  Nauka: 1,
  Nasłuchiwanie: 20,
  'Obsługa Ciężkiego Sprzętu': 1,
  Okultyzm: 5,
  Orientacja: 10,
  'Pierwsza Pomoc': 30,
  Pilotowanie: 1,
  Pływanie: 20,
  Prawo: 5,
  'Prowadzenie Samochodu': 20,
  Przebranie: 5,
  Przetrwanie: 10,
  Perswazja: 10,
  Psychoanaliza: 1,
  Psychologia: 10,
  Rzucanie: 20,
  Skok: 20,
  Skradanie: 20,
  Spostrzegawczość: 25,
  'Sztuka/Rzemiosło': 5,
  Ślusarstwo: 1,
  Tropienie: 10,
  Unik: 0, // Ustawiane dynamicznie = ZR/2
  Ukrywanie: 20,
  'Urok Osobisty': 15,
  'Walka Wręcz': 25,
  'Walka Wręcz (Bijatyka)': 25,
  'Walka Wręcz (Broń Obuchowa)': 10,
  'Walka Wręcz (Szabla/Miecz)': 10,
  'Wiedza o Naturze': 10,
  'Wiedza Tajemna': 1,
  Wspinaczka: 20,
  Wycena: 5,
  Zastraszanie: 15,
  'Zręczne Palce': 10,
  Majętność: 0,
};

// Maksymalny poziom umiejętności podczas tworzenia postaci (wyjątki: Język Ojczysty, Majętność)
export const SKILL_CREATION_LIMIT = 75;
export const SKILL_LIMIT_EXCEPTIONS = ['Język Ojczysty', 'Majętność'];

/**
 * Kanoniczne angielskie nazwy bazowych umiejetnosci Call of Cthulhu 7e RAW.
 */
export const SKILL_NAMES_EN: Record<string, string> = {
  "Antropologia": "Anthropology",
  "Archeologia": "Archaeology",
  "Biblioteka": "Library Use",
  "Broń Artyleryjska": "Artillery",
  "Broń Palna": "Firearms",
  "Broń Palna (Broń Ciężka)": "Firearms (Heavy Weapons)",
  "Broń Palna (Karabin)": "Firearms (Rifle/Shotgun)",
  "Broń Palna (Karabin Maszynowy)": "Firearms (Machine Gun)",
  "Broń Palna (Krótka)": "Firearms (Handgun)",
  "Broń Palna (Łuk)": "Firearms (Bow)",
  "Broń Palna (Miotacz Ognia)": "Firearms (Flamethrower)",
  "Broń Palna (Pistolet Maszynowy)": "Firearms (Submachine Gun)",
  "Elektryka": "Electrical Repair",
  "Gadanina": "Fast Talk",
  "Historia": "History",
  "Jeździectwo": "Ride",
  "Język Obcy": "Language (Other)",
  "Język Ojczysty": "Language (Own)",
  "Komputery": "Computers",
  "Księgowość": "Accounting",
  "Mechanika": "Mechanical Repair",
  "Medycyna": "Medicine",
  "Mity Cthulhu": "Cthulhu Mythos",
  "Nauka": "Science",
  "Nasłuchiwanie": "Listen",
  "Obsługa Ciężkiego Sprzętu": "Operate Heavy Machinery",
  "Okultyzm": "Occult",
  "Orientacja": "Navigate",
  "Pierwsza Pomoc": "First Aid",
  "Pilotowanie": "Pilot",
  "Pływanie": "Swim",
  "Prawo": "Law",
  "Prowadzenie Samochodu": "Drive Auto",
  "Przebranie": "Disguise",
  "Przetrwanie": "Survival",
  "Perswazja": "Persuade",
  "Psychoanaliza": "Psychoanalysis",
  "Psychologia": "Psychology",
  "Rzucanie": "Throw",
  "Skok": "Jump",
  "Skradanie": "Stealth",
  "Spostrzegawczość": "Spot Hidden",
  "Sztuka/Rzemiosło": "Art and Craft",
  "Ślusarstwo": "Locksmith",
  "Tropienie": "Track",
  "Unik": "Dodge",
  "Ukrywanie": "Conceal",
  "Urok Osobisty": "Charm",
  "Walka Wręcz": "Fighting",
  "Walka Wręcz (Bijatyka)": "Fighting (Brawl)",
  "Walka Wręcz (Broń Obuchowa)": "Fighting (Blunt)",
  "Walka Wręcz (Szabla/Miecz)": "Fighting (Sword)",
  "Wiedza o Naturze": "Natural World",
  "Wiedza Tajemna": "Occult Lore",
  "Wspinaczka": "Climb",
  "Wycena": "Appraise",
  "Zastraszanie": "Intimidate",
  "Zręczne Palce": "Sleight of Hand",
  "Majętność": "Credit Rating",
  "Dowolna": "Any Skill",
  "Dowolna Umiejętność": "Any Skill",
  "Język Obcy (2)": "Language (Other) (2)",
  "Język Obcy (łacina)": "Language (Other) (Latin)",
  "Nauka (Astronomia)": "Science (Astronomy)",
  "Nauka (Biologia)": "Science (Biology)",
  "Nauka (Chemia)": "Science (Chemistry)",
  "Nauka (Druga)": "Science (Second)",
  "Nauka (Farmacja)": "Science (Pharmacy)",
  "Nauka (Farmakologia)": "Science (Pharmacology)",
  "Nauka (Fizyka)": "Science (Physics)",
  "Nauka (Geologia)": "Science (Geology)",
  "Nauka (Matematyka)": "Science (Mathematics)",
  "Nauka (Specjalizacja)": "Science (Specialization)",
  "Nauka (Zoologia)": "Science (Zoology)",
  "Pilotowanie (Łódź)": "Pilot (Boat)",
  "Sztuka/Rzemiosło (Fotografia)": "Art and Craft (Photography)",
  "Sztuka/Rzemiosło (Muzyka)": "Art and Craft (Music)"
};

/**
 * Angielskie opisy umiejetnosci Call of Cthulhu 7e RAW dla tooltipow i kart pomocy.
 */
export const SKILL_DESCRIPTIONS_EN: Record<string, string> = {
  "Antropologia": "Study of human cultures, beliefs, and behaviors. Used to understand unfamiliar customs and isolated tribal traditions.",
  "Archeologia": "Expertise in ancient civilizations, ruins, and excavation techniques. Used to analyze historical relics and lost tombs.",
  "Biblioteka": "Skill in navigating archives, libraries, newspapers, and microfiche to uncover hidden records and documented facts.",
  "Broń Artyleryjska": "Operation, targeting, and maintenance of field artillery, mortars, and military naval ordnance. Base: 01%",
  "Broń Palna": "Proficiency in maintaining and shooting handguns and revolvers. Base: 20%",
  "Broń Palna (Broń Ciężka)": "Operation of anti-tank rifles, rocket launchers, grenade throwers, and vehicular armaments. Base: 10%",
  "Broń Palna (Karabin)": "Proficiency with hunting rifles, bolt-action service rifles, and shotguns. Base: 25%",
  "Broń Palna (Karabin Maszynowy)": "Firing and clearing heavy and light tripod- or bipod-mounted machine guns. Base: 10%",
  "Broń Palna (Krótka)": "Accurate drawing, aiming, and firing of semi-automatic pistols and revolvers. Base: 20%",
  "Broń Palna (Łuk)": "Target shooting with longbows, short bows, composite bows, and hunting crossbows. Base: 15%",
  "Broń Palna (Miotacz Ognia)": "Deploying military flamethrowers and managing hazardous pressurized fuel tanks. Base: 10%",
  "Broń Palna (Pistolet Maszynowy)": "Firing burst and full-auto submachine guns like the Thompson or MP 18. Base: 15%",
  "Elektryka": "Wiring, troubleshooting, and repairing electrical circuits, generators, fuses, and appliances.",
  "Gadanina": "The art of confusing, distracting, or fast-talking someone into momentary compliance or agreement.",
  "Historia": "Knowledge of past events, dynasties, social shifts, and historical contexts of people and places.",
  "Jeździectwo": "Equestrian riding skill, saddle control, and calming startled horses in hostile environments.",
  "Język Obcy": "Knowledge and conversational fluency in a specified foreign language. Rating equals percentage proficiency.",
  "Język Ojczysty": "Command of one mother tongue, syntax, and vocabulary. Automatically equals Education (EDU).",
  "Komputery": "Operating computing terminals, software systems, programming languages, and network protocols.",
  "Księgowość": "Auditing financial ledgers, corporate spreadsheets, tax declarations, and uncovering embezzlement.",
  "Mechanika": "Diagnosing, disassembling, and repairing combustion engines, clockwork mechanisms, valves, and locks.",
  "Medycyna": "Professional diagnosis and treatment of diseases, infections, trauma, and surgical procedures.",
  "Mity Cthulhu": "Forbidden revelations concerning the Great Old Ones and cosmic entities. Base: 00%, lowers maximum Sanity.",
  "Nauka": "Rigorous scientific knowledge in a specialized academic discipline like chemistry, biology, or physics.",
  "Nasłuchiwanie": "Acuity in detecting faint footsteps, hushed whispers, distant clicks, or breathing in the dark. Base: 20%",
  "Obsługa Ciężkiego Sprzętu": "Driving steam tractors, excavators, cranes, locomotives, and industrial factory equipment. Base: 01%",
  "Okultyzm": "Knowledge of folklore, esoteric traditions, spiritualism, and secret sects. Does not reveal Mythos truths.",
  "Orientacja": "Reading nautical charts, topological maps, celestial constellations, and finding coordinates.",
  "Pierwsza Pomoc": "Emergency roadside medical treatment, applying tourniquets, bandaging wounds, and revival. Base: 30%",
  "Pilotowanie": "Piloting aircraft, biplanes, sea vessels, or dirigibles through turbulent conditions.",
  "Pływanie": "Swimming through rough surf, navigating submerged passages, and treading water while weighed down. Base: 20%",
  "Prawo": "Knowledge of statutory laws, judicial precedents, criminal court procedures, and legal protections.",
  "Prowadzenie Samochodu": "Operating automobiles, trucks, and taxis during hazardous road conditions and vehicular pursuits. Base: 20%",
  "Przebranie": "Cosmetic alterations, posture adjustment, voice modulation, and clothing to conceal identity.",
  "Przetrwanie": "Wilderness foraging, erecting shelters, tracking potable water, and braving hostile climates.",
  "Perswazja": "Convincing others through compelling arguments, evidence, rational debate, and structured negotiation. Base: 10%",
  "Psychoanaliza": "Clinical therapeutic treatment to alleviate acute emotional panic, bouts of madness, and psychological trauma. Base: 01%",
  "Psychologia": "Perceiving underlying human motivations, emotional states, nervous tics, and assessing deceit. Base: 10%",
  "Rzucanie": "Hurling items with trajectory precision, including grenades, knives, stones, and ropes. Base: 20%",
  "Skok": "Leaping across rooftops, hurdles, and vertical obstacles with measured athletic momentum. Base: 20%",
  "Skradanie": "Moving silently without rustling, minimizing shadow exposure, and avoiding roving sentries. Base: 20%",
  "Spostrzegawczość": "Noticing minute physical clues, hidden compartments, disguised tripwires, and skulking figures. Base: 25%",
  "Sztuka/Rzemiosło": "Artistic expression or artisan craftsmanship in a specific medium like painting, photography, or carpentry.",
  "Ślusarstwo": "Picking tumbler locks, cracking safes, bypassing latches, and studying mechanical security devices.",
  "Tropienie": "Following physical spoor, trampled foliage, tire treads, and blood trails across various terrains. Base: 10%",
  "Unik": "Instinctively evading incoming blows, projectile arcs, and collapsing hazards. Automatically half Dexterity.",
  "Ukrywanie": "Stashing contraband, concealing weapons under clothing, or hiding behind cover. Base: 20%",
  "Urok Osobisty": "Eliciting warmth and favor through magnetic charisma, flattery, social grace, and personal appeal. Base: 15%",
  "Walka Wręcz": "Unarmed close-quarters combat or fighting with simple contact weapons. Base: 25%",
  "Walka Wręcz (Bijatyka)": "Bare-knuckle boxing, brawling, grappling, and using improvised tavern weapons. Base: 25%",
  "Walka Wręcz (Broń Obuchowa)": "Wielding blunt instruments like clubs, saps, warhammers, maces, and walking sticks. Base: 10%",
  "Walka Wręcz (Szabla/Miecz)": "Fencing, parrying, and slashing with sabres, rapiers, broadswords, and cavalry blades. Base: 10%",
  "Wiedza o Naturze": "Recognizing flora, fauna, geological formations, weather patterns, and wilderness ecosystems. Base: 10%",
  "Wiedza Tajemna": "Obscure knowledge of forgotten grimoires, secret hermetic orders, and forbidden manuscripts. Base: 01%",
  "Wspinaczka": "Ascending vertical surfaces, stone facades, rigging, drainpipes, and sheer crags. Base: 20%",
  "Wycena": "Estimating market values and authenticity of antiques, jewelry, rare books, and fine art pieces.",
  "Zastraszanie": "Coercing cooperation through overt threats, menacing demeanor, physical stature, and cold stares. Base: 15%",
  "Zręczne Palce": "Manual dexterity in pickpocketing, palming items, misdirection, and card manipulation. Base: 10%",
  "Majętność": "Material affluence and credit standing, dictating spending limits, social status, and lifestyle tier.",
  "Dowolna": "Any occupational or personal skill chosen by the investigator."
};

/**
 * Normalizuje klucz umiejetnosci (male litery, bez nadmiarowych spacji).
 */
function normalizeSkillKey(str: string): string {
  return str.trim().toLowerCase();
}

/**
 * Odwrocona mapa EN -> PL dla szybkiego resolve w obydwie strony.
 */
const SKILL_MAP_EN_TO_PL: Record<string, string> = {};
for (const [plName, enName] of Object.entries(SKILL_NAMES_EN)) {
  SKILL_MAP_EN_TO_PL[normalizeSkillKey(enName)] = plName;
}

// Dodatkowe popularne warianty angielskie i aliasy
const ADDITIONAL_SKILL_ALIASES_EN_TO_PL: Record<string, string> = {
  'spot hidden': 'Spostrzegawczość',
  'library use': 'Biblioteka',
  'first aid': 'Pierwsza Pomoc',
  'fast talk': 'Gadanina',
  'fast-talk': 'Gadanina',
  'credit rating': 'Majętność',
  'sleight of hand': 'Zręczne Palce',
  'locksmith': 'Ślusarstwo',
  'cthulhu mythos': 'Mity Cthulhu',
  'dodge': 'Unik',
  'fighting (brawl)': 'Walka Wręcz (Bijatyka)',
  'brawl': 'Walka Wręcz (Bijatyka)',
  'fighting': 'Walka Wręcz',
  'firearms (handgun)': 'Broń Palna (Krótka)',
  'handgun': 'Broń Palna (Krótka)',
  'firearms (rifle/shotgun)': 'Broń Palna (Karabin)',
  'rifle/shotgun': 'Broń Palna (Karabin)',
  'firearms (submachine gun)': 'Broń Palna (Pistolet Maszynowy)',
  'submachine gun': 'Broń Palna (Pistolet Maszynowy)',
  'smg': 'Broń Palna (Pistolet Maszynowy)',
  'firearms (machine gun)': 'Broń Palna (Karabin Maszynowy)',
  'firearms (heavy weapons)': 'Broń Palna (Broń Ciężka)',
  'firearms (bow)': 'Broń Palna (Łuk)',
  'firearms (flamethrower)': 'Broń Palna (Miotacz Ognia)',
  'firearms': 'Broń Palna',
  'stealth': 'Skradanie',
  'conceal': 'Ukrywanie',
  'climb': 'Wspinaczka',
  'jump': 'Skok',
  'swim': 'Pływanie',
  'throw': 'Rzucanie',
  'accounting': 'Księgowość',
  'anthropology': 'Antropologia',
  'appraise': 'Wycena',
  'archaeology': 'Archeologia',
  'art and craft': 'Sztuka/Rzemiosło',
  'art / craft': 'Sztuka/Rzemiosło',
  'art/craft': 'Sztuka/Rzemiosło',
  'art': 'Sztuka/Rzemiosło',
  'charm': 'Urok Osobisty',
  'disguise': 'Przebranie',
  'drive auto': 'Prowadzenie Samochodu',
  'driving': 'Prowadzenie Samochodu',
  'electrical repair': 'Elektryka',
  'history': 'Historia',
  'intimidate': 'Zastraszanie',
  'intimidation': 'Zastraszanie',
  'law': 'Prawo',
  'listen': 'Nasłuchiwanie',
  'mechanical repair': 'Mechanika',
  'medicine': 'Medycyna',
  'natural world': 'Wiedza o Naturze',
  'navigate': 'Orientacja',
  'navigation': 'Orientacja',
  'occult': 'Okultyzm',
  'occult lore': 'Wiedza Tajemna',
  'operate heavy machinery': 'Obsługa Ciężkiego Sprzętu',
  'persuade': 'Perswazja',
  'persuasion': 'Perswazja',
  'pilot': 'Pilotowanie',
  'psychoanalysis': 'Psychoanaliza',
  'psychology': 'Psychologia',
  'ride': 'Jeździectwo',
  'science': 'Nauka',
  'survival': 'Przetrwanie',
  'track': 'Tropienie',
  'language (other)': 'Język Obcy',
  'language (own)': 'Język Ojczysty',
  'computers': 'Komputery',
  'artillery': 'Broń Artyleryjska'
};

for (const [alias, pl] of Object.entries(ADDITIONAL_SKILL_ALIASES_EN_TO_PL)) {
  SKILL_MAP_EN_TO_PL[alias] = pl;
}

/**
 * Zwraca zlokalizowana nazwe umiejetnosci Call of Cthulhu 7e w zadanym jezyku ('pl' lub 'en').
 * Obsluguje dwukierunkowe mapowanie:
 * - 'Spostrzegawczość' -> 'Spot Hidden' (gdy locale === 'en')
 * - 'Spot Hidden' -> 'Spostrzegawczość' (gdy locale === 'pl')
 * - Nierozpoznane/specjalistyczne nazwy zwraca nienaruszone (fallback).
 */
export function getLocalizedSkillName(
  skillName: string | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!skillName) return '';
  const raw = skillName.trim();
  if (!raw) return '';

  const isEn = locale === 'en';

  // 1. Sprawdz bezposrednie mapowanie PL -> EN
  if (isEn && SKILL_NAMES_EN[raw]) {
    return SKILL_NAMES_EN[raw];
  }

  // 2. Jesli szukamy wersji PL, sprawdz czy wejscie to nazwa EN
  const norm = normalizeSkillKey(raw);
  if (!isEn && SKILL_MAP_EN_TO_PL[norm]) {
    return SKILL_MAP_EN_TO_PL[norm];
  }

  // 3. Sprawdz czy wejscie to wariant PL z wielkoscia liter
  for (const [plName, enName] of Object.entries(SKILL_NAMES_EN)) {
    if (normalizeSkillKey(plName) === norm) {
      return isEn ? enName : plName;
    }
  }

  // 4. Obsluz specyfikacje w nawiasach, np. "Język Obcy (łacina)" -> "Language (Other) (łacina)"
  const bracketMatch = raw.match(/^([^(]+)\(([^)]+)\)$/);
  if (bracketMatch) {
    const baseName = bracketMatch[1].trim();
    const spec = bracketMatch[2].trim();
    const localizedBase = getLocalizedSkillName(baseName, locale);
    if (localizedBase && localizedBase !== baseName) {
      return `${localizedBase} (${spec})`;
    }
  }

  // 5. Fallback: zwroc oryginalna nazwe
  return raw;
}

/**
 * Zwraca zlokalizowany opis umiejetnosci dla tooltipow.
 */
export function getLocalizedSkillDescription(
  skillName: string | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!skillName) return '';
  const raw = skillName.trim();
  if (!raw) return '';

  const norm = normalizeSkillKey(raw);

  // Ustal kanoniczny klucz PL
  let plKey = raw;
  if (SKILL_DESCRIPTIONS[raw]) {
    plKey = raw;
  } else if (SKILL_MAP_EN_TO_PL[norm]) {
    plKey = SKILL_MAP_EN_TO_PL[norm];
  } else {
    // Sprawdz bez nawiasow jesli specjalizacja
    const bracketMatch = raw.match(/^([^(]+)\(/);
    if (bracketMatch) {
      const baseName = bracketMatch[1].trim();
      const baseNorm = normalizeSkillKey(baseName);
      if (SKILL_DESCRIPTIONS[baseName]) {
        plKey = baseName;
      } else if (SKILL_MAP_EN_TO_PL[baseNorm]) {
        plKey = SKILL_MAP_EN_TO_PL[baseNorm];
      }
    }
  }

  if (locale === 'en') {
    return SKILL_DESCRIPTIONS_EN[plKey] || SKILL_DESCRIPTIONS[plKey] || '';
  }
  return SKILL_DESCRIPTIONS[plKey] || SKILL_DESCRIPTIONS_EN[plKey] || '';
}
