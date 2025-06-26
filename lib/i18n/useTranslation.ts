'use client';

import { useCallback } from 'react';

import { useLocale } from './context';

export function useTranslation() {
  const { locale, translations } = useLocale();

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      // eslint-disable-next-line no-console
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Replace parameters if provided
    if (params) {
      return Object.entries(params).reduce((str, [key, val]) => {
        return str.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
      }, value);
    }

    return value;
  }, [translations]);

  return { t, locale };
}  