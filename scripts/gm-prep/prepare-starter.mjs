import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import "./prepare-starter-artwork.mjs";
import { readHandoutArtworkApproval } from "./starter-approval.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const runtime = path.join(root, "_tester/_base/.silnik");
const require = createRequire(path.join(runtime, "package.json"));
const ts = require("typescript");
const sharp = require("sharp");
// CLI-local transpilation only. The application's module loader is untouched.
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    file,
  );
const { getHauntingDossier, getHauntingGraph, hauntingMapImage } = require(
  path.join(runtime, "src/lib/adventures/starter-dossier.ts"),
);
const { validatePreparedDossier, escapeXml } = require(
  path.join(runtime, "src/lib/adventures/prepared-dossier.ts"),
);
const out = path.join(root, ".local-playtest/starter-dossier");
const sourceArg = process.argv.indexOf("--source");
const sourcePath = sourceArg < 0 ? null : process.argv[sourceArg + 1];
const sourceHash = sourcePath
  ? createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex")
  : null;
if (sourceHash && sourceHash !== getHauntingDossier("pl").source.sha256)
  throw Error("SOURCE_PDF_MISMATCH");

const escape = escapeXml;
const imageData = (file) => {
  if (file.startsWith("data:")) return file;
  if (!file.startsWith("/adventure-packs/"))
    throw Error("UNEXPECTED_ASSET_PATH");
  const bytes = fs.readFileSync(path.join(runtime, "public", file));
  return `data:image/webp;base64,${bytes.toString("base64")}`;
};
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
const json = (file, value) =>
  write(file, JSON.stringify(value, null, 2) + "\n");
