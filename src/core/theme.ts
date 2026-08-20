export type Theme = 'dark' | 'light';

const COOKIE_NAME = 'timeline_theme';

/** Read stored theme from cookie with localStorage fallback, defaulting to 'dark'. */
export function getStoredTheme(): Theme {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_NAME + '=([^;]+)'));
    if (match) {
      const val = match[2];
      if (val === 'dark' || val === 'light') return val;
    }
    try {
      const ls = localStorage.getItem(COOKIE_NAME);
      if (ls === 'dark' || ls === 'light') return ls;
    } catch {
      // ignore
    }
  }
  return 'dark';
}

/** Store theme to cookie and localStorage, and update data-theme attribute on <html>. */
export function setStoredTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=${theme}; max-age=31536000; path=/; SameSite=Lax`;
    try {
      localStorage.setItem(COOKIE_NAME, theme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute('data-theme', theme);
  }
}
