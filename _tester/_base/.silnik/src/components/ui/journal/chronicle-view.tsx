'use client';

import { useTranslations } from 'next-intl';
import type { JournalChronicleScene } from '@/lib/journal/public-journal';

/** Reads the accepted scene summaries already present in the save. Opening never requests AI. */
export function ChronicleView({
  entries,
}: {
  entries: JournalChronicleScene[];
}) {
  const t = useTranslations('SessionJournal');
  return (
    <section
      data-testid="journal-chronicle"
      aria-label={t('chronicleHeading')}
      className="mb-10 space-y-6"
    >
      {entries.length ? (
        entries.map((scene, index) => (
          <article
            key={scene.id}
            className="max-w-3xl border-l-2 border-brass/40 pl-5"
          >
            {(index === 0 ||
              scene.sessionNumber !== entries[index - 1].sessionNumber) && (
              <p className="mb-3 text-sm text-brass">
                {scene.sessionNumber
                  ? t('chronicleSession', { number: scene.sessionNumber })
                  : t('chronicleEarlier')}
              </p>
            )}
            <h3 className="font-display text-xl text-foreground">
              {scene.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {[scene.inGameDate, scene.location, ...scene.people]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {scene.summary && (
              <p className="mt-3 whitespace-pre-line font-serif text-lg leading-8 text-foreground">
                {scene.summary}
              </p>
            )}
          </article>
        ))
      ) : (
        <p className="max-w-3xl font-serif text-lg leading-8 text-muted-foreground">
          {t('chronicleEmpty')}
        </p>
      )}
    </section>
  );
}
