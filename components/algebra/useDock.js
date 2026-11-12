'use client';

import { useEffect, useRef, useState } from 'react';

// Keeps the query editor reachable: whenever its text box would not be fully on screen in
// its normal place (scrolled above OR below), the editor is fixed to the bottom of the viewport.
// The spot (`slotRef`) keeps the editor's full height while it is docked, so the page
// never jumps and docking cannot flicker. Re-renders only when the dock state changes.
export default function useDock() {
  const slotRef = useRef(null);
  const panelRef = useRef(null);
  const [dock, setDock] = useState({ docked: false, fullHeight: 0, dockHeight: 0, left: 0, width: 0 });

  useEffect(() => {
    const slot = slotRef.current;
    const panel = panelRef.current;
    if (!slot || !panel) return undefined;
    let frame = 0;
    let last = { docked: false, fullHeight: 0, dockHeight: 0, left: 0, width: 0 };
    let input = { top: 0, height: 0 }; // text box position inside the undocked editor

    const update = () => {
      frame = 0;
      const fullHeight = last.docked ? last.fullHeight : panel.offsetHeight;
      if (!last.docked) {
        const box = panel.querySelector('.input-wrap')?.getBoundingClientRect();
        if (box) input = { top: box.top - panel.getBoundingClientRect().top, height: box.height };
      }
      const rect = slot.getBoundingClientRect();
      const inputTop = rect.top + input.top;
      const docked = inputTop < 0 || inputTop + input.height > window.innerHeight;
      const next = {
        docked,
        fullHeight,
        dockHeight: docked && last.docked ? panel.offsetHeight : last.dockHeight,
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      };
      if (Object.keys(next).some((key) => next[key] !== last[key])) {
        last = next;
        setDock(next);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(panel);
    resize?.observe(slot);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resize?.disconnect();
    };
  }, []);

  return {
    slotRef,
    panelRef,
    docked: dock.docked,
    slotStyle: dock.docked ? { height: dock.fullHeight } : undefined,
    panelStyle: dock.docked ? { left: dock.left, width: dock.width } : undefined,
    // room at the end of the page so the docked editor never covers the last content
    pageStyle: dock.docked && dock.dockHeight ? { paddingBottom: dock.dockHeight + 16 } : undefined,
  };
}
