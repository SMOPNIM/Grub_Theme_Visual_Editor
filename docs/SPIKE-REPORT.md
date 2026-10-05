# Spike Report (4 gates → V3.1 freeze)

- [x] Gate1-web: `pnpm --filter editor build` green (local Win + CI).
- [x] Gate1-Windows-desktop: `target/debug/editor.exe` produced 2026-10-05
  (`tauri build --debug` full Rust link OK). Lesson: `tauri-build` demands
  `src-tauri/icons/icon.ico` even with `bundle.active:false` — placeholder icons
  generated via `scripts/make-icons.py` (stdlib-only); real branding before V3.1 freeze.
- [ ] Gate1-Linux-desktop: CI job defined (webkit2gtk-4.1/gtk3/ayatana/librsvg2/patchelf +
  rust-cache + `grub-common` for the `grub-mkfont --version` real-call smoke); awaits first green run.
- Bundle note: Spike keeps `bundle.active:false` (compile-only). V3.1 freeze REQUIRES
  flipping back to `true` + real icons, else vertical slice reworks packaging.
- fs/dialog: `fs:allow-read-file/write-file/read-dir` + `dialog:allow-open/save` minimal.
  Whether dialog-picked paths outside $APPDIR auto-extend fs scope (plugin-fs × plugin-dialog
  linkage) is UNVERIFIED — e2e (dialog-pick outside $APPDIR → fs-read) tracked for UI-1 (needs WebDriver).
- shell scope: explicit-args only in Spike (`grub-mkfont --version`, `grub2-theme-preview --help`).
  Full conversion args (`-o/--output/-s/...`) get a second scope entry at vertical slice.
  `grub2-theme-preview` upstream is a script — interpreter-path scope matching verified then, not now.
- [x] Gate2-A: tela-1080p / tela-4k / archlinux byte-identical via `Buffer.equals`
  (`pnpm --filter @grub-theme/core test`).
- [x] Gate2-B: existing-scalar / color-format / space-path-quoting / BOM / mixed-EOL pass;
  missing-scalar insert defined as +1 line; hunk ≤ target ±1 line.
- [x] Gate3-coverage: `derive()` stats — tela all top-level; archlinux yields
  `root.hbox[0].label[0..5]` (6 inline labels) + `root.circular_progress[0]` (two-line open).
  No silent empty-render: SemanticIndex recurses hbox/vbox with stable paths
  `root.<name>[i]` for UI-1. circular_progress collected as progress (MVP: passthrough render).
- [ ] Gate3-measure: 4 components color exact (sRGB 0 tol; compare-channel accepts
  #RGBA/#RRGGBBAA/rgba()/transparent, serialize-channel is GRUB-native only via
  `normalizeForSerialize`, exporter warns on simulation-only) + geometric bbox ≤2px/1%
  @1024x768/1920x1080 with `setupCanvas` DPR=1.0; text soft-gate horizontal-center ≤5% width
  (vertical excluded).
- [ ] Gate4: 10x monaco↔form alternation, no loop, undo not double-counted — 🔒 LOCKED
  until UI-1 (Monaco mounted + form edits left/top/width/height + zundo wired).

## V3.1 freeze criteria
1. Gate1 CI green (web + linux-tauri; Windows exe produced locally).
2. Gate2-A 3 real themes byte-identical; Gate2-B 5 classes pass.
3. Gate3 color exact + geometric bbox pass; text explainable.
4. Gate4 10x alternation pass (after UI-1 unlock).
All four → freeze V3.1 → vertical slice. Any fail → fix that layer only, no scope creep.
