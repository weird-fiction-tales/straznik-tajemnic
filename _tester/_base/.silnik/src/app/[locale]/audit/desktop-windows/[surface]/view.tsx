'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { DesktopUpdateModal } from '@/components/desktop-update-modal';
import { SessionList } from '@/components/ui/session-list';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ApiKeysModal } from '@/components/dialogs/ApiKeysModal';
import { BetaWelcomeModal } from '@/components/dialogs/BetaWelcomeModal';
import { BetaFeedbackModal } from '@/components/dialogs/BetaFeedbackModal';
import { RulebookModal } from '@/components/dialogs/RulebookModal';
import { CharacterDialog } from '@/components/dialogs/CharacterDialog';
import { DevelopmentPhaseModal } from '@/components/dialogs/DevelopmentPhaseModal';
import { SanityTherapyModal } from '@/components/dialogs/SanityTherapyModal';
import { MedicalCareModal } from '@/components/dialogs/MedicalCareModal';
import { RollTestModal } from '@/components/dialogs/RollTestModal';
import { QuickSetupModal } from '@/components/ui/quick-setup-modal';
import { AdventureSelector } from '@/components/ui/adventure-selector';
import { AdventureDetailsModal } from '@/components/ui/adventure-details-modal';
import { CharacterWizardV2 } from '@/components/ui/character-wizard';
import { HotSeatSetup } from '@/components/ui/hot-seat-setup';
import { SessionZeroModal } from '@/components/ui/session-zero-modal';
import { CharacterSheet } from '@/components/ui/character-sheet';
import { EquipmentModal } from '@/components/ui/equipment-modal';
import { EquipmentDetailDialog } from '@/components/ui/equipment-detail-dialog';
import { SessionJournal } from '@/components/ui/session-journal';
import { FullGameSaveModal } from '@/components/ui/full-game-save-modal';
import { FullResetDialog } from '@/components/ui/full-reset-dialog';
import { NewAdventureModal } from '@/components/ui/new-adventure-modal';
import { SettingsModal } from '@/components/ui/settings-modal';
import { LanguageSelectionModal } from '@/components/onboarding/language-selection-modal';
import { CompendiumModal } from '@/components/compendium-modal/CompendiumModal';
import { OpposedMeleeCard } from '@/components/chat/chat-window/components/opposed-melee-card';
import { SpellCard } from '@/components/chat/chat-window/components/spell-card';
import { TomeCard } from '@/components/chat/chat-window/components/tome-card';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { Character, OpposedMeleeEventData } from '@/lib/types';
import type { CustomAdventure } from '@/lib/adventures-data';

