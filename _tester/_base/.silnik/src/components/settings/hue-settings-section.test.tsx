import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HueSettingsSection } from './hue-settings-section';
import { DEFAULT_HUE_CONFIG } from '@/lib/hardware/hue/types';
const status = {
  config: {
    ...DEFAULT_HUE_CONFIG,
    enabled: true,
    paired: true,
    bridgeIp: '192.168.1.2',
    bridgeId: '001788fffe123456',
    selectedLightIds: ['light-1'],
  },
  phase: 'off',
  paired: true,
  hasClientKey: false,
  lights: [{ id: 'light-1', metadata: { name: 'Desk' }, on: { on: true } }],
  areas: [],
};
describe('Hue settings', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => status });
  });
  it('loads live pairing state and renders all five score rows', async () => {
    render(<HueSettingsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozwiń' }));
    await waitFor(() =>
      expect(screen.getByTestId('hue-enabled')).toBeEnabled()
    );
    expect(screen.getByTestId('hue-scene-values')).toHaveTextContent('40%');
    fireEvent.change(screen.getByTestId('hue-scene-select'), {
      target: { value: 'scene-prabuty-krypta-climax' },
    });
    expect(screen.getByTestId('hue-scene-values')).toHaveTextContent('10%');
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(
      5
    );
  });
  it('explains paired-but-unselected lamps and disables lighting tests', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          ...status,
          config: { ...status.config, selectedLightIds: [] },
        }),
      } as Response);
    render(<HueSettingsSection />);
    expect(
      await screen.findByTestId('hue-selection-required')
    ).toHaveTextContent('Wybierz lampy');
  });
  it('reports failed operations and never erases a legacy key on failed migration', async () => {
    localStorage.setItem(
      'straznik_hue_config',
      JSON.stringify({ ...status.config, appKey: 'legacy-dummy' })
    );
    jest.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'OFFLINE' }),
    } as Response);
    render(<HueSettingsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozwiń' }));
    await screen.findByText(/Nie udało się wykonać polecenia/);
    expect(
      JSON.parse(localStorage.getItem('straznik_hue_config')!).appKey
    ).toBe('legacy-dummy');
  });
});
