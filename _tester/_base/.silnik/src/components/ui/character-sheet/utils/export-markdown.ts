/**
 * CharacterSheet - export markdown helper (IND-185 M2, sesja 132).
 *
 * Pure function generująca Markdown karty postaci + trigger download
 * przez Blob + URL.createObjectURL + a.click. Wycięte z character-sheet.tsx
 * (sekcja `handleExportMarkdown` lin 73-165).
 *
 * Side effects (DOM API): document.createElement('a'), a.click(),
 * URL.createObjectURL, URL.revokeObjectURL. To NIE jest pure - operuje
 * na DOM. Testowane przez polyfill jsdom URL.createObjectURL (CS5).
 */

import { getSkillValue, type Character } from '@/lib/types';
import { resolveTestValue } from '@/lib/skill-test-resolver';
import { deriveFinances, type EconomyEraContext } from '@/lib/economy/credit-rating';
import {
  isWeapon,
  inferWeaponSkill,
  isMeleeWeapon,
} from '@/lib/combat/weapon-context';
import { getLocalizedOccupationName } from '@/lib/data/character';

const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

/**
 * Buduje string Markdown z całej karty postaci (cechy, stan, walka,
 * umiejętności, historia, cechy psychologiczne) i triggeruje download
 * pliku `<name>_karta.md` przez Blob.
 *
 * Side effects: tworzy `<a>` element, kliknięcie, revoke object URL.
 * Nie zwraca nic (void). Bezpieczne wywołanie 0/1 razów per akcja.
 */
