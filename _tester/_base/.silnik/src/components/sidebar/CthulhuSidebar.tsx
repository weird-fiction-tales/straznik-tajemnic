'use client';

import { SafeImage } from '@/components/ui/safe-image';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedOccupationName } from '@/lib/data/character';
import {
  Settings,
  User,
  BookOpen,
  Volume2,
  VolumeX,
  Users,
  Save,
  FolderOpen,
  Package,
  RotateCcw,
  Image as ImageIcon,
  LogOut,
  Flame,
  Hourglass,
  Lock,
  Sparkles,
  Bug,
  Eye,
  EyeOff,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';
import {
  loadStoredHueConfig,
  saveStoredHueConfig,
  getGlobalLightDirector,
} from '@/lib/hardware/hue/light-director-service';
import type { SessionEndStatus } from '@/hooks/useChat';
import NextImage from 'next/image';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { SettingsModal } from '../ui/settings-modal';
import { CharacterDialog } from '../dialogs/CharacterDialog';
import { CharacterSheet } from '../ui/character-sheet';
import { deriveStats } from '../ui/character-sheet/utils/derive-stats';
import { SessionJournal } from '../ui/session-journal';

import {
  SessionZeroModal,
  SessionZeroSettings,
} from '../ui/session-zero-modal';
import { HandoutGenerator } from '../ui/handout-generator';
import { AdventureSelector } from '../ui/adventure-selector';
import { EquipmentModal } from '../ui/equipment-modal';
import { NewAdventureModal } from '../ui/new-adventure-modal';
import { YouTubePlayer } from '../ui/youtube-player';

import {
  Character,
  ActiveGameState,
  HotSeatConfig,
  JournalEntry,
  AdventureContext as BaseAdventureContext,
} from '@/lib/types';
import { AdventureContext, CustomAdventure } from '@/lib/adventures-data';
import { useResolvedPortrait } from '@/hooks/useResolvedPortrait';
import { useLocalPlaytestTransport } from '@/hooks/useLocalPlaytestTransport';
import { getEraImageFilter } from '@/lib/era-visual-style';
import { resolveGameEraContext } from '@/lib/era';
import { mergeAdventureJournalEntries } from '@/lib/journal/shared-adventure-journal';
import type { AISettings } from '@/lib/ai-settings';

interface CthulhuSidebarProps {
  activeCharacter?: Character;
  characters?: Character[]; // Lista wszystkich postaci
  onCharacterSwitch?: (character: Character) => void;
  onCharacterCreate?: () => void;
  onCharacterManage?: () => void;
  onUpdateCharacter?: (character: Character) => void; // Dla dziennika
  onUpdateSharedJournal?: (journal: JournalEntry[]) => void;
  handleSendMessage?: (message: string) => void;
  activeGameState?: ActiveGameState | null;
  voiceFeatureAvailable?: boolean;
  voiceEnabled?: boolean;
  setVoiceEnabled?: (enabled: boolean) => void;
  isTTSEnabled?: boolean;
  setIsTTSEnabled?: (enabled: boolean) => void;
  isTTSPlaying?: boolean;
  onToggleNarrator?: (enabled: boolean) => void; // IND-258: trwały mute lektora (voiceSettings.enabled)
  queueStatus?: {
    queueLength: number;
    totalCharacters: number;
    processing: boolean;
  };
  onStartNewGame?: () => void;
  onNewAdventure?: () => void; // Powrót do kreatora bez zapisu (Nowa przygoda)
  onSaveAndNewAdventure?: () => void; // Zapisz sesję, potem powrót do kreatora
  onOpenGameSession?: () => void;
  onOpenGMTools?: (tool: string) => void; // Otwiera narzędzie GM
  onOpenDevelopmentPhase?: () => void; // IND-230: otwiera Fazę Rozwoju (rzuty na poprawę)
  markedSkillsCount?: number; // IND-230: liczba umiejętności oznaczonych do rozwoju
  onSaveGame?: () => void; // Zapisz grę (nowy system)
  onOpenHotSeat?: () => void; // Otwórz tryb Hot Seat
  onSessionZeroComplete?: () => void; // Callback po zakończeniu Sesji Zero
  registerOpenSessionZero?: (openFn: () => void) => void; // Rejestracja funkcji otwierającej Sesję Zero
  registerOpenAdventureSelector?: (openFn: () => void) => void; // Rejestracja funkcji otwierającej AdventureSelector
  hideSidebarPanel?: boolean; // Welcome: ukryj wizualny panel (komponent zostaje zamontowany, by hostować modale + rejestrację)
  onOpenHelp?: () => void; // Otwiera kompendium wiedzy, bestiariusz i encyklopedię epoki
  onOpenBetaStatus?: () => void; // Otwiera raport gotowości wersji Beta
  onOpenBetaFeedback?: () => void; // Otwiera formularz zgłoszenia błędu / uwagi
  onAdventureSelect?: (adventure: AdventureContext) => void; // Callback: przygoda była wybrana
  // Custom Adventures
  customAdventures?: CustomAdventure[];
  onUploadAdventure?: (file: File) => Promise<CustomAdventure | null>;
  onDeleteAdventure?: (id: string) => Promise<void>;
  onToggleAttachLorebook?: (adventureId: string, lorebookId: string) => Promise<void>;
  isUploadingAdventure?: boolean;
  uploadProgressAdventure?: number;
  loadingStatusAdventure?: string;
  uploadErrorAdventure?: string | null;
  onClearUploadErrorAdventure?: () => void;

  // Hot Seat config - potrzebny dla wspólnego dziennika (sharedJournal)
  hotSeatConfig?: HotSeatConfig;
  onSwitchPlayer?: (index: number) => void;
  onDisableHotSeat?: () => void;
  aiSettings?: AISettings;
  onUpdateAISettings?: (settings: AISettings) => void;
  isSessionEnded?: boolean;
  sessionEndStatus?: SessionEndStatus;
  adventureContext?: BaseAdventureContext | AdventureContext | null; // Bieżący kontekst przygody i epoki
}

export const CthulhuSidebar: FC<CthulhuSidebarProps> = ({
  activeCharacter,
  characters,
  onCharacterSwitch,
  onCharacterCreate,
  onCharacterManage,
  onUpdateCharacter,
  onUpdateSharedJournal,
  handleSendMessage,
  activeGameState,
  voiceFeatureAvailable,
  voiceEnabled,
  setVoiceEnabled,
  isTTSEnabled,
  setIsTTSEnabled,
  isTTSPlaying = false,
  onToggleNarrator,
  queueStatus,
  onStartNewGame,
  onNewAdventure,
  onSaveAndNewAdventure,
  onOpenGameSession,
  onOpenGMTools,
  onOpenDevelopmentPhase,
  markedSkillsCount = 0,
  onSaveGame,
  onOpenHotSeat,
  onSessionZeroComplete,
  registerOpenSessionZero,
  registerOpenAdventureSelector,
  hideSidebarPanel,
  onOpenHelp,
  onOpenBetaStatus,
  onOpenBetaFeedback,
  onAdventureSelect,
  customAdventures,
  onUploadAdventure,
  onDeleteAdventure,
  onToggleAttachLorebook,
  isUploadingAdventure,
  uploadProgressAdventure = 0,
  loadingStatusAdventure = '',
  uploadErrorAdventure = null,
  onClearUploadErrorAdventure,

  hotSeatConfig,
  aiSettings,
  onUpdateAISettings,
  isSessionEnded = false,
  sessionEndStatus = 'idle',
  adventureContext: adventureContextProp,
}) => {
  const t = useTranslations('Sidebar');
  const locale = useLocale();
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [showSessionZero, setShowSessionZero] = useState(false);
  const [showHandoutGenerator, setShowHandoutGenerator] = useState(false);
  const [showAdventureSelector, setShowAdventureSelector] = useState(false);
  const [showNewAdventureConfirm, setShowNewAdventureConfirm] = useState(false);
  const [inspectedCharacterId, setInspectedCharacterId] = useState<string>();
  const [adventureContext, setAdventureContext] =
    useState<AdventureContext | null>(null);
  const effectiveAdventureContext = adventureContextProp ?? adventureContext;
  const localTransport = useLocalPlaytestTransport();
  const isPrabutySolo = effectiveAdventureContext?.id === 'cien-nad-prabutami' && !hotSeatConfig?.enabled;
  const pilotProbeKey = isPrabutySolo && localTransport.serverConfigured && !localTransport.loading
    ? `${effectiveAdventureContext?.id}:${activeCharacter?.id ?? ''}` : null;
  const [pilotMode, setPilotMode] = useState<{ key: string; allowed: boolean } | null>(null);
  const isLocalPrabuty = pilotProbeKey !== null && pilotMode?.key === pilotProbeKey && pilotMode.allowed;
  const awaitingPilotCapability = isPrabutySolo && (localTransport.loading ||
    (pilotProbeKey !== null && pilotMode?.key !== pilotProbeKey));
  useEffect(() => {
    setPilotMode(null);
    if (!pilotProbeKey) return;
    let current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    void fetch('/api/adventure-dossier/playtest', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = response.status === 200 ? await response.json() : null;
        const allowed = data?.mode === 'local_playtest' && data?.adventureId === 'cien-nad-prabutami' &&
          typeof data?.editionFingerprint === 'string' && /^sha256:[a-f0-9]{64}$/.test(data.editionFingerprint);
        if (current) setPilotMode({ key: pilotProbeKey, allowed });
      })
      .catch(() => { if (current) setPilotMode({ key: pilotProbeKey, allowed: false }); })
      .finally(() => clearTimeout(timeout));
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [pilotProbeKey]);
  const [pilotEndStep, setPilotEndStep] = useState<'closed' | 'options' | 'confirm'>('closed');
  useEffect(() => { setPilotEndStep('closed'); }, [isLocalPrabuty, effectiveAdventureContext?.id, activeCharacter?.id, isSessionEnded, sessionEndStatus, hideSidebarPanel]);

  const resolvedEraContext = useMemo(() => {
    if (effectiveAdventureContext) {
      return resolveGameEraContext({ adventure: effectiveAdventureContext });
    }
    return null;
  }, [effectiveAdventureContext]);

  // System notyfikacji - nowe pozycje w dzienniku i ekwipunku
  const [unseenJournalCount, setUnseenJournalCount] = useState(0);
  const [seenEquipmentCount, setSeenEquipmentCount] = useState<number>(
    () => activeCharacter?.equipment?.length ?? 0
  );

  // Tryb reżyserski (Kulisy MG / BOP) w Pomocach Badacza
  const [isDirectorMode, setIsDirectorMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('straznik_director_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleDirectorMode = () => {
    const next = !isDirectorMode;
    setIsDirectorMode(next);
    try {
      localStorage.setItem('straznik_director_mode', String(next));
      window.dispatchEvent(
        new CustomEvent('director-mode-changed', {
          detail: { isDirectorMode: next },
        })
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleDirectorModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDirectorMode?: boolean }>;
      if (typeof customEvent.detail?.isDirectorMode === 'boolean') {
        setIsDirectorMode(customEvent.detail.isDirectorMode);
      } else {
        try {
          setIsDirectorMode(localStorage.getItem('straznik_director_mode') === 'true');
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('director-mode-changed', handleDirectorModeChange);
    return () => window.removeEventListener('director-mode-changed', handleDirectorModeChange);
  }, []);

  const [hueConfig, setHueConfig] = useState(loadStoredHueConfig);

  useEffect(() => {
    const handleHueChange = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        setHueConfig(custom.detail);
      } else {
        setHueConfig(loadStoredHueConfig());
      }
    };
    window.addEventListener('straznik_hue_config_changed', handleHueChange);
    window.addEventListener('storage', handleHueChange);
    return () => {
      window.removeEventListener('straznik_hue_config_changed', handleHueChange);
      window.removeEventListener('storage', handleHueChange);
    };
  }, []);

  const handleToggleHue = () => {
    const updated = { ...hueConfig, enabled: !hueConfig.enabled };
    setHueConfig(updated);
    saveStoredHueConfig(updated);
  };

  const handleTriggerEmergencyLight = async () => {
    const director = getGlobalLightDirector();
    await director.triggerEmergencyLight();
  };

  // Portret do panelu postaci - dociągany z IndexedDB gdy portraitUrl pusty
  // (wyścig hydratacji po starcie/wczytaniu gry, IND-262). Wspólna logika z
  // awatarami wiadomości w czacie - patrz useResolvedPortrait (#2b).
  const portraitSrc = useResolvedPortrait(activeCharacter);
  const inspectedCharacter =
    characters?.find((character) => character.id === inspectedCharacterId) ??
    activeCharacter;
  const sharedJournalEnabled =
    Boolean(hotSeatConfig?.enabled) && (characters?.length ?? 0) >= 2;
  const sharedJournal = useMemo(
    () =>
      sharedJournalEnabled
        ? mergeAdventureJournalEntries(
            characters ?? [],
            hotSeatConfig?.adventureJournalId
          )
        : undefined,
    [characters, hotSeatConfig?.adventureJournalId, sharedJournalEnabled]
  );
  const participantNames = useMemo(
    () =>
      sharedJournalEnabled
        ? (characters ?? []).map(
            (character) => character.playerName || character.name
          )
        : [],
    [characters, sharedJournalEnabled]
  );
  const journalEntryCount = sharedJournalEnabled
    ? (sharedJournal?.length ?? 0)
    : (activeCharacter?.journal?.length ?? 0);
  const journalStorageKey = sharedJournalEnabled
    ? `unseen_journal_${(characters ?? [])
        .map((character) => character.id)
        .sort()
        .join('_')}`
    : activeCharacter
      ? `unseen_${activeCharacter.id}`
      : null;

  // Zmiana tury synchronizuje domyślny widok tylko przy zamkniętych modalach.
  // Otwarta karta/ekwipunek może niezależnie oglądać drugiego badacza.
  useEffect(() => {
    if (!openDialog) setInspectedCharacterId(activeCharacter?.id);
  }, [activeCharacter?.id, openDialog]);

  // Śledzenie nowych pozycji
  useEffect(() => {
    if (!journalStorageKey) return;

    const stored = localStorage.getItem(journalStorageKey);
    const unseenData = stored ? JSON.parse(stored) : { journalSeen: 0 };

    // Oblicz ile nowych pozycji od ostatniego widzenia
    const newJournal = Math.max(0, journalEntryCount - unseenData.journalSeen);

    setUnseenJournalCount(newJournal);
  }, [journalEntryCount, journalStorageKey]);

  // Resetuj licznik po otwarciu modala
  useEffect(() => {
    if (!journalStorageKey) return;

    if (openDialog === 'journal') {
      const stored = localStorage.getItem(journalStorageKey);
      const unseenData = stored
        ? JSON.parse(stored)
        : { journalSeen: 0, inventorySeen: 0 };
      localStorage.setItem(
        journalStorageKey,
        JSON.stringify({ ...unseenData, journalSeen: journalEntryCount })
      );
      setUnseenJournalCount(0);
    }
  }, [journalEntryCount, journalStorageKey, openDialog]);

  // Rejestracja funkcji otwierającej Sesję Zero dla zewnętrznych komponentów
  useEffect(() => {
    if (registerOpenSessionZero) {
      registerOpenSessionZero(() => setShowSessionZero(true));
    }
  }, [registerOpenSessionZero]);

  // Rejestracja funkcji otwierającej AdventureSelector dla WelcomeScreen
  useEffect(() => {
    if (registerOpenAdventureSelector) {
      registerOpenAdventureSelector(() => setShowAdventureSelector(true));
    }
  }, [registerOpenAdventureSelector]);

  // Narzędzia gracza - przeniesione do Pomoce Badacza
  const playerTools = [
    {
      id: 'characterSheet',
      icon: User,
      label: t('characterSheet'),
      description: t('characterSheetDescription'),
    },
    {
      id: 'equipment',
      icon: Package,
      label: t('equipment'),
      description: t('equipmentDescription'),
    },
    {
      id: 'journal',
      icon: BookOpen,
      label: t('journal'),
      description: t('journalDescription'),
    },
  ];

  return (
    <>
      <div
        className={`w-80 max-[1100px]:w-72 max-[900px]:w-64 shrink-0 bg-sidebar border-l border-brass/25 h-full flex flex-col relative z-10 ${hideSidebarPanel ? 'hidden' : ''}`}
      >
        {/* Header - Compact Token Counter - wyrównane z ChatWindow */}
        <div className="relative h-16 flex items-center px-4 border-b border-brass/30">
          {/* déco: złota linia akcentu */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent"
          />
          <div className="flex items-center justify-center gap-3 w-full">
            {/* Ikona aplikacji - Oko Horusa (ta sama grafika co launcher/icon.png) */}
            <NextImage
              src="/app-icon.png"
              alt={t('appName')}
              width={32}
              height={32}
              className="w-8 h-8 rounded-md border border-brass/40 shadow-inner"
              priority
            />
            <div className="text-left">
              <div className="text-[14px] text-brass/80 font-special-elite tracking-[0.22em] uppercase">
                {t('rulebookEdition')}
              </div>
              <div className="text-sm font-medium text-emerald-400 font-special-elite tracking-wide">
                {t('appName')}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Character Management */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-special-elite text-foreground">
                  {t('characters')}
                </CardTitle>
                {activeCharacter && characters && characters.length > 1 && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {characters.findIndex((c) => c.id === activeCharacter.id) + 1}/{characters.length}
                  </span>
                )}
              </div>
              {/* Character Selector Dropdown - widoczny tylko gdy w sesji bierze udział więcej niż 1 postać */}
              {characters && characters.length > 1 && (
                <div className="relative w-full">
                  <select
                    value={activeCharacter?.id || ''}
                    onChange={(e) => {
                      const selected = characters.find(
                        (c) => c.id === e.target.value
                      );
                      if (selected && onCharacterSwitch) {
                        setInspectedCharacterId(selected.id);
                        onCharacterSwitch(selected);
                      }
                    }}
                    className="w-full appearance-none bg-card border-2 border-primary/60 rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground font-medium cursor-pointer hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="" disabled>
                      {t('select')}
                    </option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id}>
                        🎭 {char.name} ({getLocalizedOccupationName(char.occupation, locale) || t('investigator')})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                    ▼
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Character Portrait and Stats - klikalny kafelek otwierający kartę postaci */}
              {activeCharacter &&
                (() => {
                  const derived = deriveStats(activeCharacter);
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setInspectedCharacterId(activeCharacter.id);
                        setOpenDialog('characterSheet');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpenDialog('characterSheet');
                        }
                      }}
                      aria-label={t('openCharacterSheet', { name: activeCharacter.name })}
                      title={t('openCharacterSheet', { name: activeCharacter.name })}
                      className="relative deco-corners p-4 bg-card rounded-lg border border-brass/30 cursor-pointer transition-colors hover:bg-muted/40 hover:border-brass/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <div className="flex items-center gap-3">
                        {portraitSrc ? (
                          <SafeImage
                            src={portraitSrc}
                            alt={activeCharacter.name}
                            className="w-16 h-16 rounded-lg object-cover border border-brass/40"
                            style={{
                              filter: getEraImageFilter(
                                effectiveAdventureContext?.yearRange?.split('-')[0] ||
                                  effectiveAdventureContext?.era ||
                                  '1920s'
                              ),
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-input flex items-center justify-center text-2xl border border-brass/40">
                            👤
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-serif text-lg font-semibold text-foreground tracking-wide truncate">
                            {activeCharacter.name}
                          </div>
                          <div className="text-sm text-brass/90 font-special-elite font-medium tracking-wide truncate">
                            {getLocalizedOccupationName(activeCharacter.occupation, locale)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        <Badge
                          variant="outline"
                          className="w-full inline-flex items-center justify-center text-center bg-destructive/15 text-destructive border-destructive/40 py-1 text-xs sm:text-sm font-semibold"
                        >
                          {t('hpAbbr')}: {activeCharacter.hp}/{derived.maxHp}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="w-full inline-flex items-center justify-center text-center bg-brass/15 text-brass border-brass/40 py-1 text-xs sm:text-sm font-semibold"
                        >
                          {t('sanAbbr')}: {activeCharacter.san}/{derived.maxSan}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="w-full inline-flex items-center justify-center text-center bg-primary/15 text-primary border-primary/40 py-1 text-xs sm:text-sm font-semibold"
                        >
                          {t('mpAbbr')}: {activeCharacter.mp}/{derived.maxMp}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="w-full inline-flex items-center justify-center text-center bg-gold/10 text-gold border-gold/40 py-1 text-xs sm:text-sm font-semibold"
                        >
                          {t('luckAbbr')}: {activeCharacter.luck}
                        </Badge>
                      </div>
                    </div>
                  );
                })()}

              {/* Action Buttons - zielone ikony */}
              <div className="space-y-1">
                {playerTools.map((item) => {
                  const IconComponent = item.icon;
                  const currentEquipmentLength = activeCharacter?.equipment?.length ?? 0;
                  const isEquipment = item.id === 'equipment';
                  const isJournal = item.id === 'journal';
                  
                  return (
                    <Button
                      key={item.id}
                      data-testid={
                        item.id === 'characterSheet'
                          ? 'btn-open-character-sheet'
                          : item.id === 'equipment'
                            ? 'btn-open-equipment'
                            : item.id === 'journal'
                              ? 'btn-open-journal'
                          : undefined
                      }
                      variant="ghost"
                      className="w-full flex items-center justify-between border border-brass/15 font-special-elite tracking-wide text-foreground hover:bg-brass/5 hover:border-brass/40 hover:text-foreground px-3 py-2 text-left"
                      onClick={() => {
                        if (isEquipment) {
                          setSeenEquipmentCount(currentEquipmentLength);
                        }
                        setInspectedCharacterId(activeCharacter?.id);
                        setOpenDialog(item.id);
                      }}
                    >
                      <span className="flex items-center gap-3 min-w-0 truncate">
                        <IconComponent className="w-4 h-4 text-brass shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {isEquipment && currentEquipmentLength > seenEquipmentCount && (
                        <span className="ml-2 text-[10px] font-bold uppercase rounded bg-primary text-primary-foreground px-1.5 py-0.5 animate-pulse shadow shrink-0">
                          {t('newBadge')}
                        </span>
                      )}
                      {isJournal && unseenJournalCount > 0 && (
                        <span className="ml-2 text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-destructive text-destructive-foreground shrink-0 shadow">
                          {unseenJournalCount > 99 ? '99+' : unseenJournalCount}
                        </span>
                      )}
                    </Button>
                  );
                })}

                {/* IND-230 / Issue #28: Faza Rozwoju CoC - dostępna wyłącznie po zakończeniu sesji */}
                {activeCharacter && onOpenDevelopmentPhase && (
                  isSessionEnded || sessionEndStatus === 'ended' ? (
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-between border-brass/60 font-special-elite tracking-wide text-brass bg-brass/10 hover:bg-brass/20 hover:border-brass hover:text-foreground animate-pulse px-3 py-2 text-left"
                      onClick={onOpenDevelopmentPhase}
                      title={t('developmentPhaseReadyTitle')}
                    >
                      <span className="flex items-center gap-3 min-w-0 truncate">
                        <Sparkles className="w-4 h-4 text-brass shrink-0" />
                        <span className="truncate">{t('developmentPhaseReady')}</span>
                      </span>
                      {markedSkillsCount > 0 && (
                        <span className="ml-2 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 shadow">
                          {markedSkillsCount > 99 ? '99+' : markedSkillsCount}
                        </span>
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="ghost"
                      className="w-full flex items-center justify-between border border-border/60 font-special-elite tracking-wide text-muted-foreground/60 bg-muted/40 opacity-60 cursor-not-allowed px-3 py-2 text-left"
                      title={t('developmentPhaseLockedTitle')}
                    >
                      <span className="flex items-center gap-3 min-w-0 truncate">
                        <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                        <span className="truncate">{t('developmentPhaseLocked')}</span>
                      </span>
                      {markedSkillsCount > 0 && (
                        <span
                          className="ml-2 bg-muted text-muted-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 border border-border/40"
                          title={t('markedSkillsBadgeTooltip', { count: markedSkillsCount })}
                        >
                          {markedSkillsCount > 99 ? '99+' : markedSkillsCount}
                        </span>
                      )}
                    </Button>
                  )
                )}
              </div>

              {/* Create New Character / Koniec Sesji */}
              {activeCharacter ? (
                isSessionEnded || sessionEndStatus === 'ended' ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full h-auto min-h-10 py-2.5 px-3 border-border text-muted-foreground bg-muted/30 opacity-70 cursor-not-allowed font-special-elite text-sm whitespace-normal flex items-center justify-center gap-2"
                    title={t('sessionClosedTitle')}
                  >
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="leading-tight">{t('sessionClosed')}</span>
                  </Button>
                ) : isLocalPrabuty && sessionEndStatus === 'idle' ? (
                  <div className="space-y-2" role="group" aria-label={t('pilotEndOrSave')}>
                    {pilotEndStep === 'closed' ? (
                      <Button variant="outline" className="w-full border-brass/40 text-brass font-special-elite" onClick={() => setPilotEndStep('options')}>{t('pilotEndOrSave')}</Button>
                    ) : pilotEndStep === 'options' ? (
                      <>
                        <p className="text-xs text-muted-foreground">{t('pilotSaveBeforeBreak')}</p>
                        <Button data-testid="pilot-save-game" variant="outline" className="w-full" disabled={!onSaveGame} onClick={() => { setPilotEndStep('closed'); onSaveGame?.(); }}>{t('saveGame')}</Button>
                        <Button variant="outline" className="w-full h-auto whitespace-normal" disabled={!handleSendMessage} onClick={() => setPilotEndStep('confirm')}>{t('pilotWithdraw')}</Button>
                        <Button variant="ghost" className="w-full" onClick={() => setPilotEndStep('closed')}>{t('pilotReturnToGame')}</Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-foreground">{t('pilotWithdrawDescription')}</p>
                        <Button data-testid="pilot-withdraw-confirm" variant="outline" className="w-full h-auto whitespace-normal border-brass/60 text-brass" disabled={!handleSendMessage} onClick={() => { setPilotEndStep('closed'); handleSendMessage?.('Wycofuję się ze śledztwa.'); }}>{t('pilotConfirmWithdrawal')}</Button>
                        <Button variant="ghost" className="w-full" onClick={() => setPilotEndStep('closed')}>{t('pilotReturnToGame')}</Button>
                      </>
                    )}
                  </div>
                ) : sessionEndStatus === 'awaiting_player_closure' ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full h-auto min-h-10 py-2.5 px-3 border-brass/60 text-brass bg-brass/10 font-special-elite animate-pulse cursor-wait whitespace-normal text-sm leading-snug flex items-center justify-center gap-2 text-center"
                    title={t('awaitingClosureTitle')}
                  >
                    <Hourglass className="w-4 h-4 mr-1 animate-spin text-brass shrink-0" />
                    <span className="leading-tight">{t('awaitingClosure')}</span>
                  </Button>
                ) : (
                  <Button
                    disabled={awaitingPilotCapability}
                    onClick={() => {
                      if (!awaitingPilotCapability && handleSendMessage) {
                        handleSendMessage('[KONIEC_SESJI]');
                      }
                    }}
                    variant="outline"
                    className="w-full border-brass/40 text-brass hover:bg-brass/10 hover:border-brass/70 font-special-elite flex items-center justify-center gap-2"
                    title={t('endSessionTitle')}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>{t('endSession')}</span>
                  </Button>
                )
              ) : (
                <Button
                  onClick={onCharacterCreate}
                  data-testid="open-character-wizard"
                  variant="outline"
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{t('createCharacter')}</span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Zapisz / Wczytaj (IND-264) */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-special-elite text-foreground">
                {t('saveLoad')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={onSaveGame}
                  variant="outline"
                  className="flex-1"
                  title={t('saveGame')}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('save')}
                </Button>
                <Button
                  onClick={onOpenGameSession}
                  variant="outline"
                  className="flex-1"
                  title={t('loadSession')}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  {t('load')}
                </Button>
              </div>
              {/* Nowa przygoda - powrót do ekranu głównego (kreatora) */}
              {(onNewAdventure || onSaveAndNewAdventure) && (
                <Button
                  onClick={() => setShowNewAdventureConfirm(true)}
                  variant="outline"
                  className="w-full border-primary/50 text-primary hover:bg-primary/10"
                  title={t('newAdventureTitle')}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t('newAdventure')}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pomoce Badacza - narzędzia pomocnicze */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-special-elite text-foreground flex items-center gap-2">
                <span>🔍</span> {t('investigatorTools')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {onOpenHelp && (
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={onOpenHelp}
                  title={t('compendiumTitle')}
                >
                  <BookOpen className="w-4 h-4 mr-3 text-primary" />
                  {t('compendium')}
                </Button>
              )}
              <Button
                variant="ghost"
                className={`w-full justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${
                  isDirectorMode ? 'bg-brass/15 text-gold border border-brass/40' : ''
                }`}
                onClick={toggleDirectorMode}
                title={t('directorModeTooltip')}
                aria-pressed={isDirectorMode}
              >
                <span className="flex items-center">
                  <Eye className={`w-4 h-4 mr-3 ${isDirectorMode ? 'text-gold' : 'text-primary'}`} />
                  {t('directorMode')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                  isDirectorMode ? 'bg-gold/20 text-gold font-semibold' : 'text-muted-foreground'
                }`}>
                  {isDirectorMode ? t('on') : t('off')}
                </span>
              </Button>
              {onOpenBetaStatus && (
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={onOpenBetaStatus}
                  title={t('betaStatusTitle')}
                >
                  <Sparkles className="w-4 h-4 mr-3 text-primary" />
                  {t('betaStatus')}
                </Button>
              )}
              {onOpenBetaFeedback && (
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={onOpenBetaFeedback}
                  title={t('betaFeedbackTitle')}
                >
                  <Bug className="w-4 h-4 mr-3 text-primary" />
                  {t('betaFeedback')}
                </Button>
              )}
              <YouTubePlayer isTTSPlaying={isTTSPlaying} />
            </CardContent>
          </Card>

          {/* Ustawienia */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-special-elite text-foreground">
                ⚙️ {t('settings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setOpenDialog('settings')}
              >
                <Settings className="w-4 h-4 mr-3 text-primary" />
                {t('configuration')}
              </Button>
              {/* IND-258: szybki mute lektora w grze (trwały, niezależny od presetu) */}
              {voiceFeatureAvailable !== false && (
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => onToggleNarrator?.(!isTTSEnabled)}
                  title={t('narratorToggleTitle')}
                >
                  {isTTSEnabled ? (
                    <Volume2 className="w-4 h-4 mr-3 text-primary" />
                  ) : (
                    <VolumeX className="w-4 h-4 mr-3 text-muted-foreground" />
                  )}
                  {t('narrator')}: {isTTSEnabled ? t('on') : t('off')}
                </Button>
              )}
              {/* Szybki toggle generowania obrazów w czacie (oszczędność kosztów) */}
              {aiSettings && onUpdateAISettings && (
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => {
                    const updated = {
                      ...aiSettings,
                      imageGenerationEnabled:
                        !aiSettings.imageGenerationEnabled,
                    };
                    onUpdateAISettings(updated);
                    // Zapisz trwale
                    import('@/lib/ai-settings').then(({ saveAISettings }) => {
                      saveAISettings(updated);
                    });
                  }}
                  title={t('imagesToggleTitle')}
                >
                  <ImageIcon
                    className={`w-4 h-4 mr-3 ${aiSettings.imageGenerationEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  {t('images')}: {aiSettings.imageGenerationEnabled ? t('on') : t('off')}
                </Button>
              )}
              {/* Szybki toggle oświetlenia Philips Hue w pokoju */}
              <div className="flex items-center gap-1 w-full">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={handleToggleHue}
                  title={t('hueLightingToggleTitle')}
                >
                  <Lightbulb
                    className={`w-4 h-4 mr-3 ${hueConfig.enabled ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  {t('hueLighting')}: {hueConfig.enabled ? t('on') : t('off')}
                </Button>
                {hueConfig.enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs font-mono text-primary hover:bg-primary/20"
                    onClick={handleTriggerEmergencyLight}
                    title={t('emergencyLightTitle')}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                    <span className="ml-1 text-[10px] font-bold">100%</span>
                  </Button>
                )}
              </div>
              {/* Przycisk Zimny Start - czyszczenie danych podręcznych i restart do stanu początkowego */}
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/15 hover:text-destructive-foreground"
                onClick={() => {
                  if (confirm(t('coldStartConfirm'))) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }
                }}
                title={t('coldStartTitle')}
              >
                <Flame className="w-4 h-4 mr-3 text-destructive" />
                {t('coldStart')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {openDialog === 'settings' && (
        <SettingsModal
          open={openDialog === 'settings'}
          onClose={() => setOpenDialog(null)}
          onOpenChange={(open) => !open && setOpenDialog(null)}
        />
      )}
      <CharacterDialog
        open={openDialog === 'character'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        activeCharacter={activeCharacter}
        characters={characters}
        onCharacterSwitch={onCharacterSwitch}
        onCharacterCreate={onCharacterCreate}
        onCharacterManage={onCharacterManage}
      />
      <CharacterSheet
        open={openDialog === 'characterSheet'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        character={inspectedCharacter}
        onCharacterUpdate={onUpdateCharacter}
        characters={characters}
        onCharacterChange={(character) => setInspectedCharacterId(character.id)}
        eraContext={resolvedEraContext}
      />

      {openDialog === 'journal' && activeCharacter && onUpdateCharacter && (
        <SessionJournal
          character={activeCharacter}
          onUpdateCharacter={onUpdateCharacter}
          sharedJournal={sharedJournal}
          onUpdateSharedJournal={
            sharedJournalEnabled ? onUpdateSharedJournal : undefined
          }
          participantNames={participantNames}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog === 'journal' && !activeCharacter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-brass/30 rounded-lg p-8 text-center w-full max-w-md shadow-deco">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {t('selectCharacter')}
            </h3>
            <p className="text-muted-foreground mb-6">{t('journalRequiresCharacter')}</p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setOpenDialog('character')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                📋 {t('selectCharacter')}
              </Button>
              <Button
                onClick={() => {
                  setOpenDialog(null);
                  if (onCharacterCreate) onCharacterCreate();
                }}
                variant="outline"
              >
                ➕ {t('newCharacter')}
              </Button>
            </div>
            <Button
              onClick={() => setOpenDialog(null)}
              variant="ghost"
              className="mt-4 text-muted-foreground"
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {openDialog === 'equipment' && activeCharacter && onUpdateCharacter && (
        <EquipmentModal
          open={openDialog === 'equipment'}
          onOpenChange={(open) => !open && setOpenDialog(null)}
          character={inspectedCharacter ?? activeCharacter}
          onCharacterUpdate={onUpdateCharacter}
          era={
            effectiveAdventureContext?.yearRange?.split('-')[0] ||
            effectiveAdventureContext?.era ||
            '1920s'
          }
          adventureTheme={effectiveAdventureContext?.title}
          eraContext={resolvedEraContext}
          characters={characters}
          onCharacterChange={(character) =>
            setInspectedCharacterId(character.id)
          }
        />
      )}
      <SessionZeroModal
        open={showSessionZero}
        onClose={() => setShowSessionZero(false)}
        adventureContext={
          (effectiveAdventureContext as unknown as AdventureContext) ||
          undefined
        }
        activeCharacter={activeCharacter}
        onCharacterUpdate={onUpdateCharacter}
        playerCharacters={
          hotSeatConfig?.enabled
            ? hotSeatConfig.players
                .map((player) =>
                  characters?.find(
                    (character) =>
                      character.id === player.characterId ||
                      character.playerName === player.name
                  )
                )
                .filter((character): character is Character => Boolean(character))
            : activeCharacter
              ? [activeCharacter]
              : []
        }
        onComplete={(settings: SessionZeroSettings) => {
          console.log('Session Zero completed:', settings);
          setShowSessionZero(false);
          // Wywołaj callback do page.tsx
          if (onSessionZeroComplete) {
            onSessionZeroComplete();
          }
        }}
      />
      <AdventureSelector
        open={showAdventureSelector}
        onClose={() => setShowAdventureSelector(false)}
        onSelect={(adventure) => {
          setAdventureContext(adventure);
          // Zapisz do localStorage dla strony tworzenia postaci
          localStorage.setItem('adventure_context', JSON.stringify(adventure));
          // Powiadom page.tsx o wyborze przygody
          if (onAdventureSelect) {
            onAdventureSelect(adventure);
          }
          setShowAdventureSelector(false);
        }}
        customAdventures={customAdventures}
        onUploadAdventure={onUploadAdventure}
        onDeleteAdventure={onDeleteAdventure}
        onToggleAttachLorebook={onToggleAttachLorebook}
        isUploading={isUploadingAdventure}
        uploadProgress={uploadProgressAdventure}
        loadingStatus={loadingStatusAdventure}
        uploadError={uploadErrorAdventure}
        onClearUploadError={onClearUploadErrorAdventure}
      />

      <HandoutGenerator
        open={showHandoutGenerator}
        onClose={() => setShowHandoutGenerator(false)}
        onGenerate={(handout) => {
          console.log('Handout generated:', handout);
        }}
      />
      <NewAdventureModal
        open={showNewAdventureConfirm}
        onClose={() => setShowNewAdventureConfirm(false)}
        onSaveFirst={() => onSaveAndNewAdventure?.()}
        onSkipSave={() => onNewAdventure?.()}
      />
    </>
  );
};
