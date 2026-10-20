import { getSpellDefinition, getTomeDefinition } from '@/lib/magic';
import { getLocalizedOccupationName } from '@/lib/data/character';
/**
 * buildAdditionalContext - pure function dla sekcji 8 route.ts (IND-71 micro 1/3).
 *
 * Składa tablicę `additionalContext: string[]` przekazywaną do
 * `provider.streamChat({ geminiOptions: { additionalContext } })`.
 *
 * Zachowuje 1:1 kolejność push'y z oryginalnego route.ts (lin 267-315 przed split):
 *   1. timePromptSection
 *   2. gmProtocol (tylko gdy NIE cache - OPT-26: cache zawiera już protokół)
 *   3. getPacingDirective(gameContext)
 *   4. directorSection (jeśli sessionId + state istnieje)
 *   5. ragSection (jeśli niepuste)
 *   6. summarySection (jeśli niepuste)
 *   7. gameContextPrompt LUB NPC context (zależnie od skipContext + dostępności)
 *   8. HOT SEAT FIX (jeśli hotSeatConfig.enabled + ≥2 graczy)
 *
 * Pure function: brak side effects, brak async. Wszystkie zależności (getPacingDirective,
 * getDirectorPromptSection) injected via import z `@/lib/*` - mockowalne przez jest.
 */

import type { CachedContent } from '@google/genai';
import { getPacingDirective } from '@/lib/pacing-controller';
import {
  getDirectorPromptSection,
  getDirectorState,
  buildDynamicScenePacingInjection,
  type DynamicScenePacingParams,
} from '@/lib/director-state';
import type { GameContext } from '@/lib/prompt-section-parser';
import type { Character, NPC, GuardrailState } from '@/lib/types';
import { getSkillValue } from '@/lib/types';
import { buildLocationEraGuidanceSection } from '@/lib/location-era-validator';
import { isWeapon } from '@/lib/combat/weapon-context';
import {
  deriveFinances,
  resolveEconomyEra,
  type EconomyEraContext,
} from '@/lib/economy/credit-rating';
import type { ResolvedEraContext } from '@/lib/era/types';
import {
  buildConcordiaObservationDirective,
  type InvestigatorSubjectiveState,
  type EpistemicTruthAnchor,
} from '@/lib/concordia/make-observation';
import { adjudicateEventPipeline } from '@/lib/concordia/event-resolution';
import { VisualBeliefGraph } from '@/lib/images/visual-belief-graph';
import type { DocumentType } from '@/types/adventure';
import type { ClueProvenance } from '@/lib/journal/dossier-types';
import { inferClueProvenance } from '@/lib/parsers/journal-parser';
import { isPublicCurrentClue } from '@/core/memory/revealed-facts';
import { isDocumentModelUseBlocked } from '@/lib/document-model-policy';
import { getSystemCapabilitiesPromptSection } from '@/lib/pdf/capabilities-manager';

/**
 * Buduje sekcję promptu z umiejętnościami postaci (nazwa + wartość %), by AI wzywało
 * testy `[TEST:]` WYŁĄCZNIE nazwami z karty. Eliminuje rozjazd nazewnictwa, przez który
 * AI prosiło o test nazwą spoza karty → resolver zwracał 0% → Tacka „próg ≤0".
 * Zwraca pusty string gdy brak postaci/umiejętności (sekcja się nie wstrzykuje).
 */
export function buildPlayerSkillsSection(
  character: Character | null | undefined
): string {
  const skills = character?.skills;
  if (!skills) return '';
  const list = Object.entries(skills)
    .map(([name, value]) => `${name} ${getSkillValue(value)}%`)
    .join(', ');
  if (!list) return '';
  return (
    `\n## UMIEJĘTNOŚCI POSTACI (lista z karty)\n${list}\n` +
    `Gdy wzywasz test \`[TEST:]\`, użyj DOKŁADNIE nazwy umiejętności z tej listy. ` +
    `DYWERSYFIKACJA UMIEJĘTNOŚCI (RAW): Przełamuj duopol Spostrzegawczości i Perswazji! ` +
    `Aktywnie wykorzystuj specjalizacje badacza z powyższej listy (np. Prawo, Księgowość, Medycyna, Ślusarstwo, Urok, Zastraszanie, Gadanina) ` +
    `lub oferuj testy łączone z operatorem LUB (np. Spostrzegawczość LUB Ślusarstwo). ` +
    `Zawsze szanuj autorską kontrpropozycję gracza popartą diegetycznie. ` +
    `NIGDY nie wymyślaj nazw umiejętności spoza karty (w ostateczności użyj testu cechy: Siła, Zręczność, Inteligencja).`
  );
}

/**
 * Buduje sekcję promptu dla postaci gracza w konwencji Pulp Cthulhu (RAW).
 * Wstrzykuje wybrany archetyp, pulpowe talenty, odporność i zasady pulpowego Szczęścia.
 */
export function buildPlayerPulpSection(
  character: Character | null | undefined,
  locale: 'pl' | 'en' = 'pl'
): string {
  if (!character || character.rulesetVariant !== 'pulp') {
    return '';
  }

  const isEn = locale === 'en';
  const archetype = character.archetype ? character.archetype : '';
  const talents =
    character.pulpTalents && character.pulpTalents.length > 0
      ? character.pulpTalents.join(', ')
      : '';

  if (isEn) {
    let section = `\n## INVESTIGATOR PULP PROFILE (Pulp Cthulhu RAW)\n`;
    section += `- **Ruleset Variant:** Pulp Cthulhu (High-action heroic horror)\n`;
    if (archetype) section += `- **Pulp Archetype:** ${archetype}\n`;
    if (talents) section += `- **Pulp Talents:** ${talents}\n`;
    section += `- **Durability & Health:** Max HP calculated as (CON+SIZ)/5. Investigator remains conscious longer, recovers 2 HP/day naturally, and avoids Major Wounds unless dealt full max HP damage in a single blow.\n`;
    section += `- **Pulp Luck Economy:** Can spend Luck 2:1 to halve Sanity loss (1:1 with Iron Nerves), 20 Luck for an adrenaline heal (1d6+1 HP), 10 Luck to unjam weapons, and all Luck (min 30) to Cheat Death.\n`;
    section += `Narrative guideline: Reflect the investigator's archetype and unique talents in your descriptions. Honor heroic agency and dynamic action.`;
    return section;
  } else {
    let section = `\n## PROFIL PULPOWY BADACZA (Pulp Cthulhu RAW)\n`;
    section += `- **Wariant zasad:** Pulp Cthulhu (heroiczny horror akcji)\n`;
    if (archetype) section += `- **Archetyp pulpowy:** ${archetype}\n`;
    if (talents) section += `- **Pulpowe talenty:** ${talents}\n`;
    section += `- **Żywotność i Odporność:** Maksymalne Punkty Wytrzymałości liczone ze wzoru (KON+BUD)/5. Badacz jest twardszy, regeneruje 2 PW dziennie, a Ciężką Ranę odnosi tylko przy ciosie za pełne maxHP.\n`;
    section += `- **Pulpowa Ekonomia Szczęścia:** Gracz może wydawać Szczęście w stosunku 2:1 na zmniejszenie straty Poczytalności o połowę (1:1 z talentem Nerwy ze Stali), 20 SZC na zastrzyk adrenaliny (1k6+1 PW), 10 SZC na odblokowanie zaciętej broni oraz wszystkie punkty (min. 30) na Oszukanie Śmierci (Cheat Death).\n`;
    section += `Wytyczna reżyserska: Uwzględniaj archetyp i talenty postaci w opisach świata. Pamiętaj o heroicznym profilu bohatera i nagradzaj śmiałe deklaracje akcji.`;
    return section;
  }
}

/**
 * Buduje sekcję promptu z listą wyposażenia i przedmiotów użytkowych badacza
 * (z wyłączeniem broni, która jest już opisywana w sekcji uzbrojenia).
 * Informuje AI MG co gracz ma przy sobie, aby zapobiec wymyślaniu przedmiotów
 * znikąd oraz uwzględniać brak sprzętu w testach.
 */
export function buildPlayerEquipmentSection(
  character: Character | null | undefined
): string {
  const equipment = character?.equipment;
  if (!equipment || equipment.length === 0) return '';

  const nonWeapons = equipment.filter((item) => !isWeapon(item));
  if (nonWeapons.length === 0) return '';

  const lines = nonWeapons.map((item) => {
    const desc = item.description?.trim();
    let statusLabel = '';
    if (item.quantity && item.quantity > 0) {
      statusLabel = ` (pozostało: ${item.quantity}${item.maxQuantity ? `/${item.maxQuantity}` : ''})`;
    } else if (item.isConsumable) {
      statusLabel = ` [zużywalny]`;
    }
    return desc
      ? `- **${item.name}**${statusLabel}: ${desc}`
      : `- **${item.name}**${statusLabel}`;
  });

  return (
    `\n## EKWIPUNEK POSTACI (posiadane przedmioty)\n` +
    `Badacz ma przy sobie WYŁĄCZNIE następujące przedmioty użytkowe:\n` +
    lines.join('\n') +
    `\nReguła: Gdy gracz podejmuje działania wymagające narzędzi (np. rozpalenie ognia, oświetlenie ciemności, otwarcie zamka, pierwsza pomoc, robienie zdjęć, badania naukowe), bierz pod uwagę powyższą listę. ` +
    `Brak odpowiedniego narzędzia powinien utrudniać zadanie (np. kość kary w teście, brak możliwości wykonania testu lub konieczność improwizacji). ` +
    `NIGDY nie zakładaj, że postać posiada przedmioty, których nie ma na tej liście, chyba że dopiero co podniosła je w bieżącej scenie.\n\n` +
    `Reguły operowania ekwipunkiem (Fiction First & puryzm CoC 7e):\n` +
    `1. Gdy gracz deklaruje akcje w sposób naturalny w świecie gry, sprawdzaj posiadaną listę. Jeśli deklaruje użycie czegoś, czego nie ma, opisz to fabularnie w świecie gry i nie emituj tagu.\n` +
    `2. Gdy badacz z sukcesem zużywa zasób zużywalny (np. dawka morfiny, bandaże, flara), dołącz na końcu odpowiedzi znacznik: \`[EKWIPUNEK: ZUZYJ | NazwaPrzedmiotu | 1]\`.\n` +
    `3. Gdy przedmiot zostaje bezpowrotnie zniszczony, porzucony lub odebrany: \`[EKWIPUNEK: USUN | NazwaPrzedmiotu]\`.\n` +
    `4. Gdy badacz odnajduje lub otrzymuje nowy kluczowy rekwizyt w śledztwie: \`[EKWIPUNEK: DODAJ | Nazwa | kategoria | opis]\` (kategorie: tool, document, weapon, medical, occult, artifact, personal).\n` +
    `5. Drobiazgi tła (zapałki, ołówek, notes) oraz amunicja w broni są nielimitowane w normalnych warunkach - NIE zliczaj pojedynczych zapałek ani naboi jak w grach arcade. Mogą się skończyć wyłącznie przy dramatycznej komplikacji, zacięciu lub pechu.`
  );
}