const editions = [];
for (const locale of ["pl", "en"]) {
  const d = getHauntingDossier(locale),
    errors = validatePreparedDossier(d);
  if (errors.length) throw Error(errors.join("\n"));
  const base = path.join(out, locale),
    records = [];
  const add = (
    id,
    type,
    content,
    pages,
    scenes = [],
    entities = [],
    links = [],
    provenance = "source_derived",
  ) =>
    records.push({
      schema_version: 1,
      record_id: `haunting.${locale}.${id}`,
      record_type: type,
      adventure_id: d.adventureId,
      edition_fingerprint: d.source.sha256,
      language: locale,
      content,
      tags: { entities, scenes, mechanics: [], topics: [type], triggers: [] },
      retrieval: {
        visibility: "gm_only",
        availability: scenes.length ? "when_scene_active" : "always",
        condition: scenes.length
          ? { all: [{ kind: "scene_active", id: scenes[0] }] }
          : null,
        priority: type === "scene" ? 3 : 1,
      },
      evidence: {
        provenance,
        source_ref: `${d.source.url}#printed-pages=${pages.join(",")}`,
        status: "set",
        approval: "pending",
        approved_by: null,
        approved_at: null,
      },
      links,
    });
  for (const a of d.actors)
    add(
      a.id,
      "actor",
      [a.name, a.description, a.behaviour, a.stats || "", a.voice].join("\n"),
      a.sourcePages,
      a.sceneIds,
      [a.id],
    );
  for (const r of d.rooms)
    add(
      `room.${r.id}`,
      "location",
      r.description,
      r.sourcePages,
      [r.sceneId],
      [r.id],
    );
  for (const s of d.scenes) {
    add(
      s.id,
      "scene",
      JSON.stringify({
        title: s.title,
        entry: s.entry,
        atmosphere: s.atmosphere,
        knowledge: s.knowledge,
        actions: s.actions,
        checks: s.checks,
        exits: s.exits,
      }),
      s.sourcePages,
      [s.id],
      s.actorIds,
      s.handoutSlugs.map((id) => `haunting.${locale}.${id}`),
    );
    add(`${s.id}.director`, "director_note", s.director, s.sourcePages, [s.id]);
  }
  for (const h of d.handouts)
    add(
      h.slug,
      "media",
      JSON.stringify({
        title: h.title,
        text: h.textContent,
        sourceNumber: h.sourceNumber,
        reveal: h.reveal,
      }),
      h.sourcePages,
      [h.nodeId],
      [],
      [],
      h.provenance,
    );
  for (const r of d.rules) add(r.id, "mechanic_hook", r.text, r.sourcePages);
  for (const e of d.endings)
    add(
      `ending.${e.id}`,
      "event",
      `${e.condition}\n${e.consequence}`,
      e.sourcePages,
      [],
      [],
      [],
      e.id === "withdrawal" ? "approved_design" : "source_derived",
    );
  for (const a of d.audio)
    add(
      `audio.${a.id}`,
      "director_note",
      JSON.stringify(a),
      a.sourcePages,
      [a.sceneId],
      [],
      [],
      "approved_design",
    );
  for (const r of records)
    write(
      path.join(base, "records", r.record_id + ".yaml"),
      JSON.stringify(r, null, 2) + "\n",
    );
  write(
    path.join(base, "dossier.yaml"),
    JSON.stringify(
      {
        schema_version: 1,
        dossier_id: `haunting-${locale}`,
        adventure_id: d.adventureId,
        edition_id: d.editionId,
        edition_fingerprint: d.source.sha256,
        language: locale,
        source_ref: d.source.url,
        approval: "pending",
        approved_by: null,
        approved_at: null,
        records_directory: "records",
      },
      null,
      2,
    ) + "\n",
  );
  for (const h of d.handouts) {
    if (h.image.startsWith("data:image/svg+xml")) {
      const svg = decodeURIComponent(h.image.slice(h.image.indexOf(",") + 1));
      write(path.join(base, "handouts", h.slug + ".svg"), svg);
      const embedded = svg.match(
        /<image\b[^>]*href="data:image\/webp;base64,([^"]+)"[^>]*\/>/,
      );
      const image = embedded
        ? await sharp(Buffer.from(embedded[1], "base64"))
            .composite([{ input: Buffer.from(svg.replace(embedded[0], "")) }])
            .flatten()
            .webp({ quality: 95 })
            .toBuffer()
        : await sharp(Buffer.from(svg))
            .flatten()
            .webp({ quality: 95 })
            .toBuffer();
      const stats = await sharp(image).stats();
      if (stats.channels.slice(0, 3).every((c) => c.mean < 40))
        throw Error(`HANDOUT_BACKGROUND_MISSING:${h.slug}`);
      write(path.join(base, "handouts", h.slug + ".webp"), image);
    } else
      write(
        path.join(base, "handouts", h.slug + ".webp"),
        fs.readFileSync(path.join(runtime, "public", h.image)),
      );
  }
  json(path.join(base, "dossier.json"), d);
  json(path.join(base, "graph.json"), getHauntingGraph(locale));
  json(path.join(base, "rag-payload.json"), {
    schema_version: 1,
    adventure_id: d.adventureId,
    edition_fingerprint: d.source.sha256,
    records,
  });
  const rows = d.handouts.map((h) => ({
    material: h.slug,
    number: h.sourceNumber || null,
    title: h.title,
    text: h.textContent,
    scene: h.nodeId,
    reveal: h.reveal,
    sourcePages: h.sourcePages,
    approval: "pending",
  }));
  json(path.join(base, "preparation/handout-bindings.json"), rows);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(d))
    .digest("hex");
  const decisionPath = path.join(base, "preparation/scene-decisions.json");
  // Retain exact previous decisions before invalidating a changed snapshot. Never auto-approve.
  if (fs.existsSync(decisionPath)) {
    const previous = fs.readFileSync(decisionPath);
    if (JSON.parse(previous).snapshot !== fingerprint) {
      const previousHash = createHash("sha256").update(previous).digest("hex");
      write(
        path.join(
          base,
          "preparation/scene-decisions-history",
          previousHash + ".json",
        ),
        previous,
      );
      json(decisionPath, {
        schema_version: 1,
        edition_id: d.editionId,
        snapshot: fingerprint,
        decisions: [],
      });
    }
  } else
    json(decisionPath, {
      schema_version: 1,
      edition_id: d.editionId,
      snapshot: fingerprint,
      decisions: [],
    });
  json(path.join(base, "preparation/snapshot.json"), {
    snapshot: fingerprint,
    approval: "pending",
    recordCount: records.length,
    sourceHash: d.source.sha256,
  });
  const heading =
    locale === "pl"
      ? "Nawiedzony Dom - teczka do odbioru"
      : "The Haunting - preparation review";
  const pending =
    locale === "pl"
      ? "Oczekuje na odbiór autora. To podgląd przygotowania, bez uruchamiania gry."
      : "Pending author review. This is a preparation preview, without running the game.";
  const cards = d.handouts
    .map(
      (h) =>
        `<article data-testid="handout-card" id="${escape(h.slug)}"><h3>${h.sourceNumber ? `${h.sourceNumber}. ` : ""}${escape(h.title)}</h3><img class="document" alt="${escape(h.title)}" src="${imageData(h.image)}"/><p class="transcript">${escape(h.textContent)}</p><p><strong>${locale === "pl" ? "Scena" : "Scene"}:</strong> ${escape(d.scenes.find((s) => s.id === h.nodeId).title)}</p><p><strong>${locale === "pl" ? "Ujawnienie" : "Reveal"}:</strong> ${escape(h.reveal.action)}</p><p>${escape(h.reveal.checks.join(", "))} ${escape(h.reveal.requires.join(", "))}</p><small>${locale === "pl" ? "Źródło, strony drukowane" : "Source, printed pages"}: ${h.sourcePages.join(", ")}</small>${h.illustration ? `<details><summary>${locale === "pl" ? "Zachowana ilustracja pomocnicza" : "Retained supporting illustration"}</summary><img class="document" alt="${escape(h.title)}" src="${imageData(h.illustration)}"/></details>` : ""}</article>`,
    )
    .join("");
  const sceneCards = d.scenes
    .map(
      (s) =>
        `<article data-testid="scene-card"><h3>${escape(s.title)}</h3><p>${escape(s.entry)}</p><p>${escape(s.atmosphere)}</p><p>${escape(s.actions.join("\n"))}</p><p><strong>${locale === "pl" ? "Reżyseria" : "Direction"}:</strong> ${escape(s.director)}</p>${s.checks.map((c) => `<details><summary>${escape(c.test)}</summary><p>${escape(c.success)}</p><p>${escape(c.failure)}</p>${c.pushedFailure ? `<p>${escape(c.pushedFailure)}</p>` : ""}</details>`).join("")}<p>${s.handoutSlugs.map((id) => `<a href="#${escape(id)}">${escape(d.handouts.find((h) => h.slug === id).title)}</a>`).join(" · ")}</p></article>`,
    )
    .join("");
  const statusLabels =
    locale === "pl"
      ? {
          needs_review: "do sprawdzenia",
          replace: "do wymiany",
          missing: "brak nagrania",
        }
      : {
          needs_review: "needs review",
          replace: "replace",
          missing: "recording missing",
        };
  const audioCards = d.audio
    .map(
      (a) =>
        `<article data-testid="audio-card"><h3>${escape(a.id)} - ${escape(statusLabels[a.status])}</h3><p>${escape(a.trigger)}</p><p>${escape(a.scripts[locale])}</p><small>${escape(a.notes)}</small></article>`,
    )
    .join("");
  const allRooms = [
    "G1",
    "G2",
    "G3",
    "G4",
    "G5",
    "G6",
    "U1",
    "U2",
    "U3",
    "U4",
    "B1",
    "B2",
    "B3",
    "B4",
  ];
  const labels =
    locale === "pl"
      ? [
          "Handouty",
          "Sceny i reżyseria",
          "Obsada",
          "Plan domu",
          "Mechanika i zakończenia",
          "Audio",
        ]
      : [
          "Handouts",
          "Scenes and direction",
          "Cast",
          "House map",
          "Mechanics and endings",
          "Audio",
        ];
  const css = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#17140f;color:#eee3cd;font:18px/1.6 Georgia,serif}header,main{max-width:1100px;margin:auto;padding:28px}header{border-bottom:1px solid #a48748}a{color:#e1c778}nav{display:flex;gap:16px;flex-wrap:wrap}article{background:#211d17;border:1px solid #705d3b;margin:26px 0;padding:26px}h1,h2,h3{line-height:1.3;color:#e1c778}h1{font-size:40px}h2{margin-top:60px}.document{display:block;width:100%;height:auto;max-height:none;margin:20px auto}.portrait{width:160px;height:auto;float:right;margin:0 0 15px 20px}.transcript{white-space:pre-wrap}small{color:#c4b79f}.pending{padding:16px;background:#3a2d18;border-left:4px solid #d8b566}details{margin:12px 0}summary{cursor:pointer}section{scroll-margin-top:30px}.map{max-width:650px}button{padding:12px;background:#292117;color:#e1c778;border:1px solid #ad9155}@media(max-width:600px){header,main{padding:16px}article{padding:16px}h1{font-size:28px}}`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${heading}</title><style>${css}</style></head><body><header><h1>${heading}</h1><p class="pending" data-testid="approval-status">${pending}</p>%%HANDOUT_ARTWORK_APPROVAL%%<nav><a href="../pl/index.html">Polski</a><a href="../en/index.html">English</a>${labels.map((label, i) => `<a href="#section-${i}">${label}</a>`).join("")}</nav></header><main><section id="section-0"><h2>${labels[0]}</h2>${cards}</section><section id="section-1"><h2>${labels[1]}</h2>${sceneCards}</section><section id="section-2"><h2>${labels[2]}</h2>${d.actors.map((a) => `<article data-testid="actor-card">${a.portrait ? `<img class="portrait" src="${imageData(a.portrait)}" alt="${escape(a.name)}"/>` : ""}<h3>${escape(a.name)}</h3><p>${escape(a.description)}</p><p>${escape(a.behaviour)}</p>${!a.portrait ? `<p>${locale === "pl" ? "Brak dedykowanego portretu; w aplikacji inicjały." : "No dedicated portrait; use initials in the application."}</p>` : ""}${a.stats ? `<small>${escape(a.stats)}</small>` : ""}</article>`).join("")}</section><section id="section-3"><h2>${labels[3]}</h2><p>${locale === "pl" ? "Rzut schematyczny, bez skali architektonicznej. Widok gracza zawiera tylko odkryte pomieszczenia." : "Schematic plan, without architectural scale. The player view contains explored rooms only."}</p><h3>${locale === "pl" ? "Przykładowy widok gracza: G3 i B1" : "Example player view: G3 and B1"}</h3><img class="document map" alt="${locale === "pl" ? "Odkryte pomieszczenia" : "Explored rooms"}" src="${hauntingMapImage(locale, ["G3", "B1"])}"/><details><summary>${locale === "pl" ? "Pełny schemat - wyłącznie Strażnik" : "Complete schematic - Keeper only"}</summary><img class="document map" alt="Keeper" src="${hauntingMapImage(locale, allRooms)}"/></details>${d.rooms.map((r) => `<details><summary>${escape(r.id)}</summary><p>${escape(r.description)}</p><small>${r.sourcePages.join(", ")}</small></details>`).join("")}</section><section id="section-4"><h2>${labels[4]}</h2>${d.rules.map((r) => `<article><h3>${escape(r.id)}</h3><p>${escape(r.text)}</p><small>${r.sourcePages.join(", ")}</small></article>`).join("")}${d.endings.map((e) => `<article><h3>${escape(e.id)}</h3><p>${escape(e.condition)}</p><p>${escape(e.consequence)}</p></article>`).join("")}<aside class="pending">${d.unresolved.map((u) => escape(u.description)).join("<br>")}</aside></section><section id="section-5"><h2>${labels[5]}</h2><p>${locale === "pl" ? "Brak automatycznych zgód na produkcję. Skrypty są propozycjami do odbioru." : "No automatic production approvals. Scripts are proposals for review."}</p>${audioCards}<a href="../audio-budget.json">${locale === "pl" ? "Kosztorys i jednostki" : "Budget and units"}</a></section></main></body></html>`;
  write(path.join(base, "index.html"), html);
  editions.push({
    locale,
    records: records.length,
    handouts: rows.length,
    scenes: d.scenes.length,
    actors: d.actors.length,
    snapshot: fingerprint,
  });
}
const visualApproval = readHandoutArtworkApproval(out);
for (const locale of ["pl", "en"]) {
  const status =
    locale === "pl"
      ? {
          approved: "Oprawa handoutów: zatwierdzona przez autora.",
          stale:
            "Oprawa handoutów: materiały zmieniono po akceptacji; wymagają ponownego odbioru.",
          pending: "Oprawa handoutów: oczekuje na odbiór.",
        }
      : {
          approved: "Handout artwork: approved by the author.",
          stale: "Handout artwork: changed after acceptance; review required.",
          pending: "Handout artwork: pending review.",
        };
  const file = path.join(out, locale, "index.html");
  const html = fs.readFileSync(file, "utf8");
  write(
    file,
    html.replace(
      "%%HANDOUT_ARTWORK_APPROVAL%%",
      `<p data-testid="artwork-approval-status">${escape(status[visualApproval.status])}</p>`,
    ),
  );
}
const audio = getHauntingDossier("pl").audio;
const speech = audio.filter((a) =>
  ["briefing", "reading", "performance"].includes(a.kind),
);
const characters = speech.reduce(
  (sum, a) => sum + a.scripts.pl.length + a.scripts.en.length,
  0,
);
const soundSeconds = audio
  .filter((a) => ["sfx", "ambience"].includes(a.kind))
  .reduce((sum, a) => sum + a.seconds, 0);
