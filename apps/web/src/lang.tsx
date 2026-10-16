import { createContext, useContext } from 'react';
import type { Language } from './i18n.js';

export const LanguageContext = createContext<Language>('vi');

export function useLang(): Language {
  return useContext(LanguageContext);
}
