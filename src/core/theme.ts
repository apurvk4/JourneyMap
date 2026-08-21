export type Theme = 'dark' | 'light';

const COOKIE_NAME = 'timeline_theme';

export function getStoredTheme(): Theme {
  if (typeof document !== 'undefined') {
    try {
      const ls = localStorage.getItem(COOKIE_NAME);
      if (ls === 'dark' || ls === 'light') return ls;
    } catch {
      // ignore
    }

    const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_NAME + '=([^;]+)'));
    if (match) {
      const val = match[2];
      if (val === 'dark' || val === 'light') return val;
    }
  }
  return 'dark';
}

export function applyStoredTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

if (typeof document !== 'undefined') {
  applyStoredTheme(getStoredTheme());
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
    applyStoredTheme(theme);
  }
}