const oneTake = (characters / 1000) * 0.08 + (soundSeconds / 60) * 0.12;
json(path.join(out, "audio-budget.json"), {
  status: "pending_separate_production_approval",
  generatedFiles: 0,
  charactersPLAndEN: characters,
  soundSeconds,
  estimateUSD: {
    oneTake: Number(oneTake.toFixed(2)),
    threeTakes: Number((oneTake * 3).toFixed(2)),
    includesTaxes: false,
  },
  pricing: {
    checkedDate: "2026-10-31",
    source: "https://elevenlabs.io/pricing/api",
    speechModel: "v3",
    usdPer1000Characters: 0.08,
    soundEffectsUSDPerMinute: 0.12,
  },
  assumptions: [
    "Replace both briefings for a consistent approved transcript.",
    "Shared language-neutral ambience and SFX are generated once.",
    "Three takes are an estimate, not spend authorization.",
    "Workspace subscription, voice surcharges and production availability are unverified.",
    "Final generation requires a separately approved quote and scripts.",
  ],
  audio,
});
json(path.join(out, "manifest.json"), {
  schemaVersion: 1,
  approval: "pending",
  reviewDomains: {
    handoutArtwork: visualApproval,
    sceneContent: "pending",
    runtimeIntegration: "pending",
    audioProduction: "pending",
    gameplay: "not_run",
  },
  sourceVerified: sourceHash !== null,
  sourceHash: sourceHash || getHauntingDossier("pl").source.sha256,
  editions,
  gameplayTested: false,
  audioProduced: false,
});
write(
  path.join(out, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>Starter review</title><h1>Starter - odbiór / review</h1><p><a href="pl/index.html">Polski</a> · <a href="en/index.html">English</a></p>',
);
console.log(
  JSON.stringify({
    output: out,
    editions,
    characters,
    soundSeconds,
    oneTakeUSD: Number(oneTake.toFixed(2)),
    approval: "pending",
  }),
);