/**
 * Buduje sekcję promptu ze statusem majątkowym i zamożnością badacza wg reguł CoC 7e RAW.
 * Przekazuje AI poziom wydatków (Spending Level), gotówkę oraz majątek trwały,
 * dzięki czemu MG wie, kiedy gracz może wydać pieniądze od ręki, a kiedy żądać testu.
 */
export function buildPlayerFinancesSection(
  character: Character | null | undefined,
  eraContext?: EconomyEraContext | string | null
): string {
  if (!character) return '';

  const finances = deriveFinances(character, eraContext);
  const isDefaultUsd = finances.currency === 'USD' && !eraContext;
  const spendingStr = isDefaultUsd ? `${finances.spendingLevel} $` : finances.formattedSpendingLevel;
  const cashStr = isDefaultUsd ? `${finances.cash} $` : finances.formattedCash;
  const assetsStr = isDefaultUsd ? `${finances.assets} $` : finances.formattedAssets;
  const assetsDesc =
    finances.assetsDescription &&
    finances.assetsDescription !== assetsStr &&
    finances.assetsDescription !== finances.formattedAssets
      ? ` (${finances.assetsDescription})`
      : '';
  const livingConditionsLine = finances.livingConditions
    ? `\n- Standard życiowy w epoce: ${finances.livingConditions}`
    : '';

  return (
    `\n## MAJĄTEK I STATUS FINANSOWY POSTACI (CoC 7e RAW)\n` +
    `- Zamożność (Credit Rating): ${finances.creditRating}% [Poziom: ${finances.tierLabel}]\n` +
    `- Dzienny poziom wydatków bez rzutu (Spending Level): ${spendingStr} dziennie (drobne wydatki, tanie hotele, posiłki, bilety miejskie gracz opłaca od ręki bez testu kośćmi i bez odliczania)\n` +
    `- Gotówka pod ręką (Cash): ${cashStr} (na zakupy przekraczające poziom wydatków, lecz mieszczące się w tej kwocie)\n` +
    `- Majątek trwały (Assets): ${assetsStr}${assetsDesc} (nieruchomości, oszczędności bankowe; spieniężenie wymaga czasu i procedur bankowych)` +
    `${livingConditionsLine}\n` +
    `Reguła: Gdy gracz próbuje dokonać wydatku znacząco przekraczającego gotówkę, wziąć dużą pożyczkę lub zaimponować statusem majątkowym, zażądaj \`[TEST: Majętność | zwykły | ... | powód]\`. Porażka oznacza odmowę lub utratę reputacji.`
  );
}

/**
 * Buduje sekcję promptu ze stałym profilem wizualnym Badacza (Visual DNA).
 * Przekazuje AI wygląd, płeć, wiek, ubiór i cechy szczególne z karty WYŁĄCZNIE
 * na potrzeby prozy narracyjnej i reakcji NPC w świecie gry, z twardym zakazem
 * wplatania twarzy/sylwetki Badacza do tagów ilustracji (kadr FPP / Pure Camera POV).
 */
export function buildPlayerVisualProfileSection(
  character: Character | null | undefined
): string {
  if (!character) return '';

  const details: string[] = [];
  if (character.gender) {
    const g =
      character.gender === 'male'
        ? 'mężczyzna'
        : character.gender === 'female'
          ? 'kobieta'
          : character.gender;
    details.push(`Płeć: ${g}`);
  }
  if (character.age) details.push(`Wiek: ${character.age} lat`);
  if (character.occupation) {
    details.push(`Zawód / Profesja: ${character.occupation}`);
  }
  if (character.appearance && character.appearance.trim()) {
    details.push(`Wygląd i aparycja: ${character.appearance.trim()}`);
  }
  if (character.traits && character.traits.length > 0) {
    details.push(`Cechy szczególne i styl: ${character.traits.join(', ')}`);
  }

  if (details.length === 0) return '';

  return (
    `\n## PROFIL WIZUALNY BADACZA (VISUAL DNA - TYLKO DLA NARRACJI TEKSTOWEJ)\n` +
    `Badacz gracza to **${character.name}** o następującym stałym wyglądzie fizycznym:\n` +
    details.map((d) => `- ${d}`).join('\n') +
    `\nReguła (BEZWZGLĘDNY ZAKAZ W OBRAZACH - CZYSTY KADR FPP): Powyższy profil fizyczny służy WYŁĄCZNIE do opisów w prozie narracyjnej i reakcji postaci niezależnych (NPC) na wygląd Badacza. ` +
    `ABSOLUTNY ZAKAZ wplatania twarzy, sylwetki, dłoni ani ubioru Badacza do tagów obrazów ([SCENA:], [LOKACJA:], [PORTRET:], [PRZEDMIOT:], [POTWÓR:], [ZJAWISKO:])! ` +
    `Wszystkie ilustracje scen i lokacji pokazują świat z oczu Badacza (Pure Subjective Camera POV - zero części ciała gracza w kadrze). ` +
    `Tag [PORTRET:] jest zarezerwowany WYŁĄCZNIE dla napotkanych postaci niezależnych (NPC) - NIGDY nie generuj [PORTRET:] dla postaci gracza (${character.name}).`
  );
}

/**
 * Sprawdza, czy dane realia/lokacja/epoka odpowiadają Polsce międzywojennej (II RP).
 */
export function isIIRPSetting(
  era?: string,
  currentLocation?: string,
  eraContext?: ResolvedEraContext | EconomyEraContext | string | null,
  characters?: Character[]
): boolean {
  if (
    era === '1920s-poland' ||
    era === '1920s-pl' ||
    era === 'iirp' ||
    era === 'pl-1920s' ||
    era === 'poland-1920s'
  ) {
    return true;
  }
  if (
    characters &&
    characters.some(
      (c) => c.era === '1920s-poland' || c.era === '1920s-pl'
    )
  ) {
    return true;
  }
  if (eraContext) {
    const resolved = resolveEconomyEra(eraContext as EconomyEraContext);
    if (resolved === '1920s-pl') return true;
  }
  if (currentLocation && era) {
    const resolved = resolveEconomyEra({ era, location: currentLocation });
    if (resolved === '1920s-pl') return true;
  }
  if (era) {
    const resolved = resolveEconomyEra(era);
    if (resolved === '1920s-pl') return true;
  }
  return false;
}

/**
 * Buduje sekcję promptu dotyczącą realiów prawnych i posiadania broni w II Rzeczypospolitej.
 * Oparta na rozdziale 9 Podręcznika Badacza CoC 7ed (s. 214-216):
 * - Dekret z 25 stycznia 1919 r. o nabywaniu i posiadaniu broni i amunicji.
 * - Uznaniowe pozwolenia Starosty Powiatowego (lub Komisarza Rządu w Warszawie).
 * - Podział na pozwolenia do obrony osobistej (broń krótka) i myśliwskie.
 * - Rygorystyczny pas graniczny (20 km): KOP, Straż Graniczna, sądy doraźne.
 * - Reakcja Policji Państwowej na jawną broń w miastach.
 */
export function buildIIRPWeaponLawContext(
  eraContextOrEra?: ResolvedEraContext | EconomyEraContext | string | null,
  currentLocation?: string,
  locale?: 'pl' | 'en'
): string {
  const isEn = locale === 'en';

  if (isEn) {
    return (
      `\n## WEAPON LAWS & FIREARMS IN INTERWAR POLAND (II RP RAW)\n` +
      `In interwar Poland (1918-1939), strict firearm regulations apply:\n` +
      `1. Decree of January 25, 1919: Acquiring and possessing firearms or ammunition requires an official government permit. Unregistered weapons carry severe criminal penalties.\n` +
      `2. Starosta Discretion: Firearm permits are issued by the district starosta (in Warsaw, the Government Commissioner). The official has complete discretion and may deny permits without justification. Permits distinguish personal defense (handguns) from hunting firearms.\n` +
      `3. Border Zone (20 km): Within 20 km of the state border, strict security zones enforced by KOP (Border Protection Corps) and the Border Guard apply. Carrying weapons without an explicit border pass leads to immediate arrest and summary trial.\n` +
      `4. Open Carry in Cities: Displaying weapons openly in urban areas triggers an immediate armed intervention by Policja Panstwowa (State Police). Handguns must remain concealed in an inner coat pocket or holster.\n` +
      `5. Military & Automatic Weapons: Civilian ownership of military rifles (Mauser wz. 29), submachine guns, or anti-tank rifles is strictly forbidden and treated as high treason or banditry.`
    );
  }

  return (
    `\n## PRAWO I POSIADANIE BRONI W II RZECZYPOSPOLITEJ (REGUŁY RAW)\n` +
    `W realiach Polski międzywojennej (II RP) obowiązują surowe przepisy dotyczące broni palnej:\n` +
    `1. Dekret z 25 stycznia 1919 r.: Nabywanie i posiadanie broni palnej oraz amunicji wymaga oficjalnego zezwolenia władz. Nielegalne posiadanie broni jest surowo karane.\n` +
    `2. Uznaniowość Starosty: Pozwolenia wydaje Starosta Powiatowy (w Warszawie Komisarz Rządu). Urzędnik ma pełną swobodę decyzyjną i może odmówić bez podania przyczyny. Zezwolenia dzielą się na obronę osobistą (broń krótka) oraz myśliwskie (strzelby, sztucery).\n` +
    `3. Pas graniczny (20 km): W strefie 20 km od granicy państwowej obowiązują rygorystyczne obostrzenia KOP (Korpus Ochrony Pogranicza) i Straży Granicznej. Noszenie broni bez specjalnej przepustki granicznej grozi natychmiastowym aresztem i sądem doraźnym.\n` +
    `4. Zakaz afiszowania się z bronią: Paradowanie z bronią na widoku w miastach wywołuje natychmiastową interwencję Policji Państwowej. Broń krótka musi być noszona w ukryciu (kieszeń płaszcza, dyskretna kabura pod marynarką).\n` +
    `5. Broń wojskowa i maszynowa: Posiadanie przez cywilów wojskowych karabinów (Mauser wz. 29), pistoletów maszynowych lub broni przeciwpancernej jest całkowicie zakazane i traktowane jak przestępstwo przeciw bezpieczeństwu państwa.`
  );
}

export interface BuildActiveInvestigationOpts {
  character?: Character | null;
  characters?: Character[];
  sessionId?: string;
  locale?: 'pl' | 'en';
}

