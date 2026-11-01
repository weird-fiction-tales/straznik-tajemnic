import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from './index';
import { hasRequiredKeys } from '@/lib/api-keys-service';

let mockTransport = { serverConfigured: true, serverHasBaseRules: true, loading: false };
jest.mock('@/hooks/useLocalPlaytestTransport', () => ({
  useLocalPlaytestTransport: () => mockTransport,
}));
jest.mock('@/lib/api-keys-service', () => ({ hasRequiredKeys: jest.fn(() => false) }));
jest.mock('./hooks/use-typewriter-sound', () => ({ useTypewriterSound: () => ({ displayedText: '', isTyping: false }) }));

const props = { hasRules: true, onUploadRules: jest.fn(), onSelectAdventure: jest.fn(), onCreateCharacter: jest.fn(), onStartGame: jest.fn() };
describe('real WelcomeScreen local server transport guard', () => {
  beforeEach(() => { localStorage.clear(); mockTransport = { serverConfigured: true, serverHasBaseRules: true, loading: false }; });
  afterEach(() => { delete process.env.NEXT_INTL_TEST_LOCALE; });
  it.each(['pl', 'en'])('shows the real mode picker in %s without pretending client credentials exist', (locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    render(<WelcomeScreen {...props} />);
    expect(screen.getByTestId('btn-manual-setup')).toHaveTextContent(locale === 'en' ? 'Manual Setup' : 'Ustawienia Ręczne');
    expect(hasRequiredKeys()).toBe(false);
    expect(localStorage.getItem('zew-app-api-keys')).toBeNull();
    expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
  });
  it.each(['pl', 'en'])('keeps the authorization screen in %s without verified transport', (locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    mockTransport.serverConfigured = false;
    render(<WelcomeScreen {...props} />);
    expect(screen.queryByTestId('btn-manual-setup')).not.toBeInTheDocument();
    expect(screen.getByText(locale === 'en' ? 'Authorization required' : 'Wymagana autoryzacja')).toBeVisible();
  });
  it('retains the real rules gate even with server credentials', () => {
    render(<WelcomeScreen {...props} hasRules={false} />);
    expect(screen.queryByTestId('btn-manual-setup')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Wgraj zasady/i });
    fireEvent.click(button);
    expect(props.onUploadRules).toHaveBeenCalled();
  });
});
