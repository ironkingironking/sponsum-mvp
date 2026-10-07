import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../public/sponsum");
const html = readFileSync(join(dir, "index.html"), "utf8");
const css = readFileSync(join(dir, "sponsum-desk.css"), "utf8");
const desk = readFileSync(join(dir, "sponsum-desk.js"), "utf8");

test("desk rail follows the Suite chrome: M mark, app name, «Zurück zur Suite» to the Work Hub", () => {
  assert.match(html, /<a class="sp-back" href="\/work-hub\/">Zurück zur Suite<\/a>/);
  assert.match(html, /<span class="sp-mark" aria-hidden="true">M<\/span><span>Sponsum<\/span>/);
  assert.doesNotMatch(html, /← Suite|>SP</);
});

test("narrow screens collapse the navigation behind «Menü» without page scroll", () => {
  assert.match(html, /class="sp-menu-toggle" aria-expanded="false" aria-controls="sp-nav">Menü</);
  assert.match(css, /\.sp-shell \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.sp-rail\.is-open nav \{/);
  assert.match(desk, /function setMenuOpen\(open\)/);
});

test("status badges are border badges with a symbol; deliberate rules are not red", () => {
  assert.doesNotMatch(css, /#d1fae5|#fef3c7|#fee2e2/);
  assert.match(css, /\.badge\.deny \{ border-color: #b8c1cc; color: var\(--muted\); \}/);
  assert.match(desk, /const BADGE_SYMBOLS = \{ ok: "●", warn: "▲", danger: "■", "": "○" \}/);
  assert.doesNotMatch(desk, /class="badge \$\{cls\}" title=/);
});

test("plain-language regulatory note and overdue due dates stay in place", () => {
  assert.doesNotMatch(desk, /Kein Escrow|Orderbuch|anteiligen Token/);
  assert.match(desk, /Sponsum verwahrt keine Kundengelder/);
  assert.match(desk, /\$\{overdue === 1 \? "Tag" : "Tage"\} überfällig/);
});
