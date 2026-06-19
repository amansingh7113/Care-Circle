import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { useStore } from '../store/useStore';

// Import translations
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import bn from '../locales/bn.json';
import ta from '../locales/ta.json';
import te from '../locales/te.json';
import mr from '../locales/mr.json';
import gu from '../locales/gu.json';
import kn from '../locales/kn.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  gu: { translation: gu },
  kn: { translation: kn },
};

// Map system language code to our supported locales
const getSystemLanguage = () => {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    const langCode = locales[0].languageCode;
    // Check if the system language is one of our supported ones
    if (Object.keys(resources).includes(langCode)) {
      return langCode;
    }
  }
  return 'en'; // Default fallback
};

const initI18n = () => {
  // Try to get language from store, otherwise use system
  const savedLanguage = useStore.getState().appLanguage;
  const initialLanguage = savedLanguage || getSystemLanguage();

  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3', // Required for React Native Android
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already safes from XSS
      },
    });
};

// Initialize immediately so it's ready when app starts
initI18n();

export const changeLanguage = async (langCode) => {
  await i18n.changeLanguage(langCode);
  useStore.getState().setAppLanguage(langCode);
};

export default i18n;
