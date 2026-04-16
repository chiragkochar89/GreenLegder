import React, { createContext, useContext, useState } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface LangContextType {
  lang: Language;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  t: (key) => key,
  toggleLang: () => {},
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('en');
  const t = (key: TranslationKey) => translations[lang][key] || translations.en[key] || key;
  const toggleLang = () => setLang(l => l === 'en' ? 'mr' : 'en');
  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
