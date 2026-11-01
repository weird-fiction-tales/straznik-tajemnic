import { STARTER_ARTWORK } from './starter-artwork.generated';
import { documentImage, escapeXml } from './prepared-dossier';

function wrap(text: string, width: number): string[] {
  return text.split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + ' ' + word).length > width) {
        lines.push(line);
        line = '';
      }
      line = (line + ' ' + word).trim();
    }
    lines.push(line);
    return lines;
  });
}

/** Photographic props and deterministic text have independent sources. */
export function starterDocumentImage(
  title: string,
  text: string,
  slug: string,
  sourceNumber: number | undefined,
  locale: 'pl' | 'en'
): string {
  if (slug === 'clue-01-knott-keys')
    return '/adventure-packs/case-s11-01/clue-01-knott-keys.webp';
  if (slug === 'item-corbitt-dagger')
    return '/adventure-packs/case-s11-01/item-corbitt-dagger.webp';
  const journal =
    (!sourceNumber && slug !== 'clue-crypt-horoscope') || sourceNumber === 9;
  const plate = journal
    ? 'journal'
    : sourceNumber === 5
      ? 'obituary'
      : sourceNumber === 2 || slug === 'clue-crypt-horoscope'
        ? 'press'
        : sourceNumber === 8
          ? 'report'
          : 'legal';
  const background = STARTER_ARTWORK[plate];
  if (!background) return documentImage(title, text, sourceNumber === 9);
  const ink = '#30271e';
  let body = '';
  if (journal) {
    const lines = wrap(text, 34),
      middle = sourceNumber === 9 ? lines.length : Math.ceil(lines.length / 2),
      titles = wrap(title, 29);
    body = titles
      .map(
        (s, i) =>
          `<text x="275" y="${205 + i * 40}" font-size="32" font-weight="bold">${escapeXml(s)}</text>`
      )
      .join('');
    body += lines
      .map(
        (s, i) =>
          `<text x="${i < middle ? 275 : 905}" y="${340 + (i < middle ? i : i - middle) * 37}" font-size="25" font-style="italic">${escapeXml(s)}</text>`
      )
      .join('');
    if (sourceNumber === 9)
      body += `<g transform="translate(875 300) scale(2.1)" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"><path d="M120 10V55L85 115M120 55L155 115M10 205L45 185L80 125M45 185H112M230 205L195 185L160 125M195 185H128"/><path d="M85 135Q120 105 155 135Q120 165 85 135Z"/><circle cx="120" cy="135" r="11" fill="${ink}"/></g>`;
  } else {
    const obituary = sourceNumber === 5,
      press = sourceNumber === 2,
      report = sourceNumber === 8;
    const x = obituary ? 430 : 270,
      width = obituary ? 48 : press ? 68 : 65;
    const heading = press
      ? 'BOSTON GLOBE'
      : report
        ? 'BOSTON POLICE DEPARTMENT'
        : sourceNumber === 1
          ? 'STEVEN KNOTT'
          : obituary
            ? 'IN MEMORIAM'
            : locale === 'pl'
              ? 'AKTA ARCHIWALNE · BOSTON'
              : 'ARCHIVAL RECORD · BOSTON';
    body = `<text x="${x}" y="${obituary ? 270 : 195}" font-size="${press ? 40 : 26}" letter-spacing="${press ? 3 : 2}" font-weight="bold">${escapeXml(heading)}</text><path d="M${x} 220H1350" fill="none" stroke="${ink}" stroke-width="${obituary ? 3 : 1}"/>`;
    const titles = wrap(title, obituary ? 42 : 56),
      lines = wrap(text, width),
      start = (obituary ? 415 : 330) + (titles.length - 1) * 39;
    body += titles
      .map(
        (s, i) =>
          `<text x="${x}" y="${(obituary ? 340 : 280) + i * 39}" font-size="31" font-weight="bold">${escapeXml(s)}</text>`
      )
      .join('');
    body += `<g font-family="${press || report ? 'Courier New,monospace' : 'Georgia,serif'}" font-weight="${press || report ? 600 : 400}">${lines.map((s, i) => `<text x="${x}" y="${start + i * (obituary ? 42 : 36)}" font-size="${obituary ? 29 : press || report ? 24 : 26}">${escapeXml(s)}</text>`).join('')}</g>`;
    if (press)
      body += `<g transform="translate(1280 134) rotate(9)"><text text-anchor="middle" font-family="Courier New" font-size="16" font-weight="bold" fill="#8b3e32">${locale === 'pl' ? 'NIEOPUBLIKOWANE' : 'UNPUBLISHED'}</text></g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941" viewBox="0 0 1672 941"><image width="1672" height="941" href="${background}"/><g fill="${ink}" font-family="Georgia,serif">${body}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
