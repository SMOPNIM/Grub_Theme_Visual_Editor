// PlatformAdapter (V3 §6) — UI must not import @tauri-apps/* directly.

export interface ThemeFileData {
  name: string;
  data: ArrayBuffer;
}

export interface ThemeDirData {
  name: string;
  files: Array<{ path: string; data: ArrayBuffer }>;
}

export interface PlatformAdapter {
  openThemeFile(): Promise<ThemeFileData>;
  openThemeDir(): Promise<ThemeDirData | null>;
  saveZip(data: Uint8Array, suggestedName: string): Promise<void>;
  hasNativeFont(): Promise<boolean>;
  hasTruePreview(): Promise<boolean>;
  convertFont?(ttf: Uint8Array): Promise<Uint8Array>;
}

export const webAdapter: PlatformAdapter = {
  async openThemeFile() {
    // Web: file picker (theme.txt + multi-resource handled by caller)
    const [handle] = await (window as any).showOpenFilePicker?.() ?? [];
    throw new Error("Spike: wire file picker in UI; adapter surface frozen.");
  },
  async openThemeDir() {
    // Chromium dir picker; other browsers -> null (degraded)
    return null;
  },
  async saveZip(data, suggestedName) {
    const blob = new Blob([data as BlobPart], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  async hasNativeFont() { return false; },
  async hasTruePreview() { return false; },
};
