"use client";

import { useEffect } from "react";
import { useLangStore, type Lang } from "@/lib/store/langStore";

const VALID: Lang[] = ["en", "hi", "kn"];

export default function LangBootstrap() {
  const setLang = useLangStore((s) => s.setLang);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("parkiq-lang") as Lang | null;
      if (saved && VALID.includes(saved)) {
        setLang(saved);
      }
    } catch {}
  }, [setLang]);

  return null;
}
