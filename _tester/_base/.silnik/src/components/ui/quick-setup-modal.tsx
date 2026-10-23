'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { SafeImage } from './safe-image';
import { Sparkles, User, BookOpen, ArrowRight, Users, Info, X, Loader2 } from 'lucide-react';
import { getQuickSetupAdventures } from '@/lib/adventures-data';
import { getStrefa11CharactersForAdventure } from '@/lib/immersion/strefa-11-characters';
import {
  localizeStrefa11Adventure,
  localizeStrefa11Character,
} from '@/lib/immersion/strefa-11-localization';
import { Character } from '@/lib/types';
import { CharacterSheet } from './character-sheet';
import { QUICK_SETUP_SHOWCASE_PROFILE } from './quick-setup-showcase-profile';

interface QuickSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickStart: (adventureId: string, characterId: string, mode: 'solo' | 'hot-seat', player2CharacterId?: string) => void;
  isStarting?: boolean;
  startProgress?: number;
  startStatus?: string;
}

export function QuickSetupModal({
  open,
  onOpenChange,
  onQuickStart,
  isStarting = false,
  startProgress = 0,
  startStatus = '',
}: QuickSetupModalProps) {
  const t = useTranslations('QuickSetupModal');
  const locale = useLocale() as 'pl' | 'en';
  const showcase = QUICK_SETUP_SHOWCASE_PROFILE.enabled
    ? QUICK_SETUP_SHOWCASE_PROFILE.locales[locale]
    : undefined;
  const rawAdventures = useMemo(
    () => getQuickSetupAdventures(locale).filter(
      (adventure) => !showcase || adventure.id === showcase.adventureId
    ),
    [locale, showcase]
  );
  const [selectedAdventureId, setSelectedAdventureId] = useState<string>(
    () => rawAdventures[0]?.id || 'cien-nad-prabutami'
  );
  
  const [playMode, setPlayMode] = useState<'solo' | 'hot-seat'>('solo');
  const [selectedCharacter1, setSelectedCharacter1] = useState<string>('');
  const [selectedCharacter2, setSelectedCharacter2] = useState<string>('');
  const [viewingCharacter, setViewingCharacter] = useState<Character | null>(null);

  const adventures = useMemo(
    () => rawAdventures.map((adventure) => localizeStrefa11Adventure(adventure, locale)),
    [rawAdventures, locale]
  );

  useEffect(() => {
    if (!rawAdventures.some((adv) => adv.id === selectedAdventureId)) {
      setSelectedAdventureId(rawAdventures[0]?.id || 'cien-nad-prabutami');
    }
  }, [rawAdventures, selectedAdventureId]);

  const availableCharacters = useMemo(() => {
    return getStrefa11CharactersForAdventure(selectedAdventureId)
      .filter((character) => !showcase || character.id === showcase.characterId)
      .slice(0, 4)
      .map((character) => localizeStrefa11Character(character, locale));
  }, [locale, selectedAdventureId, showcase]);

  useEffect(() => {
    setSelectedCharacter1(showcase ? availableCharacters[0]?.id || '' : '');
    setSelectedCharacter2('');
    if (showcase) setPlayMode('solo');
  }, [selectedAdventureId, availableCharacters, showcase]);

  // Gdy gra zaczyna się uruchamiać, zamknij modal, aby odsłonić pełnoekranowy ekran ładowania TTSHardLoadingScreen
  useEffect(() => {
    if (isStarting && open) {
      onOpenChange(false);
    }
  }, [isStarting, open, onOpenChange]);

  const canStart = playMode === 'solo' 
    ? selectedCharacter1 !== ''
    : selectedCharacter1 !== '' && selectedCharacter2 !== '' && selectedCharacter1 !== selectedCharacter2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="quick-setup-modal"
        size="screen"
        screenContentClassName="flex flex-col"
      >
        <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-brass/55" />
        <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-brass/55" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-brass/55" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-brass/55" />

        <DialogHeader className="text-center sm:text-center shrink-0">
          <div className="font-special-elite text-[14px] uppercase tracking-[0.4em] text-primary">
            {t('kicker')}
          </div>
          <DialogTitle className="mt-1 justify-center text-center font-display-decorative text-3xl font-black uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
            {locale === 'en' ? 'American Mythos Cold Cases' : 'Strefa 11'}
          </DialogTitle>
          <DialogDescription className="text-center font-serif text-base italic text-muted-foreground">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 mb-2 flex items-center gap-4 shrink-0">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold" />
          <span className="h-2 w-2 rotate-45 bg-brass" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto journal-scroll space-y-6 pt-4 pr-2">
          {/* Wybór trybu */}
          <div>
            <label className="block text-sm font-display uppercase tracking-[0.16em] text-brass mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              {t('stepMode')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={playMode === 'solo'}
                onClick={() => { setPlayMode('solo'); setSelectedCharacter2(''); }}
                className={`min-h-11 p-3.5 border text-left transition-all relative flex items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  playMode === 'solo'
                    ? 'border-primary bg-[#0f1715] shadow-glow text-foreground'
                    : 'bg-[#14100c]/90 border-brass/30 hover:border-brass/70 hover:bg-[#1a1510] text-muted-foreground'
                }`}
              >
                <span className={`pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l ${playMode === 'solo' ? 'border-primary' : 'border-brass/50'}`} />
                <span className={`pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r ${playMode === 'solo' ? 'border-primary' : 'border-brass/50'}`} />
                <div className={`p-2 border transition-colors ${
                  playMode === 'solo'
                    ? 'border-primary/60 bg-primary/15 text-primary shadow-glow'
                    : 'border-brass/30 bg-black/40 text-brass/70'
                }`}>
                  <User className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <div className={`font-display text-sm uppercase tracking-[0.14em] font-semibold ${
                    playMode === 'solo' ? 'text-primary' : 'text-foreground'
                  }`}>{t('solo')}</div>
                  <div className="text-sm font-special-elite mt-0.5 opacity-80 tracking-wide">{t('soloDescription')}</div>
                </div>
              </button>

              {!showcase && (
                <button
                  type="button"
                  aria-pressed={playMode === 'hot-seat'}
                  onClick={() => setPlayMode('hot-seat')}
                  className={`min-h-11 p-3.5 border text-left transition-all relative flex items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    playMode === 'hot-seat'
                      ? 'border-primary bg-[#0f1715] shadow-glow text-foreground'
                      : 'bg-[#14100c]/90 border-brass/30 hover:border-brass/70 hover:bg-[#1a1510] text-muted-foreground'
                  }`}
                >
                  <span className={`pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l ${playMode === 'hot-seat' ? 'border-primary' : 'border-brass/50'}`} />
                  <span className={`pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r ${playMode === 'hot-seat' ? 'border-primary' : 'border-brass/50'}`} />
                  <div className={`p-2 border transition-colors ${
                    playMode === 'hot-seat'
                      ? 'border-primary/60 bg-primary/15 text-primary shadow-glow'
                      : 'border-brass/30 bg-black/40 text-brass/70'
                  }`}>
                    <Users className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <div className={`font-display text-sm uppercase tracking-[0.14em] font-semibold ${
                      playMode === 'hot-seat' ? 'text-primary' : 'text-foreground'
                    }`}>{t('hotSeat')}</div>
                    <div className="text-sm font-special-elite mt-0.5 opacity-80 tracking-wide">{t('hotSeatDescription')}</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Wybór scenariusza */}
          <div>
            <label className="block text-sm font-display uppercase tracking-[0.16em] text-brass mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              {t('stepAdventure')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {adventures.map((adv) => {
                const isSelected = selectedAdventureId === adv.id;
                return (
                  <button
                    type="button"
                    key={adv.id}
                    aria-label={adv.title}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedAdventureId(adv.id)}
                    className={`p-3.5 border cursor-pointer transition-all relative flex flex-col justify-between min-h-[6rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected
                        ? 'border-primary bg-[#0f1715] shadow-glow text-foreground'
                        : 'bg-[#14100c]/90 border-brass/30 hover:border-brass/70 hover:bg-[#1a1510] text-muted-foreground'
                    }`}
                  >
                    <span className={`pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                    <span className={`pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                    <div>
                      <div className={`font-display text-base whitespace-normal break-words uppercase tracking-[0.12em] font-bold ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}>
                        {adv.title}
                      </div>
                      <div className="text-base leading-relaxed font-serif mt-1.5 line-clamp-3 text-muted-foreground">
                        {adv.description}
                      </div>
                    </div>
                    <div className="text-sm uppercase font-special-elite mt-3 self-start border border-brass/40 bg-black/60 text-brass px-2 py-0.5 tracking-wider">
                      {adv.eraLabel} · {adv.location}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wybór postaci */}
          <div>
            <label className="block text-sm font-display uppercase tracking-[0.16em] text-brass mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              {t('stepCharacters')}
            </label>
            
            {/* Gracz 1 */}
            <div className="mb-4">
              <div className="text-sm font-special-elite uppercase tracking-[0.1em] text-brass/80 mb-2">
                {playMode === 'hot-seat' ? t('playerOne') : t('yourCharacter')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {availableCharacters.map(c => {
                  const isSelected = selectedCharacter1 === c.id;
                  const isOtherChosen = playMode === 'hot-seat' && selectedCharacter2 === c.id;
                  return (
                    <div
                      key={'p1-'+c.id}
                      className={`relative border transition-all flex flex-col overflow-hidden ${
                        isSelected
                          ? 'bg-[#0f1715] border-primary shadow-glow'
                          : isOtherChosen 
                            ? 'opacity-30 border-brass/15 bg-black/70 grayscale pointer-events-none'
                            : 'bg-[#14100c]/90 border-brass/30 hover:border-brass/70 grayscale hover:grayscale-0'
                      }`}
                    >
                      <span className={`pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l z-10 ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                      <span className={`pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r z-10 ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                      <div className="flex-1 flex flex-col">
                        <button
                          type="button"
                          disabled={isOtherChosen}
                          onClick={() => setSelectedCharacter1(c.id)}
                          aria-pressed={isSelected}
                          className="min-h-11 flex-1 text-left w-full relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <div className="aspect-[3/4] w-full overflow-hidden border-b border-brass/30 relative bg-black/50">
                            {c.portraitUrl ? (
                              <SafeImage
                                src={c.portraitUrl}
                                alt={c.name}
                                className="w-full h-full object-cover object-top grayscale opacity-85 transition-all hover:grayscale-0 hover:opacity-100"
                                style={{ 
                                  filter: isSelected ? 'grayscale(0)' : undefined,
                                  opacity: isSelected ? 1 : undefined
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                                <User className="w-8 h-8 opacity-20 text-brass" />
                              </div>
                            )}
                            {isSelected && (
                              <span className="absolute left-1.5 top-1.5 flex h-6 w-6 rotate-45 items-center justify-center bg-primary border border-primary/80 shadow-glow z-10">
                                <span aria-hidden="true" className="-rotate-45 text-sm font-black text-primary-foreground">✓</span>
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <div className={`font-display uppercase tracking-[0.08em] text-base leading-relaxed whitespace-normal break-words ${isSelected ? 'text-primary font-bold' : 'text-foreground'}`}>
                              {c.name}
                            </div>
                            <div className="text-sm font-special-elite text-brass/70 whitespace-normal break-words mt-0.5 tracking-wider uppercase">
                              {c.occupation}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingCharacter(c as Character);
                          }}
                          className="w-full min-h-11 py-1.5 border-t border-brass/30 bg-black/60 hover:bg-brass/15 text-brass hover:text-gold text-sm font-special-elite uppercase tracking-widest flex justify-center items-center gap-1.5 transition-colors mt-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <Info className="w-3 h-3 text-gold/80" /> {t('biography')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gracz 2 */}
            {playMode === 'hot-seat' && (
              <div>
                <div className="text-sm font-special-elite uppercase tracking-[0.1em] text-brass/80 mb-2">
                  {t('playerTwo')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {availableCharacters.map(c => {
                    const isSelected = selectedCharacter2 === c.id;
                    const isOtherChosen = selectedCharacter1 === c.id;
                    return (
                      <div
                        key={'p2-'+c.id}
                        className={`relative border transition-all flex flex-col overflow-hidden ${
                          isSelected
                            ? 'bg-[#0f1715] border-primary shadow-glow'
                            : isOtherChosen 
                              ? 'opacity-30 border-brass/15 bg-black/70 grayscale pointer-events-none'
                              : 'bg-[#14100c]/90 border-brass/30 hover:border-brass/70 grayscale hover:grayscale-0'
                        }`}
                      >
                        <span className={`pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l z-10 ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                        <span className={`pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r z-10 ${isSelected ? 'border-primary' : 'border-brass/50'}`} />
                        <div className="flex-1 flex flex-col">
                          <button
                            type="button"
                            disabled={isOtherChosen}
                            onClick={() => setSelectedCharacter2(c.id)}
                            aria-pressed={isSelected}
                            className="min-h-11 flex-1 text-left w-full relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                          >
                            <div className="aspect-[3/4] w-full overflow-hidden border-b border-brass/30 relative bg-black/50">
                              {c.portraitUrl ? (
                                <SafeImage
                                  src={c.portraitUrl}
                                  alt={c.name}
                                  className="w-full h-full object-cover object-top grayscale opacity-85 transition-all hover:grayscale-0 hover:opacity-100"
                                  style={{ 
                                    filter: isSelected ? 'grayscale(0)' : undefined,
                                    opacity: isSelected ? 1 : undefined
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                                  <User className="w-8 h-8 opacity-20 text-brass" />
                                </div>
                              )}
                              {isSelected && (
                                <span className="absolute left-1.5 top-1.5 flex h-6 w-6 rotate-45 items-center justify-center bg-primary border border-primary/80 shadow-glow z-10">
                                  <span aria-hidden="true" className="-rotate-45 text-sm font-black text-primary-foreground">✓</span>
                                </span>
                              )}
                            </div>
                            <div className="p-2.5">
                              <div className={`font-display uppercase tracking-[0.08em] text-base leading-relaxed whitespace-normal break-words ${isSelected ? 'text-primary font-bold' : 'text-foreground'}`}>
                                {c.name}
                              </div>
                              <div className="text-sm font-special-elite text-brass/70 whitespace-normal break-words mt-0.5 tracking-wider uppercase">
                                {c.occupation}
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCharacter(c as Character);
                            }}
                            className="w-full min-h-11 py-1.5 border-t border-brass/30 bg-black/60 hover:bg-brass/15 text-brass hover:text-gold text-sm font-special-elite uppercase tracking-widest flex justify-center items-center gap-1.5 transition-colors mt-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                          >
                            <Info className="w-3 h-3 text-gold/80" /> {t('biography')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="shrink-0 flex flex-col items-end gap-3 pt-4 mt-auto border-t border-brass/30 bg-[#120e0a]/70">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            {isStarting ? (
              <div
                data-testid="quick-setup-progress-container"
                className="w-full max-w-md flex flex-col gap-1.5 animate-in fade-in-50 duration-300"
              >
                <div className="w-full h-2 bg-black/80 border border-primary/50 overflow-hidden relative shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
                  <div
                    data-testid="quick-setup-progress-bar"
                    className="h-full bg-primary shadow-glow transition-all duration-500 ease-out relative"
                    style={{ width: `${Math.min(100, Math.max(5, startProgress))}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="w-full flex items-center justify-between text-sm font-special-elite text-brass tracking-[0.08em] px-1">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                    <span className="truncate">{startStatus || t('statusSettingUp')}</span>
                  </span>
                  <span className="font-mono text-primary ml-2 shrink-0">{startProgress}%</span>
                </div>
              </div>
            ) : (
              <div className="hidden sm:block text-sm font-serif italic text-brass/80">
                {playMode === 'hot-seat' ? t('hotSeatDescription') : t('soloDescription')}
              </div>
            )}

            <Button
              className={`font-display uppercase tracking-[0.16em] text-sm px-8 h-11 border transition-all ${
                isStarting
                  ? 'bg-primary/40 border-primary text-primary-foreground cursor-wait'
                  : canStart
                    ? 'bg-primary border-primary text-primary-foreground font-bold shadow-glow hover:bg-primary/90 hover:brightness-110'
                    : 'bg-black/50 border-brass/30 text-muted-foreground cursor-not-allowed opacity-50'
              }`}
              disabled={!canStart || isStarting}
              onClick={() => {
                if (canStart && !isStarting) {
                  onQuickStart(
                    selectedAdventureId,
                    selectedCharacter1,
                    playMode,
                    playMode === 'hot-seat' ? selectedCharacter2 : undefined
                  );
                  onOpenChange(false);
                }
              }}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" />
                  <span>{t('startingGame')}</span>
                </>
              ) : (
                <>
                  <span>{t('start')}</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <CharacterSheet
        open={!!viewingCharacter}
        onOpenChange={(open) => !open && setViewingCharacter(null)}
        character={viewingCharacter || undefined}
      />
    </Dialog>
  );
}
