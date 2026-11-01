/**
 * STARTER: NAWIEDZONY DOM / THE HAUNTING (Boston 1920) - Issue #661 / #700
 *
 * Oficjalny scenariusz wprowadzający do Zewu Cthulhu 7e RAW (Starter Kit).
 * Kanoniczne materiały dowodowe, rekwizyty fizyczne i portrety NPC.
 */

import type { AdventureContext, AdventureHandout } from './adventures-data';
import {
  getHauntingHandouts,
  getHauntingGraph,
} from './adventures/starter-dossier';

export const HAUNTING_HANDOUTS: AdventureHandout[] = getHauntingHandouts('pl');

export const STARTER_HAUNTING_ADVENTURE: AdventureContext = {
  id: 'nawiedzony-dom',
  title: 'Nawiedzony Dom (The Haunting)',
  era: 'classic',
  eraLabel: 'Lata 20. (USA)',
  yearRange: '1920',
  activeSceneYear: 1920,
  // Explicit adaptation for the application clock; the source specifies only 1920.
  startDate: '1920-05-12T10:00',
  initialWeather:
    'Chłodny, wilgotny bostoński poranek z mgłą znad zatoki Massachusetts',
  location: 'Boston, Massachusetts',
  country: 'USA',
  tone: 'purist',
  themes: [
    'Nawiedzony Dom',
    'Zbrodnia z Przeszłości',
    'Kult Mitów',
    'Śledztwo Archiwalne',
  ],
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
    'Klasyczny scenariusz ze Startera Zewu Cthulhu 7e. Badacze badają sprawę rezydencji Corbitta, odkrywając tajemnicę dawnego procesu, sekty Kaplicy Kontemplacji i historii dawnych mieszkańców domu.',
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
  graph: getHauntingGraph('pl'),
};
