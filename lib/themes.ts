export const themes = [
  { id: "midnight-dark", family: "midnight", name: "Midnight", appearance: "Dark", swatch: "#111c2d", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=88" },
  { id: "midnight-light", family: "midnight", name: "Midnight", appearance: "Light", swatch: "#4338ca", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=88" },
  { id: "forest-dark", family: "forest", name: "Forest", appearance: "Dark", swatch: "#10251a", image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=88" },
  { id: "forest-light", family: "forest", name: "Forest", appearance: "Light", swatch: "#24734d", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=88" },
  { id: "coastal-dark", family: "coastal", name: "Coastal", appearance: "Dark", swatch: "#102b41", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=88" },
  { id: "coastal-light", family: "coastal", name: "Coastal", appearance: "Light", swatch: "#0284c7", image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=88" },
  { id: "coral-dark", family: "coral", name: "Coral", appearance: "Dark", swatch: "#2a1721", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=88" },
  { id: "coral-light", family: "coral", name: "Coral", appearance: "Light", swatch: "#e11d48", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=88" },
  { id: "indigo-dark", family: "indigo", name: "Indigo", appearance: "Dark", swatch: "#181e3b", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=88" },
  { id: "indigo-light", family: "indigo", name: "Indigo", appearance: "Light", swatch: "#4f46e5", image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=88" },
] as const;

export type ThemeId = (typeof themes)[number]["id"];
export type ThemeMode = "auto" | "fixed";

const legacyThemeIds: Record<string, ThemeId> = {
  midnight: "midnight-dark",
  indigo: "indigo-light",
  forest: "forest-light",
  coastal: "coastal-light",
  coral: "coral-light",
};

export function getSavedTheme(value: string | null): ThemeId | null {
  if (!value) return null;
  if (themes.some((theme) => theme.id === value)) return value as ThemeId;
  return legacyThemeIds[value] ?? null;
}

export function randomTheme(excluding?: ThemeId): ThemeId {
  const available = themes.filter((theme) => theme.id !== excluding);
  return available[Math.floor(Math.random() * available.length)].id;
}

export function getThemeImage(themeId: ThemeId) {
  return themes.find((theme) => theme.id === themeId)!.image;
}
