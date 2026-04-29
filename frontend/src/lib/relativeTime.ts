// Locale-aware "X minutes/hours/days ago" formatter.
//
// Originally embedded inside NotificationCenter; lifted out for Faz 8 so the
// AnalyticsPage Insights cards (and any future card surface) can reuse the
// exact same i18n key set instead of re-implementing the bucket math. Pure +
// dependency-free; relies on the language layer for the actual TR/EN strings
// (see strings.ts: common.justNow, common.minutesAgo, common.hoursAgo,
// common.daysAgo).

type T = (key: string, vars?: Record<string, string | number>) => string;

export function makeTimeAgo(t: T): (input: string | Date) => string {
  return (input) => {
    const date = input instanceof Date ? input : new Date(input);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('common.justNow');
    if (diffMin < 60) return t('common.minutesAgo', { n: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('common.hoursAgo', { n: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    return t('common.daysAgo', { n: diffDay });
  };
}
