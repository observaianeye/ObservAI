/**
 * Yan #41: pdfkit's default Helvetica font does not ship Turkish-specific
 * glyphs (s with cedilla, dotted/dotless I, etc). Falling them back to ASCII
 * keeps the PDF readable without bundling a custom TTF. CSV path keeps the
 * native UTF-8 — only PDF text passes through this helper.
 */
const MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'C',
  'ğ': 'g', 'Ğ': 'G',
  'ı': 'i', 'İ': 'I',
  'ö': 'o', 'Ö': 'O',
  'ş': 's', 'Ş': 'S',
  'ü': 'u', 'Ü': 'U',
};

const RE = /[ÇÖÜçöüĞğİıŞş]/g;

export function turkishToAscii(s: string): string {
  return s.replace(RE, (ch) => MAP[ch] ?? ch);
}
