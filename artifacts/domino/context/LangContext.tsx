import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { TRANSLATIONS, type Lang, type Translations } from "@/constants/translations";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  needsLanguageSelection: boolean;
  t: Translations;
}

const LANG_KEY = "domino_lang";

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  const [loaded, setLoaded] = useState(false);
  const [needsLanguageSelection, setNeedsLanguageSelection] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((val) => {
      if (val === "es" || val === "en" || val === "pt" || val === "fr" || val === "it") {
        setLangState(val);
      } else {
        setNeedsLanguageSelection(true);
      }
      setLoaded(true);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    setNeedsLanguageSelection(false);
    AsyncStorage.setItem(LANG_KEY, l);
  }

  if (!loaded) return null;

  return (
    <LangContext.Provider value={{ lang, setLang, needsLanguageSelection, t: TRANSLATIONS[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
