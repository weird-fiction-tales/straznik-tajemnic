import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHandout } from './render-handout';
import WaveSurfer from 'wavesurfer.js';
import pl from '../../../../messages/pl.json';
import en from '../../../../messages/en.json';

let mockLocale: 'pl' | 'en' = 'pl';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: string) => {
    const translate = (key: string) => {
    const messages = mockLocale === 'pl' ? pl : en;
    const entries = messages[namespace as keyof typeof messages];
    if (!entries || !(key in entries)) throw new Error(`MISSING_MESSAGE: ${namespace}.${key}`);
    return entries[key as keyof typeof entries];
    };
    translate.has = (key: string) => {
      const messages = mockLocale === 'pl' ? pl : en;
      const entries = messages[namespace as keyof typeof messages];
      return Boolean(entries && key in entries);
    };
    return translate;
  },
}));
jest.mock('@/components/ui/document-viewer', () => ({ DocumentViewer: () => <div /> }));
jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ on: jest.fn(), destroy: jest.fn() })) },
}));

it.each(['pl', 'en'] as const)('renders the real player with the %s recording and controls', (locale) => {
  mockLocale = locale;
  render(<>{renderHandout({ type: 'handout', handoutSlug: 'audio-stilon-c60-interview', content: '' }, 0)}</>);
  expect(WaveSurfer.create).toHaveBeenLastCalledWith(expect.objectContaining({
    url: `/audio/handouts/tajemnica-dzieci-z-traszyna/wywiad-dziecko-1983${locale === 'en' ? '-en' : ''}.mp3`,
  }));
  const messages = locale === 'pl' ? pl : en;
  expect(screen.getAllByText(messages.AudioHandouts['audio-stilon-c60-interview-title'], { exact: false }).length).toBeGreaterThan(0);
  expect(screen.getAllByText(messages.AudioHandouts['audio-stilon-c60-interview-summary']).length).toBeGreaterThan(0);
  expect(screen.getByText(messages.AudioReelPlayer.formatCassette)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: messages.AudioReelPlayer.play })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: messages.AudioReelPlayer.restart })).toBeInTheDocument();
});
