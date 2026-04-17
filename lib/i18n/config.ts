export const defaultLocale = 'en';
export const locales = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'zh', 'ko', 'ru', 'hi', 'bn', 'ta', 'te'] as const;
export type Locale = typeof locales[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ru: 'Русский',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  it: '🇮🇹',
  ja: '🇯🇵',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ru: '🇷🇺',
  hi: '🇮🇳',
  bn: '🇧🇩',
  ta: '🇮🇳',
  te: '🇮🇳',
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
} 