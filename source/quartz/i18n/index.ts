import { Translation, CalloutTranslation } from "./locales/definition"
import enUs from "./locales/en-US"

// This fork ships a single locale. quartz.config.ts pins `locale: "en-US"`, which is also
// `defaultTranslation`, so the other 20 upstream locale bundles were never read. Re-add a
// locale here (and its file under ./locales) if this site ever goes multilingual.
export const TRANSLATIONS = {
  "en-US": enUs,
} as const

export const defaultTranslation = "en-US"
export const i18n = (locale: ValidLocale): Translation => TRANSLATIONS[locale ?? defaultTranslation]
export type ValidLocale = keyof typeof TRANSLATIONS
export type ValidCallout = keyof CalloutTranslation
