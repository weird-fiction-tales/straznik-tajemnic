'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedOccupationName } from '@/lib/data/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Character } from '@/lib/types';

interface CharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCharacter?: Character;
  characters?: Character[];
  onCharacterSwitch?: (character: Character) => void;
  onCharacterCreate?: () => void;
  onCharacterManage?: () => void;
}

export const CharacterDialog: FC<CharacterDialogProps> = ({
  open,
  onOpenChange,
  activeCharacter,
  characters = [],
  onCharacterSwitch,
  onCharacterCreate,
  onCharacterManage,
}) => {
  const t = useTranslations('CharacterDialog');
  const locale = useLocale();
  const [view, setView] = useState<'list' | 'details'>('list');

  // Aktualnie wyświetlana postać (dla widoku szczegółów)
  const displayedCharacter = activeCharacter;

  // Funkcja do wyboru postaci
  const handleSelectCharacter = (character: Character) => {
    if (onCharacterSwitch) {
      onCharacterSwitch(character);
    }
    onOpenChange(false); // Zamknij dialog po wyborze
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="wide"
        className="bg-gradient-to-b from-card to-background border-2 border-emerald-600/50 shadow-2xl shadow-emerald-500/10"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-special-elite text-foreground text-xl">
            <span className="text-2xl">👤</span>
            {view === 'list' ? t('manageTitle') : t('sheetTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view === 'list' ? t('listDescription') : t('detailsDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* WIDOK LISTY POSTACI */}
          {view === 'list' && (
            <>
              {/* Aktywna postać (jeśli jest) */}
              {activeCharacter && (
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-2">
                    {t('activeCharacter')}
                  </div>
                  <Card
                    className="bg-card/70 border-brass/50 cursor-pointer hover:bg-card/90 transition-colors shadow-sm"
                    onClick={() => setView('details')}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="w-12 h-12 border border-brass/40">
                        <AvatarFallback className="bg-primary text-primary-foreground font-special-elite font-bold">
                          {activeCharacter.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-bold text-foreground">
                          {activeCharacter.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getLocalizedOccupationName(activeCharacter.occupation, locale)}
                        </div>
                      </div>
                      <Badge className="bg-brass/20 text-brass border border-brass/40 font-special-elite">{t('activeBadge')}</Badge>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Lista innych postaci */}
              {characters.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {activeCharacter
                      ? t('otherCharacters')
                      : t('availableCharacters')}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {characters
                      .filter((char) => char.id !== activeCharacter?.id)
                      .map((char) => (
                        <Card
                          key={char.id}
                          className="bg-card border-border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSelectCharacter(char)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-muted text-foreground text-sm">
                                {char.name
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                {char.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getLocalizedOccupationName(char.occupation, locale)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="bg-brass/20 hover:bg-brass/30 text-foreground border border-brass/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCharacter(char);
                              }}
                            >
                              {t('select')}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* Brak postaci */}
              {characters.length === 0 && !activeCharacter && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👤</div>
                  <p className="text-muted-foreground mb-4">
                    {t('noCharacters')}
                  </p>
                  <Button
                    onClick={onCharacterCreate}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground border border-brass/40"
                  >
                    ➕ {t('createFirst')}
                  </Button>
                </div>
              )}

              {/* Przyciski akcji */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  {t('close')}
                </Button>
                <Button
                  onClick={onCharacterCreate}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground border border-brass/40"
                >
                  ➕ {t('newCharacter')}
                </Button>
                {characters.length > 0 && (
                  <Button variant="outline" onClick={onCharacterManage}>
                    {t('manage')}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* WIDOK SZCZEGÓŁÓW POSTACI */}
          {view === 'details' && displayedCharacter && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                className="mb-2"
              >
                ← {t('backToList')}
              </Button>

              {/* Podstawowe informacje */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-muted text-foreground">
                        {displayedCharacter.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-foreground">
                        {displayedCharacter.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getLocalizedOccupationName(displayedCharacter.occupation, locale)}
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('age')}</span>
                      <p className="text-foreground">
                        {t('ageYears', { age: displayedCharacter.age })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('hp')}</span>
                      <p className="text-foreground">{displayedCharacter.hp}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t('sanity')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">
                          {displayedCharacter.san}
                        </span>
                        <Progress
                          value={
                            (displayedCharacter.san / displayedCharacter.pow) *
                            100
                          }
                          className="w-16 h-2"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="bg-border" />

              {/* Charakterystyki */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    {t('characteristics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        name: t('characteristicSTR'),
                        value: displayedCharacter.str || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicDEX'),
                        value: displayedCharacter.dex || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicCON'),
                        value: displayedCharacter.con || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicAPP'),
                        value: displayedCharacter.app || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicPOW'),
                        value: displayedCharacter.pow || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicEDU'),
                        value: displayedCharacter.edu || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicSIZ'),
                        value: displayedCharacter.siz || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicINT'),
                        value: displayedCharacter.int || 0,
                        max: 100,
                      },
                      {
                        name: t('characteristicLuck'),
                        value: displayedCharacter.luck || 0,
                        max: 100,
                      },
                    ].map((char) => (
                      <div key={char.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">{char.name}</span>
                          <span className="text-foreground">
                            {char.value}/{char.max}
                          </span>
                        </div>
                        <Progress
                          value={(char.value / char.max) * 100}
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  {t('close')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onCharacterManage}
                >
                  {t('manage')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
