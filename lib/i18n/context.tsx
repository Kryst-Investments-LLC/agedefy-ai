'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import type { Locale } from './config';
import { defaultLocale, locales } from './config';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translations: Record<string, unknown>;
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [translations, setTranslations] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocaleState(savedLocale);
    }
  }, []);

  useEffect(() => {
    async function loadTranslations() {
      setIsLoading(true);
      try {
        const response = await fetch(`/translations/${locale}.json`);
        if (response.ok) {
          const data = await response.json();
          setTranslations(data);
        } else {
          console.warn(`Failed to load translations for ${locale}, falling back to English`);
          const fallbackResponse = await fetch('/translations/en.json');
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            setTranslations(fallbackData);
          }
        }
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations({});
      } finally {
        setIsLoading(false);
      }
    }

    loadTranslations();
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, translations, isLoading }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

export function useTranslation() {
  const { translations } = useLocale();
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: unknown = translations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  };
  
  return { t };
}
