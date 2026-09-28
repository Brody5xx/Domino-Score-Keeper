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
const LANGUAGE_SETUP_KEY = "domino_language_setup_done";

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  const [loaded, setLoaded] = useState(false);
  const [needsLanguageSelection, setNeedsLanguageSelection] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LANG_KEY), AsyncStorage.getItem(LANGUAGE_SETUP_KEY)]).then(([val, setupDone]) => {
      if (val === "es" || val === "en" || val === "pt" || val === "fr" || val === "it") {
        setLangState(val);
      }
      setNeedsLanguageSelection(setupDone !== "true");
      setLoaded(true);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    setNeedsLanguageSelection(false);
    Promise.all([
      AsyncStorage.setItem(LANG_KEY, l),
      AsyncStorage.setItem(LANGUAGE_SETUP_KEY, "true"),
    ]);
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
