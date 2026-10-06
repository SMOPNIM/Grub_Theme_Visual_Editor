// Source pane: Monaco UNCONTROLLED (defaultValue) + explicit sync.
// - monaco -> store: debounced applyMonacoText (300ms); a form-driven executeEdits
//   cancels the pending debounce, so a stale parse never overwrites a fresh patch.
// - store -> monaco, two explicit paths only (never setValue-on-every-render):
//   a) source==='form' && versioned lastFormEdit matches: surgical executeEdits at the
//      CURRENT CST range (re-parsed live by nodeId — never a cached range, rows drift).
//      Consumed immediately (consumeFormEdit) so import/undo can't replay it.
//   b) source==='import' | 'history': wholesale setValue (file load / undo-redo;
//      cursor reset is accepted semantics there).
import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useThemeStore, selectCst } from "../store/themeStore.js";
import { LANG, registerGrubTheme } from "../editor/grubThemeLanguage.js";

export function SourcePane() {
  const text = useThemeStore((s) => s.text);
  const source = useThemeStore((s) => s.source);
  const version = useThemeStore((s) => s.version);
  const lastFormEdit = useThemeStore((s) => s.lastFormEdit);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingFormRef = useRef(false);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    registerGrubTheme(monaco);
    // Mount backfill: defaultValue is "" — never leave a stale/empty model behind
    // when the store already holds a theme (StrictMode remount included).
    const cur = useThemeStore.getState();
    if (cur.text && editor.getModel()?.getValue() !== cur.text) {
      editor.executeEdits("mount-sync", [
        {
          range: editor.getModel()!.getFullModelRange(),
          text: cur.text,
          forceMoveMarkers: true,
        },
      ]);
    }
  };

  const onChange = (value: string | undefined) => {
    if (applyingFormRef.current) return; // echo of our own executeEdits — ignore
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      useThemeStore.getState().applyMonacoText(value ?? "");
    }, 300);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    // Belt-and-braces: any non-form source invalidates a pending form sync
    // (e.g. undo() without an immediate markHistorySync must never replay it).
    if (source !== "form" && lastFormEdit) {
      useThemeStore.getState().consumeFormEdit();
      return;
    }

    // Path (a): versioned, consume-once surgical edit.
    if (source === "form" && lastFormEdit && lastFormEdit.version === version) {
      if (debounceRef.current) clearTimeout(debounceRef.current); // cancel stale parse
      useThemeStore.getState().consumeFormEdit();
      applyingFormRef.current = true;
      try {
        if (lastFormEdit.op === "remove") {
          // Structural delete in PRE-edit model coordinates: drop the whole line
          // and park the cursor at the deletion point (cursor must move — the line
          // it sat on is gone).
          const line = Math.min(lastFormEdit.line, model.getLineCount());
          if (line > 0) {
            const nextLine = Math.min(line + 1, model.getLineCount());
            editor.executeEdits("form-remove", [
              {
                range: {
                  startLineNumber: line, startColumn: 1,
                  endLineNumber: nextLine,
                  endColumn: nextLine > line ? 1 : model.getLineMaxColumn(line),
                },
                text: "",
                forceMoveMarkers: true,
              },
            ]);
            editor.setPosition({ lineNumber: Math.min(line, model.getLineCount()), column: 1 });
          }
          return;
        }
        // Live range: re-parse CURRENT text; cached rows may have drifted.
        // Full-line replace is correct even when several props share one line
        // (single-line components): the replacement spans the whole line.
        const cst = selectCst(useThemeStore.getState().text);
        let line = 0;
        const walk = (nodes: any[]) => {
          for (const n of nodes) {
            if (n.nodeId === lastFormEdit.nodeId) {
              // Property node itself, or first property child of the component.
              const prop =
                n.kind === "property"
                  ? n
                  : n.children?.find((c: any) => c.kind === "property" && c.key === lastFormEdit.key);
              if (prop?.range) line = prop.range.start.line;
              return;
            }
            if (n.kind === "component") walk(n.children);
            if (line) return;
          }
        };
        walk(cst.children as any[]);
        if (line > 0) {
          const newLineText = useThemeStore.getState().text.split(/\r?\n/)[line - 1] ?? "";
          editor.executeEdits("form-sync", [
            {
              range: {
                startLineNumber: line, startColumn: 1,
                endLineNumber: line, endColumn: model.getLineMaxColumn(line),
              },
              text: newLineText,
              forceMoveMarkers: true,
            },
          ]);
        }
      } finally {
        applyingFormRef.current = false;
      }
      return;
    }

    // Path (b): wholesale restore. Guarded by inequality so focus/blur cycles
    // that change nothing never touch the model (no cursor jump, no echo).
    if ((source === "import" || source === "history") && model.getValue() !== text) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      applyingFormRef.current = true;
      try {
        editor.executeEdits("full-sync", [
          { range: model.getFullModelRange(), text, forceMoveMarkers: true },
        ]);
      } finally {
        applyingFormRef.current = false;
      }
    }
  }, [source, version, lastFormEdit, text]);

  return (
    <Editor
      height="100%"
      language={LANG}
      defaultValue=""
      onMount={handleMount}
      onChange={onChange}
      options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
    />
  );
}