/**
 * Buduje kompaktową sekcję promptu "AKTYWNE ŚLEDZTWO I WIEDZA BADACZA" (~80-120 tokenów)
 * zamykającą dwukierunkową pętlę pamięci w relacji Gracz <-> AI MG (Issue #68).
 *
 * Zawiera:
 * 1. Kluczowe potwierdzone poszlaki (do 5 najważniejszych z 1-zdaniową syntezą).
 * 2. Ostatnie wnioski i hipotezy badacza (z rzutów na Pomysł / notatek / dossier).
 * 3. Aktywny wątek lub cel śledczy.
 *
 * Zachowuje 100% symetrię językową (PL + EN).
 */

/**
 * Sekcja magii postaci gracza (Wierzący/Sceptyk, Punkty Magii, znane zaklęcia, tomy).
 * Zapobiega zmyślaniu czarów i halucynacjom reguł w narracji AI (Issue #318).
 */
export function buildPlayerMagicSection(
  character: Character | null | undefined,
  locale: 'pl' | 'en' = 'pl'
): string {
  if (!character) return '';

  const maxMp = Math.floor((character.pow ?? 50) / 5);
  const currentMp = character.mp ?? maxMp;
  const belief = character.magic?.belief ?? 'believer';
  const isBeliever = belief === 'believer';

  const knownSpellsMap = character.magic?.knownSpells ?? {};
  const spellEntries = Object.values(knownSpellsMap);

  const tomeStudiesMap = character.magic?.tomeStudies ?? {};
  const tomeEntries = Object.values(tomeStudiesMap);

  const isPl = locale === 'pl';
  const lines: string[] = [];

  if (isPl) {
    lines.push(`\n## MAGIA I WIEDZA NADPRZYRODZONA BADACZA (${character.name})`);
    lines.push(
      `- **Status wiary:** ${
        isBeliever
          ? 'Wierzący (może rzucać poznane czary, pełna strata SAN przy kontakcie z Mitami)'
          : 'Sceptyk (ZAKAZ rzucania czarów! Odłożona strata SAN do momentu załamania racjonalizmu)'
      }`
    );
    lines.push(`- **Punkty Magii (PM):** ${currentMp} / ${maxMp} (regeneracja: 1 PM na godzinę)`);

    if (spellEntries.length > 0) {
      lines.push(`- **Znane zaklęcia:**`);
      for (const s of spellEntries) {
        const def = getSpellDefinition(s.spellId);
        const name = def?.namePl ?? s.spellId;
        const aliasStr = s.knownAlias ? ` (znane jako: „${s.knownAlias}”)` : '';
        const castStatus = s.isFirstCastDone
          ? 'opanowane (sukces automatyczny bez rzutu kością)'
          : 'wymaga pierwszego rzucenia (Trudny test POW)';
        lines.push(
          `  * **${name}**${aliasStr} - status: ${castStatus}${s.deeperUnlocked ? ' [Głębsza Magia odblokowana]' : ''}`
        );
      }
    } else {
      lines.push(`- **Znane zaklęcia:** Brak poznanych zaklęć.`);
    }

    if (tomeEntries.length > 0) {
      lines.push(`- **Przestudiowane tomy Mitów:**`);
      for (const t of tomeEntries) {
        const def = getTomeDefinition(t.tomeId);
        const title = def?.titlePl ?? t.tomeId;
        const status =
          t.studyCount > 0
            ? `pełne studium (${t.studyCount}x)`
            : 'wstępny przegląd (skimming)';
        lines.push(`  * **${title}** - status: ${status}`);
      }
    }

    lines.push(
      `- **DYREKTYWA DLA STRAŻNIKA TAJEMNIC:** NIGDY nie rozstrzygaj rzucania magii ani obrony w prozie narracyjnej! Gdy badacz rzuca czar, wyemituj tag \`[CZAR:...]\`. Gdy wróg rzuca czar na badacza, wyemituj tag obrony \`[OBRONA_MAGIA: @${character.name}: rzucajacy=... | pow=... | czar=... | opis=...]\`. Zakaz rzucania zaklęć spoza listy znanych czarów bez procedury Magii Spontanicznej (\`[MAGIA_SPONTANICZNA:...]\`).`
    );
  } else {
    lines.push(`\n## INVESTIGATOR MAGIC & SUPERNATURAL LORE (${character.name})`);
    lines.push(
      `- **Belief Status:** ${
        isBeliever
          ? 'Believer (can cast learned spells, full SAN loss upon Mythos contact)'
          : 'Skeptic (FORBIDDEN to cast spells! Deferred SAN loss until rationalism breaks)'
      }`
    );
    lines.push(`- **Magic Points (MP):** ${currentMp} / ${maxMp} (regains 1 MP per hour)`);

    if (spellEntries.length > 0) {
      lines.push(`- **Known Spells:**`);
      for (const s of spellEntries) {
        const def = getSpellDefinition(s.spellId);
        const name = def?.nameEn ?? s.spellId;
        const aliasStr = s.knownAlias ? ` (known as: "${s.knownAlias}")` : '';
        const castStatus = s.isFirstCastDone
          ? 'mastered (automatic success without die roll)'
          : 'requires first cast (Hard POW test)';
        lines.push(
          `  * **${name}**${aliasStr} - status: ${castStatus}${s.deeperUnlocked ? ' [Deeper Magic unlocked]' : ''}`
        );
      }
    } else {
      lines.push(`- **Known Spells:** None.`);
    }

    if (tomeEntries.length > 0) {
      lines.push(`- **Studied Mythos Tomes:**`);
      for (const t of tomeEntries) {
        const def = getTomeDefinition(t.tomeId);
        const title = def?.titleEn ?? t.tomeId;
        const status =
          t.studyCount > 0 ? `full study (${t.studyCount}x)` : 'skimming';
        lines.push(`  * **${title}** - status: ${status}`);
      }
    }

    lines.push(
      `- **KEEPER DIRECTIVE:** NEVER resolve spellcasting or magic defense in prose! When investigator casts a spell, emit \`[CZAR:...]\`. When enemy casts magic on investigator, emit \`[OBRONA_MAGIA: @${character.name}: rzucajacy=... | pow=... | czar=... | opis=...]\`. Casting unknown spells without Spontaneous Magic (\`[MAGIA_SPONTANICZNA:...]\`) is forbidden.`
    );
  }

  return lines.join('\n');
}

export function buildActiveInvestigationSection(
  opts: BuildActiveInvestigationOpts
): string {
  const isEn = opts.locale === 'en';
  const directorState = opts.sessionId ? getDirectorState(opts.sessionId) : null;

  // Znajdź listę badaczy (wszystkie postacie z drużyny lub główny badacz)
  const char = opts.character || opts.characters?.[0];
  const targetChars = opts.character ? [opts.character] : opts.characters ?? [];
  const excluded = new Set((opts.characters ?? targetChars).flatMap(c =>
    (c.investigatorDossier?.clues ?? []).filter(clue=>!isPublicCurrentClue(clue)).map(clue=>clue.title.trim().toLowerCase())));

  // 1. ZBIERZ POSZLAKI (Context Stuffing: pełna lista aktywnych faktów śledczych z dossier)
  const clues: { title: string; fact: string; provenance?: ClueProvenance }[] = [];
  const seenClueKeys = new Set<string>();

  // A. Z dossier postaci (priorytet) - wykluczamy fakty unieważnione/obalone (Fact Supersession)
  for (const cChar of targetChars) {
    if (cChar?.investigatorDossier?.clues && cChar.investigatorDossier.clues.length > 0) {
      // Sortuj: kluczowe poszlaki najpierw, potem najnowsze
      const sorted = [...cChar.investigatorDossier.clues]
        .filter(isPublicCurrentClue)
        .sort((a, b) => {
          if (a.isKeyClue && !b.isKeyClue) return -1;
          if (!a.isKeyClue && b.isKeyClue) return 1;
          return (b.timestamp || 0) - (a.timestamp || 0);
        });

      for (const c of sorted) {
        const key = c.title.toLowerCase().trim();
        if (!seenClueKeys.has(key)) {
          seenClueKeys.add(key);
          const fact = (c.description || c.investigatorInsight || '').trim();
          clues.push({ title: `${c.status === 'unconfirmed' ? (isEn ? '[unconfirmed] ' : '[niepotwierdzona] ') : ''}${c.title.trim()}`, fact, provenance: c.provenance });
        }
      }
    }
  }

  // B. Fallback: z dziennika (character.journal) - gdy w dossier było mało poszlak
  if (clues.length < 5) {
    for (const cChar of targetChars) {
      if (cChar?.journal && cChar.journal.length > 0) {
        const journalClues = cChar.journal
          .filter((e) => e.type === 'clue' || e.type === 'discovery' || e.type === 'case')
          .reverse();

        for (const j of journalClues) {
          const key = j.title.toLowerCase().trim();
          if (!seenClueKeys.has(key) && !excluded.has(key)) {
            seenClueKeys.add(key);
            const prov = j.provenance || inferClueProvenance(j.title, j.content);
            clues.push({ title: j.title.trim(), fact: j.content.trim(), provenance: prov });
            if (clues.length >= 5) break;
          }
        }
      }
      if (clues.length >= 5) break;
    }
  }

  // C. Fallback: z directorState.clueFacts lub discoveredClues (tylko aktywne fakty)
  if (clues.length < 5 && directorState) {
    if (directorState.clueFacts && directorState.clueFacts.length > 0) {
      for (const cf of directorState.clueFacts) {
        if (cf.status === 'superseded' || cf.status === 'refuted' || excluded.has(cf.title.trim().toLowerCase())) continue;
        const key = cf.title.toLowerCase().trim();
        if (!seenClueKeys.has(key)) {
          seenClueKeys.add(key);
          const prov = inferClueProvenance(cf.title, cf.fact);
          clues.push({ title: cf.title, fact: cf.fact, provenance: prov });
          if (clues.length >= 5) break;
        }
      }
    } else if (directorState.discoveredClues && directorState.discoveredClues.length > 0) {
      for (const title of directorState.discoveredClues.slice(-5)) {
        const key = title.toLowerCase().trim();
        if (!seenClueKeys.has(key) && !excluded.has(key)) {
          seenClueKeys.add(key);
          const prov = inferClueProvenance(title, '');
          clues.push({ title, fact: '', provenance: prov });
          if (clues.length >= 5) break;
        }
      }
    }
  }

  // 2. ZBIERZ HIPOTEZY I WNIOSKI (do 2 najważniejszych)
  const hypotheses: string[] = [];
  const seenHypo = new Set<string>();

  // A. Z notatek badacza (dossier.notes)
  for (const cChar of targetChars) {
    if (cChar?.investigatorDossier?.notes && cChar.investigatorDossier.notes.length > 0) {
      for (const note of cChar.investigatorDossier.notes.slice(-2)) {
        const text = (note.content || note.title).trim();
        if (text && !seenHypo.has(text.toLowerCase())) {
          seenHypo.add(text.toLowerCase());
          hypotheses.push(text);
          if (hypotheses.length >= 2) break;
        }
      }
    }
    if (hypotheses.length >= 2) break;
  }

  // B. Z wniosków poszlak (investigatorInsight)
  if (hypotheses.length < 2) {
    for (const cChar of targetChars) {
      if (cChar?.investigatorDossier?.clues) {
        for (const c of cChar.investigatorDossier.clues) {
          if (isPublicCurrentClue(c) && c.investigatorInsight && !seenHypo.has(c.investigatorInsight.toLowerCase())) {
            seenHypo.add(c.investigatorInsight.toLowerCase());
            hypotheses.push(c.investigatorInsight.trim());
            if (hypotheses.length >= 2) break;
          }
        }
      }
      if (hypotheses.length >= 2) break;
    }
  }

  // C. Z directorState.investigatorHypotheses
  if (hypotheses.length < 2 && directorState?.investigatorHypotheses) {
    for (const h of directorState.investigatorHypotheses.slice(-2)) {
      if (!seenHypo.has(h.toLowerCase())) {
        seenHypo.add(h.toLowerCase());
        hypotheses.push(h);
        if (hypotheses.length >= 2) break;
      }
    }
  }

  // 3. AKTYWNY CEL / WĄTEK ŚLEDCZY
  let activeLead = '';
  if (directorState?.narrativeGoal) {
    activeLead = directorState.narrativeGoal.trim();
  } else if (char?.investigatorDossier?.clues) {
    const unconfirmedKey = char.investigatorDossier.clues.find(
      (c) => isPublicCurrentClue(c) && (c.status === 'unconfirmed' || c.isKeyClue)
    );
    if (unconfirmedKey) {
      activeLead = unconfirmedKey.title;
    }
  }

  // Jeśli brak jakichkolwiek danych śledczych, nie marnujemy tokenów
  if (clues.length === 0 && hypotheses.length === 0 && !activeLead) {
    return '';
  }

  // SKŁADANIE SEKCJI
  const header = isEn
    ? '## ACTIVE INVESTIGATION & INVESTIGATOR KNOWLEDGE'
    : '## AKTYWNE ŚLEDZTWO I WIEDZA BADACZA';

  const lines: string[] = [header];

  // Formatowanie poszlak (Context Stuffing: pełne fakty z etykietą proweniencji bez obcinania do 100 znaków)
  if (clues.length > 0) {
    const cluesHeader = isEn
      ? '**Revealed clues (status matters):**'
      : '**Ujawnione poszlaki (uwzględnij status):**';
    lines.push(cluesHeader);
    for (const c of clues) {
      let provLabel = '';
      if (c.provenance) {
        switch (c.provenance) {
          case 'observed':
            provLabel = isEn ? 'Observed' : 'Zaobserwowane';
            break;
          case 'testimony':
            provLabel = isEn ? 'Testimony' : 'Zeznanie';
            break;
          case 'deduction':
            provLabel = isEn ? 'Deduction' : 'Dedukcja';
            break;
          case 'handout':
            provLabel = isEn ? 'Handout' : 'Handout';
            break;
        }
      }
      const provTag = provLabel ? ` [${provLabel}]` : '';
      const desc = c.fact ? `: ${c.fact}` : '';
      lines.push(`- **${c.title}**${provTag}${desc}`);
    }
  }

  // Formatowanie hipotez
  if (hypotheses.length > 0) {
    const hypoHeader = isEn
      ? '**Investigator hypotheses & insights:**'
      : '**Wnioski i hipotezy badacza:**';
    lines.push(hypoHeader);
    for (const h of hypotheses) {
      let text = h;
      if (text.length > 100) text = `${text.slice(0, 97)}...`;
      lines.push(`- ${text}`);
    }
  }

  // Formatowanie aktywnego wątku
  if (activeLead) {
    const leadHeader = isEn
      ? `**Active investigative lead:** ${activeLead}`
      : `**Aktywny wątek śledczy:** ${activeLead}`;
    lines.push(leadHeader);
  }

  return `\n${lines.join('\n')}\n`;
}

