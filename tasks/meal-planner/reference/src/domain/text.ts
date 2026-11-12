/** Letters that Unicode decomposition (NFD) leaves whole, so stripping accents alone doesn't fold them. */
const letters: Record<string, string> = { "ø": "o", "œ": "oe", "æ": "ae", "ß": "ss", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" }

/** Lowercase, without accents: `Crème Brûlée` → `creme brulee`, `Smørrebrød` → `smorrebrod`, `Çılbır` → `cilbir`. */
export function foldText(text: string): string {
  return text.toLowerCase().replace(/[øœæßłđðþı]/g, letter => letters[letter]!).normalize("NFD").replace(/\p{M}/gu, "")
}
