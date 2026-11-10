# CL-UX-41 — independent UI/language review of `70935b0..7397b6a` (report only)

Session **CL-UX41-20261110-01** (Claude, cloud sandbox). Receipt: [receipt.md](./receipt.md), committed 4d81c32 before this
report. Source **`codex/hosted-38` 7397b6a954dbe877e425abd09abd125398c271c4** (no descendant used). Docs
**`codex/project-operations` d43ef90**. Branch `codex/cl-ux-41-claude-20261110` contains **only** `docs/reports/claude/cl-ux-41/**`.
No app or test files were edited. No deploy, migration, cloud SQL, credentials, worker, Qwen flag or GPU work.

**Verdict:** no blocker. One visible non-English string remains (F1). One conditional hero contrast risk on narrow
screens (F2) needs a check with the real photo. The rest are low-severity wording, plural and consistency issues.
Raw enums, option `value`s, worker, SQL and data are unchanged by the diff (all option `value=` attributes in the
diff are unchanged; only labels changed). I found no behaviour change caused by the text changes, and all
browser locators resolve to real UI text.

## 1. Evidence

| Check | Kind | Result | Log |
|---|---|---|---|
| Unicode scan of `src/`, `public/` for Vietnamese letters | static | only `recommend.ts` colour **aliases** (input matching, OK) + a stale comment (F11) | — |
| Scan for diacritic-free Vietnamese | static | **`Theo quiz`** (F1) | — |
| Every `getByText/Label/Role name` string in `scripts/test-*.mjs` exists in `src/` | static | all resolve; unresolved ones are fixture data names or composed accessible names | — |
| `npm test` | executed | 119/119 PASS | [npm-test.log](./logs/npm-test.log) |
| `npm run lint` | executed | exit 0 | [lint.log](./logs/lint.log) |
| `next build --webpack` + local Google-font mock | executed | exit 0 (Turbopack/fonts blocked in this sandbox) | [build.log](./logs/build.log) |
| `npm run test:studio` | executed | exit 0 | [test-studio.log](./logs/test-studio.log) |
| `npm run test:v2` (full SQL/HTTP/browser, CPU mock) | executed | exit 0, 15 PASS blocks | [test-v2.log](./logs/test-v2.log) |
| Home + 404 at 320/390/820/1440 px: `lang`, horizontal overflow, first Tab, hero caption vs content overlap, axe-core 4.10.3 (wcag2a/aa, 21aa, best-practice) | executed (local `next start`, no backend) | `lang=en`; no overflow; first Tab = "Skip to main content"; caption never overlaps the CTA/lock line; **home 0 axe violations**; 404: `landmark-one-main`, `region` (F9) | [home-check.json](./logs/home-check.json) |
| Hero text contrast with a **bright stand-in image** (real Unsplash photo blocked here) | executed, worst case | F2 | [hero-contrast-bright-standin.txt](./logs/hero-contrast-bright-standin.txt) |

Environment: Node 22.23.4; Playwright 1.64.1 using headless shell 1243 aliased as 1248; local `postgres:16/17-alpine`
stand-in images (Docker Hub blocked); `images.unsplash.com` blocked, so the real hero photo was not rendered.
Codex's own reference-environment run of `test:v2` remains the authoritative one.

## 2. Findings (most severe first)

### F1 — Medium — Vietnamese text still visible on Looks
- **File:** `src/app/looks/page.tsx:144`: `<option value="">Theo quiz</option>` (default option of the Occasion select).
- **Repro:** open `/looks` signed in. The select shows "Theo quiz" by default (see the `v2-looks-desktop.png` screenshot from `test:v2`).
- **Expected:** English only. **Actual:** Vietnamese, without diacritics, so a Unicode scan misses it.
- **Proposal:** "From your quiz" (or "Use my quiz answer"). Related low issue: the same `daily` value reads "Every day" in
  `quiz/page.tsx:246` but "Everyday" in `looks/page.tsx:145`. Use one wording.

### F2 — Medium (conditional) — Hero text over the image can lose contrast on ≤820 px
- **File:** `src/app/page.tsx` hero overlay: `bg-gradient-to-r from-black/90 via-black/65 to-black/20` plus the vertical gradient.
- **Why:** the horizontal gradient protects only the left part. On phones and tablets the text runs almost the full width,
  so line ends sit over 20–35 % black. The overlay only helps where the photo is dark.
- **Test (stand-in bright image, worst pixel inside each text box):**
  - At 390 px: paragraph ~2.0:1, eyebrow (`text-orange-200`) ~2.3:1, h1 ~2.5:1.
  - At 1440 px: everything ≥6:1.
  - The screenshot `home-bright-390` shows line ends ("fitting", "style.") over a light area.
- **Limit:** the production photo is a dark coat, so the real risk may be small. It depends on what `object-[62%_center]`
  shows on mobile. **Verify at 390 px on the live site** with the real photo.
- **Proposal:** below `lg`, add a stronger uniform layer (e.g. `bg-black/55`, or a gradient ending at `/60` instead of `/20`), or a
  subtle `text-shadow`. Keep the current desktop look.

### F3 — Low — Plurals for count 1
- `src/app/wardrobe/page.tsx:301` "(1 items)". Seen in `qint-review.png`.
- `src/components/studio/Studio.tsx:346` "Avatar opened · 1 tops and 0 bottoms…". Seen in `v2-cloud-studio.png`.
- `src/components/v2/AvatarDraft.tsx:44` "Canceled 1 jobs using them."
- **Proposal:** a small `plural(n, "item")` helper or `Intl.PluralRules("en")`. Tests that assert these strings would need the matching text.

