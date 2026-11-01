import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHandoutArtworkApproval } from "./starter-approval.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const require = createRequire(
  path.join(root, "_tester/_base/.silnik/package.json"),
);
const { chromium } = require("playwright");
const output = path.join(root, ".local-playtest/starter-dossier");
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const locale of ["pl", "en"]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const requests = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    await page.goto(
      pathToFileURL(path.join(output, locale, "index.html")).href,
    );
    await page
      .locator("img")
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
    assert.equal(await page.getByTestId("handout-card").count(), 14);
    assert.equal(await page.getByTestId("scene-card").count(), 14);
    assert.equal(await page.getByTestId("actor-card").count(), 8);
    assert.equal(await page.getByTestId("audio-card").count(), 10);
    assert.match(
      await page.getByTestId("approval-status").innerText(),
      locale === "pl" ? /Oczekuje na odbiór autora/ : /Pending author review/,
    );
    if (readHandoutArtworkApproval(output).status === "approved") {
      assert.match(
        await page.getByTestId("artwork-approval-status").innerText(),
        locale === "pl"
          ? /zatwierdzona przez autora/
          : /approved by the author/,
      );
    }
    const glossary =
      locale === "pl"
        ? ["Zlecenie Knotta", "Brak wyroku w rejestrze", "Sąd i policja"]
        : [
            "Knott’s commission",
            "No verdict on record",
            "Courthouse and police",
          ];
    for (const word of glossary)
      assert.ok((await page.locator("body").innerText()).includes(word));
    for (const [id, name] of [
      ["clue-02-boston-globe-1918", "article"],
      ["clue-05-obituary-1866", "obituary"],
      ["clue-08-cult-symbol-sketch", "symbol"],
    ]) {
      const card = page.locator("#" + id);
      await card.screenshot({
        path: path.join(output, `${name}-${locale}.png`),
      });
      const imageText = await card
        .locator("img.document")
        .first()
        .getAttribute("src");
      const transcript = await card.locator(".transcript").innerText();
      const svg = decodeURIComponent(imageText.split(",").slice(1).join(","));
      assert.ok(
        transcript
          .split(/\s+/)
          .every((word) =>
            svg.includes(
              word
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;"),
            ),
          ),
      );
    }
    await page
      .locator("header")
      .screenshot({ path: path.join(output, `review-${locale}.png`) });
    await page.setViewportSize({ width: 820, height: 1000 });
    await page
      .locator("#clue-06-missing-court-verdict")
      .screenshot({ path: path.join(output, `missing-verdict-${locale}.png`) });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "horizontal overflow",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    report.push({
      locale,
      handouts: 14,
      scenes: 14,
      actors: 8,
      audioBriefs: 10,
      consoleErrors: errors,
      externalRequests: requests,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(output, "render-report.json"),
  JSON.stringify({ gameStarted: false, report }, null, 2) + "\n",
);
console.log(JSON.stringify(report));
