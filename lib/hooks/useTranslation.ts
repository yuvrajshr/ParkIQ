import { useLangStore } from "@/lib/store/langStore";
import en from "@/lib/locales/en.json";
import hi from "@/lib/locales/hi.json";
import kn from "@/lib/locales/kn.json";

type Dict = typeof en;
type DictKey = keyof Dict;

const dicts: Record<string, Dict> = { en, hi, kn };

export function useTranslation() {
  const lang = useLangStore((s) => s.lang);

  const t = (key: DictKey, vars?: Record<string, string | number>): string => {
    let str: string = ((dicts[lang]?.[key] ?? dicts.en[key]) as string) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return { t, lang };
}
