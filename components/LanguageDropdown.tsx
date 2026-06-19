"use client";

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

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Select language"
      style={{
        height: "36px",
        paddingLeft: "10px",
        paddingRight: "28px",
        borderRadius: "12px",
        fontSize: "13px",
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isDark ? "%23a1a1a1" : "%23737373"}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "var(--color-surface-2)",
        color: isDark ? "#a1a1a1" : "var(--color-faint)",
        border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid var(--color-line)",
        outline: "none",
        transition: "border-color 0.15s, background 0.15s",
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
