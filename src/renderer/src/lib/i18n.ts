import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from '../locales/ru.json'
import ky from '../locales/ky.json'
import uz from '../locales/uz.json'

export const LANGUAGES = [
  { code: 'ru', native: 'Русский' },
  { code: 'ky', native: 'Кыргызча' },
  { code: 'uz', native: "O'zbekcha" }
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

const STORAGE_KEY = 'qarz.language'

function initialLanguage(): LanguageCode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as LanguageCode
  return 'ru'
}

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    ky: { translation: ky },
    uz: { translation: uz }
  },
  lng: initialLanguage(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false }
})

export function setLanguage(code: LanguageCode): void {
  localStorage.setItem(STORAGE_KEY, code)
  void i18n.changeLanguage(code)
  document.documentElement.lang = code
}

const RESOURCES: Record<string, { reminders: { waTemplate: string }; settings: { directTemplate: string } }> = {
  ru,
  ky,
  uz
}

/** The built-in WhatsApp reminder template for a language, with {{placeholders}} intact. */
export function defaultWaTemplate(lang: string): string {
  return RESOURCES[lang]?.reminders.waTemplate ?? RESOURCES.ru.reminders.waTemplate
}

/** The built-in "new transaction" WhatsApp template for a language, with {{placeholders}} intact. */
export function defaultDirectTemplate(lang: string): string {
  return RESOURCES[lang]?.settings.directTemplate ?? RESOURCES.ru.settings.directTemplate
}

export default i18n
