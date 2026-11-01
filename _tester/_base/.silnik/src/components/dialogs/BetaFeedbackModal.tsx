'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  Bug,
  Copy,
  Download,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Mail,
} from 'lucide-react';

export const FEEDBACK_EMAIL =
  process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || 'issue@callofchtulhu.pl';

export type FeedbackCategory =
  | 'mechanics'
  | 'audio'
  | 'graphics'
  | 'narrative'
  | 'general';

interface BetaFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioTitle?: string;
  characterName?: string;
  eraLabel?: string;
  messageCount?: number;
}

export function BetaFeedbackModal({
  open,
  onOpenChange,
  scenarioTitle,
  characterName,
  eraLabel,
  messageCount,
}: BetaFeedbackModalProps) {
  const t = useTranslations('BetaFeedback');
  const [category, setCategory] = useState<FeedbackCategory>('mechanics');
  const [description, setDescription] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  const categories: Array<{ id: FeedbackCategory; label: string }> = [
    { id: 'mechanics', label: t('categoryMechanics') },
    { id: 'audio', label: t('categoryAudio') },
    { id: 'graphics', label: t('categoryGraphics') },
    { id: 'narrative', label: t('categoryNarrative') },
    { id: 'general', label: t('categoryGeneral') },
  ];

  const generateDiagnosticData = () => {
    return {
      appVersion: 'v0.9.3 (Beta)',
      timestamp: new Date().toISOString(),
      scenario: scenarioTitle || 'Nie wybrano (Ekran główny)',
      era: eraLabel || 'Nie określono',
      character: characterName || 'Brak aktywnego badacza',
      messageCount: messageCount ?? 0,
      category,
      userDescription: description.trim(),
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      screenResolution:
        typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : 'Unknown',
    };
  };

  const buildReportMarkdown = (diag: ReturnType<typeof generateDiagnosticData>, catLabel: string) => {
    return `### [BETA FEEDBACK] ${catLabel}

**Opis problemu:**
${diag.userDescription || '*(Brak dodatkowego opisu)*'}

<details>
<summary><b>Dane diagnostyczne sesji</b></summary>

- **Wersja aplikacji:** \`${diag.appVersion}\`
- **Data i czas:** \`${diag.timestamp}\`
- **Scenariusz:** ${diag.scenario}
- **Epoka:** ${diag.era}
- **Badacz:** ${diag.character}
- **Liczba wiadomości w sesji:** ${diag.messageCount}
- **Rozdzielczość ekranu:** \`${diag.screenResolution}\`
- **Przeglądarka / Środowisko:** \`${diag.browserInfo}\`

</details>
`;
  };

  const handleCopyEmail = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(FEEDBACK_EMAIL);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
        toast({
          title: t('copiedEmail'),
          description: FEEDBACK_EMAIL,
        });
      }
    } catch (err) {
      console.error('Błąd kopiowania adresu e-mail:', err);
    }
  };

  const handleSendEmail = async () => {
    const diag = generateDiagnosticData();
    const catLabel =
      categories.find((c) => c.id === category)?.label || category;
    const reportMarkdown = buildReportMarkdown(diag, catLabel);

    // 1. Zapis w tle do API lokalnego
    try {
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description: diag.userDescription,
          diagnostics: diag,
        }),
      }).catch(() => {});
    } catch {
      // Ignoruj błąd zapisu w tle
    }

    // 2. Kopiowanie do schowka dla wygody
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(reportMarkdown);
      }
    } catch {
      // Ignoruj błąd schowka
    }

    // 3. Wywołanie mailto
    const subject = encodeURIComponent(`[Strażnik Beta] ${catLabel} - ${diag.scenario}`);
    const body = encodeURIComponent(reportMarkdown);
    const mailtoUrl = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const mailtoLink = document.createElement('a');
        mailtoLink.href = mailtoUrl;
        document.body.appendChild(mailtoLink);
        mailtoLink.click();
        mailtoLink.remove();
      } catch {
        window.location.href = mailtoUrl;
      }
    }

    setSentEmail(true);
    setTimeout(() => setSentEmail(false), 3000);

    toast({
      title: t('sendEmailSuccess'),
      description: t('sendEmailSuccessDesc', { email: FEEDBACK_EMAIL }),
    });
  };

  const handleCopyReport = async () => {
    const diag = generateDiagnosticData();
    const catLabel =
      categories.find((c) => c.id === category)?.label || category;

    const reportMarkdown = buildReportMarkdown(diag, catLabel);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(reportMarkdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast({
          title: t('copySuccess'),
          description: t('subtitle'),
        });
      }
    } catch (err) {
      console.error('Błąd kopiowania do schowka:', err);
    }
  };

  const handleDownloadDiagnostics = () => {
    const diag = generateDiagnosticData();
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(diag, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `straznik-tajemnic-diagnostyka-${Date.now()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-w-2xl border-brass/50 bg-[#0d0f12]/95 backdrop-blur-md">
        <DialogHeader className="space-y-2 pb-3 border-b border-brass/20">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/70 text-primary bg-primary/10 font-display font-semibold uppercase tracking-wider text-xs px-2.5 py-0.5"
            >
              <Bug className="w-3.5 h-3.5 mr-1" />
              Feedback
            </Badge>
          </div>
          <DialogTitle className="font-display text-xl font-bold tracking-wide text-foreground uppercase">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-xs font-special-elite text-muted-foreground">
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Wybór kategorii */}
          <div className="space-y-2">
            <label className="text-xs font-display font-semibold uppercase tracking-wider text-brass">
              {t('categoryLabel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`feedback-category-${cat.id}`}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`text-left text-xs p-2.5 rounded border transition-colors ${
                    category === cat.id
                      ? 'border-primary bg-primary/15 text-foreground font-semibold shadow-sm'
                      : 'border-brass/20 bg-card/40 text-muted-foreground hover:border-brass/50 hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opis */}
          <div className="space-y-2">
            <label
              htmlFor="feedback-description"
              className="text-xs font-display font-semibold uppercase tracking-wider text-brass"
            >
              {t('descriptionLabel')}
            </label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={4}
              className="border-brass/30 bg-card/50 text-xs font-special-elite focus-visible:ring-primary"
            />
          </div>

          {/* Pasek informacyjny o docelowym adresie e-mail */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded bg-black/50 border border-brass/25 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <Mail className="w-4 h-4 text-brass shrink-0" />
              <span className="truncate font-special-elite">
                {t('emailNotice')}:{' '}
                <strong className="text-brass font-mono select-all font-bold">
                  {FEEDBACK_EMAIL}
                </strong>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleCopyEmail}
              className="h-7 px-2 text-[11px] text-brass hover:text-foreground hover:bg-brass/10 shrink-0 self-end sm:self-auto"
            >
              {copiedEmail ? (
                <Check className="w-3 h-3 mr-1 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              {copiedEmail ? t('copiedEmail') : t('copyEmail')}
            </Button>
          </div>

          {/* Dane diagnostyczne - Zwijany panel */}
          <div className="border border-brass/20 rounded p-3 bg-black/40">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center justify-between w-full text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brass" />
                {t('diagnosticsTitle')}
              </span>
              {showDiagnostics ? (
                <ChevronDown className="w-4 h-4 text-brass" />
              ) : (
                <ChevronRight className="w-4 h-4 text-brass" />
              )}
            </button>

            {showDiagnostics && (
              <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
                <div>
                  <span className="text-foreground/70 block">{t('appVersion')}:</span>
                  v0.9.3 (Beta)
                </div>
                <div>
                  <span className="text-foreground/70 block">{t('currentScenario')}:</span>
                  {scenarioTitle || '—'}
                </div>
                <div>
                  <span className="text-foreground/70 block">{t('currentEra')}:</span>
                  {eraLabel || '—'}
                </div>
                <div>
                  <span className="text-foreground/70 block">{t('character')}:</span>
                  {characterName || '—'}
                </div>
                <div>
                  <span className="text-foreground/70 block">{t('messagesCount')}:</span>
                  {messageCount ?? 0}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col items-stretch gap-3 pt-3 border-t border-brass/20 lg:grid lg:grid-cols-1">
          <div className="grid min-w-0 grid-cols-2 gap-2 order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyReport}
              className="min-w-0 whitespace-normal px-3 py-2 flex-1 text-sm border-brass/30 text-brass hover:bg-brass/10"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                  {t('copiedNotice')}
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {t('copyButton')}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDiagnostics}
              className="min-w-0 whitespace-normal px-3 py-2 flex-1 text-sm border-brass/30 text-muted-foreground hover:text-foreground hover:bg-brass/10"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('downloadButton')}
            </Button>
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 order-1">
            <Button
              size="sm"
              onClick={handleSendEmail}
              className="min-w-0 whitespace-normal px-3 py-2 flex-1 font-display uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
            >
              {sentEmail ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                  {t('sentNotice')}
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                  {t('sendEmailButton')}
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('close')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
