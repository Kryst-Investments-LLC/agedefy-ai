/* eslint-disable no-duplicate-imports */
'use client';

import React from 'react';

import { locales, localeNames, localeFlags } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">🌐</span>
      <select
        className="border rounded px-2 py-1 bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        value={locale}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocale(e.target.value as Locale)}
      >
        {locales.map((l) => (
          <option key={l} value={l} className="bg-gray-800 text-gray-300">
            {localeFlags[l]} {localeNames[l]}
          </option>
        ))}
      </select>
    </div>
  );
}                                                                                                                                                