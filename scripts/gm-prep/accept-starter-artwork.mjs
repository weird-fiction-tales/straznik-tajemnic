import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { captureHandoutArtwork } from "./starter-approval.mjs";

const value = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
};
const approvedBy = value("--approved-by"),
  evidence = value("--evidence");
if (!approvedBy?.trim() || !evidence?.trim())
  throw Error(
    "Explicit --approved-by and --evidence required; never infer approval",
  );
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dir = path.join(root, ".local-playtest/starter-dossier");
const receipt = {
  schemaVersion: 1,
  domain: "handout-artwork",
  decision: "approved",
  approvedBy,
  approvedAt: new Date().toISOString(),
  evidence,
  snapshot: captureHandoutArtwork(dir),
};
const file = path.join(dir, "approvals/handout-artwork.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
if (fs.existsSync(file)) {
  const previous = fs.readFileSync(file),
    id = createHash("sha256").update(previous).digest("hex");
  fs.mkdirSync(path.join(dir, "approvals/history"), { recursive: true });
  fs.writeFileSync(path.join(dir, "approvals/history", id + ".json"), previous);
}
fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify({
    file,
    domain: receipt.domain,
    decision: receipt.decision,
    files: receipt.snapshot.files.length,
  }),
);