// IND-160: minimal NPC context shape z body request (cleanup `any` z lin 255 route.ts).
export interface NpcContextEntry {
  name: string;
  status?: 'alive' | 'unknown' | 'dead' | string;
  occupation?: string;
  description?: string;
  /** Lokacja, w której przebywa NPC (Arcanum Benchmark 2026: Scene Presence) */
  location?: string;
  /** Ukryty lub jawny cel postaci (Arcanum Benchmark 2026: NPC Pushback) */
  agenda?: string;
  /** Nastawienie psychologiczne do badacza (blokada uległości bez testu socjalnego) */
  disposition?: 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'fanatical';
}

// IND-72: minimal Hot Seat player shape z body request (cleanup `any` z lin 291 route.ts).
export interface HotSeatPlayerEntry {
  playerId?: string;
  characterId?: string;
  characterName?: string;
  name?: string;
}

export {
  buildDynamicScenePacingInjection,
  type DynamicScenePacingParams,
};

export interface DepthInjectionMessage {
  role: string;
  content: string;
}

/**
 * Sprawdza czy wiadomość jest dyrektywą Depth Injection / Author's Note.
 */
export function isDepthInjectionMessage(msg: DepthInjectionMessage): boolean {
  if (!msg || typeof msg.content !== 'string') return false;
  return (
    msg.content.includes('[PRZYPOMNIENIE DLA MG') ||
    msg.content.includes('[GM DIRECTIVE') ||
    msg.content.includes('DYNAMIC SCENE & PACING INJECTION') ||
    msg.content.includes('[NOTATKA AUTORA') ||
    msg.content.includes("[AUTHOR'S NOTE") ||
    msg.content.includes('[AUTHORS NOTE')
  );
}

/**
 * Wstrzykuje dyrektywę Depth Injection (Author's Note) do tablicy wiadomości czatu
 * na zadanej głębokości (domyślnie 2-3 wiadomości przed końcem okna kontekstowego).
 * W strefie najwyższej uwagi modelu (SillyTavern Adaptation - Issue #349).
 * Zastępuje wcześniejsze dyrektywy, aby nie kumulować sprzecznych instrukcji pacingu.
 */
export function injectDepthInjection<T extends DepthInjectionMessage>(
  messages: T[],
  injection: string,
  depth: number = 3,
  role: string = 'system'
): T[] {
  if (!injection || !injection.trim()) {
    return messages ? [...messages] : [];
  }
  const cleanMessages = (messages || []).filter(
    (m) => !isDepthInjectionMessage(m)
  );
  if (cleanMessages.length === 0) {
    return [{ role, content: injection } as T];
  }
  const copy = [...cleanMessages];
  const targetIndex = Math.max(0, copy.length - Math.max(0, depth));
  copy.splice(targetIndex, 0, { role, content: injection } as T);
  return copy;
}

/**
 * Wstrzykuje dyrektywę Depth Injection bezpośrednio do tablicy in-place.
 * Zastępuje wcześniejsze dyrektywy, aby nie kumulować sprzecznych instrukcji pacingu.
 */
export function injectDepthInjectionInPlace<T extends DepthInjectionMessage>(
  messages: T[],
  injection: string,
  depth: number = 3,
  role: string = 'system'
): T[] {
  if (!messages) return [];
  if (!injection || !injection.trim()) {
    return messages;
  }
  // Usuń ewentualne wcześniejsze wstrzyknięcia z poprzednich tur
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isDepthInjectionMessage(messages[i])) {
      messages.splice(i, 1);
    }
  }
  if (messages.length === 0) {
    messages.push({ role, content: injection } as T);
    return messages;
  }
  const targetIndex = Math.max(0, messages.length - Math.max(0, depth));
  messages.splice(targetIndex, 0, { role, content: injection } as T);
  return messages;
}

export interface BuildAdditionalContextOpts {
  timePromptSection: string;
  gmProtocol: string;
  gameContext: GameContext;
  resolvedCachedContent: CachedContent | null;
  // IND-223: imię postaci gracza (steruje człowiek) - oznaczamy ją jawnie w
  // kontekście, by AI nigdy nie generowało jej wypowiedzi/akcji.
  playerCharacterName?: string;
  // Uzbrojenie postaci gracza (sekcja promptu z buildPlayerWeaponContext). Wstrzykiwane
  // gdy niepuste, by AI prowadziło walkę narracyjnie znając broń + umiejętność + obrażenia.
  playerWeaponsSection?: string;
  // Lista umiejętności postaci z wartościami % (gotowa sekcja). Wstrzykiwana, by AI
  // wzywało testy WYŁĄCZNIE nazwami z karty - eliminuje rozjazd nazw (Tacka 0%).
  playerSkillsSection?: string;
  /** Ekwipunek i przedmioty użytkowe postaci (bez broni) */
  playerEquipmentSection?: string;
  /** Status majątkowy i poziom wydatków postaci wg CoC 7e RAW */
  playerFinancesSection?: string;
  /** Stały profil fizyczny Badacza (Visual DNA) */
  playerVisualProfileSection?: string;
  /** Magia i wiedza nadprzyrodzona postaci gracza (status wiary, znane zaklęcia, tomy) */
  playerMagicSection?: string;
  /** Profil pulpowy badacza (archetyp, talenty, żywotność, pulpowe szczęście) */
  playerPulpSection?: string;
  /** Opcjonalna tablica wiadomości czatu do Depth Injection (SillyTavern Adaptation - Issue #349) */
  messages?: Array<{ role: string; content: string }>;
  /** Głębokość wstrzykiwania Depth Injection od końca (domyślnie 3 = 2-3 wiadomości przed końcem okna) */
  depthInjectionDepth?: number;
  /** Opcjonalna gotowa dyrektywa dynamicznej sceny i pacingu (Author's Note) */
  dynamicSceneInjection?: string;
  /** Czy wymusić wstrzyknięcie dyrektywy także do additionalContext */
  injectIntoAdditionalContext?: boolean;
  sessionId?: string;
  ragSection?: string;
  summarySection?: string | null;
  /** Sekcja z realnymi handoutami przygody (DriveThruRPG) - markdown do wstawienia przez MG. */
  handoutsSection?: string;
  /** C1: instrukcja recapu przy wznowieniu zapisanej gry (null gdy nie wznowienie). */
  sessionRecapSection?: string | null;
  skipContext?: boolean;
  gameContextPrompt?: string;
  isGameStart?: boolean;
  characters?: Character[];
  npcs?: NpcContextEntry[];
  currentLocation?: string;
  hotSeatConfig?: { enabled?: boolean; players?: HotSeatPlayerEntry[] };
  tone?: 'purist' | 'pulp' | 'noir' | 'neutral';
  /** Epoka gry dla reguł materialnych i guardrails */
  era?: string;
  /** Język wyjścia dla dyrektyw kontekstowych */
  locale?: 'pl' | 'en';
  /** Sekcja danych immersyjnych (astronomia, gazety, ceny epoki) - wstrzykiwana gdy dostępna. */
  immersionSection?: string;
  /** Wydarzenie z generatora fabularnego zrzucone z UI, przekazywane z hooka useChat */
  directorEventSection?: string;
  /** Niezmienna prawda śledztwa (Arcanum Benchmark 2026: Sealed Envelope Enforcement) */
  truthAnchor?: {
    culprit?: string;
    motive?: string;
    murderWeapon?: string;
    keyAlibi?: string;
    immutableFacts?: string[];
    unrevealedClueTitles?: string[];
  };
  /** Twarda lista NPC fizycznie obecnych w scenie (Arcanum Benchmark 2026: Scene Presence) */
  presentNpcs?: Array<{ id?: string; name: string; location?: string }>;
  /** Visual Belief Graph (DeepMind Proactive T2I) */
  visualBeliefGraph?: VisualBeliefGraph;
  /** Sekcja realiów prawnych i posiadania broni w II RP (dekret 1919, starosta, pas graniczny) */
  iirpWeaponLawSection?: string;
  /** Kontekst epoki lub ekonomiczny dla automatycznej detekcji realiów II RP */
  eraContext?: ResolvedEraContext | EconomyEraContext;
  /** Sekcja Stowarzyszenia Badaczy i mecenatu (Rozdział 6 CoC 7e RAW) */
  organizationSection?: string;
  /** Typ dokumentu przygody: 'scenario' | 'campaign' | 'setting' | 'compendium' */
  adventureDocumentType?: DocumentType;
  /** Flaga oznaczająca czy bieżąca przygoda to kampania (wieloczęściowa z ciągłością Badaczy) */
  isCampaign?: boolean;
  /** Surowa deklaracja / wypowiedź gracza w tej turze podlegająca adjudykacji intencji (Concordia EventResolution) */
  playerMessage?: string;
  /** Bezpośrednia dyrektywa Adjudykacji Zdarzeń (Concordia EventResolution) */
  eventResolutionDirective?: string;
  /** Stan guardrails immersji i strike counter (Issue #380) */
  guardrailState?: GuardrailState;
  /** Dyrektywy 5 modularnych silników świata (NPCEngine, Sensory, Graph, Friction, Mystery) */
  worldEngineDirectives?: string;
}

