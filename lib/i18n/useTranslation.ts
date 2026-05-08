'use client';

import { useCallback } from 'react';
import { useLocale } from './context';

interface TranslationNodeMap {
  [key: string]: string | TranslationNodeMap;
}

type TranslationNode = string | TranslationNodeMap;

export function useTranslation() {
  const { locale, translations } = useLocale();

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: TranslationNode = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
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