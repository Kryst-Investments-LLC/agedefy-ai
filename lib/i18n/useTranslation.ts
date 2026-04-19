'use client';

import { useCallback } from 'react';
import { useLocale } from './context';

interface TranslationNodeMap {
  [key: string]: string | TranslationNodeMap;
}

type TranslationNode = string | TranslationNodeMap;

export function useTranslation() {
  const { locale, translations, isLoading } = useLocale();

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: TranslationNode = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value];
      } else {
        // Suppress warnings while translations are still loading to avoid
        // flooding the console on every initial render (translations start as {}).
        if (!isLoading) {
          console.warn(`Translation key not found: ${key}`);
        }
        return key;
      }
    }

    if (typeof value !== 'string') {
      if (!isLoading) {
        console.warn(`Translation value is not a string: ${key}`);
      }
      return key;
    }

    // Replace parameters if provided
    if (params) {
      return Object.entries(params).reduce((str, [key, val]) => {
        return str.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
      }, value);
    }

    return value;
  }, [translations, isLoading]);

  return { t, locale };
} 