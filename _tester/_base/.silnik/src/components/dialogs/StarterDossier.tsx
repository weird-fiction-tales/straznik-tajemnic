'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Character } from '@/lib/types';
import { isStarterAdventure, type StarterMechanics, type StarterState } from '@/lib/adventures/starter-runtime';
import { readStarterState } from '@/lib/adventures/starter-client';
import { getHauntingHandouts, getHauntingDossier, hauntingMapImage } from '@/lib/adventures/starter-dossier';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function StarterDossier({ adventure, activeCharacter, characters, send }: {
  adventure: { id?: string; sourceBookId?: string } | null; activeCharacter: Character | null; characters: Character[];
  send: (message: string, mechanics?: { starter: StarterMechanics }) => void;
}) {
  const t = useTranslations('StarterDossier');
  const locale = useLocale() === 'en' ? 'en' : 'pl';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StarterState | null>(null);
  useEffect(() => {
    const refresh = () => setState(readStarterState());
    refresh(); window.addEventListener('starter-dossier-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('starter-dossier-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [adventure?.id]);
  if (!isStarterAdventure(adventure)) return null;
  const d = getHauntingDossier(locale);
  const materials = getHauntingHandouts(locale).filter(h => state?.discoveredHandouts.includes(h.slug));
  const action = (kind: 'take' | 'transfer' | 'study', slug: string, title: string) => {
    if (!activeCharacter) return;
    setOpen(false);
    send(t(({ take: 'takeMessage', transfer: 'transferMessage', study: 'studyMessage' } as const)[kind], { title }), { starter: { action: { kind, slug, characterId: activeCharacter.id } } });
  };
  return <>
    <Button data-testid="starter-dossier-open" variant="outline" className="fixed bottom-4 left-4 z-30 border-brass bg-card text-brass font-special-elite" onClick={() => setOpen(true)}>{t('open')}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="screen" data-testid="starter-dossier">
        <DialogHeader><DialogTitle>{t('title')}</DialogTitle><DialogDescription>{t('description')}</DialogDescription></DialogHeader>
        <div className="overflow-y-auto journal-scroll space-y-6 pr-3">
          <p>{state ? d.scenes.find(s => s.id === state.currentSceneId)?.title : t('empty')}</p>
          {state && <section><h2 className="font-display text-brass">{t('map')}</h2>
            {/* Only confirmed room identities enter this projection. */}
            <img src={hauntingMapImage(locale, state.discoveredRoomIds)} alt={t('map')} className="max-w-2xl w-full" />
          </section>}
          {materials.map(h => {
            const ownerId = state?.owners[h.slug];
            const owner = characters.find(c => c.id === ownerId);
            const portable = ['clue-01-knott-keys', 'clue-09-corbitt-journal', 'item-corbitt-dagger', 'item-liber-ivonis', 'clue-chapel-cult-journal'].includes(h.slug);
            return <article key={h.slug} data-testid="starter-discovered-handout" className="border border-brass/30 bg-card p-4 space-y-3">
              <h2 className="font-display text-brass">{h.title}</h2>
              <img src={h.image} alt={h.title} className="w-full h-auto" />
              <details><summary>{t('transcript')}</summary><p className="whitespace-pre-wrap font-special-elite">{h.textContent}</p></details>
              {owner && <p>{t('owner', { name: owner.name })}</p>}
              {portable && activeCharacter && !ownerId && <Button onClick={() => action('take', h.slug, h.title)}>{t('take')}</Button>}
              {ownerId && activeCharacter && ownerId !== activeCharacter.id && <Button onClick={() => action('transfer', h.slug, h.title)}>{t('transfer')}</Button>}
              {ownerId === activeCharacter?.id && ['item-liber-ivonis', 'clue-09-corbitt-journal'].includes(h.slug) && !state?.completedChecks.includes('study:' + h.slug) && <Button onClick={() => action('study', h.slug, h.title)}>{t('study')}</Button>}
            </article>;
          })}
          {state?.failedChecks.filter(id => !state.completedChecks.includes(id)).map(id => <Button key={id} variant="outline" onClick={() => {
            if (!activeCharacter) return; setOpen(false); send(t('pushMessage'), { starter: { action: { kind: 'push', checkId: id, characterId: activeCharacter.id } } });
          }}>{t('push')}</Button>)}
          {state?.ending && <p data-testid="starter-ending" className="border border-brass p-4">{t(`ending.${state.ending}` as const)}</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
