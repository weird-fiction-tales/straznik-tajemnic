import { waitFor } from '@testing-library/react';
import { applyPreset } from '../lib/ai-presets/apply';
import { defaultAISettings } from '../lib/ai-settings/defaults';
import { renderHook, act, RenderHookResult } from '@testing-library/react';
import { useSettingsInit, UseSettingsInitReturn, UseSettingsInitOptions } from './useSettingsInit';
import * as aiSettingsModule from '@/lib/ai-settings';

jest.mock('@/lib/ai-settings', () => {
  const original = jest.requireActual('@/lib/ai-settings');
  return {
    ...original,
    saveAISettings: jest.fn(),
    loadAISettings: jest.fn(() => original.defaultAISettings),
    resetAISettings: jest.fn(() => original.defaultAISettings),
  };
});

describe('useSettingsInit', () => {
  let originalAlert: typeof window.alert;
  let originalConfirm: typeof window.confirm;
  let alertMock: jest.Mock;
  let confirmMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    originalAlert = window.alert;
    originalConfirm = window.confirm;
    alertMock = jest.fn();
    confirmMock = jest.fn();
    window.alert = alertMock;
    window.confirm = confirmMock;
  });

  afterEach(() => {
    window.alert = originalAlert;
    window.confirm = originalConfirm;
  });

  it('handleSave zapisuje ustawienia, zamyka modal i NIE wywołuje window.alert', async () => {
    const onClose = jest.fn();
    const onOpenChange = jest.fn();

    let hookResult!: RenderHookResult<UseSettingsInitReturn, UseSettingsInitOptions>['result'];
    await act(async () => {
      const { result } = renderHook(() =>
        useSettingsInit({
          open: true,
          onClose,
          onOpenChange,
        })
      );
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.handleSave();
    });

    expect(aiSettingsModule.saveAISettings).toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
    expect(hookResult.current.saveStatus).toBe('saved');
    expect(onClose).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handleReset otwiera dialog potwierdzenia zamiast window.confirm', async () => {
    const onClose = jest.fn();

    let hookResult!: RenderHookResult<UseSettingsInitReturn, UseSettingsInitOptions>['result'];
    await act(async () => {
      const { result } = renderHook(() =>
        useSettingsInit({
          open: true,
          onClose,
        })
      );
      hookResult = result;
    });

    expect(hookResult.current.showResetConfirm).toBe(false);

    act(() => {
      hookResult.current.handleReset();
    });

    expect(confirmMock).not.toHaveBeenCalled();
    expect(hookResult.current.showResetConfirm).toBe(true);

    act(() => {
      hookResult.current.closeResetConfirm();
    });
    expect(hookResult.current.showResetConfirm).toBe(false);

    act(() => {
      hookResult.current.openResetConfirm();
    });
    expect(hookResult.current.showResetConfirm).toBe(true);

    act(() => {
      hookResult.current.confirmReset();
    });
    expect(aiSettingsModule.resetAISettings).toHaveBeenCalled();
    expect(hookResult.current.showResetConfirm).toBe(false);
  });
});

describe('settings preset drift detection', () => {
  beforeEach(() => {
    localStorage.clear();
    const settings = applyPreset('mid', defaultAISettings);
    settings.gameMasterNarration.prompts.mainPrompt =
      'Synthetic test instructions';
    localStorage.setItem('ai_settings', JSON.stringify(settings));
    jest.mocked(aiSettingsModule.loadAISettings).mockReturnValue(
      jest.requireActual<typeof aiSettingsModule>('@/lib/ai-settings').loadAISettings()
    );
  });

  it('keeps MID after editing narration and sampling, but marks an edited model CUSTOM', async () => {
    const { result } = renderHook(() =>
      useSettingsInit({ open: true, onClose: jest.fn() })
    );
    await waitFor(() =>
      expect(result.current.settings.qualityPreset).toBe('mid')
    );
    act(() =>
      result.current.setSettings((current) => ({
        ...current,
        geminiSettings: { ...current.geminiSettings, temperature: 0.42 },
        gameMasterNarration: {
          ...current.gameMasterNarration,
          style: { responseLength: 'short', detailLevel: 'minimal' },
          behavior: {
            ...current.gameMasterNarration.behavior,
            creativity: 'creative',
          },
        },
      }))
    );
    expect(result.current.settings.qualityPreset).toBe('mid');
    expect(
      result.current.settings.gameMasterNarration.style.responseLength
    ).toBe('short');
    act(() =>
      result.current.setSettings((current) => ({
        ...current,
        geminiSettings: {
          ...current.geminiSettings,
          model: 'gemini-3.8-flash',
        },
      }))
    );
    await waitFor(() =>
      expect(result.current.settings.qualityPreset).toBe('custom')
    );
  });
});
