"use client";

import { useSyncExternalStore } from "react";

// Dark mode lives in the DOM (`.dark` on <html>), set pre-paint and toggled imperatively.
// Subscribe to it rather than mirroring into an effect so consumers re-render on theme change
// without a setState-in-effect cascade. Mirrors the pattern in DashboardHeader / SettingsMenu.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function useIsDark() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
