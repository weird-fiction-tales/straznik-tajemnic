/**
 * STARTER: NAWIEDZONY DOM / THE HAUNTING (Boston 1920) - Issue #661 / #700
 *
 * Oficjalny scenariusz wprowadzający do Zewu Cthulhu 7e RAW (Starter Kit).
 * Kanoniczne materiały dowodowe, rekwizyty fizyczne i portrety NPC.
 */

import type { AdventureContext, AdventureHandout } from './adventures-data';

export const HAUNTING_HANDOUTS: AdventureHandout[] = [
  {
    slug: 'clue-01-knott-keys',
    title: 'Zlecenie i klucze Knotta do Corbitt House',
    image: '/adventure-packs/case-s11-01/clue-01-knott-keys.webp',
    handoutType: 'report',
    textContent:
      'Pan Steven Knott przekazuje mosiężne klucze do Corbitt House, adres w centrum Bostonu oraz 25$ zaliczki. Poprzedni lokatorzy, rodzina Macario, padli ofiarą tragicznych wydarzeń.',
  },
  {
    slug: 'clue-02-boston-globe-1918',
    aliases: ['boston-globe-1918'],
    title: 'Nieopublikowany artykuł, „Boston Globe” (1918)',
    image: '/adventure-packs/case-s11-01/clue-02-boston-globe-1918.webp',
    handoutType: 'newspaper',
    textContent:
      'Nieopublikowany artykuł „Boston Globe” (1918): W 1880 r. do Corbitt House wprowadziła się rodzina francuskich imigrantów; seria krwawych wypadków przyniosła śmierć rodziców i kalectwo trojga dzieci. W 1914 r. najstarszy z kolejnych lokatorów oszalał i odebrał sobie życie nożem kuchennym. W 1918 r. rodzina Macario uciekła z rezydencji w niewyjaśnionych okolicznościach.',
  },
  {
    slug: 'clue-03-land-registry-1852',
    title: 'Wypis z rejestru gruntów bostońskich (1852)',
    image: '/adventure-packs/case-s11-01/clue-03-land-registry-1852.webp',
    handoutType: 'report',
    textContent:
      'Rejestr Gruntów Miasta Boston (1852): Posiadłość wzniesiona przez zamożnego kupca została sprzedana w wyniku nagłej choroby panu Walterowi Corbittowi, Esq.',
  },
  {
    slug: 'clue-04-lawsuit-1853',
    title: 'Pozew sąsiedzki przeciw Walterowi Corbittowi (1853)',
    image: '/adventure-packs/case-s11-01/clue-04-lawsuit-1853.webp',
    handoutType: 'report',
    textContent:
      'Sąd Pokoju w Bostonie (1853): Pozew sąsiadów żądających eksmisji Waltera Corbitta ze względu na „zdrożne nawyki i złowieszczą powierzchowność”.',
  },
  {
    slug: 'clue-05-obituary-1866',
    title: 'Nekrolog Waltera Corbitta (1866)',
    image: '/adventure-packs/case-s11-01/clue-05-obituary-1866.webp',
    handoutType: 'newspaper',
    textContent:
      'Bostoński nekrolog prasowy (1866): Walter Corbitt zmarł pod tym samym adresem w trakcie drugiego procesu sądowego, który miał uniemożliwić pochowanie jego ciała w piwnicy domu, jak nakazywał testament zmarłego.',
  },
  {
    slug: 'clue-06-court-executor-record',
    title: 'Akta wykonawcy testamentu (Archiwum Miejskie)',
    image: '/adventure-packs/case-s11-01/clue-06-court-executor-record.webp',
    handoutType: 'report',
    textContent:
      'Bostońskie Archiwum Miejskie: Wykonawcą testamentu Waltera Corbitta był wielebny Michael Thomas, pastor Kaplicy Kontemplacji oraz Kościoła Pana Naszego Dawcy Tajemnic. Rejestr odnotowuje zamknięcie świątyni w 1912 r.',
  },
  {
    slug: 'clue-07-police-raid-file',
    title: 'Raport z nalotu policji na Kaplicę Kontemplacji (1912)',
    image: '/adventure-packs/case-s11-01/clue-07-police-raid-file.webp',
    handoutType: 'report',
    textContent:
      'Boston Police Department - Raport z nalotu (1912): Tajna operacja w związku z zaginięciami okolicznych dzieci. W strzelaninie i pożarze zginęło 3 policjantów i 17 członków sekty. Pastor Michael Thomas skazany na 40 lat więzienia; uciekł w 1917 r.',
  },
  {
    slug: 'clue-08-cult-symbol-sketch',
    title: 'Odręczny szkic symbolu Kaplicy Kontemplacji',
    image: '/adventure-packs/case-s11-01/clue-08-cult-symbol-sketch.webp',
    handoutType: 'report',
    textContent:
      'Ręcznie wykreślony okultystyczny glif Kościoła Dawcy Tajemnic: Stylizowane oko otoczone płaczącymi promieniami i nieeuklidesowymi nacięciami.',
  },
  {
    slug: 'clue-09-corbitt-journal',
    title: 'Dziennik okultystyczny Waltera Corbitta',
    image: '/adventure-packs/case-s11-01/clue-09-corbitt-journal.webp',
    handoutType: 'diary',
    textContent:
      'Staroświecki, spleśniały pamiętnik oprawny w czarną skórę. Notatki Corbitta spisane po angielsku i łacinie opisują rytuały przywoływania Istoty w Ścianach oraz instrukcje zachowania świadomości po śmierci ciała.',
  },
  {
    slug: 'item-corbitt-dagger',
    title: 'Rytualny sztylet Waltera Corbitta',
    image: '/adventure-packs/case-s11-01/item-corbitt-dagger.webp',
    handoutType: 'report',
    textContent:
      'Antyczny sztylet ze sczerniałego żelaza i patynowanego brązu. Rękojeść z kości nosi zatarte ryty. Ostrze wydaje się nienaturalnie zimne w dotyku.',
  },
];