export function DesktopWindowFixture({ surface }: { surface: string }) {
  const locale = useLocale() === 'en' ? 'en' : 'pl';
  const [actions, setActions] = useState(0);
  const inert = () => setActions((value) => value + 1);
  const character: Character = {
    ...PREDEFINED_CHARACTERS[0],
    id: 'desktop-visual-investigator',
    name: 'Anna Kowalska',
    significantPerson:
      locale === 'en'
        ? 'Helena, the editor who supported Anna during a difficult investigation.'
        : 'Helena, redaktorka, która wspierała Annę podczas trudnego śledztwa.',
    meaningfulLocation:
      locale === 'en'
        ? 'The quiet newspaper archive in London.'
        : 'Ciche archiwum gazety w Londynie.',
    treasuredPossession:
      locale === 'en'
        ? 'An engraved brass pocket watch.'
        : 'Grawerowany mosiężny zegarek kieszonkowy.',
    ideology:
      locale === 'en'
        ? 'Every mystery has an explanation.'
        : 'Każda tajemnica ma wyjaśnienie.',
    background:
      locale === 'en'
        ? 'Anna investigates unexplained disappearances.'
        : 'Anna bada niewyjaśnione zaginięcia.',
    backstory:
      locale === 'en'
        ? 'A journalist follows a trail of missing letters through the city archives.'
        : 'Dziennikarka podąża tropem zaginionych listów w miejskich archiwach.',
    birthplace: 'London',
    description: '',
    appearance: '',
    notes: '',
    traits: [],
    occupation:
      locale === 'en' ? 'Investigative journalist' : 'Dziennikarka śledcza',
    portraitUrl: '/portraits/predefined/arthur-pendleton.webp',
    san: 55,
    maxSan: 99,
    hp: 9,
    maxHp: 12,
    mp: 14,
    maxMp: 14,
    skills: {
      Biblioteka: { value: 55, markedForImprovement: true },
      Spostrzegawczość: { value: 65, markedForImprovement: true },
      Unik: 45,
      'Walka Wręcz': 50,
      Łacina: 60,
    },
    equipment: [
      {
        id: 'watch',
        name:
          locale === 'en'
            ? 'Engraved pocket watch'
            : 'Grawerowany zegarek kieszonkowy',
        description:
          locale === 'en'
            ? 'A brass watch with an engraved dedication.'
            : 'Mosiężny zegarek z wygrawerowaną dedykacją.',
        category: 'personal',
        quantity: 1,
        condition: 'used',
      },
    ],
    magic: {
      schemaVersion: 1,
      belief: 'believer',
      deferredSanLoss: 0,
      knownSpells: {
        'wither-limb': {
          spellId: 'wither-limb',
          learnedAt: '2026-10-23',
          source: 'tome',
          isFirstCastDone: false,
          deeperUnlocked: false,
          definitionVersion: 1,
        },
      },
      tomeStudies: {
        'necronomicon-latin': {
          tomeId: 'necronomicon-latin',
          initialReadingDone: true,
          fullStudyDone: true,
          studyCount: 1,
          completedWeeks: 66,
          cmiAwarded: 5,
          cmfAwarded: 11,
          sanLossPaid: 2,
          definitionVersion: 1,
        },
      },
    },
  };
  const adventure: CustomAdventure = {
    id: 'desktop-visual-adventure',
    locale,
    title:
      locale === 'en'
        ? 'Mystery of the Black Sarcophagus'
        : 'Tajemnica Czarnego Sarkofagu',
    era: 'classic',
    eraLabel: locale === 'en' ? 'Classic 1920s' : 'Klasyczne lata 20.',
    yearRange: '1924',
    location: 'London',
    country: 'UK',
    tone: 'pulp',
    themes: [],
    suggestedOccupations: [],
    hook:
      locale === 'en'
        ? 'The expedition has vanished inside a sealed tomb.'
        : 'Ekspedycja zniknęła wewnątrz zapieczętowanego grobowca.',
    description:
      locale === 'en'
        ? 'Follow the trail of a missing expedition and discover the origin of the sarcophagus.'
        : 'Rusz tropem zaginionej ekspedycji i odkryj pochodzenie sarkofagu.',
    estimatedSessions: '2-3',
    playerCount: '1-4',
    difficulty: 'normal',
    documentType: 'scenario',
    isCustom: true,
    suggestedArchetypes: [],
    geminiFileUri: 'visual-fixture://scenario',
    pdfUrl: '/visual-fixture.pdf',
    fileName: 'visual-fixture.pdf',
    uploadedAt: '2026-10-23T12:00:00Z',
    isAnalyzed: true,
  };
  const melee: OpposedMeleeEventData = {
    id: 'visual-melee',
    attackerName: locale === 'en' ? 'Cultist' : 'Kultysta',
    characterName: character.name,
    characterId: character.id,
    attackerSkill: 55,
    attackerBuild: 0,
    damageFormula: '1d3',
    weaponName: locale === 'en' ? 'Fist' : 'Pięść',
    description:
      locale === 'en'
        ? 'A fist arcs toward the investigator.'
        : 'Pięść leci w stronę badaczki.',
  };
  let content;
  switch (surface) {
    case 'scope-check':
      content = (
        <div data-testid="unscoped-controls">
          <Button>Shared button</Button>
          <Input placeholder="Shared input" />
        </div>
      );
      break;
    case 'quick-setup':
      content = (
        <QuickSetupModal open onOpenChange={inert} onQuickStart={inert} />
      );
      break;
    case 'adventure-selector':
      content = (
        <AdventureSelector
          open
          onClose={inert}
          onSelect={inert}
          customAdventures={[adventure]}
        />
      );
      break;
    case 'adventure-details':
      content = (
        <AdventureDetailsModal
          open
          adventure={adventure}
          onClose={inert}
          onChoose={inert}
        />
      );
      break;
    case 'character-wizard':
      content = (
        <CharacterWizardV2 onClose={inert} onCharacterCreated={inert} />
      );
      break;
    case 'hot-seat':
      content = (
        <HotSeatSetup
          open
          onClose={inert}
          onChooseSolo={inert}
          onStartHotSeat={inert}
        />
      );
      break;
    case 'session-zero':
      content = <SessionZeroModal open onClose={inert} onComplete={inert} />;
      break;
    case 'api-keys':
      content = <ApiKeysModal open onOpenChange={inert} />;
      break;
    case 'characters':
      content = (
        <CharacterDialog
          open
          onOpenChange={inert}
          activeCharacter={character}
          characters={[character]}
        />
      );
      break;
    case 'character-sheet':
      content = (
        <CharacterSheet open onOpenChange={inert} character={character} />
      );
      break;
    case 'equipment':
      content = (
        <EquipmentModal
          open
          onOpenChange={inert}
          character={character}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'equipment-detail':
      content = (
        <EquipmentDetailDialog
          item={character.equipment?.[0] ?? null}
          onClose={inert}
        />
      );
      break;
    case 'journal':
      content = <SessionJournal character={character} onClose={inert} />;
      break;
    case 'development':
      content = (
        <DevelopmentPhaseModal
          isOpen
          onClose={inert}
          character={character}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'sanity-therapy':
      content = (
        <SanityTherapyModal
          isOpen
          onClose={inert}
          character={character}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'medical-care':
      content = (
        <MedicalCareModal
          isOpen
          onClose={inert}
          character={character}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'save-game':
      content = (
        <FullGameSaveModal
          isOpen
          mode="save"
          onClose={inert}
          currentData={{
            messages: [],
            aiSettings: defaultAISettings,
            characters: [character],
            campaigns: [],
            npcs: [],
            locations: [],
          }}
        />
      );
      break;
    case 'load-game':
      content = (
        <FullGameSaveModal isOpen mode="load" onClose={inert} onLoad={inert} />
      );
      break;
    case 'help':
      content = <CompendiumModal isOpen onClose={inert} />;
      break;
    case 'settings':
      content = <SettingsModal open onClose={inert} />;
      break;
    case 'new-adventure':
      content = (
        <NewAdventureModal
          open
          onClose={inert}
          onSaveFirst={inert}
          onSkipSave={inert}
        />
      );
      break;
    case 'image-lightbox':
      content = (
        <ImageLightbox
          src="/portraits/predefined/arthur-pendleton.webp"
          images={[
            '/portraits/predefined/arthur-pendleton.webp',
            '/portraits/predefined/beatrice-holloway.webp',
          ]}
          onClose={inert}
          alt={character.name}
        />
      );
      break;
    case 'desktop-update':
      content = (
        <DesktopUpdateModal
          open
          onOpenChange={inert}
          onDismissLater={inert}
          update={{
            available: true,
            configured: true,
            currentVersion: '0.9.6',
            commitsBehind: 3,
            canSelfUpdate: true,
            manifest: {
              version: '0.9.6',
              releaseNotes: '',
              shortCommit: '1234567',
            },
          }}
        />
      );
      break;
    case 'session-list':
      content = (
        <SessionList
          onClose={inert}
          onLoadSession={inert}
          onDeleteSession={inert}
        />
      );
      break;
    case 'full-reset-final':
      content = (
        <FullResetDialog
          show
          step={2}
          onClose={inert}
          onConfirmStep1={inert}
          onConfirm={inert}
        />
      );
      break;
    case 'full-reset':
      content = (
        <FullResetDialog
          show
          step={1}
          onClose={inert}
          onConfirmStep1={inert}
          onConfirm={inert}
        />
      );
      break;
    case 'rulebook':
      content = <RulebookModal open onOpenChange={inert} />;
      break;
    case 'roll-test':
      content = (
        <RollTestModal
          open
          onOpenChange={inert}
          activeCharacter={character}
          test={{
            testId: 'visual-test',
            skill: 'Spostrzegawczość',
            value: 65,
            difficulty: 'zwykly',
            bonusDice: 0,
            justification:
              locale === 'en'
                ? 'Search the dimly lit room.'
                : 'Przeszukaj słabo oświetlony pokój.',
          }}
        />
      );
      break;
    case 'beta-welcome':
      content = (
        <BetaWelcomeModal open onOpenChange={inert} onOpenFeedback={inert} />
      );
      break;
    case 'beta-feedback':
      content = <BetaFeedbackModal open onOpenChange={inert} />;
      break;
    case 'language-selection':
      content = <LanguageSelectionModal open onSelected={inert} />;
      break;
    case 'combat-card':
      content = (
        <OpposedMeleeCard
          opposedEvent={melee}
          activeCharacter={character}
          onSendChat={inert}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'spell-card':
      content = (
        <SpellCard
          activeCharacter={character}
          spellEvent={{
            id: 'visual-spell',
            spellId: 'wither-limb',
            characterId: character.id,
            targetName: locale === 'en' ? 'Cultist' : 'Kultysta',
            targetPow: 55,
          }}
          onSendChat={inert}
          onCharacterUpdate={inert}
        />
      );
      break;
    case 'tome-card':
      content = (
        <TomeCard
          activeCharacter={{
            ...character,
            magic: {
              schemaVersion: 1,
              belief: 'believer',
              deferredSanLoss: 0,
              knownSpells: {},
              tomeStudies: {},
            },
          }}
          tomeEvent={{
            id: 'visual-tome',
            tomeId: 'necronomicon-latin',
            characterId: character.id,
          }}
          onSendChat={inert}
          onCharacterUpdate={inert}
        />
      );
      break;
    default:
      content = <p>Unknown fixture: {surface}</p>;
  }
  return (
    <main
      data-testid="desktop-window-fixture"
      data-actions={actions}
      className="min-h-screen bg-background text-foreground"
    >
      {surface.endsWith('-card') ? (
        <section
          data-testid="visual-card"
          className="mx-auto w-[800px] max-w-full p-6"
        >
          {content}
        </section>
      ) : (
        content
      )}
    </main>
  );
}
