"use client";

import { useState } from "react";
import { useLangStore, type Lang } from "@/lib/store/langStore";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "kn", label: "ಕನ್ನಡ" },
];

interface Props {
  isDark?: boolean;
}

export default function LanguageDropdown({ isDark = false }: Props) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const [hot, setHot] = useState(false); // hover or keyboard focus — brightens the control

  // Arrow tints toward primary so the pill reads as an interactive control, not chrome.
  const arrow = isDark ? "%237fb0ec" : "%231b5fb0";
  const textColor = isDark ? "#e5e5e5" : "var(--color-ink-soft)";
  const restBorder = isDark
    ? "1px solid rgba(127,176,236,0.30)"
    : "1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)";
  const hotBorder = "1px solid var(--color-primary)";
  const restBg = isDark ? "rgba(127,176,236,0.10)" : "var(--color-primary-wash)";
  const hotBg = isDark
    ? "rgba(127,176,236,0.18)"
    : "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))";

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      aria-label="Select language"
      style={{
        height: "36px",
        paddingLeft: "10px",
        paddingRight: "28px",
        borderRadius: "12px",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${arrow}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        backgroundColor: hot ? hotBg : restBg,
        color: textColor,
        border: hot ? hotBorder : restBorder,
        outline: "none",
        transition: "border-color 0.15s, background-color 0.15s",
      }}
    >
      {LANGS.map(({ value, label }) => (
        <option
          key={value}
          value={value}
          style={{
            background: isDark ? "#171717" : "#ffffff",
            color: isDark ? "#fafafa" : "#171717",
          }}
        >
          {label}
        </option>
      ))}
    </select>
  );
}
