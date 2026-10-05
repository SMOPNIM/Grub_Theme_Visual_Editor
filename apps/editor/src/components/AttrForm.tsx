// Attribute form: boot_menu left/top/width/height via RHF+zod → CSTPatch.
// Equality-first: submitting an unchanged value never touches the store
// (no version bump, no history entry, no Monaco echo). On a store-side
// short-circuit ("skipped-equal") the field is synced back to the semantic
// value so the input never visually disagrees with the model.
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useThemeStore, selectCst, selectSemantic } from "../store/themeStore.js";

const layout = z.string().regex(/^(\d+(\.\d+)?%\s*(-\s*\d+(\.\d+)?(px)?)?|\d+(\.\d+)?(px)?)$/, "use %, px or pct-px (e.g. 20%, 300, 100%-50)");
const schema = z.object({
  left: layout.optional().or(z.literal("")),
  top: layout.optional().or(z.literal("")),
  width: layout.optional().or(z.literal("")),
  height: layout.optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function AttrForm() {
  const text = useThemeStore((s) => s.text);
  const version = useThemeStore((s) => s.version);
  const applyFormPatch = useThemeStore((s) => s.applyFormPatch);
  const sem = useMemo(() => selectSemantic(selectCst(text)), [text]);
  const bootMenu = sem.bootMenu;

  const { register, reset, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { left: "", top: "", width: "", height: "" },
  });

  // Reflect semantic → form when text changes from monaco/import (not our own submit).
  useEffect(() => {
    reset({
      left: bootMenu?.left ?? "",
      top: bootMenu?.top ?? "",
      width: bootMenu?.width ?? "",
      height: bootMenu?.height ?? "",
    });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bootMenu) return <p>No boot_menu in theme (path: root.boot_menu[0] missing).</p>;

  const submit = (key: keyof FormValues) => handleSubmit((v) => {
    const value = v[key];
    if (value === undefined || value === "") return;
    // Local equality gate: skip the store entirely when nothing changed.
    if (value === (bootMenu[key] ?? "")) return;
    const result = applyFormPatch(bootMenu.nodeId, key, value);
    if (result === "skipped-equal") {
      // Semantic tie (e.g. typed "10.0" == stored "10"): pull the field back so
      // the input never disagrees with the model between renders.
      setValue(key, bootMenu[key] ?? "", { shouldDirty: false });
    }
  });

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
      <p>version {version}</p>
    </form>
  );
}
