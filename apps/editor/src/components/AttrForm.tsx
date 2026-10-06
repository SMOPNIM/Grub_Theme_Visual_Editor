// Attribute form (PR3 geometry/text + PR4 color/font):
// boot_menu left/top/width/height, label text, colors (swatch+text),
// fonts (name+size split). Equality-first + short-circuit everywhere.
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useThemeStore, selectCst, selectSemantic } from "../store/themeStore.js";
import { ColorField, FontField } from "./Fields.js";

const layout = z.string().regex(/^(\d+(\.\d+)?%\s*(-\s*\d+(\.\d+)?(px)?)?|\d+(\.\d+)?(px)?)$/, "use %, px or pct-px (e.g. 20%, 300, 100%-50)");
const schema = z.object({
  left: layout.optional().or(z.literal("")),
  top: layout.optional().or(z.literal("")),
  width: layout.optional().or(z.literal("")),
  height: layout.optional().or(z.literal("")),
  label_text: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
type BootKey = "left" | "top" | "width" | "height";

export function AttrForm() {
  const text = useThemeStore((s) => s.text);
  const version = useThemeStore((s) => s.version);
  const applyFormPatch = useThemeStore((s) => s.applyFormPatch);
  const sem = useMemo(() => selectSemantic(selectCst(text)), [text]);
  const bootMenu = sem.bootMenu;

  const { register, reset, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { left: "", top: "", width: "", height: "", label_text: "" },
  });

  // Reflect semantic → form when text changes from monaco/import (not our own submit).
  useEffect(() => {
    reset({
      left: bootMenu?.left ?? "",
      top: bootMenu?.top ?? "",
      width: bootMenu?.width ?? "",
      height: bootMenu?.height ?? "",
      label_text: sem.labels[0]?.text ?? "",
    });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bootMenu) return <p>No boot_menu in theme (path: root.boot_menu[0] missing).</p>;

  const submit = (key: keyof FormValues) => handleSubmit((v) => {
    const value = v[key];
    // PR3 rule: empty field = GRUB default -> remove the property line.
    if (value === undefined || value === "") {
      const target = key === "label_text" ? sem.labels[0] : bootMenu;
      const targetKey = key === "label_text" ? "text" : (key as string);
      if (target) useThemeStore.getState().removeProperty(target.nodeId, targetKey);
      return;
    }
    if (key === "label_text") {
      const label = sem.labels[0];
      if (!label || value === (label.text ?? "")) return;
      const result = applyFormPatch(label.nodeId, "text", value);
      if (result === "skipped-equal") setValue(key, label.text ?? "", { shouldDirty: false });
      return;
    }
    // Local equality gate: skip the store entirely when nothing changed.
    const current = bootMenu[key as BootKey];
    if (value === (current ?? "")) return;
    const result = applyFormPatch(bootMenu.nodeId, key, value);
    if (result === "skipped-equal") {
      // Semantic tie (e.g. typed "10.0" == stored "10"): pull the field back so
      // the input never disagrees with the model between renders.
      setValue(key, current ?? "", { shouldDirty: false });
    }
  });

  const label0 = sem.labels[0];
  const prog0 = sem.progressbars[0];
  const termFont = sem.globals["terminal-font"];

  return (
    <form>
      <h3>boot_menu <small>{bootMenu.path}</small></h3>
      {(["left", "top", "width", "height"] as const).map((k) => (
        <div key={k}>
          <label>{k}</label>
          <input {...register(k)} onBlur={submit(k)} />
          {formState.errors[k] && <span>{formState.errors[k]?.message}</span>}
        </div>
      ))}
      {bootMenu.item_color !== undefined && (
        <ColorField nodeId={bootMenu.nodeId} propKey="item_color" label="item_color" path={bootMenu.path} current={bootMenu.item_color} />
      )}
      {bootMenu.selected_item_color !== undefined && (
        <ColorField nodeId={bootMenu.nodeId} propKey="selected_item_color" label="selected_item_color" path={bootMenu.path} current={bootMenu.selected_item_color} />
      )}
      {bootMenu.item_font !== undefined && (
        <FontField nodeId={bootMenu.nodeId} fontKey="item_font" label="item_font" path={bootMenu.path} current={bootMenu.item_font} />
      )}
      {label0 && (
        <>
          <h3>label <small>{label0.path}</small></h3>
          <div>
            <label>label_text</label>
            <input {...register("label_text")} onBlur={submit("label_text")} />
          </div>
          {label0.color !== undefined && (
            <ColorField nodeId={label0.nodeId} propKey="color" label="color" path={label0.path} current={label0.color} />
          )}
        </>
      )}
      {prog0 && (
        <>
          <h3>progress <small>{prog0.path}</small></h3>
          {prog0.fg_color !== undefined && (
            <ColorField nodeId={prog0.nodeId} propKey="fg_color" label="fg_color" path={prog0.path} current={prog0.fg_color} />
          )}
          {prog0.bg_color !== undefined && (
            <ColorField nodeId={prog0.nodeId} propKey="bg_color" label="bg_color" path={prog0.path} current={prog0.bg_color} />
          )}
        </>
      )}
      {termFont && (
        <>
          <h3>global</h3>
          <FontField nodeId={termFont.nodeId} fontKey="terminal-font" label="terminal-font" path="root (global)" current={termFont.value} />
        </>
      )}
      <p>version {version}</p>
    </form>
  );
}
