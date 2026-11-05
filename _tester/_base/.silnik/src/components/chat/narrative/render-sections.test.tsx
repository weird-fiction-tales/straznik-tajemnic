import { fireEvent, render, screen } from '@testing-library/react';
import { renderSection } from './render-sections';
import { parseIntoSections } from './parse-sections';
import type { AnyAdventureContext } from '@/lib/handout-resolver';

beforeEach(() => localStorage.clear());

function dialogue(name: string, adventureId?: string) {
  return render(<>{renderSection({ type: 'dialogue', speaker: name, content: 'Test.' }, 0,
    undefined, undefined, adventureId ? { id: adventureId } as AnyAdventureContext : undefined)}</>);
}

it.each(['Helena', 'Helena Krawczyk'])('wybiera istniejący portret dla jawnego aliasu %s w aktywnej przygodzie', (name) => {
  dialogue(name, 'cien-nad-prabutami');
  expect(screen.getByRole('img', { name: 'Helena Krawczyk' })).toHaveAttribute('src', '/adventure-packs/cien-nad-prabutami/npc-helena-krawczyk.png');
  expect(screen.getByText('Helena Krawczyk')).toBeVisible();
});

it('shows the same Helena portrait for a legacy @ dialogue label', () => {
  const sections = parseIntoSections('@Helena: „Przeczytaj raport. Potem porozmawiamy.”');
  render(<>{sections.map((section, index) => renderSection(section, index, undefined, undefined,
    { id: 'cien-nad-prabutami' } as AnyAdventureContext))}</>);
  expect(screen.getByRole('img', { name: 'Helena Krawczyk' })).toHaveAttribute('src', '/adventure-packs/cien-nad-prabutami/npc-helena-krawczyk.png');
  expect(screen.getByTestId('npc-dialogue-quote')).toHaveTextContent('Przeczytaj raport. Potem porozmawiamy.');
});

it.each([
  ['Helena', undefined], ['Helena', 'englewood-murder-castle-1893'], ['Nieznana Osoba', 'cien-nad-prabutami'],
])('pokazuje inicjały bez zgadywania URL dla %s w kontekście %s', (name, adventureId) => {
  const { container } = dialogue(name, adventureId);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByTestId('npc-dialogue-initials')).toHaveTextContent(name === 'Helena' ? 'HE' : 'NO');
});

it('przy błędzie ładowania znanego portretu pokazuje inicjały postaci', () => {
  dialogue('Helena', 'cien-nad-prabutami');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByTestId('npc-dialogue-initials')).toHaveTextContent('HK');
});

it('używa jawnej mapy portretów wyłącznie dla aktora obecnego w aktywnym kontekście', () => {
  localStorage.setItem('gm_npcs', JSON.stringify([
    { id: 'anna-one', name: 'Anna Kowalska', portraitUrl: '/portraits/custom-anna.webp' },
    { id: 'anna-two', name: 'Anna Nowak', portraitUrl: '/portraits/other-anna.webp' },
  ]));
  const adventure = { id: 'custom-case', graph: { npcs: [
    { id: 'anna-one', name: 'Anna Kowalska' },
  ] } } as AnyAdventureContext;
  render(<>{renderSection({ type: 'dialogue', speaker: 'Anna', content: 'Test.' }, 0,
    undefined, undefined, adventure)}</>);
  expect(screen.getByRole('img', { name: 'Anna Kowalska' })).toHaveAttribute('src', '/portraits/custom-anna.webp');
});

it('przy niejednoznacznym imieniu w aktywnej obsadzie pokazuje inicjały', () => {
  const adventure = { id: 'custom-case', graph: { npcs: [
    { id: 'anna-one', name: 'Anna Kowalska' }, { id: 'anna-two', name: 'Anna Nowak' },
  ] } } as AnyAdventureContext;
  const { container } = render(<>{renderSection({ type: 'dialogue', speaker: 'Anna', content: 'Test.' }, 0,
    undefined, undefined, adventure)}</>);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByTestId('npc-dialogue-initials')).toHaveTextContent('AN');
});

it.each([
  ['„', '”', 'To jest raport. Przeczytaj go'],
  ['“', '”', 'This is the report. Read it'],
])('render zachowuje oryginalne cudzysłowy %s%s i całe zdania', (opening, closing, text) => {
  const sections = parseIntoSections(`Helena: ${opening}${text}${closing}.`);
  render(<>{sections.map((section, index) => renderSection(section, index))}</>);
  expect(screen.getByTestId('npc-dialogue-quote')).toHaveTextContent(`${opening}${text}${closing}.`);
});

it('renderuje pełną kwestię ASCII z escapowanym cytatem wewnętrznym', () => {
  const sections = parseIntoSections(String.raw`Helena: "He said \"Wait\". Keep going".`);
  render(<>{sections.map((section, index) => renderSection(section, index))}</>);
  expect(screen.getByTestId('npc-dialogue-quote')).toHaveTextContent(String.raw`"He said \"Wait\". Keep going".`);
});