export function buildAdditionalContext(
  opts: BuildAdditionalContextOpts
): string[] {
  // These legacy channels may hold extracted document text from old saves.
  // Do not mutate the save or treat a renamed document as campaign-event memory.
  if (isDocumentModelUseBlocked()) {
    opts = { ...opts, gameContextPrompt: undefined, truthAnchor: undefined, handoutsSection: undefined };
  }
  const {
    timePromptSection,
    gmProtocol,
    gameContext,
    resolvedCachedContent,
    sessionId,
    ragSection,
    summarySection,
    handoutsSection,
    sessionRecapSection,
    skipContext,
    gameContextPrompt,
    npcs,
    currentLocation,
    hotSeatConfig,
    playerCharacterName,
    playerWeaponsSection,
    playerSkillsSection,
    playerEquipmentSection,
    playerFinancesSection,
    playerVisualProfileSection,
    isGameStart,
    characters,
    era,
  } = opts;

  const additionalContext: string[] = [timePromptSection];

  // Materialne User Story i Kontrast Epoki dla MG (domyślna epoka CoC to 1920s)
  if (era || currentLocation) {
    additionalContext.push(buildLocationEraGuidanceSection(era || '1920s', currentLocation));
  }

  // C1: recap przy wznowieniu zapisanej gry - instrukcja "zrób recap w tej turze".
  if (sessionRecapSection) {
    additionalContext.push(sessionRecapSection);
  }

  // R1 & R2: Bezwzględna ochrona sprawczości i Fizyczny Immunitet Badacza (Solo i Hot Seat / Drużyna)
  // Wstrzykiwane ZAWSZE, aby AI dostawało konkretne imiona i twardy zakaz grania za postacie.
  const isHotSeatActive = Boolean(hotSeatConfig?.enabled && (hotSeatConfig?.players?.length ?? 0) >= 2);
  const isTeamSession = isHotSeatActive || (Array.isArray(characters) && characters.length >= 2);
  if (isTeamSession) {
    const gatheredNames: string[] = [];
    if (hotSeatConfig?.players && Array.isArray(hotSeatConfig.players)) {
      for (const p of hotSeatConfig.players) {
        const charName = p.characterName?.trim() || p.name?.trim();
        if (charName && charName !== 'Nieznany' && !gatheredNames.includes(charName)) {
          gatheredNames.push(charName);
        }
      }
    }
    if (Array.isArray(characters)) {
      for (const c of characters) {
        const charName = c?.name?.trim();
        if (charName && charName !== 'Nieznany' && !gatheredNames.includes(charName)) {
          gatheredNames.push(charName);
        }
      }
    }
    const teamNames = gatheredNames.length >= 2
      ? gatheredNames
      : (playerCharacterName ? [playerCharacterName] : gatheredNames);

    additionalContext.push(
      `\n## BEZWZGLĘDNA OCHRONA SPRAWCZOŚCI I FIZYCZNY IMMUNITET BADACZY (HOT SEAT / DRUŻYNA)\n` +
      `W grze uczestniczy zespół badaczy sterowanych przez żywych graczy: **${teamNames.join(', ')}**.\n` +
      `KATEGORYCZNY ZAKAZ GRANIE ZA BADACZY (ZAKAZ AUTOPILOTA):\n` +
      `- ZAKAZ PRZEMIESZCZANIA: MG nie ma prawa samowolnie przemieszczać badaczy (nie decyduj, że badacze wchodzą, podchodzą, wsiadają na wóz czy z niego zeskakują). Postacie zatrzymują się na progu zdarzenia.\n` +
      `- ZAKAZ SIĘGANIA DO EKWIPUNKU: MG nie wyciąga za badaczy broni, apteczek ani przedmiotów bez deklaracji graczy.\n` +
      `- ZAKAZ SAMOWOLNYCH BADAŃ I OGLĘDZIN: Zakaz orzekania, że badacze badają rany, oglądają zwłoki czy przeszukują meble bez deklaracji.\n` +
      `- ZAKAZ MOTORYKI I DIALOGÓW: Zero kwestii dialogowych, myśli, gestów ani mimiki w imieniu któregokolwiek z badaczy (${teamNames.join(', ')}).\n` +
      `Wprowadzenie sceny i incydent inicjujący (NPC) ZAWSZE zatrzymuje się na progu zdarzenia z pytaniem [Co robicie?]. Czekaj na deklaracje graczy.`
    );
  } else {
    const activeCharacterName = playerCharacterName || characters?.[0]?.name;
    if (activeCharacterName) {
      additionalContext.push(
        `\n## BEZWZGLĘDNA OCHRONA SPRAWCZOŚCI I FIZYCZNY IMMUNITET BADACZA (STERUJE CZŁOWIEK)\n` +
        `Postać gracza: **${activeCharacterName}**. To żywy człowiek podejmuje jej decyzje, pisze jej kwestie i deklaruje akcje.\n` +
        `FIZYCZNY IMMUNITET BADACZA (ZAKAZ AUTOPILOTA):\n` +
        `- ZAKAZ PRZEMIESZCZANIA: MG nie ma prawa samowolnie przemieszczać badacza (nie pisz "wchodzisz", "podchodzisz", "wsiadasz", "zeskakujesz"). Badacz zatrzymuje się przed progiem nowej przestrzeni.\n` +
        `- ZAKAZ SIĘGANIA DO EKWIPUNKU: MG nigdy nie decyduje o dobyciu broni, wyjęciu apteczki czy użyciu przedmiotów badacza bez deklaracji gracza.\n` +
        `- ZAKAZ SAMOWOLNYCH BADAŃ I OGLĘDZIN: MG nigdy nie decyduje, że badacz bada rany, bada zwłoki czy przeszukuje pomieszczenie bez deklaracji.\n` +
        `- ZAKAZ MOTORYKI I DIALOGÓW: Zero kwestii dialogowych, myśli, uczuć ani odruchów motorycznych postaci ${activeCharacterName}.\n` +
        `Wprowadzenie sceny i incydent inicjujący (NPC) ZAWSZE zatrzymuje się na progu zdarzenia z markerem [Co robisz?]. Czekaj na input gracza.`
      );
    }
  }

  // Profil wizualny Badacza (Visual DNA) - wyłącznie dla narracji tekstowej i reakcji NPC (zakaz w obrazach FPP)
  if (playerVisualProfileSection) {
    additionalContext.push(playerVisualProfileSection);
  }

  // Visual Belief Graph (DeepMind Proactive T2I) - kotwice postaci NPC i stan lokacji.
  // Odfiltrowujemy postacie graczy (isPlayer: true), aby LLM nigdy nie wplatał
  // angielskiego Visual DNA badacza do tagów obrazów ([SCENA:], [LOKACJA:], [PORTRET:]).
  if (opts.visualBeliefGraph) {
    const state =
      typeof opts.visualBeliefGraph.getState === 'function'
        ? opts.visualBeliefGraph.getState()
        : undefined;
    let beliefDirective = '';
    if (state) {
      const npcOnlyCharacters = Object.fromEntries(
        Object.entries(state.characters || {}).filter(
          ([, profile]) => !profile.isPlayer
        )
      );
      const npcOnlyGraph = new VisualBeliefGraph({
        ...state,
        characters: npcOnlyCharacters,
      });
      beliefDirective = npcOnlyGraph.toPromptDirective(opts.locale);
    } else {
      beliefDirective = opts.visualBeliefGraph.toPromptDirective(opts.locale);
    }
    if (beliefDirective) {
      additionalContext.push(`\n${beliefDirective}`);
    }
  }

  // Uzbrojenie postaci gracza - by AI prowadziło walkę narracyjnie znając broń.
  if (playerWeaponsSection) {
    additionalContext.push(playerWeaponsSection);
  }

  // Realiów prawnych i broni w II RP (dekret 1919, pozwolenia starosty, pas graniczny 20 km)
  if (opts.iirpWeaponLawSection) {
    additionalContext.push(opts.iirpWeaponLawSection);
  } else if (isIIRPSetting(era, currentLocation, opts.eraContext, characters)) {
    additionalContext.push(
      buildIIRPWeaponLawContext(
        opts.eraContext || era,
        currentLocation,
        opts.locale
      )
    );
  }

  // Stowarzyszenie Badaczy i mecenat (Rozdział 6 CoC 7e RAW s. 117-139)
  // KRYTYCZNA ZASADA PO: Stowarzyszenia są aktywne WYŁĄCZNIE dla kampanii!
  // W oneshotach, pojedynczych scenariuszach i antologiach ten moduł jest bezwzględnie zablokowany,
  // aby nie niszczyć natywnych haczyków fabularnych scenariusza i gotowych postaci.
  const isCampaignContext = Boolean(
    opts.isCampaign || opts.adventureDocumentType === 'campaign'
  );

  if (isCampaignContext && opts.organizationSection) {
    additionalContext.push(opts.organizationSection);
  }

  // Umiejętności postaci - AI ma wzywać testy WYŁĄCZNIE nazwami z tej listy.
  if (playerSkillsSection) {
    additionalContext.push(playerSkillsSection);
  }

  // Ekwipunek i przedmioty użytkowe postaci - AI wie co badacz ma przy sobie.
  if (playerEquipmentSection) {
    additionalContext.push(playerEquipmentSection);
  }

  // Sytuacja finansowa i Zamożność - AI zna poziom wydatków i gotówkę wg CoC 7e RAW.
  if (playerFinancesSection) {
    additionalContext.push(playerFinancesSection);
  }

  // Magia i wiedza nadprzyrodzona Badacza - AI zna status wiary, czary i tomy.
  if (opts.playerMagicSection) {
    additionalContext.push(opts.playerMagicSection);
  }

  // Profil pulpowy badacza (archetyp, talenty, żywotność, pulpowe szczęście)
  if (opts.playerPulpSection) {
    additionalContext.push(opts.playerPulpSection);
  }

  // Wstrzykiwanie Ustawy Przygody na podstawie tonu (dynamiczne pacingi z debaty)
  const sessionTone = opts.tone || 'purist';
  if (sessionTone === 'noir') {
    additionalContext.push(
      `\n## USTAWA O PRZYGODZIE NOIR\n` +
      `1. Prowadź grę w stylu Noir (powolne tempo, slow-burn, mrok, beznadzieja). NPC prezentują oficjalną Maskę, ale kierują się Ukrytym Celem/Strachem (są nieufni, podejrzliwi).\n` +
      `2. Zasoby są skrajnie ograniczone (rzadka amunicja, brak gotowych środków obrony).\n` +
      `3. CIĘCIA MONTAŻOWE: Teleportuj postać do nowej lokacji natychmiast po jej zadeklarowaniu. Jeśli jednak gracz wprost chce zrobić coś w drodze (np. czytać, przepytać kierowcę), rozegraj to jako mikro-scenę w podróży przed przeniesieniem.\n` +
      `4. SZALEŃSTWO: Przy stracie Poczytalności narzucaj traumę, fobie i luki w pamięci bezpośrednio w opisie zachowania badacza (jako wyjątek od sprawczości). Nigdy nie pisz o punktach ani mechanice w narracji.`
    );
  } else if (sessionTone === 'pulp') {
    if (opts.locale === 'en') {
      additionalContext.push(
        `\n## PULP CTHULHU ADVENTURE CODE (RAW & CINEMATIC ACTION)\n` +
        `1. HEROIC AGENCY: Investigators are larger-than-life heroes, not helpless victims. Reward initiative, audacity, and bold plans. Give them room to fight back against the horrors.\n` +
        `2. CHANDLER'S LAW: Whenever pacing drags or the investigation stalls, don't hesitate - have a man burst through the door with a smoking gun, a cult ambush, or a ticking explosion.\n` +
        `3. THE BEAST AT THE CLIMAX: Mythos horrors and cosmic abominations don't get wasted in background alleys; they are reserved for climactic finales and epic set-piece showdowns.\n` +
        `4. MOOKS & MINIONS: Low-tier cultists, thugs, and henchmen drop fast from a single solid hit (>50% HP) or a cinematic takedown.\n` +
        `5. VILLAINOUS DRAMA: Masterminds have flair, grand monologues, and getaway schemes. They sacrifice mooks to escape for future encounters.\n` +
        `6. RULE OF COOL: If an action is cinematic, audacious, and fits pulp serial energy, enable it or grant a bonus die rather than strictly saying no.\n` +
        `7. CHEAT DEATH: A dying hero can spend all their Luck (min 30) to miraculously survive through sheer fortune or a timely environmental twist.\n` +
        `8. WEIRD SCIENCE & ANOMALIES: Ray-guns, ether detectors, and occult technology spark erratic surges, ozone smells, and electric crackles.\n` +
        `9. CINEMATIC INSANITY: Sanity loss translates into adrenaline rushes, temporary combat manias, obsessive bravado, or sensory phobias rather than passive catatonia.\n` +
        `10. PULP CLIFFHANGERS: Cut scenes on dramatic cliffhangers and urgent dilemmas that compel immediate hero intervention.`
      );
    } else {
      additionalContext.push(
        `\n## USTAWA O PRZYGODZIE PULP CTHULHU (RAW & FILMOWY ROZMACH)\n` +
        `1. SPRAWCZOŚĆ BOHATERÓW: Gracze to herosi, nie bezbronne ofiary. Promuj inicjatywę, odwagę i brawurowe pomysły. Badacze mają narzędzia, by walczyć i stawiać czoła koszmarom.\n` +
        `2. PRAWO CHANDLERA: Gdy tempo siada lub śledztwo grzęźnie w martwym punkcie, nie czekaj - natychmiast wrzuć do pokoju faceta z rewolwerem, zamachowca kultu lub wybuchającą pułapkę.\n` +
        `3. POTWÓR NA KOŃCU: Monstra i mityczne aberracje nie giną od razu w zaułkach tła; ujawniają się jako punkt kulminacyjny (Grand Finale) lub bossowie sekwencji.\n` +
        `4. PACHOŁKI I MIĘSO ARMATNIE: Pospolici kultyści, zbiry i poplecznicy (Mooks) padają jak kaczki od jednego solidnego trafienia (>50% PŻ) lub spektakularnego ciosu.\n` +
        `5. ZŁOCZYŃCY Z KLASĄ ("UWAŻAJ MISTRZU"): Główni arcywrogowie mają swoje dramatyczne monologi, plany dominacji i asów w rękawie; zawsze poświęcają pachołków, by uciec na późniejsze starcie.\n` +
        `6. ZASADA RULE OF COOL: Jeśli deklaracja gracza jest widowiskowa, filmowa i pasuje do pulpowego kina akcji, pozwól na nią lub nagródź ułatwieniem (kością premiową), a nie sztywnym zakazem.\n` +
        `7. OSZUKANIE ŚMIERCI (CHEAT DEATH): Postać gracza na skraju zagłady może zużyć całe Szczęście (min. 30), by cudownie przetrwać zbiegiem okoliczności w ostatniej sekundzie.\n` +
        `8. WEIRD SCIENCE I ANOMALIE: Dziwaczna technologia, promienie śmierci, prototypy i anomalie eteru to chleb powszedni - reaguj na nie fascynacją i nagłymi przepięciami otoczenia.\n` +
        `9. SZALEŃSTWO I SZALONE TALENTY: Utrata Poczytalności to nie paraliżujący stupor, lecz wybuch adrenaliny, heroiczny szał, obsesyjny monolog lub nagła, barwna fobia sensoryczna.\n` +
        `10. FILMOWE CLIFFHANGERY: Kończ intensywne sceny i rozdziały dynamicznymi zawieszeniami akcji, stawiając badaczy przed natychmiastowym wyborem lub zagrożeniem.`
      );
    }
  } else if (sessionTone === 'purist') {
    additionalContext.push(
      `\n## USTAWA O PRZYGODZIE KLASYCZNEJ (LOVECRAFTIAN)\n` +
      `1. Prowadź grę w klasycznym stylu Lovecrafta (powolne popadanie w szaleństwo, badanie starych ksiąg i rodów). NPC skrywają swoje prawdziwe oblicze pod Maską.\n` +
      `2. CIĘCIA MONTAŻOWE: Domyślnie teleportuj badacza do nowej lokacji. Jeśli gracz wprost opisał chęć zrobienia czegoś w podróży (np. lektura, obserwacja), rozegraj to przed cięciem.\n` +
      `3. SZALEŃSTWO: Narzucaj traumę i czasową amnezję bezpośrednio w opisie badacza po porażce SAN. Zakaz używania pojęć mechanicznych (punktów, testów) w prozie opisu.`
    );
  }

  // OPT-26: gmProtocol skip gdy cache aktywny - jest już w cachedContent.contents
  if (!resolvedCachedContent) additionalContext.push(gmProtocol);
  additionalContext.push(getPacingDirective(gameContext, opts.locale));

  // Director's state injection
  if (sessionId) {
    const directorSection = getDirectorPromptSection(sessionId);
    if (directorSection) additionalContext.push(directorSection);
  }

  // SillyTavern Adaptation (Issue #349): Dynamic Scene & Pacing Injection (Author's Note / Depth Injection)
  const scenePacingInjection =
    opts.dynamicSceneInjection ??
    (gameContext
      ? buildDynamicScenePacingInjection({
          sessionId,
          gameContext,
          tone: opts.tone,
          locale: opts.locale,
        })
      : '');

  if (scenePacingInjection) {
    if (opts.messages && opts.messages.length > 0) {
      const depth = opts.depthInjectionDepth ?? 3;
      injectDepthInjectionInPlace(opts.messages, scenePacingInjection, depth);
      if (opts.injectIntoAdditionalContext) {
        additionalContext.push(scenePacingInjection);
      }
    } else {
      additionalContext.push(scenePacingInjection);
    }
  }

  // Issue #68: Dwukierunkowa pętla pamięci - wstrzykiwanie sekcji ## AKTYWNE ŚLEDZTWO I WIEDZA BADACZA
  const activeInvestigationChar =
    (playerCharacterName ? characters?.find((c) => c.name === playerCharacterName) : undefined) ??
    characters?.[0];

  const investigationSection = buildActiveInvestigationSection({
    character: activeInvestigationChar,
    characters,
    sessionId,
    locale: opts.locale,
  });
  if (investigationSection) additionalContext.push(investigationSection);

  if (ragSection) additionalContext.push(ragSection);
  if (summarySection) additionalContext.push(summarySection);
  // Realne handouty przygody (DriveThruRPG) - MG dostaje markdown obrazów do wstawienia.
  if (handoutsSection) additionalContext.push(handoutsSection);

  // Modularne nakładki semantyczne DLC (odblokowane reguły, pościgi, magia, bestie)
  const capabilitiesSection = getSystemCapabilitiesPromptSection(opts.locale);
  if (capabilitiesSection) additionalContext.push(capabilitiesSection);

  // Etap 3: dane immersyjne (astronomia, gazety epoki, przelicznik cen) - wzbogacają narrację.
  if (opts.immersionSection) additionalContext.push(opts.immersionSection);

  // Etap 3.5: Wstrzyknięcie instrukcji reżyserskiej z wylosowanego zdarzenia
  if (opts.directorEventSection) {
    additionalContext.push(opts.directorEventSection);
  }

  // OPT-23: game context injection (gameContextPrompt LUB NPC fallback)
  if (!skipContext && gameContextPrompt) {
    additionalContext.push(gameContextPrompt);
  } else if (!skipContext && npcs && npcs.length > 0) {
    const activeNPCs = npcs.filter(
      (npc) => npc.status === 'alive' || npc.status === 'unknown'
    );
    if (activeNPCs.length > 0) {
      let npcContext = '\n## AKTYWNE POSTACIE (NPC)\n';
      for (const npc of activeNPCs.slice(0, 10)) {
        npcContext += `- **${npc.name}**`;
        if (npc.occupation) npcContext += ` (${npc.occupation})`;
        if (npc.description) npcContext += `: ${npc.description.slice(0, 100)}`;
        if (npc.location) npcContext += ` [lokacja: ${npc.location}]`;
        if (npc.disposition) npcContext += ` [nastawienie: ${npc.disposition}]`;
        if (npc.agenda) npcContext += ` [agenda: ${npc.agenda}]`;
        npcContext += '\n';
      }
      if (currentLocation) {
        npcContext += `\nAktualna lokacja gracza: ${currentLocation}\n`;
      }
      additionalContext.push(npcContext);
    }
  }

  // Arcanum Benchmark 2026: Task 2 - Scene Presence & Information Horizon
  // Twarda obecność NPC w scenie wyznaczona z presentNpcs lub dopasowania npc.location do currentLocation
  const scenePresentNpcs = (opts.presentNpcs && opts.presentNpcs.length > 0)
    ? opts.presentNpcs
    : (npcs && currentLocation
        ? npcs.filter((n) => (n.status === 'alive' || n.status === 'unknown') && n.location && n.location.toLowerCase().trim() === currentLocation.toLowerCase().trim())
        : []);

  if (scenePresentNpcs.length > 0) {
    const isEn = opts.locale === 'en';
    const presentList = scenePresentNpcs.map((n) => n.name).join(', ');
    const scenePresenceSection = isEn
      ? `\n## SCENE PRESENCE & INFORMATION HORIZON (STRICT)\n` +
        `[PRESENT_NPCS: ${presentList}]\n` +
        `STRICT RULE: ONLY NPCs explicitly listed in [PRESENT_NPCS] are physically present in this room and can hear or speak. NPCs in other rooms CANNOT participate, react, or hear the Investigator's words.\n`
      : `\n## OBECNOŚĆ W SCENIE I HORYZONT INFORMACYJNY (TWARDY)\n` +
        `[OBECNI_NPC: ${presentList}]\n` +
        `BEZWZGLĘDNA ZASADA: W dialogach mogą uczestniczyć i zabierać głos WYŁĄCZNIE NPC ze znacznika [OBECNI_NPC]. Postacie przebywające w innych lokacjach lub na korytarzu NIE mają prawa reagować, wtrącać się ani słyszeć wypowiedzi Badacza.\n`;
    additionalContext.push(scenePresenceSection);
  }

  // Arcanum Benchmark 2026: Task 3 - Sealed Envelope Enforcement
  // Niezmienna prawda śledztwa chroniąca przed retrospektywnym dopasowaniem (retrofitted mystery)
  if (opts.truthAnchor) {
    const isEn = opts.locale === 'en';
    const ta = opts.truthAnchor;
    const lines: string[] = isEn
      ? [`\n## IMMUTABLE INVESTIGATION TRUTH (SEALED ENVELOPE)`]
      : [`\n## NIEZMIENNA PRAWDA ŚLEDZTWA (ZAMKNIĘTA KOPERTA)`];

    if (ta.culprit) lines.push(isEn ? `- True Culprit: ${ta.culprit}` : `- Prawdziwy sprawca: ${ta.culprit}`);
    if (ta.motive) lines.push(isEn ? `- Motive: ${ta.motive}` : `- Motyw zbrodni: ${ta.motive}`);
    if (ta.murderWeapon) lines.push(isEn ? `- Murder Weapon / Method: ${ta.murderWeapon}` : `- Narzędzie / metoda: ${ta.murderWeapon}`);
    if (ta.keyAlibi) lines.push(isEn ? `- Inviolable Alibi: ${ta.keyAlibi}` : `- Kluczowe alibi: ${ta.keyAlibi}`);
    if (ta.immutableFacts && ta.immutableFacts.length > 0) {
      ta.immutableFacts.forEach((f) => lines.push(`- ${f}`));
    }

    const directive = isEn
      ? `STRICT DIRECTIVE: DO NOT confirm false theories or bend the mystery to Investigator hypotheses. If the Investigator accuses an innocent person or follows a dead end, present natural contradictory evidence or physical resistance. The true culprit and facts NEVER change.`
      : `ŚCIŚLE ZAKAZANA RETROSPEKTYWNA KONFIRMACJA: ZAKAZ ulegania fałszywym hipotezom Badacza. Jeśli gracz oskarża niewinną osobę lub forsuje zmyślony trop, świat przedstawia sprzeczne dowody lub opór materialny. Prawdziwy sprawca, motyw i narzędzie pozostają nienaruszalne.`;

    lines.push(directive);
    additionalContext.push(lines.join('\n'));
  }

  // OPT-22: Hot Seat FIX prompt (≥2 graczy z resolved characterName)
  if (hotSeatConfig?.enabled && (hotSeatConfig?.players?.length ?? 0) >= 2) {
    const isEn = opts.locale === 'en';
    const fallbackName = isEn ? 'Unknown' : 'Nieznany';
    const characterNames = (hotSeatConfig.players ?? [])
      .map((p) => p.characterName || fallbackName)
      .filter((n) => n !== fallbackName);
    if (characterNames.length >= 2) {
      let duetContext = isEn
        ? `\n## TWO-PLAYER MODE (HOT SEAT / DUET)\n` +
          `CRITICAL ROLE OVERRIDE: This game is NOT solo. A TEAM of investigators is participating: ${characterNames.join(', ')}.\n` +
          `1. NARRATIVE FORM: Describe the world and scenes in the plural ("You see...", "You stand before...", "You hear...") or in addressed shots ("@${characterNames[0]}..., while @${characterNames[1]}..."). NEVER address them as a single individual in the 2nd person singular.\n` +
          `2. RELATIONSHIP & COMMON GOAL: Run the game recognizing that the investigators are cooperating. Emphasize their shared challenges and what brought them together to this point in time and space. NEVER force players to debate among themselves in chat.\n` +
          `3. ADDRESSING & ACTIONS: Describe shared scenes for both characters. Prefix lines and actions directed at ONE character with @CharacterName: (e.g. @${characterNames[0]}: ...).\n` +
          `4. TURN CONCLUSION & PHYSICAL IMMUNITY: Instead of questioning each character individually, ALWAYS end with a simple question addressed to the party: [What do you all do?]. REMEMBER PHYSICAL IMMUNITY: do not perform physical actions, move characters, reach into their inventory, or decide on behalf of ${characterNames.join(', ')}.\n` +
          `5. ASSIGNING EFFECTS: When applying SAN/HP/journal changes, prefix with @Name: \`[SANITY:@${characterNames[0]}: -1d4: reason]\`, \`[HP:@${characterNames[1]}: -1d6: reason]\`, \`[JOURNAL:@${characterNames[0]}:clue:title]content[/JOURNAL]\`.\n`
        : `\n## TRYB GRY DLA DWÓCH OSÓB (HOT SEAT / DRUŻYNA)\n` +
          `KRYTYCZNE NADPISANIE ROLI: Ta gra NIE jest jednoosobowa. W grze uczestniczy ZESPÓŁ badaczy: ${characterNames.join(', ')}.\n` +
          `1. FORMA NARRACJI: Opisuj świat i sceny w liczbie mnogiej ("Widzicie...", "Stajecie przed...", "Słyszycie...") lub w ujęciach adresowanych ("@${characterNames[0]}..., podczas gdy @${characterNames[1]}..."). NIGDY nie zwracaj się do nich jak do pojedynczej osoby w 2. osobie l.poj.\n` +
          `2. RELACJA I WSPÓLNY CEL: Prowadź grę z uwzględnieniem faktu, że bohaterowie współpracują. Podkreślaj ich wspólne wyzwania oraz to, co sprowadziło ich razem w dany punkt czasu i przestrzeni. NIGDY nie zmuszaj graczy do dyskusji między sobą na czacie.\n` +
          `3. ADRESOWANIE I AKCJE: Sceny wspólne opisuj dla obu postaci. Kwestie i akcje kierowane do JEDNEJ postaci poprzedzaj tagiem @ImięPostaci: (np. @${characterNames[0]}: ...).\n` +
          `4. ZAKOŃCZENIE TURY I FIZYCZNY IMMUNITET: Zamiast pytania do każdej postaci z osobna ZAWSZE kończ prostym pytaniem skierowanym do drużyny: [Co robicie?]. PAMIĘTAJ O FIZYCZNYM IMMUNITECIE: nie wykonuj żadnych akcji fizycznych, nie przemieszczaj postaci, nie sięgaj do ich ekwipunku ani nie decyduj za ${characterNames.join(', ')}.\n` +
          `5. PRZYPISANIE SKUTKÓW: Przy zmianach SAN/HP/dziennika dodawaj prefiks @Imię: \`[SANITY:@${characterNames[0]}: -1d4: powód]\`, \`[HP:@${characterNames[1]}: -1d6: powód]\`, \`[DZIENNIK:@${characterNames[0]}:trop:tytuł]treść[/DZIENNIK]\`.\n`;

      if (isGameStart && characters && characters.length >= 2) {
        duetContext += isEn
          ? `\n### DUET INTRODUCTION (GAME START)\n` +
            `You are opening the game for two players. Your first turn must sketch a shared beginning with both characters in mind:\n` +
            `1. DESCRIBE RELATIONSHIP & MEETING: Describe how the characters got there, why they travel/work together, what connects them, and why they are at this place and time at the same moment.\n` +
            `2. PARTY HOOK: Tie the adventure hook to the shared goal of both characters, referencing their background from character sheets.\n` +
            `3. FORM: Address both characters directly and simultaneously in the plural.\n\n` +
            `Investigator details to sketch relationships and meeting:\n`
          : `\n### WPROWADZENIE DLA DUETU (ROZPOCZĘCIE GRY)\n` +
            `Otwierasz grę dla dwójki graczy. Twoja pierwsza tura musi nakreślić wspólny początek z myślą o obu postaciach:\n` +
            `1. OPISZ RELACJĘ I SPOTKANIE: Opisz jak postacie się tam znalazły, dlaczego podróżują/działają razem, co je łączy i dlaczego są w tym miejscu i czasie w tym samym momencie.\n` +
            `2. DRUŻYNOWY HAK: Zwiąż hook przygody ze wspólnym celem obu postaci, odwołując się do ich tła z kart.\n` +
            `3. FORMA: Zwróć się bezpośrednio do obu postaci jednocześnie w liczbie mnogiej.\n\n` +
            `Dane bohaterów do zarysowania relacji i spotkania:\n`;

        characters.forEach((char) => {
          const occ = isEn
            ? (char.occupation ? (getLocalizedOccupationName(char.occupation, 'en') || char.occupation) : '')
            : (char.occupation || '');
          duetContext += isEn
            ? `- **${char.name}** (${occ}): ${char.background || ''}\n` +
              `  * Concept: ${char.characterConcept || ''}\n` +
              `  * Personality & Traits: ${(char.traits || []).join(', ')}. ${((char as unknown) as Record<string, unknown>).personality || ''}\n` +
              `  * Significant Person: ${char.significantPerson || ''}\n` +
              `  * Meaningful Location: ${char.meaningfulLocation || ''}\n` +
              `  * Treasured Possession: ${char.treasuredPossession || ''}\n` +
              `  * Backstory: ${char.backstory || ''}\n`
            : `- **${char.name}** (${char.occupation}): ${char.background || ''}\n` +
              `  * Koncept: ${char.characterConcept || ''}\n` +
              `  * Osobowość i Cechy: ${(char.traits || []).join(', ')}. ${((char as unknown) as Record<string, unknown>).personality || ''}\n` +
              `  * Kluczowa osoba: ${char.significantPerson || ''}\n` +
              `  * Ważne miejsce: ${char.meaningfulLocation || ''}\n` +
              `  * Cenne posiadanie: ${char.treasuredPossession || ''}\n` +
              `  * Historia: ${char.backstory || ''}\n`;
        });
      }

      additionalContext.push(duetContext);
    }
  }

  // Concordia Pattern: Epistemic Fog of War & MakeObservation
  const epistemicChars: InvestigatorSubjectiveState[] = (characters && characters.length > 0)
    ? characters.map((c) => ({
        id: c.id,
        name: c.name,
        currentLocation: currentLocation,
        sanity: c.san,
        maxSanity: c.maxSan ?? (typeof c.san === 'number' ? 99 : undefined),
        dayStartSan: c.dayStartSan,
        dailySanLoss: c.dailySanLoss,
        insanityState: c.insanityState,
        underlyingInsanity: c.underlyingInsanity,
        isBoutOfMadnessActive: Boolean(c.activeBoutOfMadness),
        phobias: c.characterTraits?.phobias,
        manias: c.characterTraits?.manias,
      }))
    : playerCharacterName
      ? [{ id: 'p1', name: playerCharacterName, currentLocation }]
      : [];

  const unrevealedClueSet = new Set<string>();
  if (opts.truthAnchor?.unrevealedClueTitles) {
    opts.truthAnchor.unrevealedClueTitles.forEach((t) => unrevealedClueSet.add(t));
  }

  if (characters && characters.length > 0) {
    for (const char of characters) {
      if (char.investigatorDossier?.clues) {
        char.investigatorDossier.clues.forEach((c) => {
          if (c.discoveryStatus === 'unrevealed' || c.status === 'unconfirmed') {
            unrevealedClueSet.add(c.title);
          }
        });
      }
      if (char.investigatorBoard?.nodes) {
        char.investigatorBoard.nodes.forEach((node) => {
          if (node.discoveryStatus === 'unrevealed') {
            unrevealedClueSet.add(node.title);
          }
        });
      }
    }
  }

  const unrevealedClueTitles = Array.from(unrevealedClueSet);

  const concordiaTruthAnchor: EpistemicTruthAnchor | undefined = opts.truthAnchor
    ? {
        culprit: opts.truthAnchor.culprit,
        motive: opts.truthAnchor.motive,
        murderWeapon: opts.truthAnchor.murderWeapon,
        keyAlibi: opts.truthAnchor.keyAlibi,
        immutableFacts: opts.truthAnchor.immutableFacts,
        unrevealedClueTitles: unrevealedClueTitles.length > 0 ? unrevealedClueTitles.slice(0, 5) : undefined,
      }
    : unrevealedClueTitles.length > 0
      ? { unrevealedClueTitles: unrevealedClueTitles.slice(0, 5) }
      : undefined;

  const observationDirective = buildConcordiaObservationDirective({
    characters: epistemicChars,
    activeCharacterName: playerCharacterName,
    currentLocation,
    scenePresentNpcNames: scenePresentNpcs.map((n) => n.name),
    truthAnchor: concordiaTruthAnchor,
    isHotSeat: isHotSeatActive,
    locale: opts.locale,
  });

  additionalContext.push(observationDirective);

  // Concordia Pattern: EventResolution & Intent Adjudication
  if (opts.eventResolutionDirective) {
    additionalContext.push(opts.eventResolutionDirective);
  } else if (opts.playerMessage && !opts.isGameStart) {
    const activeChar =
      (playerCharacterName ? characters?.find((c) => c.name === playerCharacterName) : undefined) ??
      characters?.[0] ??
      (playerCharacterName ? ({ name: playerCharacterName } as Character) : null);

    const eventResolution = adjudicateEventPipeline(opts.playerMessage, {
      character: activeChar,
      characters,
      currentLocation,
      npcs: npcs as NPC[] | undefined,
      presentNpcNames: scenePresentNpcs.map((n) => n.name),
      locale: opts.locale,
      gameContext: typeof opts.gameContext === 'object' ? JSON.stringify(opts.gameContext) : undefined,
    });
    if (eventResolution?.directive) {
      additionalContext.push(eventResolution.directive);
    }

    // Drabina eskalacji guardrails & ukryty strike counter (Issue #380)
    const isEn = opts.locale === 'en';
    const violation = eventResolution?.adjudication?.guardrailViolation;
    const strike = opts.guardrailState?.strikeCount ?? (violation ? 1 : 0);
    const charName = activeChar?.name || playerCharacterName || (isEn ? 'Investigator' : 'Badacz');

    if (strike > 0) {
      additionalContext.push(`\n[GUARDRAIL_LEVEL: ${strike}]`);
    }

    if (violation && strike === 2) {
      const level2Directive = isEn
        ? `\n## GUARDRAILS LEVEL 2: COGNITIVE SHOCK & ELDRITCH COLD (CoC 7e RAW)\n` +
          `The player has repeated an immersion-breaking action (${violation}: ${eventResolution.adjudication.plausibilityReason || 'anachronism'}).\n` +
          `1. YOU MUST emit the tag: [SANITY: -1k4: cognitive shock, spacetime distortion anomaly].\n` +
          `2. Describe surrounding NPCs reacting with deep shock, outrage, or panic.\n` +
          `3. Describe an unnatural, biting cold filling the room, and sickening oily smoke crawling from the sharp corners of walls (harbinger of the Hounds of Tindalos / Cthulhu).\n` +
          `4. End with [What do you do?]. Game time does NOT advance.`
        : `\n## GUARDRAILS POZIOM 2: SZOK POZNAWCZY I CHŁÓD Z INNEGO WYMIARU (CoC 7e RAW)\n` +
          `Gracz powtórzył działanie niszczące immersję (${violation}: ${eventResolution.adjudication.plausibilityReason || 'anachronizm'}).\n` +
          `1. MUSISZ wyemitować tag: [SANITY: -1k4: szok poznawczy, zaburzenie czasoprzestrzeni].\n` +
          `2. Opisz zgorszenie, oburzenie lub panikę obecnych postaci niezależnych (NPC).\n` +
          `3. Opisz nienaturalny, lodowaty chłód wypełniający pomieszczenie oraz siny, gryzący dym sączący się z ostrych kątów ścian i mebli (zwiastun nadejścia Ogarów z Tindalos / Cthulhu).\n` +
          `4. Zakończ pytaniem [Co robisz?]. Czas gry NIE upływa.`;
      additionalContext.push(level2Directive);
    } else if (violation && strike >= 3) {
      const level3Directive = isEn
        ? `\n## GUARDRAILS LEVEL 3: SERIOUS SAM PROTOCOL (INSTANT ANNIHILATION)\n` +
          `The player has persistently broken reality 3 times. The Serious Sam Protocol is triggered!\n` +
          `1. Spacetime violently ruptures with a deafening screech of non-Euclidean angles. Cthulhu or the Hounds of Tindalos descend and INSTANTLY annihilate the investigator without any roll!\n` +
          `2. YOU MUST emit the exact game over tag:\n` +
          `   [GAME_OVER: @${charName} | typ=DEAD | powod=Anihilacja czasoprzestrzenna przez Wielkiego Przedwiecznego (Protokół Serious Sam) | naglowek=ROZERWANA TKANKA RZECZYWISTOŚCI | tresc=Niewyjaśniony fenomen czasoprzestrzenny wstrząsnął Arkham. Na miejscu odnaleziono jedynie zwęglone szczątki i ślady nieludzkiego śluzu. Świadkowie w "The Arkham Advertiser" donoszą o zstąpieniu koszmaru z gwiazd.]\n` +
          `3. Describe this instantaneous, inescapable doom in full Lovecraftian horror. Game Over.`
        : `\n## GUARDRAILS POZIOM 3: PROTOKÓŁ SERIOUS SAM (NATYCHMIASTOWA ANIHILACJA)\n` +
          `Gracz trzykrotnie naruszył realia świata gry. Uruchomiony zostaje Protokół Serious Sam!\n` +
          `1. Czasoprzestrzeń pęka z ogłuszającym hukiem nieludzkiej geometrii. Cthulhu lub Ogary z Tindalos zstępują i NATYCHMIAST bezwzględnie anihilują badacza bez żadnych rzutów obronnych!\n` +
          `2. MUSISZ wyemitować oficjalny tag ostatecznego kresu:\n` +
          `   [GAME_OVER: @${charName} | typ=DEAD | powod=Anihilacja czasoprzestrzenna przez Wielkiego Przedwiecznego (Protokół Serious Sam) | naglowek=ROZERWANA TKANKA RZECZYWISTOŚCI | tresc=Niewyjaśniony fenomen czasoprzestrzenny wstrząsnął Arkham. Na miejscu odnaleziono jedynie zwęglone szczątki i ślady nieludzkiego śluzu. Świadkowie w "The Arkham Advertiser" donoszą o zstąpieniu koszmaru z gwiazd.]\n` +
          `3. Opisz ten moment z bezlitosną lovecraftowską grozą. Koniec gry.`;
      additionalContext.push(level3Directive);
    }
  }

  // Dyrektywy 5 modularnych silników świata (Issue #444)
  if (opts.worldEngineDirectives) {
    additionalContext.push(opts.worldEngineDirectives);
  }

  return additionalContext;
}
