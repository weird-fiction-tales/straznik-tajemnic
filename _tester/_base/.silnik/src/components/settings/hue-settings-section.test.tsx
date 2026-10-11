/**
 * @file hue-settings-section.test.tsx
 * Testy jednostkowe dla komponentu HueSettingsSection (Dark Art Déco, Pushlink 30s UX).
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HueSettingsSection } from './hue-settings-section';
import { HueClient } from '@/lib/hardware/hue/hue-client';

jest.mock('@/lib/hardware/hue/hue-client');

describe('HueSettingsSection', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renderuje nagłówek i status wyłączony w stanie początkowym', () => {
    render(<HueSettingsSection />);

    expect(screen.getByTestId('hue-settings')).toBeInTheDocument();
    expect(screen.getByText(/Inteligentne Oświetlenie \(Philips Hue\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Wyłączone \/ Brak mostka/i)).toBeInTheDocument();
  });

  it('rozwija sekcję konfiguracji po kliknięciu [Rozwiń]', () => {
    render(<HueSettingsSection />);

    const expandBtn = screen.getByRole('button', { name: /Rozwiń/i });
    act(() => {
      fireEvent.click(expandBtn);
    });

    expect(screen.getByText(/Adres IP mostka w sieci lokalnej/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('192.168.1.xxx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wykryj w LAN/i })).toBeInTheDocument();
  });

  it('pozwala wpisać IP mostka i uruchamia pętlę Pushlink', async () => {
    const mockLinkWithPolling = jest.fn().mockImplementation((_ip, onCountdown) => {
      onCountdown(29);
      return Promise.resolve({ success: true, appKey: 'test-app-key-777' });
    });

    (HueClient as unknown as jest.Mock).mockImplementation(() => ({
      linkBridgeWithPolling: mockLinkWithPolling,
      getLights: jest.fn().mockResolvedValue([
        {
          id: '1',
          metadata: { name: 'Kinkiet Gabinet' },
          on: { on: true },
        },
      ]),
    }));

    render(<HueSettingsSection />);

    // Rozwiń
    fireEvent.click(screen.getByRole('button', { name: /Rozwiń/i }));

    // Wpisz IP
    const input = screen.getByPlaceholderText('192.168.1.xxx');
    fireEvent.change(input, { target: { value: '192.168.1.50' } });

    // Kliknij Paruj
    const pairBtn = screen.getByRole('button', { name: /Paruj z mostkiem/i });
    await act(async () => {
      fireEvent.click(pairBtn);
    });

    expect(mockLinkWithPolling).toHaveBeenCalledWith(
      '192.168.1.50',
      expect.any(Function),
      expect.any(Object),
      30
    );

    // Po sukcesie powinien pojawić się komunikat sukcesu
    expect(screen.getByText(/Pomyślnie połączono z mostkiem Hue!/i)).toBeInTheDocument();
  });
});
