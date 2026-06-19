import { create } from "zustand";

export type Lang = "en" | "hi" | "kn";

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangStore>()((set) => ({
  lang: "en",
  setLang: (lang) => {
    set({ lang });
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    try {
      localStorage.setItem("parkiq-lang", lang);
    } catch {}
  },
}));