export function exportCharacterToMarkdown(
  character: Character,
  locale: string = 'pl',
  eraContext?: EconomyEraContext | string | null
): void {
  const isEn = locale === 'en';
  const stats = {
    str: character.str ?? 50,
    con: character.con ?? 50,
    siz: character.siz ?? 50,
    dex: character.dex ?? 50,
    app: character.app ?? 50,
    int: character.int ?? 50,
    pow: character.pow ?? 50,
    edu: character.edu ?? 50,
  };
  const hpDivisor = character.rulesetVariant === 'pulp' ? 5 : 10;
  const maxHp =
    typeof character.maxHp === 'number' && character.maxHp > 0
      ? character.maxHp
      : Math.floor((stats.con + stats.siz) / hpDivisor);
  const maxMp =
    typeof character.maxMp === 'number' && character.maxMp > 0
      ? character.maxMp
      : Math.floor(stats.pow / 5);
  const mythosVal = getSkillValue(
    character.skills?.['Mity Cthulhu'] ??
      character.skills?.['mity_cthulhu'] ??
      character.skills?.['Cthulhu Mythos'] ??
      character.skills?.['cthulhu_mythos']
  );
  const maxSan =
    typeof character.maxSan === 'number' && character.maxSan > 0
      ? character.maxSan
      : Math.max(0, 99 - mythosVal);

  const hp = character.hp ?? maxHp;
  const san = character.san ?? maxSan;
  const mp = character.mp ?? maxMp;
  const luck = character.luck ?? 50;

  let md = `# ${character.name}\n\n`;
  if (isEn) {
    if (character.rulesetVariant === 'pulp') {
      md += `**Ruleset:** Pulp Cthulhu  \n`;
      if (character.archetype) md += `**Pulp Archetype:** ${character.archetype}  \n`;
      if (character.pulpTalents && character.pulpTalents.length > 0) {
        md += `**Pulp Talents:** ${character.pulpTalents.join(', ')}  \n`;
      }
    }
    md += `**Occupation:** ${getLocalizedOccupationName(character.occupation, 'en') || '-'}  \n`;
    md += `**Age:** ${character.age || '-'}  \n`;
    md += `**Gender:** ${character.gender === 'male' ? 'Male' : character.gender === 'female' ? 'Female' : '-'}  \n\n`;

    md += `## 📊 Characteristics\n\n`;
    md += `| STR | CON | SIZ | DEX | APP | INT | POW | EDU |\n`;
    md += `|-----|-----|-----|-----|-----|-----|-----|-----|\n`;
    md += `| ${stats.str} | ${stats.con} | ${stats.siz} | ${stats.dex} | ${stats.app} | ${stats.int} | ${stats.pow} | ${stats.edu} |\n\n`;

    md += `## 💓 Status\n\n`;
    md += `- **HP:** ${hp}/${maxHp}\n`;
    md += `- **SAN:** ${san}/${maxSan}\n`;
    md += `- **MP:** ${mp}/${maxMp}\n`;
    md += `- **Luck:** ${luck}\n\n`;

    md += `## ⚔️ Combat\n\n`;
    md += `- **Damage Bonus:** ${character.damageBonus || '+0'}\n`;
    md += `- **Build:** ${character.build ?? 0}\n`;
    md += `- **Move:** ${character.move ?? 8}\n\n`;
  } else {
    if (character.rulesetVariant === 'pulp') {
      md += `**Wariant reguł:** Pulp Cthulhu  \n`;
      if (character.archetype) md += `**Archetyp pulpowy:** ${character.archetype}  \n`;
      if (character.pulpTalents && character.pulpTalents.length > 0) {
        md += `**Pulpowe talenty:** ${character.pulpTalents.join(', ')}  \n`;
      }
    }
    md += `**Zawód:** ${getLocalizedOccupationName(character.occupation, 'pl') || '-'}  \n`;
    md += `**Wiek:** ${character.age || '-'}  \n`;
    md += `**Płeć:** ${character.gender === 'male' ? 'Mężczyzna' : character.gender === 'female' ? 'Kobieta' : '-'}  \n\n`;

    md += `## 📊 Cechy\n\n`;
    md += `| SIŁ | KON | BUD | ZRĘ | WYG | INT | MOC | WYK |\n`;
    md += `|-----|-----|-----|-----|-----|-----|-----|-----|\n`;
    md += `| ${stats.str} | ${stats.con} | ${stats.siz} | ${stats.dex} | ${stats.app} | ${stats.int} | ${stats.pow} | ${stats.edu} |\n\n`;

    md += `## 💓 Stan\n\n`;
    md += `- **PŻ:** ${hp}/${maxHp}\n`;
    md += `- **PR:** ${san}/${maxSan}\n`;
    md += `- **PM:** ${mp}/${maxMp}\n`;
    md += `- **Szczęście:** ${luck}\n\n`;

    md += `## ⚔️ Walka\n\n`;
    md += `- **Bonus DMG:** ${character.damageBonus || '+0'}\n`;
    md += `- **Krzepa:** ${character.build ?? 0}\n`;
    md += `- **Ruch:** ${character.move ?? 8}\n\n`;
  }

  // Umiejętności
  if (character.skills && Object.keys(character.skills).length > 0) {
    md += isEn ? `## 📚 Skills\n\n` : `## 📚 Umiejętności\n\n`;
    Object.entries(character.skills)
      .sort(([a], [b]) => a.localeCompare(b, isEn ? 'en' : 'pl'))
      .forEach(([skill, value]) => {
        const isOcc = character.occupationalSkills?.includes(skill);
        const val = getSkillValue(value);
        const half = Math.floor(val / 2);
        const fifth = Math.floor(val / 5);
        md += `- ${isOcc ? '★ ' : ''}${skill}: **${val}%** (${half}/${fifth})\n`;
      });
    md += '\n';
  }

  // Finanse i poziom życia (CoC 7e RAW)
  const finances = deriveFinances(character, eraContext, isEn ? 'en' : 'pl');
  if (isEn) {
    md += `## 💵 Finances & Living Standard\n\n`;
    md += `- **Living Standard:** ${finances.tierLabel} (${finances.creditRating}%)\n`;
    md += `- **Daily Spending Limit:** ${finances.formattedSpendingLevel}\n`;
    md += `- **Cash on Hand:** ${finances.formattedCash}\n`;
    md += `- **Assets:** ${finances.formattedAssets}\n`;
    if (finances.livingConditions) {
      md += `- **Living Conditions:** ${finances.livingConditions}\n`;
    }
    md += '\n';
  } else {
    md += `## 💵 Finanse i Poziom Życia\n\n`;
    md += `- **Poziom życia:** ${finances.tierLabel} (${finances.creditRating}%)\n`;
    md += `- **Dzienny limit wydatków:** ${finances.formattedSpendingLevel}\n`;
    md += `- **Gotówka pod ręką:** ${finances.formattedCash}\n`;
    md += `- **Majątek:** ${finances.formattedAssets}\n`;
    if (finances.livingConditions) {
      md += `- **Warunki życia:** ${finances.livingConditions}\n`;
    }
    md += '\n';
  }

  // Ekwipunek (broń z pełną statystyką + wyposażenie)
  const equipment = character.equipment ?? [];
  if (equipment.length > 0) {
    const dmgBonus = character.damageBonus?.trim();
    const hasDb = Boolean(dmgBonus) && dmgBonus !== '0' && dmgBonus !== '-';
    const weapons = equipment.filter(isWeapon);
    const gear = equipment.filter((item) => !isWeapon(item));

    md += isEn ? `## 🎒 Equipment\n\n` : `## 🎒 Ekwipunek\n\n`;
    if (weapons.length > 0) {
      md += isEn ? `### ⚔️ Weapons\n\n` : `### ⚔️ Broń\n\n`;
      md += isEn
        ? `| Weapon | Skill | Damage | Range | Malfunction |\n`
        : `| Broń | Umiejętność | Obrażenia | Zasięg | Zacięcie |\n`;
      md += `|------|-------------|-----------|--------|----------|\n`;
      weapons.forEach((w) => {
        const skill = inferWeaponSkill(w);
        const skillVal = resolveTestValue(skill, character);
        const skillStr = `${skill} ${skillVal !== null ? `${skillVal}%` : isEn ? 'base' : 'baza'}`;
        const damage = w.modifiers?.damage ?? '-';
        const damageStr =
          isMeleeWeapon(w) && hasDb ? `${damage} ${dmgBonus}` : damage;
        md += `| ${w.name} | ${skillStr} | ${damageStr} | ${w.modifiers?.range || '-'} | ${w.modifiers?.malfunction || '-'} |\n`;
      });
      md += '\n';
    }
    if (gear.length > 0) {
      md += isEn ? `### 🎒 Gear\n\n` : `### 🎒 Wyposażenie\n\n`;
      gear.forEach((item) => {
        md += `- ${item.name}${item.description ? ` - ${item.description}` : ''}\n`;
      });
      md += '\n';
    }
  }

  // Historia
  if (
    character.ideology ||
    character.significantPerson ||
    character.background
  ) {
    md += isEn ? `## 📖 History & Identity\n\n` : `## 📖 Historia i Tożsamość\n\n`;
    if (character.ideology)
      md += `**${isEn ? 'Ideology:' : 'Ideologia:'}** ${character.ideology}\n\n`;
    if (character.significantPerson)
      md += `**${isEn ? 'Significant person:' : 'Ważna osoba:'}** ${character.significantPerson}\n\n`;
    if (character.meaningfulLocation)
      md += `**${isEn ? 'Meaningful location:' : 'Znaczące miejsce:'}** ${character.meaningfulLocation}\n\n`;
    if (character.treasuredPossession)
      md += `**${isEn ? 'Treasured possession:' : 'Cenny przedmiot:'}** ${character.treasuredPossession}\n\n`;
    if (character.background)
      md += `**${isEn ? 'Background:' : 'Tło:'}** ${character.background}\n\n`;
  }

  // Cechy psychologiczne
  if (character.characterTraits) {
    md += isEn
      ? `## 🧠 Psychological Traits\n\n`
      : `## 🧠 Cechy Psychologiczne\n\n`;
    if (character.characterTraits.phobias?.length)
      md += `**${isEn ? 'Phobias:' : 'Fobie:'}** ${character.characterTraits.phobias.join(', ')}\n`;
    if (character.characterTraits.manias?.length)
      md += `**${isEn ? 'Manias:' : 'Manie:'}** ${character.characterTraits.manias.join(', ')}\n`;
    if (character.characterTraits.beliefs?.length)
      md += `**${isEn ? 'Beliefs:' : 'Przekonania:'}** ${character.characterTraits.beliefs.join(', ')}\n`;
    md += '\n';
  }

  md += isEn
    ? `---\n*Exported from Keeper of Secrets AI - ${new Date().toLocaleString('en-US')}*\n`
    : `---\n*Eksportowano ze Strażnika Tajemnic AI - ${new Date().toLocaleString('pl-PL')}*\n`;

  // Pobierz plik
  const suffix = isEn ? '_sheet.md' : '_karta.md';
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${character.name.replace(FILENAME_SANITIZE_REGEX, '_')}${suffix}`;
  a.click();
  URL.revokeObjectURL(url);
}
