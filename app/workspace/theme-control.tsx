"use client";

import { useEffect, useSyncExternalStore } from "react";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "cartograph-theme";
const preferenceChangeEvent = "cartograph-theme-change";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  root.dataset.themePreference = preference;
  root.dataset.theme =
    preference === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : preference;
}

function getPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribeToPreference(onChange: () => void) {
  const syncPreference = () => {
    onChange();
    applyTheme(getPreference());
  };

  window.addEventListener("storage", syncPreference);
  window.addEventListener(preferenceChangeEvent, syncPreference);
  return () => {
    window.removeEventListener("storage", syncPreference);
    window.removeEventListener(preferenceChangeEvent, syncPreference);
  };
}

export function ThemeControl() {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreference,
    () => "system",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.themePreference === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  function chooseTheme(value: string) {
    if (!isThemePreference(value)) return;

    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // The current choice remains active until the page is closed.
    }
    applyTheme(value);
    window.dispatchEvent(new Event(preferenceChangeEvent));
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      Theme
      <select
        aria-label="Theme"
        className="rounded border bg-surface px-2 py-1.5 text-xs text-foreground"
        value={preference}
        onChange={(event) => chooseTheme(event.currentTarget.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
