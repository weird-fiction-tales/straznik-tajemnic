import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AmbilightSettingsSection } from './ambilight-settings-section';
import { ambilightAction } from '@/lib/hardware/ambilight/client';
jest.mock('@/lib/hardware/ambilight/client', () => ({
  ambilightAction: jest.fn(),
  saveAmbilightStatus: jest.fn(),
}));
afterEach(() => {
  delete process.env.NEXT_INTL_TEST_LOCALE;
  jest.resetAllMocks();
});
for (const locale of ['pl', 'en']) {
  test(`manual address, PIN rejection and retry - ${locale}`, async () => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    jest.mocked(ambilightAction).mockImplementation(async (action) => {
      if (action === 'confirm') throw new Error('invalidPin');
      if (action === 'pair') return { pinRequired: true } as never;
      return { paired: false, enabled: false, ip: '', name: '' } as never;
    });
    render(<AmbilightSettingsSection />);
    await waitFor(() => expect(ambilightAction).toHaveBeenCalled());
    fireEvent.change(
      screen.getByLabelText(
        locale === 'pl' ? 'Adres IP telewizora' : 'TV IP address'
      ),
      { target: { value: '192.168.1.50' } }
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: locale === 'pl' ? 'Połącz telewizor' : 'Connect TV',
      })
    );
    const input = await screen.findByLabelText(
      locale === 'pl'
        ? 'Wpisz czterocyfrowy PIN wyświetlony na telewizorze.'
        : 'Enter the four-digit PIN displayed on your TV.'
    );
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: locale === 'pl' ? 'Zatwierdź PIN' : 'Confirm PIN',
      })
    );
    expect(
      await screen.findByText(
        locale === 'pl'
          ? 'TV odrzucił PIN. Sprawdź kod na ekranie.'
          : 'TV rejected the PIN. Check the code on its screen.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: locale === 'pl' ? 'Włącz efekty TV' : 'Enable TV effects',
      })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: locale === 'pl' ? 'Anuluj parowanie' : 'Cancel pairing',
      })
    );
    expect(
      screen.queryByLabelText(/four-digit|czterocyfrowy/)
    ).not.toBeInTheDocument();
  });
}
