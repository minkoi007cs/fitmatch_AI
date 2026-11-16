import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisPanel, type AnalysisView } from "../src/components/v2/WardrobeAnalysis";

const base: AnalysisView = {
  id: "analysis", itemId: "item", state: "queued", errorCode: null, attempts: 0,
  resultSha256: null, result: null, confirmedFields: null,
};
const render = (analysis: AnalysisView, workerPaused = false) => renderToStaticMarkup(createElement(AnalysisPanel, {
  itemId: "item", itemName: "Test jacket", hasImage: true, analysis,
  workerOnline: false, workerPaused, onUpdate: () => {}, onWardrobeChanged: () => {},
}));

test("queued UI distinguishes paused processing from an unavailable connection", () => {
  assert.match(render(base, true), /AI processing is paused/);
  assert.doesNotMatch(render(base, true), /PC is offline|connection is unavailable/);
  assert.match(render(base), /connection is unavailable/);
  assert.match(render({ ...base, state: "running" }, true), /AI is analyzing/);
});

test("jacket proposal retains its selected category in human review", () => {
  const html = render({ ...base, state: "review", resultSha256: "c".repeat(64), result: {
    policyRevision: "qint.2", outcome: "proposal", abstainReason: null,
    attributes: { category: "jacket", dominantColors: ["black"], pattern: "solid", logoPresence: "not_visible", neckline: "other", sleeves: "long" },
    candidateLogoTexts: [], ocrStatus: "not_extracted",
  } });
  assert.match(html, /value="jacket" selected="">Jacket/);
  assert.match(html, /value="hoodie">Hoodie/);
  assert.match(html, /Save to wardrobe/);
  assert.match(html, /Nothing changes in your wardrobe/);
});

test("legacy abstention offers a new-policy analysis without fabricating a proposal", () => {
  const html = render({ ...base, state: "review", result: {
    policyRevision: "qint.1", outcome: "abstained", abstainReason: "unsupported_category",
    attributes: null, candidateLogoTexts: [], ocrStatus: "not_extracted",
  } });
  assert.match(html, /Analyze with updated AI/);
  assert.doesNotMatch(html, /Save to wardrobe/);
});

test("a canceled legacy analysis starts the updated policy instead of retrying qint.1", () => {
  const html = render({ ...base, state: "canceled", policyRevision: "qint.1" });
  assert.match(html, /Analyze with updated AI/);
  assert.doesNotMatch(html, />Retry</);
});
