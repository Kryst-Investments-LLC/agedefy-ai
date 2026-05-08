'use client';

import { useLocale } from '@/lib/i18n/context';
import { locales, localeNames, localeFlags, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1">
      <select
        className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-300 hover:border-gray-500 transition-colors"
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