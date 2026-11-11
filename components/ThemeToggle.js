'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'relational-quest-theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121c1f' : '#f6f1e8');
}

export default function ThemeToggle() {
  // The real theme is only known in the browser (set by the script in layout.js).
  const [theme, setTheme] = useState(null);
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); }, []);

  const isDark = theme === 'dark';
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'} title={isDark ? 'Usar tema claro' : 'Usar tema escuro'}>
      <span className="theme-icon">{isDark ? '☀' : '☾'}</span>
      <span className="theme-label">{isDark ? 'claro' : 'escuro'}</span>
    </button>
  );
}
