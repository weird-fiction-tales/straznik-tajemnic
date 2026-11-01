import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EquipmentDetailDialog } from './equipment-detail-dialog';
import { EquipmentItem } from '@/lib/types';

describe('EquipmentDetailDialog', () => {
  const mockItem: EquipmentItem = {
    id: 'eq_1',
    name: 'Tajemniczy List',
    category: 'document',
    description: 'Stary pożółkły list znaleziony w piwnicy.',
    condition: 'used',
    source: 'found',
    obtainedAt: new Date(),
  };

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders item details correctly', () => {
    render(<EquipmentDetailDialog item={mockItem} onClose={jest.fn()} />);
    expect(screen.getByText('Tajemniczy List')).toBeInTheDocument();
    expect(screen.getByText('Stary pożółkły list znaleziony w piwnicy.')).toBeInTheDocument();
  });

  it('renders read button for document categories', () => {
    const handleUpdate = jest.fn();
    render(
      <EquipmentDetailDialog
        item={mockItem}
        onClose={jest.fn()}
        onUpdateItem={handleUpdate}
      />
    );
    expect(screen.getByText('📖 Przeczytaj dokument')).toBeInTheDocument();
  });

  it('shows an owned dossier source summary without offering to generate a transcription', () => {
    const dossierItem: EquipmentItem = {
      ...mockItem,
      description: 'Źródłowe streszczenie: fotografia kieruje do klasztoru w Elblągu.',
      imageUrl: '/images/prabuty/playtest/photo-1947.png',
      dossierBinding: { adventureId: 'cien-nad-prabutami', editionFingerprint: `sha256:${'a'.repeat(64)}`, recordId: 'prabuty.item.photo' },
    };
    render(<EquipmentDetailDialog item={dossierItem} onClose={jest.fn()} onUpdateItem={jest.fn()} />);
    expect(screen.getByText(dossierItem.description!)).toBeVisible();
    expect(screen.queryByText('📖 Przeczytaj dokument')).toBeNull();
    expect(screen.getByRole('img')).toHaveAttribute('src', dossierItem.imageUrl);
  });

  it('displays readable content when present', () => {
    const readableItem: EquipmentItem = {
      ...mockItem,
      readableContent: 'Treść sekretnej wiadomości...',
      readableContentStatus: 'ready',
    };
    render(<EquipmentDetailDialog item={readableItem} onClose={jest.fn()} />);
    expect(screen.queryByText('📖 Przeczytaj dokument')).not.toBeInTheDocument();
    expect(screen.getByText('Treść sekretnej wiadomości...')).toBeInTheDocument();
  });

  it('triggers API call on read click and updates item', async () => {
    const handleUpdate = jest.fn();
    localStorage.setItem(
      'adventure_context',
      JSON.stringify({
        id: 'test-1973',
        title: 'Test 1973',
        yearRange: '1973',
        country: 'Polska',
      })
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, content: 'Zinterpretowana treść z API...' }),
    });

    render(
      <EquipmentDetailDialog
        item={mockItem}
        onClose={jest.fn()}
        onUpdateItem={handleUpdate}
      />
    );

    const button = screen.getByText('📖 Przeczytaj dokument');
    fireEvent.click(button);

    expect(screen.getByText('Badanie dokumentu...')).toBeInTheDocument();

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          readableContent: 'Zinterpretowana treść z API...',
          readableContentStatus: 'ready',
          isReadable: true,
        })
      );
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/equipment/read-item',
      expect.objectContaining({
        body: expect.stringContaining('"effectiveYear":1973'),
      })
    );
  });

  it('calls onClose when close X button is clicked', () => {
    const handleClose = jest.fn();
    render(<EquipmentDetailDialog item={mockItem} onClose={handleClose} />);
    const closeButton = screen.getByRole('button', { name: 'Zamknij' });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows expanding and collapsing the document viewer', () => {
    const readableItem: EquipmentItem = {
      ...mockItem,
      readableContent: 'Bardzo długi tekst z archiwum...',
      readableContentStatus: 'ready',
    };
    render(<EquipmentDetailDialog item={readableItem} onClose={jest.fn()} />);
    
    // Przycisk powiększenia
    const expandBtn = screen.getByTitle('Powiększ dokument');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);

    // W trybie rozszerzonym pojawia się przycisk zwinięcia
    const collapseBtn = screen.getByText('Zwiń do widoku przedmiotu');
    expect(collapseBtn).toBeInTheDocument();

    // Zwinięcie z powrotem
    fireEvent.click(collapseBtn);
    expect(screen.getByTitle('Powiększ dokument')).toBeInTheDocument();
  });

  it('renders atmospheric lore for items without explicit description and eliminates appearance label', () => {
    const bareItem: EquipmentItem = {
      id: 'eq_revolver_bare',
      name: 'Rewolwer .38',
      category: 'weapon',
      modifiers: { damage: '1d10', range: '15 yards' },
      condition: 'used',
      source: 'starting',
      obtainedAt: new Date(),
    };

    render(<EquipmentDetailDialog item={bareItem} onClose={jest.fn()} />);

    // Tytuł i nazwa
    expect(screen.getByText('Rewolwer .38')).toBeInTheDocument();

    // Nastrojowy opis lore (fallback generowany z nazwy)
    expect(
      screen.getByText(/Starannie utrzymana broń, regularnie czyszczona i oliwiona/i)
    ).toBeInTheDocument();

    // Sekcja wyglądu fizycznego (appearance) została całkowicie wyeliminowana
    expect(screen.queryByText('Wygląd:')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/antyczny przedmiot osobisty/i)
    ).not.toBeInTheDocument();

    // Mechanika CoC 7e
    expect(screen.getByText('Obrażenia')).toBeInTheDocument();
    expect(screen.getByText('1d10')).toBeInTheDocument();
  });

  it('nie wyświetla technicznego bloku Potrójnego Bytu Handoutu ani zdublowanego przycisku czytania/akcji', () => {
    const onClose = jest.fn();
    const documentItem: EquipmentItem = {
      id: 'doc-1',
      name: 'List od profesora',
      category: 'document',
      readableContent: 'Drogi przyjacielu, niebezpieczeństwo w piwnicy jest realne.',
      condition: 'used',
    };

    render(
      <EquipmentDetailDialog
        item={documentItem}
        onClose={onClose}
      />
    );

    // Potrójny Byt Handoutów nie powinien być renderowany
    expect(screen.queryByText(/Potrójny Byt Handoutu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\. Rekwizyt w ekwipunku/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\. Czytnik diegetyczny/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/3\. Fakt w Dossier/i)).not.toBeInTheDocument();

    // Zdublowany przycisk w nagłówku nie powinien być renderowany
    expect(screen.queryByRole('button', { name: /Pytaj o to na czacie/i })).not.toBeInTheDocument();

    // Pasek narzędziowy czytnika diegetycznego w szmaragdowym akcencie
    expect(screen.getByTestId('diegetic-reader-toolbar')).toBeInTheDocument();
  });

  it('renders friendly error message when API returns 402 prepayment credits depleted instead of leaking raw JSON', async () => {
    const handleUpdate = jest.fn();
    const rawGoogleError = JSON.stringify({
      error: {
        code: 402,
        message: 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ',
        status: 'RESOURCE_EXHAUSTED',
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: rawGoogleError,
        code: 'BYOK_CREDITS_DEPLETED',
      }),
    });

    render(
      <EquipmentDetailDialog
        item={mockItem}
        onClose={jest.fn()}
        onUpdateItem={handleUpdate}
      />
    );

    const button = screen.getByText('📖 Przeczytaj dokument');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Upewnij się, że surowy JSON nie wyciekł do UI
    expect(screen.queryByText(/\{"error":\{"code":402/i)).not.toBeInTheDocument();
    expect(screen.getByText('Błąd odczytu dokumentu')).toBeInTheDocument();
    expect(
      screen.getByText(/Wyczerpano środki przedpłacone/i)
    ).toBeInTheDocument();
  });

  it('renders friendly error message when API throws network error containing raw Google JSON', async () => {
    const handleUpdate = jest.fn();
    const rawGoogleError =
      '{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ","status":"RESOURCE_EXHAUSTED"}}';

    global.fetch = jest.fn().mockRejectedValue(new Error(rawGoogleError));

    render(
      <EquipmentDetailDialog
        item={mockItem}
        onClose={jest.fn()}
        onUpdateItem={handleUpdate}
      />
    );

    const button = screen.getByText('📖 Przeczytaj dokument');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.queryByText(/\{"error":\{"code":402/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Wyczerpano środki przedpłacone/i)
    ).toBeInTheDocument();
  });
});
