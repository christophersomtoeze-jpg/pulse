import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translations, type SupportedLanguage, type TranslationKey } from './translations';

interface I18nContextValue {
  language: SupportedLanguage;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  t: (key) => translations.en[key],
});

function normalizeLanguage(code: string | undefined | null): SupportedLanguage {
  return code === 'es' || code === 'fr' || code === 'pt' ? code : 'en';
}

export function I18nProvider({ language, children }: { language: string | undefined | null; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const lang = normalizeLanguage(language);
    return { language: lang, t: (key) => translations[lang][key] ?? translations.en[key] };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
