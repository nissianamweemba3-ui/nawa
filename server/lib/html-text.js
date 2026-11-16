// HTML/entity text helpers (pure; shared with the browser demo).

export const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');

// HTML -> text. Hidden elements are KEPT (not dropped) so that hidden instructions are surfaced to the
// injection scanner rather than silently ignored; the content is treated as untrusted data either way.
export function htmlToText(html) {
  return decodeEntities(html
    .replace(/<!--([\s\S]*?)-->/g, ' $1 ')
    .replace(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi, ' $2 ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
