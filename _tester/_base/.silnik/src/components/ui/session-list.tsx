'use client';

import './deco-window.css';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

interface Session {
  sessionId: string;
  sessionData: {
    sessionName: string;
    description: string;
    character: { id: string; name: string; occupation: string } | null;
    messages: Array<{ role: string; content: string }>;
    adventureText: string;
    timestamp: string;
  };
}

interface SessionListProps {
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClose: () => void;
}

export function SessionList({
  onLoadSession,
  onDeleteSession,
  onClose,
}: SessionListProps) {
  const t = useTranslations('SessionList');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/session');
      if (response.ok) {
        const { sessions } = await response.json();
        setSessions(sessions || []);
      } else {
        setError(t('loadError'));
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    await onLoadSession(sessionId);
    onClose();
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (
      window.confirm(
        t('deleteConfirm')
      )
    ) {
      await onDeleteSession(sessionId);
      await loadSessions();
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
        <p className="text-muted-foreground text-lg">
          {t('loading')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center">
          <span className="text-2xl">❌</span>
        </div>
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <Button
          onClick={loadSessions}
          className="px-6 py-2 bg-brass/80 hover:bg-brass text-background font-medium rounded-md"
        >
          {t('retryButton')}
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-brass/10 border border-brass/20 rounded-full flex items-center justify-center">
          <span className="text-2xl">📂</span>
        </div>
        <p className="text-muted-foreground text-lg">{t('emptyTitle')}</p>
        <p className="text-muted-foreground text-sm mt-2">
          {t('emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="deco-window bg-card border border-brass/30 rounded-lg p-6 w-[80vw] h-[78vh] max-h-[85vh] overflow-y-auto text-foreground shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-display uppercase tracking-widest text-brass text-center flex-1">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-muted hover:bg-muted/80 text-brass border border-brass/20 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="bg-black/40 backdrop-blur-sm border border-brass/20 rounded-lg p-6 hover:border-brass/40 hover:bg-black/50 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-foreground mb-2">
                    {session.sessionData.sessionName || t('unnamed')}
                  </h4>
                  {session.sessionData.description && (
                    <p className="text-foreground text-sm mb-2">
                      {session.sessionData.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {t('characterLabel', { name: session.sessionData.character?.name || t('noCharacter') })}
                    </span>
                    <span>
                      {t('messagesCount', { count: session.sessionData.messages?.length || 0 })}
                    </span>
                    <span>
                      {t('charactersCount', { count: session.sessionData.adventureText?.length || 0 })}
                    </span>
                    <span>🕐 {formatDate(session.sessionData.timestamp)}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleLoadSession(session.sessionId)}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all duration-300 hover:scale-105"
                  >
                    {t('loadButton')}
                  </Button>
                  <Button
                    onClick={() => handleDeleteSession(session.sessionId)}
                    className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium rounded-lg transition-all duration-300 hover:scale-105"
                  >
                    {t('deleteButton')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
