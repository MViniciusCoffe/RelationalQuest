'use client';

import { useEffect, useRef, useState } from 'react';

// Saves a game's state in localStorage and restores it after a reload.
//   key      – storage key (versioned, e.g. 'rq-algebra-v1')
//   snapshot – plain JSON-serializable object with everything worth keeping
//   restore  – called once on mount with the saved object; must validate it
// Returns `ready`: false until the saved state has been applied, so the page can
// avoid flashing the default exercise first.
export default function useSavedGame(key, snapshot, restore) {
  const [ready, setReady] = useState(false);
  const latest = useRef(snapshot);
  latest.current = snapshot;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) restore(JSON.parse(raw));
    } catch { /* corrupt data or storage blocked: start fresh */ }
    setReady(true);
  }, [key]); // restore runs once per game

  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!ready) return undefined;
    const save = () => { try { localStorage.setItem(key, JSON.stringify(latest.current)); } catch { /* full or blocked */ } };
    const timer = setTimeout(save, 250); // typing does not write on every keystroke
    window.addEventListener('pagehide', save); // …but the last keystrokes survive a reload
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [key, ready, serialized]);

  return ready;
}

export function clearSavedGame(key) {
  try { localStorage.removeItem(key); } catch { /* blocked */ }
}

// Validation helpers for restore functions.
export const indexIn = (value, length) => Number.isInteger(value) && value >= 0 && value < length;
export const stringMap = (value) => (value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([, text]) => typeof text === 'string'))
  : {});
export const indexSet = (value, length) => new Set(Array.isArray(value) ? value.filter((index) => indexIn(index, length)) : []);
