import { type DossierLocale, type PreparedHandout } from './prepared-dossier';
import { starterDocumentImage } from './starter-document';

export const phrase = (
  locale: DossierLocale,
  pl: string,
  en: string
): string => (locale === 'en' ? en : pl);
const pack = '/adventure-packs/case-s11-01/';
interface Aid {
  slug: string;
  number?: number;
  scene: string;
  pages: number[];
  checks?: string[];
  requires?: string[];
  title: [string, string];
  text: [string, string];
  action: [string, string];
  type?: PreparedHandout['handoutType'];
  illustration?: string;
  symbol?: boolean;
}
const aids: Aid[] = [
  {
    slug: 'clue-01-knott-keys',
    number: 1,
    scene: 'node-knott-office',
    pages: [15, 16, 30],
    title: ['Zlecenie Knotta', 'Knott’s commission'],
    text: [
      'Zbadajcie Corbitt House w centrum Bostonu. Poprzedni lokatorzy, rodzina Macario, przeżyli tam tragedię. Zła sława utrudnia wynajęcie domu. Ustalcie, co się wydarzyło, i wyjaśnijcie pogłoski. Knott przekazuje adres, klucze oraz 25 dolarów zaliczki. Możecie zacząć od redakcji Boston Globe, Biblioteki Głównej lub archiwum miejskiego. Możecie też od razu obejrzeć dom.',
      'Investigate Corbitt House in central Boston. Its previous tenants, the Macario family, suffered a tragedy. The house’s reputation makes it difficult to rent. Find out what happened and explain the rumours. Knott supplies the address, keys and a 25-dollar advance. Possible starting points include the Boston Globe, the Central Library and city archives. You may also go directly to the house.',
    ],
    action: ['Przyjąć zlecenie i klucze.', 'Accept the commission and keys.'],
    illustration: pack + 'clue-01-knott-keys.webp',
  },
  {
    slug: 'clue-02-boston-globe-1918',
    number: 2,
    scene: 'node-boston-globe',
    pages: [17, 30],
    checks: ['globe-access'],
    title: [
      'Nieopublikowany artykuł Boston Globe, 1918',
      'Unpublished Boston Globe article, 1918',
    ],
    type: 'newspaper',
    text: [
      'Notatka z archiwum: w 1880 roku francuscy imigranci zamieszkali w Corbitt House. Wypadki doprowadziły do śmierci rodziców i trwałych obrażeń trojga dzieci. Następna rodzina wynajęła dom w 1909 roku; w 1914 najstarszy syn popadł w obłęd i zginął z własnej ręki, używając noża kuchennego. Pogrążona w żałobie rodzina wyprowadziła się. Państwo Macario wynajęli dom w 1918 roku, lecz szybko opuścili go w niewyjaśnionych okolicznościach.',
      'Archive summary: French immigrants moved into Corbitt House in 1880. Accidents killed the parents and permanently injured their three children. Another family rented the house in 1909; in 1914 their eldest son became mentally ill and killed himself with a kitchen knife. The bereaved family moved away. The Macarios rented the house in 1918, but soon left under unexplained circumstances.',
    ],
    action: [
      'Uzyskać dostęp do archiwum gazety i zbadać sprawę domu.',
      'Gain access to the newspaper archive and research the house.',
    ],
  },
  {
    slug: 'clue-03-land-registry-1852',
    number: 3,
    scene: 'node-library',
    pages: [17, 30],
    checks: ['library-1'],
    title: ['Historia własności: 1852', 'Property history: 1852'],
    text: [
      'W 1852 roku zamożny kupiec zbudował dom. Po nagłym pogorszeniu zdrowia sprzedał nieruchomość Walterowi Corbittowi.',
      'A wealthy merchant built the house in 1852. Following a sudden illness, he sold the property to Walter Corbitt.',
    ],
    action: [
      'Pierwszy udany etap badań bibliotecznych.',
      'Complete the first successful library research stage.',
    ],
    illustration: pack + 'clue-03-land-registry-1852.webp',
  },
  {
    slug: 'clue-04-lawsuit-1853',
    number: 4,
    scene: 'node-library',
    pages: [17, 30],
    checks: ['library-2'],
    requires: ['clue-03-land-registry-1852'],
    title: ['Pozew sąsiadów, 1853', 'Neighbours’ petition, 1853'],
    text: [
      'W 1853 roku sąsiedzi wystąpili przeciw Walterowi Corbittowi. Żądali usunięcia go z okolicy ze względu na jego niepokojące zachowanie i wygląd.',
      'In 1853, neighbours brought a case against Walter Corbitt. They sought his removal from the neighbourhood because of his disturbing habits and appearance.',
    ],
    action: [
      'Drugi udany etap badań bibliotecznych.',
      'Complete the second successful library research stage.',
    ],
    illustration: pack + 'clue-04-lawsuit-1853.webp',
  },
  {
    slug: 'clue-05-obituary-1866',
    number: 5,
    scene: 'node-library',
    pages: [18, 30],
    checks: ['library-3'],
    requires: ['clue-04-lawsuit-1853'],
    title: [
      'Nekrolog Waltera Corbitta, 1866',
      'Walter Corbitt’s obituary, 1866',
    ],
    type: 'newspaper',
    text: [
      'Nekrolog z 1866 roku wskazuje, że Walter Corbitt do śmierci mieszkał w tym samym domu. Zmarł podczas drugiego sporu sądowego. Tym razem kwestionowano jego życzenie pochowania ciała w piwnicy posiadłości.',
      'The 1866 obituary places Walter Corbitt at the same address until his death. He died during a second legal dispute, this time over his wish to have his body buried in the cellar of the property.',
    ],
    action: [
      'Trzeci udany etap badań bibliotecznych.',
      'Complete the third successful library research stage.',
    ],
  },
  {
    slug: 'clue-06-missing-court-verdict',
    number: 6,
    scene: 'node-library',
    pages: [18, 30],
    checks: ['library-4'],
    requires: ['clue-05-obituary-1866'],
    title: ['Brak wyroku w rejestrze', 'No verdict on record'],
    text: [
      'Nie odnaleziono zapisu o rozstrzygnięciu drugiego procesu dotyczącego pochówku Waltera Corbitta.',
      'No record of the judgment in the second case concerning Walter Corbitt’s burial has been found.',
    ],
    action: [
      'Czwarty udany etap badań bibliotecznych.',
      'Complete the fourth successful library research stage.',
    ],
  },
  {
    slug: 'clue-06-court-executor-record',
    number: 7,
    scene: 'node-city-hall',
    pages: [18, 30],
    checks: ['archives-search'],
    title: ['Wykonawca testamentu', 'Executor of the will'],
    text: [
      'Akta miejskie wskazują wielebnego Michaela Thomasa jako wykonawcę testamentu Waltera Corbitta. Thomas był pastorem Kaplicy Kontemplacji i Kościoła Pana Naszego Dawcy Tajemnic. Rejestr instytucji religijnych odnotowuje zamknięcie kaplicy w 1912 roku.',
      'City records name Reverend Michael Thomas as executor of Walter Corbitt’s will. Thomas served the Chapel of Contemplation and the Church of Our Lord Granter of Secrets. The religious institutions register records the chapel’s closure in 1912.',
    ],
    action: [
      'Udane przeszukanie akt miejskich.',
      'Successfully search the city records.',
    ],
  },
  {
    slug: 'clue-07-police-raid-file',
    number: 8,
    scene: 'node-courthouse',
    pages: [18, 30],
    checks: ['court-access'],
    title: ['Akta nalotu na kaplicę, 1912', 'Chapel raid records, 1912'],
    text: [
      'Zeznania wiązały członków kościoła z zaginięciami dzieci. Podczas nalotu w 1912 roku zginęło trzech policjantów i siedemnastu członków sekty. Aresztowano 54 osoby; zatrzymano osiem. Sprawę wyciszano; skąpe raporty z autopsji sugerują, że sekcji nie wykonano. Michael Thomas odpowiadał za pięć zabójstw. Otrzymał wyrok czterdziestu lat więzienia, lecz uciekł w 1917 roku i opuścił Massachusetts.',
      'Witness statements linked church members to missing children. The 1912 raid left three police officers and seventeen cult members dead. Fifty-four people were arrested; eight were held. The affair was suppressed; sparse autopsy records suggest no examinations took place. Michael Thomas was charged with five murders. He received a forty-year sentence, but escaped in 1917 and left Massachusetts.',
    ],
    action: [
      'Uzyskać dostęp do akt sądowych lub policyjnych.',
      'Obtain access to court or police files.',
    ],
    illustration: pack + 'clue-07-police-raid-file.webp',
  },
  {
    slug: 'clue-08-cult-symbol-sketch',
    number: 9,
    scene: 'node-chapel-ruins',
    pages: [20, 30],
    title: ['Symbol z kaplicy', 'Symbol from the chapel'],
    text: [
      'Trzy znaki w kształcie litery Y tworzą trójkąt wokół otwartego oka.',
      'Three Y-shaped marks form a triangle around an open eye.',
    ],
    action: [
      'Obejrzeć symbol w ruinach kaplicy.',
      'Examine the symbol in the chapel ruins.',
    ],
    symbol: true,
  },
  {
    slug: 'clue-09-corbitt-journal',
    scene: 'node-corbitt-house',
    pages: [21],
    checks: ['open-journal-cabinet'],
    title: ['Trzy tomy dzienników Corbitta', 'Corbitt’s three journal volumes'],
    type: 'diary',
    text: [
      'W szafce składziku na parterze znajdują się trzy tomy zapisane po angielsku. Zapiski dotyczą osobistych doświadczeń i poszukiwań okultystycznych autora. Ich uważna lektura zajmie około dwóch dni.',
      'The ground-floor storeroom cabinet contains three volumes written in English. They concern the author’s personal experiences and occult investigations. Careful study will take about two days.',
    ],
    action: [
      'Otworzyć zabitą gwoździami szafkę w składziku.',
      'Open the nailed-shut cabinet in the storeroom.',
    ],
    illustration: pack + 'clue-09-corbitt-journal.webp',
  },
  {
    slug: 'item-corbitt-dagger',
    scene: 'node-corbitt-basement',
    pages: [23, 24],
    checks: ['knife-discovery'],
    title: ['Stary nóż', 'Old knife'],
    text: [
      'Pośród rzeczy w piwnicy leży stary nóż. Można go zbadać, spróbować zabrać albo pozostawić na miejscu.',
      'An old knife lies among the cellar clutter. It can be examined, picked up or left where it is.',
    ],
    action: [
      'Odnaleźć nóż podczas przeszukiwania piwnicy.',
      'Find the knife while searching the cellar.',
    ],
    illustration: pack + 'item-corbitt-dagger.webp',
  },
  {
    slug: 'clue-chapel-cult-journal',
    scene: 'node-chapel-ruins',
    pages: [20],
    checks: ['chapel-search'],
    title: ['Dziennik działalności kultu', 'Cult activity journal'],
    type: 'diary',
    text: [
      'Butwiejące zapiski z kaplicy wymieniają Waltera Corbitta. Odnotowują jego pochówek w piwnicy własnego domu, zgodnie z jego życzeniem oraz wolą kogoś oczekującego w ciemności.',
      'Decaying chapel notes name Walter Corbitt. They record his burial in the cellar of his own house, in accordance with his wish and the will of someone waiting in darkness.',
    ],
    action: [
      'Przeszukać przestrzeń pod szafką w podziemiu kaplicy.',
      'Search beneath the cabinet in the chapel cellar.',
    ],
  },
  {
    slug: 'item-liber-ivonis',
    scene: 'node-chapel-ruins',
    pages: [20, 21],
    checks: ['chapel-search'],
    title: ['Zbutwiała księga łacińska', 'Decaying Latin book'],
    type: 'book',
    text: [
      'Wielka, ręcznie spisana księga jest zniszczona przez wilgoć i larwy. Wiele fragmentów pozostaje nieczytelnych. Pobieżne oględziny wskazują na łacińskie dzieło okultystyczne. Rozpoznanie tekstu i jego studiowanie wymaga osobnego działania.',
      'The large handwritten book is damaged by damp and larvae. Many passages are unreadable. A cursory examination suggests a Latin work on occult subjects. Identifying and studying its text requires a separate action.',
    ],
    action: [
      'Odnaleźć księgę pod szafką w kaplicy.',
      'Find the book beneath the cabinet in the chapel.',
    ],
  },
  {
    slug: 'clue-crypt-horoscope',
    scene: 'node-corbitt-crypt',
    pages: [26, 28],
    title: ['Kruchy arkusz na stole', 'Brittle sheet on the table'],
    text: [
      'Wśród papierów na stole leży kruchy arkusz przypominający horoskop. Papier rozpada się przy dotknięciu. Sam jego wygląd nie wyjaśnia znaczenia zapisu.',
      'Among the papers on the table lies a brittle sheet resembling a horoscope. The paper crumbles when touched. Its appearance alone does not explain the meaning of the markings.',
    ],
    action: [
      'Obejrzeć papiery na stole w odkrytej komorze.',
      'Examine the papers on the table in the discovered chamber.',
    ],
  },
];

export function getHauntingHandouts(locale: DossierLocale): PreparedHandout[] {
  const i = locale === 'en' ? 1 : 0;
  return aids.map((a) => ({
    slug: a.slug,
    title: a.title[i],
    textContent: a.text[i],
    image: starterDocumentImage(
      a.title[i],
      a.text[i],
      a.slug,
      a.number,
      locale
    ),
    handoutType: a.type || 'report',
    isPlayerFacing: true,
    keeperOnly: false,
    nodeId: a.scene,
    sourceNumber: a.number,
    sourcePages: a.pages,
    provenance: 'source_derived',
    illustration: a.illustration,
    reveal: {
      sceneId: a.scene,
      checks: a.checks || [],
      requires: a.requires || [],
      action: a.action[i],
    },
  }));
}
