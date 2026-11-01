import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Capture exact visual files and their displayed text, independently of scene/audio acceptance. */
export function captureHandoutArtwork(directory) {
  const files = [];
  for (const locale of ["pl", "en"]) {
    const bindingPath = path.join(locale, "preparation/handout-bindings.json");
    const bytes = fs.readFileSync(path.join(directory, bindingPath));
    files.push({ path: bindingPath, sha256: hash(bytes) });
    const bindings = JSON.parse(bytes);
    if (!Array.isArray(bindings) || !bindings.length)
      throw Error("HANDOUT_BINDINGS_REQUIRED");
    for (const h of bindings) {
      if (!/^[a-z0-9-]+$/.test(h.material)) throw Error("INVALID_HANDOUT_ID");
      const imagePath = path.join(locale, "handouts", h.material + ".webp");
      files.push({
        path: imagePath,
        sha256: hash(fs.readFileSync(path.join(directory, imagePath))),
      });
    }
  }
  return { digest: hash(JSON.stringify(files)), files };
}

export function inspectHandoutArtworkApproval(directory, receipt) {
  if (!receipt) return { status: "pending" };
  if (
    receipt.schemaVersion !== 1 ||
    receipt.domain !== "handout-artwork" ||
    receipt.decision !== "approved" ||
    typeof receipt.approvedBy !== "string" ||
    !receipt.approvedBy.trim() ||
    !Number.isFinite(Date.parse(receipt.approvedAt)) ||
    typeof receipt.evidence !== "string" ||
    !receipt.evidence.trim()
  )
    return { status: "stale", reason: "invalid_receipt" };
  try {
    const current = captureHandoutArtwork(directory);
    if (
      current.digest !== receipt.snapshot?.digest ||
      JSON.stringify(current.files) !== JSON.stringify(receipt.snapshot?.files)
    )
      return { status: "stale", reason: "materials_changed" };
    return {
      status: "approved",
      approvedBy: receipt.approvedBy,
      approvedAt: receipt.approvedAt,
      snapshot: current.digest,
    };
  } catch {
    return { status: "stale", reason: "materials_missing" };
  }
}

export function readHandoutArtworkApproval(directory) {
  const file = path.join(directory, "approvals/handout-artwork.json");
  if (!fs.existsSync(file)) return { status: "pending" };
  try {
    return inspectHandoutArtworkApproval(
      directory,
      JSON.parse(fs.readFileSync(file, "utf8")),
    );
  } catch {
    return { status: "stale", reason: "unreadable_receipt" };
  }
}
