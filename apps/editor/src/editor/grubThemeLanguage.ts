// grub-theme Monaco language: highlight + completion + brace diagnostics.
import type { Monaco } from "@monaco-editor/react";

export const LANG = "grub-theme";

const COMPONENTS = [
  "boot_menu", "label", "image", "progress_bar", "circular_progress",
  "hbox", "vbox", "styled_box",
];

const KEYS = [
  "title-text", "desktop-image", "desktop-color", "terminal-font", "terminal-box",
  "left", "top", "width", "height", "text", "color", "font", "align",
  "item_color", "selected_item_color", "item_font", "item_height", "item_spacing",
  "item_padding", "icon_width", "icon_height", "file", "id",
  "fg_color", "bg_color", "border_color", "text_color",
];

export function registerGrubTheme(monaco: Monaco): void {
  monaco.languages.register({ id: LANG, extensions: [".txt"] });
  monaco.languages.setMonarchTokensProvider(LANG, {
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/^(\s*)(\+\s*)([A-Za-z_][\w-]*)/, ["", "keyword", "type"]],
        [/[{}]/, "delimiter.bracket"],
        [/([A-Za-z_][\w-]*)(?=\s*[:=])/, "variable"],
        [/[:=]/, "operator"],
        [/"([^"]*)"/, "string"],
        [/'([^']*)'/, "string"],
        [/#[0-9a-fA-F]{3,8}\b/, "number.hex"],
        [/\b\d+(\.\d+)?%/, "number"],
        [/\b\d+\b/, "number"],
      ],
    },
  });
  monaco.languages.registerCompletionItemProvider(LANG, {
    provideCompletionItems: (
      model: import("monaco-editor").editor.ITextModel,
      position: import("monaco-editor").Position
    ) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const items = [...COMPONENTS, ...KEYS].map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: label,
        range,
      }));
      return { suggestions: items };
    },
  });
  // Diagnostics: unbalanced braces as model markers.
  const validate = (model: { getValue(): string; getLineCount(): number }) => {
    const text = model.getValue();
    let depth = 0;
    const markers: { severity: number; message: string; startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }[] = [];
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const ch of line) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth < 0) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: "Unbalanced closing brace",
          startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: line.length + 1,
        });
        depth = 0;
      }
    });
    if (depth > 0) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `${depth} unclosed block(s)`,
        startLineNumber: lines.length, startColumn: 1, endLineNumber: lines.length,
        endColumn: (lines[lines.length - 1]?.length ?? 0) + 1,
      });
    }
    monaco.editor.setModelMarkers(model as any, LANG, markers);
  };
  monaco.editor.onDidCreateModel((model: import("monaco-editor").editor.IModel) => {
    if (model.getLanguageId() !== LANG) return;
    validate(model as any);
    model.onDidChangeContent(() => validate(model as any));
  });
}
