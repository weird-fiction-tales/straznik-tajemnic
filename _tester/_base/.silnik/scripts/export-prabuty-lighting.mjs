import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);
const source = JSON.parse(
  await fs.readFile(
    path.join(root, 'data/adventures/predefined/cien-nad-prabutami.json'),
    'utf8'
  )
);
const output = process.argv[2];
if (!output)
  throw Error(
    'Usage: node scripts/export-prabuty-lighting.mjs <output-directory>'
  );
const scenes = source.nodes.flatMap((n) => n.scenes ?? []);
if (scenes.length !== source.nodes.length) throw Error('MISSING_SCENES');
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
const rows = scenes
  .map(
    (s) =>
      `<section><h2>${escape(s.name.pl)} / ${escape(s.name.en)}</h2><p>${escape(s.sceneId)}</p><dl><dt>Preset</dt><dd>${escape(s.lighting.presetId)}</dd><dt>Jasność / Brightness</dt><dd>${s.lighting.brightness}%</dd><dt>Przejście / Transition</dt><dd>${s.lighting.transitionMs} ms</dd></dl><ul>${s.lighting.accents.map((a) => `<li>${escape(a.id)}: ${escape(a.trigger)} → ${escape(a.effectId)}; powrót do bazy / return to base</li>`).join('')}</ul></section>`
  )
  .join('');
await fs.mkdir(output, { recursive: true });
await fs.writeFile(
  path.join(output, 'lighting.json'),
  JSON.stringify({ adventureId: source.id, scenes }, null, 2) + '\n'
);
await fs.writeFile(
  path.join(output, 'lighting.html'),
  `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Prabuty - światło / lighting</title><style>body{font:16px Georgia;max-width:850px;margin:30px auto;color:#27231c}section{break-inside:avoid;border-bottom:1px solid #aaa;padding:15px}dt{font-weight:bold}dd{margin:4px 0 10px}@media print{body{margin:0}section{break-after:page}}</style><h1>Reżyseria światła / Lighting direction</h1>${rows}</html>`
);
await fs.writeFile(
  path.join(output, 'meta-lighting.json'),
  JSON.stringify(
    {
      tytul: source.title,
      poczatkowy_graf: {
        scena_startowa: scenes[0].sceneId,
        kroki_setupu: source.nodes.map((n) => ({
          id: n.id,
          nazwa: n.name,
          sceny: n.scenes,
        })),
      },
    },
    null,
    2
  ) + '\n'
);
console.log(`Exported ${scenes.length} scenes to ${output}`);
