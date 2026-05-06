import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { safeLocalStorage } from './utils/storageHelper';

import translationAR from './locales/ar/translation.json';
import translationEN from './locales/en/translation.json';

const resources = {
  en: { translation: translationEN },
  ar: { translation: translationAR },
};

const isDevelopment = () => {
  try {
    if (typeof window !== 'undefined') {
      if (import.meta.env && import.meta.env.DEV) return true;
      const hostname = window.location.hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1';
    }
  } catch {
    /* ignore errors */
  }
  return false;
};

const safeCookies = {
  get: (name) => {
    try {
      if (typeof document !== 'undefined') {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
      }
    } catch {
      return null;
    }
    return null;
  },
  set: (name, value, days) => {
    try {
      if (typeof document !== 'undefined') {
        const d = new Date();
        d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
      }
    } catch {
      /* ignore errors */
    }
  }
};

const isValidLanguage = (lng) => lng && (lng === 'ar' || lng === 'en');

const customLanguageDetector = {
  type: 'languageDetector',
  async: false,
  init: () => {},
  detect: () => {
    const localLang = safeLocalStorage.getItem('i18nextLng');
    if (isValidLanguage(localLang)) return localLang;

    const cookieLang = safeCookies.get('i18nextLng');
    if (isValidLanguage(cookieLang)) return cookieLang;

    return 'ar';
  },
  cacheUserLanguage: (lng) => {
    if (isValidLanguage(lng)) {
      safeLocalStorage.setItem('i18nextLng', lng);
      safeCookies.set('i18nextLng', lng, 365);
    }
  }
};

i18n
  .use(customLanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    load: 'languageOnly',
    debug: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false, bindI18n: 'languageChanged loaded' }
  });

const updateDirection = (lng) => {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dir = dir;
      document.documentElement.lang = lng;
      document.documentElement.classList.toggle('rtl', lng === 'ar');
      document.documentElement.classList.toggle('ltr', lng !== 'ar');
      document.documentElement.classList.remove('lang-ar', 'lang-en');
      document.documentElement.classList.add(`lang-${lng}`);
    }
  } catch {
    /* ignore errors */
  }
};

const applyInitialDirection = () => updateDirection(i18n.language || 'ar');

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyInitialDirection);
  } else {
    applyInitialDirection();
  }
}

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') updateDirection(lng);
});

export const changeLanguage = async (lng) => {
  if (!isValidLanguage(lng)) return false;
  try { await i18n.changeLanguage(lng); return true; } catch { return false; }
};

export const getCurrentLanguage = () => i18n.language || 'ar';
export const isArabic = () => getCurrentLanguage() === 'ar';
export const toggleLanguage = async () => {
  const currentLang = getCurrentLanguage();
  return await changeLanguage(currentLang === 'ar' ? 'en' : 'ar');
};

export default i18n;

