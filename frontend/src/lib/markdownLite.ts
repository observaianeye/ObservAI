/**
 * Yan #56: GlobalChatbot rendered LLM responses as raw text — `**bold**`
 * and `*italic*` came through as literal asterisks. We can't pull a full
 * markdown library for this (chat is the only place markdown lands; would
 * be 60kB+ of dep weight). Instead a tiny regex-based renderer that
 * handles the only three things the LLM ever emits in chat replies:
 *
 *   1. **bold**   → <strong>bold</strong>
 *   2. *italic*   → <em>italic</em>     (single asterisk, not double)
 *   3. \n / \n\n  → <br/> / <br/><br/>
 *
 * Critical: we HTML-escape the input first so that any tags in the raw
 * model output (or in a prompt-injection echo) cannot reach the DOM as
 * actual elements. Only the three markers above turn into HTML.
 */

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

export function markdownLiteToHtml(input: string): string {
  if (!input) return '';
  let s = escapeHtml(input);

  // Bold first (greedy ** pairs) so single-asterisk italic doesn't eat them.
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // Italic: single * not preceded by another * and not followed by another *.
  // Captures the leading char to avoid replacing across word boundaries.
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Newlines: double then single, in that order, to keep paragraph spacing.
  s = s.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

  return s;
}
