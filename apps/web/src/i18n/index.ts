import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from '../locales/es.json';

/** The source locale ships from M0; English arrives at M6 (ADR-012). */
export const SOURCE_LOCALE = 'es';

/** One namespace per screen; keys are always in English. */
export const NAMESPACES = ['common', 'home', 'node', 'timer', 'evidence', 'result', 'settings'];

export const resources: Resource = { es };

void i18n.use(initReactI18next).init({
  resources,
  lng: SOURCE_LOCALE,
  fallbackLng: SOURCE_LOCALE,
  supportedLngs: [SOURCE_LOCALE],
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
