# Spike Report (4 gates → V3.1 freeze)

- [x] Gate1-web: GREEN on Linux CI (pnpm 9.0.0 → install → core 13/13 →
  editor 13/13 → collect-fixtures bytes identical 1765/1008/1010 → vite build).
  `.gitattributes -text` proven cross-platform (Linux checkout == local bytes).
- [x] Gate1-Windows-desktop: `target/debug/editor.exe` produced 2026-10-05
  (`tauri build --debug` full Rust link OK). Lesson: `tauri-build` demands
  `src-tauri/icons/icon.ico` even with `bundle.active:false` — placeholder icons
  generated via `scripts/make-icons.py` (stdlib-only); real branding before V3.1 freeze.
- [x] Gate1-Linux-desktop: GREEN round-4 — `--verify` passed in CI, frontend build OK,
  full Rust link OK (`Finished dev profile in 1m26s`, `Built application at:
  .../src-tauri/target/debug/editor`). RGBA icon accepted by `generate_context!`.
  tauri-action notes "No artifacts found…not an error" (expected: bundle.active:false).
  Zero `##[error]` in either job.
- Icon asymmetry tally (3): (1) missing icon.ico despite active:false,
  (2) RGB .ico tolerated on Windows link, (3) non-RGBA .png rejected on Linux macro.
  Lesson locked: `bundle.active:false` skips packaging, NEVER icon validation.
  Eliminated going forward by the CI `--verify` step (fails in seconds).
  beforeBuildCommand uses `pnpm --filter editor ...` (cwd-safe in monorepo).
- [x] UI-1 (frontend-only, mock adapter — no @tauri-apps/* imports): text-only store
  (zustand+zundo temporal, limit 50; CST/semantic derived, never stored) +
  Monaco grub-theme language (highlight/completion/brace markers) + RHF+zod 4-attr
  form (left/top/width/height → CSTPatch) + executeEdits sync (no setValue) +
  DPR-1.0 preview with resolution switch. Real adapter after CI green.
- Bundle note (TEMPORARY, Spike only): `bundle.active:false` (compile-only) + placeholder
  icons from `scripts/make-icons.py` (stdlib-only, must NOT be mistaken for release assets;
  `apps/editor/src-tauri/icons/*` pinned `binary` in `.gitattributes`). V3.1 freeze checklist:
  real `icon.ico/icon.png/icon.icns` + `active:true` + bundle pass on Win/Linux (/macOS if targeted).
- fs/dialog: `fs:allow-read-file/write-file/read-dir` + `dialog:allow-open/save` minimal.
  Whether dialog-picked paths outside $APPDIR auto-extend fs scope (plugin-fs × plugin-dialog
  linkage) is UNVERIFIED — e2e (dialog-pick outside $APPDIR → fs-read) tracked for UI-1 (needs WebDriver).
- shell scope (Spike: interface only, NOT executable — no promise that convertFont/
  truePreview run inside Spike):
  - BLOCKER for V1.1: `grub-mkfont -o/--output/-s/-n/...` full conversion args need a
    second explicit scope entry, otherwise Linux `convertFont()` is rejected by Tauri at runtime.
  - BLOCKER for V1.1: `grub2-theme-preview` upstream is a script — scope matching against
    the interpreter path (`bash`/`sh`) vs the script path must be resolved then (likely add
    interpreter to scope or ship a sidecar binary). Spike conclusion: adapter keeps
    `convertFont?/truePreview?` signatures only.
- [x] Gate2-A: tela-1080p / tela-4k / archlinux byte-identical via `Buffer.equals`
  (`pnpm --filter @grub-theme/core test`).
- [x] Gate2-B: existing-scalar / color-format / space-path-quoting / BOM / mixed-EOL pass;
  missing-scalar insert defined as +1 line; hunk ≤ target ±1 line.
- [x] Gate3-coverage: `derive()` stats — tela all top-level; archlinux yields
  `root.hbox[0].label[0..5]` (6 inline labels) + `root.circular_progress[0]` (two-line open).
  No silent empty-render: SemanticIndex recurses hbox/vbox with stable paths
  `root.<name>[i]` for UI-1. circular_progress collected as progress (MVP: passthrough render).
- [x] Gate3-measure: `apps/editor/test/gate3-measure.test.ts` 11/11 green.
  Baseline: SYNTHETIC fixture in-test (controlled; device screenshots deferred to V1.1).
  Colors exact (normalizeForCompare, sRGB 0 tol): #ff9248=(255,146,72),
  cornflowerblue=(100,149,237), "128, 128, 255", #111111=(17,17,17), #ffffff.
  | res | component | expected (x,y,w,h) | actual | diff | verdict |
  |---|---|---|---|---|---|
  | 1024x768 | boot_menu | 204.8,192,614.4,384 | identical | 0 | PASS |
  | 1024x768 | label | 100,50,200,30 | identical | 0 | PASS |
  | 1024x768 | image (100%-50) | 102.4,718,480,42 | identical | 0 | PASS |
  | 1024x768 | progress | 327.68,629.76,368.64,20 | identical | 0 | PASS |
  | 1920x1080 | boot_menu | 384,270,1152,540 | identical | 0 | PASS |
  | 1920x1080 | label | 100,50,200,30 | identical | 0 | PASS |
  | 1920x1080 | image | 192,1030,480,42 | identical | 0 | PASS |
  | 1920x1080 | progress | 614.4,885.6,691.2,20 | 885.5999… | 1e-13 (float64 repr) | PASS (explainable) |
  Text: soft gate only (center drift budget 5% width; vertical excluded).
  Pixel-level raster check (getImageData border color) deferred: needs node-canvas
  or browser; geometry+color math covers Spike.
- [x] Gate4-store: 10x monaco↔form alternation at store level green
  (`apps/editor/test/store-alternation.test.ts`): +1 version steps, sources alternate,
  exactly 10 history entries, undo restores snapshot[9] byte-exact.
- [ ] Gate4-full (mounted Monaco): pending manual/UI run. Echo-guard checklist
  (single form edit of `left` must satisfy ALL three):
  1. Monaco onChange fires ≤1 time for the executeEdits echo, and the resulting
     commit (if any) carries source=monaco only when the user actually typed
     (guard: applyingFormRef + debounce-cancel in SourcePane).
  2. Store version increments by exactly +1 (no jump/loop).
  3. zundo history grows by exactly +1 entry.
  All three → Gate4 true green.

## V3.1 freeze status
- [x] Gate1: web green ×2 rounds, Windows exe local, Linux binary on CI.
- [x] Gate2-A/B, [x] Gate3-measure, [x] Gate4-store.
- [ ] Gate4-full (manual echo-guard checklist — needs `pnpm dev` + browser).
- [ ] Freeze checklist #5 (fixture bytes — done via .gitattributes, proven equal),
  #6 (real icons + active:true + full scope + preview verdict — deferred to V1.1).
Spike gates effectively complete except the manual Gate4-full run.
