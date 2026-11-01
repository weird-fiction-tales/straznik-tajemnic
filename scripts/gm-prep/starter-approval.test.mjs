import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  captureHandoutArtwork,
  inspectHandoutArtworkApproval,
} from "./starter-approval.mjs";

test("visual acceptance does not grant content/audio acceptance and becomes stale after changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "starter-approval-"));
  try {
    for (const locale of ["pl", "en"]) {
      fs.mkdirSync(path.join(dir, locale, "preparation"), { recursive: true });
      fs.mkdirSync(path.join(dir, locale, "handouts"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, locale, "preparation/handout-bindings.json"),
        JSON.stringify([{ material: "aid-one", text: "Verified text" }]),
      );
      fs.writeFileSync(
        path.join(dir, locale, "handouts/aid-one.webp"),
        "image-one",
      );
    }
    const snapshot = captureHandoutArtwork(dir);
    const receipt = {
      schemaVersion: 1,
      domain: "handout-artwork",
      decision: "approved",
      approvedBy: "Author",
      approvedAt: "2026-10-31T17:30:00.000Z",
      evidence: "jest ok",
      snapshot,
    };
    assert.equal(
      inspectHandoutArtworkApproval(dir, receipt).status,
      "approved",
    );
    assert.equal(receipt.audioProduction, undefined);
    fs.writeFileSync(path.join(dir, "pl/handouts/aid-one.webp"), "image-two");
    assert.equal(inspectHandoutArtworkApproval(dir, receipt).status, "stale");
    fs.writeFileSync(path.join(dir, "pl/handouts/aid-one.webp"), "image-one");
    fs.writeFileSync(
      path.join(dir, "en/preparation/handout-bindings.json"),
      JSON.stringify([{ material: "aid-one", text: "Changed text" }]),
    );
    assert.equal(inspectHandoutArtworkApproval(dir, receipt).status, "stale");
    fs.unlinkSync(path.join(dir, "pl/handouts/aid-one.webp"));
    assert.equal(inspectHandoutArtworkApproval(dir, receipt).status, "stale");
    assert.equal(inspectHandoutArtworkApproval(dir, null).status, "pending");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
