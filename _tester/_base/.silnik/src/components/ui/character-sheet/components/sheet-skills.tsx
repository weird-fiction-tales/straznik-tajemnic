'use client';

/**
 * CharacterSheet - SheetSkills komponent (re-skin Dark Art Déco, makieta 04).
 *
 * Sekcja 5 UMIEJĘTNOŚCI: grid 2-kolumnowy, nazwa (Cormorant) + procent
 * (Special Elite złoto) + cienki pasek postępu (5px). Zawodowe oznaczone ★.
 * Umiejętności Mitów (czerwień + poświata) wg makiety 04. Sort alfabetyczny PL.
 */

import { getSkillValue, isSkillMarked, type Character } from '@/lib/types';
import { HelpIcon } from '../../tooltip';
import { SECTION_HELP } from '../types';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedSkillName, getLocalizedSkillDescription } from '@/lib/data/character';

export interface SheetSkillsProps {
  character: Character;
  skillLabels?: Record<string, string>;
}

/** Rozpoznaje umiejętność Mitów (czerwień + poświata, niebezpieczna wiedza). */
function isMythosSkill(skill: string): boolean {
  return /mit|mythos|cthulhu/i.test(skill);
}

/**
 * Renderuje umiejętności postaci jako grid 2-kolumnowy déco. Zawodowe (★),
 * oznaczona do rozwoju (✓), progi (1/2 i 1/5), Mity na czerwono.
 * Sortowanie alfabetyczne (locale 'pl').
 */
export function SheetSkills({ character, skillLabels = {} }: SheetSkillsProps) {
  const t = useTranslations('CharacterSheet');
  const locale = useLocale();
  const skills = Object.entries(character.skills || {}).sort(([a], [b]) => {
    const nameA = skillLabels[a] ?? getLocalizedSkillName(a, locale);
    const nameB = skillLabels[b] ?? getLocalizedSkillName(b, locale);
    return nameA.localeCompare(nameB, locale);
  });

  return (
    <div>
      <h3 className="font-display uppercase tracking-[0.24em] text-brass text-xs font-semibold mb-4 flex items-center gap-1.5">
        {t('skills')}
        <HelpIcon
          content={
            t.has('sectionHelp.skills')
              ? t('sectionHelp.skills')
              : SECTION_HELP.skills
          }
          position="right"
        />
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-2.5">
        {skills.map(([skill, value]) => {
          const isOccupational = character.occupationalSkills?.includes(skill);
          const isMarked = isSkillMarked(value);
          const mythos = isMythosSkill(skill);
          // value bywa obiektem SkillData ({value, markedForImprovement, ...}) po
          // Fazie Rozwoju - getSkillValue odpakowuje oba formaty (inaczej React #31).
          const val = getSkillValue(value);
          const half = Math.floor(val / 2);
          const fifth = Math.floor(val / 5);
          const pct = Math.max(0, Math.min(100, val));
          const accent = mythos ? 'text-[#d9685f]' : 'text-brass';
          const breakdownTooltip = t.has('skillBreakdownTooltip')
            ? t('skillBreakdownTooltip', { regular: val, hard: half, extreme: fifth })
            : `Zwykły: ${val}% | Trudny (1/2): ${half}% | Ekstremalny (1/5): ${fifth}%`;
          const markedTitle = t.has('markedForImprovement')
            ? t('markedForImprovement')
            : 'Umiejętność oznaczona do rozwoju w Fazie Rozwoju';

          return (
            <div key={skill}>
              <div className="flex justify-between items-baseline mb-1">
                <span
                  className={`font-serif text-base truncate pr-2 ${
                    mythos ? 'text-[#d9685f]' : 'text-foreground'
                  }`}
                >
                  {isOccupational && <span className="text-brass mr-1">★</span>}
                  {isMarked && (
                    <span
                      className="text-primary mr-1 font-bold text-xs"
                      title={markedTitle}
                    >
                      ✓
                    </span>
                  )}
                  {skillLabels[skill] ?? getLocalizedSkillName(skill, locale)}
                </span>
                <span
                  className="font-special-elite text-xs flex-none flex items-center gap-1.5 cursor-help"
                  title={breakdownTooltip}
                >
                  <span className={accent}>{val}%</span>
                  <span className="text-[11px] text-muted-foreground/70 font-mono tracking-tight">
                    ({half}/{fifth})
                  </span>
                </span>
              </div>
              <div className="h-[5px] bg-[#1f1a14]">
                <div
                  className="h-full"
                  style={
                    mythos
                      ? {
                          width: `${pct}%`,
                          background: '#b3322c',
                          boxShadow: '0 0 8px rgba(179,50,44,.5)',
                        }
                      : { width: `${pct}%`, background: '#c9a227' }
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
