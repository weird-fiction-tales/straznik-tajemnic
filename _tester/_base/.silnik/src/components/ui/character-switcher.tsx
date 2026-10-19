"use client";

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Character } from '@/lib/types';
import { getLocalizedOccupationName } from '@/lib/data/character';
import { Button } from './button';
import { 
  Users, 
  User, 
  Clock, 
  BookOpen, 
  ChevronDown,
  ChevronUp,
  Plus,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CharacterSwitcherProps {
  characters: Character[];
  activeCharacter: Character | null;
  onCharacterSwitch: (character: Character) => void;
  onCharacterCreate: () => void;
  onCharacterManage: () => void;
  className?: string;
}

export function CharacterSwitcher({
  characters,
  activeCharacter,
  onCharacterSwitch,
  onCharacterCreate,
  onCharacterManage,
  className
}: CharacterSwitcherProps) {
  const t = useTranslations('CharacterSwitcher');
  const locale = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrowanie postaci
  const filteredCharacters = characters.filter((char) => {
    const q = searchQuery.toLowerCase();
    const localizedOcc = getLocalizedOccupationName(char.occupation, locale);
    return (
      char.name.toLowerCase().includes(q) ||
      char.playerName.toLowerCase().includes(q) ||
      char.occupation.toLowerCase().includes(q) ||
      localizedOcc.toLowerCase().includes(q)
    );
  });

  // Grupowanie postaci według kampanii
  const charactersByCampaign = filteredCharacters.reduce((acc, char) => {
    const campaignId = char.campaignId || 'no-campaign';
    if (!acc[campaignId]) {
      acc[campaignId] = [];
    }
    acc[campaignId].push(char);
    return acc;
  }, {} as Record<string, Character[]>);

  const getCharacterInitials = (character: Character) => {
    return character.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (character: Character) => {
    if (character.isActive) return 'bg-green-500';
    if (character.lastUsed && new Date().getTime() - character.lastUsed.getTime() < 24 * 60 * 60 * 1000) {
      return 'bg-yellow-500';
    }
    return 'bg-muted-foreground';
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Główny przycisk z aktywną postacią */}
      <div className="border border-border bg-card rounded-lg">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-foreground" />
              <h3 className="text-lg font-mono text-foreground">
                {t('activeCharacter')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCharacterCreate}
                className="h-8 px-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCharacterManage}
                className="h-8 px-2"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 px-2"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          {activeCharacter ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 border-2 border-border rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono text-sm">
                  {getCharacterInitials(activeCharacter)}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card",
                  getStatusColor(activeCharacter)
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-mono font-semibold text-foreground truncate">
                    {activeCharacter.name}
                  </h3>
                  <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded">
                    {getLocalizedOccupationName(activeCharacter.occupation, locale)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{activeCharacter.playerName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {activeCharacter.lastUsed 
                        ? new Date(activeCharacter.lastUsed).toLocaleDateString()
                        : 'Nigdy'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground font-mono">
                {t('noActiveCharacter')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onCharacterCreate}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('createCharacter')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rozwinięta lista postaci */}
      {isExpanded && (
        <div className="mt-2 border border-border bg-card rounded-lg">
          <div className="p-4 pb-3">
            <h4 className="text-sm font-mono text-foreground">
              Wszystkie Postaci ({characters.length})
            </h4>
          </div>
          
          <div className="px-4 pb-4 space-y-4">
            {/* Wyszukiwarka */}
            <div className="relative">
              <input
                type="text"
                placeholder="Szukaj postaci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Lista postaci pogrupowana według kampanii */}
            {Object.entries(charactersByCampaign).map(([campaignId, campaignCharacters]) => (
              <div key={campaignId} className="space-y-2">
                {campaignId !== 'no-campaign' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span className="font-mono">
                      {campaignCharacters[0].campaignId || 'Brak kampanii'}
                    </span>
                  </div>
                )}
                
                <div className="grid gap-2">
                  {campaignCharacters.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => onCharacterSwitch(character)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all hover:bg-accent",
                        character.isActive 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="relative">
                        <div className="h-10 w-10 border border-border rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono text-sm">
                          {getCharacterInitials(character)}
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-card",
                          getStatusColor(character)
                        )} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-mono font-medium text-foreground truncate">
                            {character.name}
                          </h4>
                          {character.isActive && (
                            <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                              Aktywna
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{character.playerName}</span>
                          <span>•</span>
                          <span>{getLocalizedOccupationName(character.occupation, locale)}</span>
                          <span>•</span>
                          <span>
                            {character.lastUsed 
                              ? new Date(character.lastUsed).toLocaleDateString()
                              : 'Nigdy'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filteredCharacters.length === 0 && (
              <div className="text-center py-6">
                <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground font-mono">
                  {searchQuery ? 'Nie znaleziono postaci' : 'Brak postaci'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
