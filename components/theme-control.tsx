"use client";

import { Check, Palette, Shuffle } from "lucide-react";
import { themes, ThemeId, ThemeMode } from "@/lib/themes";

export function ThemeControl({
  theme,
  mode,
  onSelect,
  onAuto,
}: {
  theme: ThemeId;
  mode: ThemeMode;
  onSelect: (theme: ThemeId) => void;
  onAuto: () => void;
}) {
  return (
    <details className="theme-control">
      <summary className="theme-trigger" aria-label="Choose appearance">
        <Palette size={16} />
        <span>Theme</span>
        <kbd>{mode === "auto" ? "AUTO" : "FIXED"}</kbd>
      </summary>
      <div className="theme-menu">
        <div className="theme-menu-heading"><strong>Appearance</strong><small>{mode === "auto" ? "Changes each sign-in" : "Pinned selection"}</small></div>
        {themes.map((option) => (
          <button type="button" key={option.id} className="theme-option" aria-pressed={theme === option.id && mode === "fixed"} onClick={(event) => { onSelect(option.id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>
            <i className={`theme-swatch theme-swatch-${option.family} theme-swatch-${option.appearance.toLowerCase()}`} />
            <span>{option.name} · {option.appearance}</span>
            {theme === option.id && mode === "fixed" && <Check size={15} />}
          </button>
        ))}
        <button type="button" className={`theme-auto${mode === "auto" ? " theme-auto-active" : ""}`} onClick={(event) => { onAuto(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Shuffle size={14} /><span>Rotate at each sign-in</span>{mode === "auto" && <Check size={14} />}</button>
      </div>
    </details>
  );
}
