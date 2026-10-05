// Mock adapter for UI-1: no @tauri-apps/* imports here (Spike rule).
// Real adapter (dialog+fs) is wired after Linux CI is green.
import type { PlatformAdapter } from "../platform/adapter.js";
import tela1080 from "../../../../assets/samples/tela-1080p-theme.txt?raw";

export const mockAdapter: PlatformAdapter = {
  async openThemeFile() {
    return { name: "tela-1080p-theme.txt", data: new TextEncoder().encode(tela1080).buffer as ArrayBuffer };
  },
  async openThemeDir() {
    return null; // degraded: Web without directory picker
  },
  async saveZip(_data, suggestedName) {
    console.info(`[mock] saveZip skipped: ${suggestedName} (${_data.length} bytes)`);
  },
  async hasNativeFont() {
    return false;
  },
  async hasTruePreview() {
    return false;
  },
};

export { tela1080 };
