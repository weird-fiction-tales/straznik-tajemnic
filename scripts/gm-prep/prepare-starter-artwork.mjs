import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const runtime = path.join(root, "_tester/_base/.silnik");
const require = createRequire(path.join(runtime, "package.json"));
const sharp = require("sharp");
const dir = path.join(root, ".local-playtest/starter-dossier/plates");
// A source checkout may omit the private source plates. Keep the frozen,
// already prepared artwork instead of silently replacing it with an empty map.
const frozenArtwork = path.join(runtime, "src/lib/adventures/starter-artwork.generated.ts");
if (!fs.existsSync(dir) && fs.existsSync(frozenArtwork)) {
  console.log("[starter] retaining existing prepared artwork; source plates unavailable");
  process.exit(0);
}
const artwork = {};
const manifest = [];
for (const name of ["report", "press", "legal", "journal", "obituary"]) {
  const source = path.join(dir, name + "-source.png");
  if (!fs.existsSync(source)) continue;
  const buffer = await sharp(source)
    .resize(1672, 941, { fit: "fill" })
    .webp({ quality: 88 })
    .toBuffer();
  fs.writeFileSync(path.join(dir, name + ".webp"), buffer);
  artwork[name] = "data:image/webp;base64," + buffer.toString("base64");
  manifest.push({
    id: name,
    source: name + "-source.png",
    output: name + ".webp",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    tool: "built-in image_gen",
    role: "photographic blank paper plate; verified text typeset separately",
    reference: "Prabuty playtest handout quality, adapted to Boston 1920",
    approval: "pending",
  });
}
const generated = path.join(
  runtime,
  "src/lib/adventures/starter-artwork.generated.ts",
);
fs.writeFileSync(
  generated,
  `// Local generated asset bytes. Never publish source plates without approval.\nexport const STARTER_ARTWORK: Record<string, string> = ${JSON.stringify(artwork)};\n`,
);
if (manifest.length)
  fs.writeFileSync(
    path.join(dir, "provenance.json"),
    JSON.stringify({ schemaVersion: 1, assets: manifest }, null, 2) + "\n",
  );
console.log(JSON.stringify({ photographicPlates: manifest.length, generated }));
