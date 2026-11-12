import type { Wording } from "../domain/format"
import { en } from "../i18n/en"
import { es } from "../i18n/es"

/** The catalogs' wording, as the app passes it to the domain's formatting. */
export const wordingEn: Wording = { language: "en", units: en.words.units, counted: en.words.counted }
export const wordingEs: Wording = { language: "es", units: es.words.units, counted: es.words.counted }