### F4 — Low — Pattern field label
- `src/app/wardrobe/page.tsx:746` labels a single-value field "Patterns".
- `src/components/v2/WardrobeAnalysis.tsx:299-300`: the visible label is "Pattern", but `aria-label="Patterns"` overrides the wrapping label.
  This is inconsistent; "label in name" still passes only because one is a substring of the other.
- **Proposal:** use "Pattern" in both places and drop the redundant `aria-label` (the wrapping `<label>` already names the select).
  Update `scripts/test-qwen-http.mjs:187` (`getByLabel("Patterns")`) in the same change.

### F5 — Low — One page, three names
- `/looks` is "Ideas & saved looks" in `Navbar`, "Outfit suggestions" in `WorkspaceNav`/`Footer`, and the Studio notice says
  "Reopen it from Ideas & saved looks".
- **Proposal:** pick one label and use it in nav, footer, workspace pills and notices.

### F6 — Low — Ambiguous feedback button
- `src/app/looks/page.tsx:431`: "My style" (an `aria-pressed` toggle meaning "this matches my taste").
- **Proposal:** "Matches my style" or "More like this", so the pressed state reads correctly in a screen reader.

### F7 — Low — Repeated wording in the analysis failure state
- `WardrobeAnalysis.tsx`: the canceled state reads "Analysis canceled. You canceled this analysis. You can still edit item details manually."
- **Proposal:** omit the `CANCELED` detail when the state is already "canceled", or reword it.

### F8 — Low — Recommendation reason fragments start with spaces
- `src/lib/v2/recommend.ts:169-172`: fragments begin with a space and are then joined with `"; "`. The raw string contains double spaces
  ("style;  includes a favorite color"). HTML collapses them on screen, but exports, `title` attributes or future tests would not.
- **Proposal:** remove the leading spaces.

### F9 — Low (pre-existing structure, copy changed in this diff) — 404 page
- axe: `landmark-one-main`, `region` (`src/app/not-found.tsx` renders no `<main>`).
- The new copy "This page is not here yet." implies the page is coming.
- **Proposal:** wrap the content in `<main>`, and say "This page doesn't exist."

### F10 — Low — Filter chips break mid-word on desktop
- Wardrobe filter chips wrap as "T-/shirt" and "All/categories" at 1280 px (`qint-review.png`). The English labels are longer than the old ones.
- **Proposal:** `whitespace-nowrap` on the chips; the row already scrolls horizontally.

### F11 — Info — Stale comment
- `src/components/v2/WardrobeAnalysis.tsx:5` still names the button "Lưu vào tủ đồ". It is now "Save to wardrobe".

## 3. Areas reviewed with no finding

- **Auth/login and the legacy login:** wording is truthful ("Your wardrobe is still saved", "remain separate"). The password toggle has an accessible label.
  Server error strings in `src/app/api` were already English.
- **Legacy outfits/wardrobe:** null color/style guards and raw enum values are retained; the browser test still selects raw `jeans`/`minimal` values via the English labels.
- **Quiz:** step labels and options are English. Option keys are unchanged. The weather/fit disclaimer stays truthful ("do not currently affect garment scores").
- **Capture/Studio:** limits match the code (12 MB / 512 px / 150 MB video; wardrobe 10 MB before client compression to a 1200 px JPEG, under the server's 4 MB).
  Experimental, preset and "not a 3D render" labels are preserved. Draft avatars still say a draft does not confirm likeness.
- **Locators:** negative assertions are now meaningful.
  - The old Vietnamese check "Tủ đồ của bạn còn trống" never matched the old mixed headline ("Tủ đồ của bạn is empty"). The new check for "Your wardrobe is empty" matches the real headline, so it is now effective.
  - "Deleted from storage." and "Checking the processor…" exist in `src/`.
  - `getByLabel(/Style/i)` does not collide with "Styling notes".

## 4. Not run / limits

- Live site not opened.
- The real hero photo was not rendered (Unsplash blocked).
- axe was not run on signed-in pages; they were checked visually from `test:v2` screenshots only.
- No physical mobile device or screen reader.
- Default Turbopack build not run here (Codex already ran it).

## 5. Process delta for Codex

```text
### L-0xx - 10/11/2026 - REVIEW - CL-UX41-20261110-01 / CL-UX-41
Claude read-only review of hosted-38 70935b0..7397b6a (source 7397b6a, docs d43ef90); report-only branch
codex/cl-ux-41-claude-20261110. No blocker. F1 Medium: looks/page.tsx:144 "Theo quiz" still Vietnamese (sent early).
F2 Medium-conditional: hero overlay weak on <=820px (bright stand-in ~2:1 paragraph), verify with real photo.
Low: plurals (1 items/1 tops/1 jobs), Pattern/Patterns label + test-qwen:187, /looks naming, "My style" toggle,
cancel wording, recommend double spaces, 404 no <main>/copy, filter chip wrapping, stale comment. Locators verified.
Executed: npm 119, lint, webpack+fontmock build, test:studio, full test:v2 exit0, axe home 0 violations (stand-in env).
No app edits/deploy/SQL/GPU.
```
