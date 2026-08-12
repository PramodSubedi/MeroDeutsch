import { useLanguage } from '../context/LanguageContext';

export function useLang() {
  const { langMode, toggleLanguage, setLanguage, isGerman } = useLanguage();

  return {
    langMode,
    setLangMode: setLanguage,
    toggle: toggleLanguage,
    isGermanOnly: isGerman,
  };
}
