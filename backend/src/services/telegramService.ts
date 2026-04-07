/**
 * Telegram Bot API Service
 *
 * Sends alert notifications via Telegram Bot API (direct fetch, no extra dependency).
 * Rate limit: max 30 messages/second per Telegram API rules.
 *
 * Setup:
 *   1. Message @BotFather on Telegram -> /newbot -> get token
 *   2. Set TELEGRAM_BOT_TOKEN in backend/.env
 *   3. User sends /start to the bot, gets chat_id
 *   4. User enters chat_id in Settings page
 */

// Severity to emoji mapping
const SEVERITY_EMOJI: Record<string, string> = {
  critical: '\u{1F534}', // red circle
  high: '\u{1F7E0}',     // orange circle
  medium: '\u{1F7E1}',   // yellow circle
  low: '\u{1F535}',      // blue circle
};

interface TelegramSendResult {
  success: boolean;
  error?: string;
}

/**
 * Send a formatted alert message to a Telegram chat.
 */
export async function sendTelegramMessage(
  chatId: string,
  title: string,
  message: string,
  severity: string,
  cameraName?: string
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const emoji = SEVERITY_EMOJI[severity] || '\u{2139}\u{FE0F}';
  const severityLabel = severity.toUpperCase();
  const timestamp = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  // Build formatted message
  let text = `${emoji} *ObservAI Alert — ${severityLabel}*\n\n`;
  text += `*${escapeMarkdown(title)}*\n`;
  text += `${escapeMarkdown(message)}\n\n`;
  if (cameraName) {
    text += `\u{1F4F7} Kamera: ${escapeMarkdown(cameraName)}\n`;
  }
  text += `\u{1F552} ${escapeMarkdown(timestamp)}`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });

    const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
    if (!data.ok) {
      const desc = (data.description as string) || 'Unknown Telegram error';
      console.error(`[Telegram] Send failed: ${desc}`);

      // If MarkdownV2 fails, retry with plain text
      if (desc.includes('parse')) {
        return sendTelegramPlain(token, chatId, title, message, severity, cameraName, timestamp);
      }

      return { success: false, error: desc };
    }

    console.log(`[Telegram] Alert sent to chat ${chatId}: ${title}`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Telegram] Network error: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Fallback: send plain text without Markdown (in case formatting fails).
 */
async function sendTelegramPlain(
  token: string,
  chatId: string,
  title: string,
  message: string,
  severity: string,
  cameraName: string | undefined,
  timestamp: string
): Promise<TelegramSendResult> {
  const emoji = SEVERITY_EMOJI[severity] || '';
  let text = `${emoji} ObservAI Alert - ${severity.toUpperCase()}\n\n`;
  text += `${title}\n${message}\n`;
  if (cameraName) text += `Kamera: ${cameraName}\n`;
  text += `Zaman: ${timestamp}`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
    return { success: !!data.ok, error: data.ok ? undefined : String(data.description || 'Error') };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify that a Telegram Bot token is valid by calling getMe.
 */
export async function verifyTelegramBot(): Promise<{ valid: boolean; botName?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { valid: false };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
    if (data.ok) {
      const result = data.result as Record<string, unknown>;
      return { valid: true, botName: String(result.username || '') };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Send a test message to verify chat_id works.
 */
export async function sendTelegramTest(chatId: string): Promise<TelegramSendResult> {
  return sendTelegramMessage(
    chatId,
    'Test Bildirimi',
    'ObservAI bildirim sistemi basariyla baglandi! Bu bir test mesajidir.',
    'low',
    'Test'
  );
}

/**
 * Escape special characters for Telegram MarkdownV2.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
