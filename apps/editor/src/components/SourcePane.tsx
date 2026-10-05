// Source pane: Monaco (grub-theme) + debounce + stale-parse guard.
// Rule: a form-driven executeEdits cancels the pending monaco debounce,
// so an older parse can never overwrite a newer form patch (no loop).
import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useThemeStore } from "../store/themeStore.js";
import { LANG, registerGrubTheme } from "../editor/grubThemeLanguage.js";

export function SourcePane() {
  const text = useThemeStore((s) => s.text);
  const source = useThemeStore((s) => s.source);
  const lastFormEdit = useThemeStore((s) => s.lastFormEdit);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingFormRef = useRef(false);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerGrubTheme(monaco);
  };

  const onChange = (value: string | undefined) => {
    if (applyingFormRef.current) return; // ignore echo of our own executeEdits
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      useThemeStore.getState().applyMonacoText(value ?? "");
    }, 300);
  };

  // Form → Monaco: surgical executeEdits (never setValue: preserves cursor/undo).
  useEffect(() => {
    if (source !== "form" || !lastFormEdit) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (debounceRef.current) clearTimeout(debounceRef.current); // cancel stale parse
    const model = editor.getModel();
    if (!model) return;
    applyingFormRef.current = true;
    try {
      editor.executeEdits("form-sync", [
        {
          range: {
            startLineNumber: lastFormEdit.line, startColumn: 1,
            endLineNumber: lastFormEdit.line, endColumn: model.getLineMaxColumn(lastFormEdit.line),
          },
          text: lastFormEdit.newLineText,
          forceMoveMarkers: true,
        },
      ]);
    } finally {
      applyingFormRef.current = false;
    }
  }, [source, lastFormEdit]);

  return (
    <Editor
      height="100%"
      language={LANG}
      value={text}
      onMount={handleMount}
      onChange={onChange}
      options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
    />
  );
}