export const STARTER_HAUNTING_ADVENTURE: AdventureContext = {
  id: 'nawiedzony-dom',
  title: 'Nawiedzony Dom (The Haunting)',
  era: 'classic',
  eraLabel: 'Lata 20. (USA)',
  yearRange: '1920',
  activeSceneYear: 1920,
  startDate: '1920-05-12T10:00',
  initialWeather: 'Chłodny, wilgotny bostoński poranek z mgłą znad zatoki Massachusetts',
  location: 'Boston, Massachusetts',
  country: 'USA',
  tone: 'purist',
  themes: ['Nawiedzony Dom', 'Zbrodnia z Przeszłości', 'Kult Mitów', 'Śledztwo Archiwalne'],
  suggestedOccupations: [
    'Prywatny Detektyw',
    'Dziennikarz',
    'Antykwariusz',
    'Lekarz',
    'Profesor',
  ],
  suggestedArchetypes: ['investigator', 'scholar', 'action'],
  hook: 'Pan Steven Knott wynajmuje Badaczy do zbadania Corbitt House w centrum Bostonu, którego zła sława uniemożliwia znalezienie najemców.',
  description:
    'Klasyczny scenariusz ze Startera Zewu Cthulhu 7e. Badacze badają sprawę rezydencji Corbitta, odkrywając tajemnicę dawnego procesu, sekty Kaplicy Kontemplacji oraz spoczywającego w piwnicy nieumarłego czarnoksiężnika Waltera Corbitta.',
  investigatorIntro:
    'Maj 1920 roku, Boston. W biurze zleceniodawcy Steven Knott rozkłada przed wami mosiężne klucze do kamienicy przy starej brukowanej uliczce. Tragedia rodziny Macario odstraszyła lokatorów, a waszym zadaniem jest odkrycie prawdy i oczyszczenie reputacji budynku.',
  settingTrivia: [
    'Boston lat 20. to miasto kontrastów: nowoczesne biurowce sąsiadują z ponurymi, wiktoriańskimi kamienicami z czerwonej cegły.',
    'Archiwum wycinków Boston Globe („kostnica”) w piwnicy redakcji kryje tysiące niepublikowanych spraw kryminalnych.',
    'Kaplica Kontemplacji została spalona podczas tajnego nalotu bostońskiej policji w 1912 roku.',
  ],
  estimatedSessions: '1-2',
  playerCount: '1-4',
  difficulty: 'easy',
  source: 'Starter Zew Cthulhu 7e',
  sourceCategory: 'starter',
  recommendedForBeginners: true,
  documentType: 'scenario',
  handouts: HAUNTING_HANDOUTS,
};
