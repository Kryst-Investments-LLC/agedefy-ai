'use client';

import { useLocale } from '@/lib/i18n/context';
import { locales, localeNames, localeFlags, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">🌐</span>
      <select
        className="border rounded px-2 py-1 bg-background text-foreground"
        value={locale}
        onChange={e => setLocale(e.target.value as Locale)}
      >
        {locales.map(l => (
          <option key={l} value={l}>
            {localeFlags[l]} {localeNames[l]}
          </option>
        ))}
      </select>
    </div>
  );
} 