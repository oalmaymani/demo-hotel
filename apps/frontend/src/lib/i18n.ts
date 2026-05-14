import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";

export type Locale = "ar" | "en";

export function getMessages(locale: Locale) {
  return locale === "ar" ? ar : en;
}

export function isRTL(locale: Locale) {
  return locale === "ar";
}
