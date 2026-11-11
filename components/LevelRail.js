'use client';

import { useEffect, useState } from 'react';

// Trail of levels. Desktop: a column on the left. Phone: a compact bar (current item,
// previous/next) that opens the full trail as a full-screen sheet.
// `sections` = [{ title, meta, difficulty, items: [{ id, label, badge, done, active, square }] }]
export default function LevelRail({ heading, footer, sections, openSections, onToggleSection, onSelect }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const flat = sections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })));
  const position = flat.findIndex((item) => item.active);
  const current = flat[position];
  const select = (item) => { setSheetOpen(false); if (!item.active) onSelect(item); };

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-lock');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('sheet-lock'); };
  }, [sheetOpen]);

  return (
    <aside className={`level-rail${sheetOpen ? ' sheet-open' : ''}`} aria-label="Fases do jogo">
      <div className="rail-bar">
        <button className="rail-step" type="button" aria-label="Item anterior" disabled={position <= 0} onClick={() => select(flat[position - 1])}>‹</button>
        <button className="rail-current" type="button" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <span className="rail-current-meta">{current ? `${current.section} · ${current.badge}` : 'MAPA'}</span>
          <strong>{current?.label ?? heading}</strong>
          <span className="rail-current-open">Trilha ▾</span>
        </button>
        <button className="rail-step" type="button" aria-label="Próximo item" disabled={position < 0 || position >= flat.length - 1} onClick={() => select(flat[position + 1])}>›</button>
      </div>

      <div className="rail-body" role={sheetOpen ? 'dialog' : undefined} aria-modal={sheetOpen || undefined} aria-label={sheetOpen ? heading : undefined}>
        <div className="rail-heading">
          <div><span>MAPA</span><strong>{heading}</strong></div>
          <button className="rail-close" type="button" aria-label="Fechar trilha" onClick={() => setSheetOpen(false)}>×</button>
        </div>
        <ol>
          {sections.map((section) => {
            const open = openSections.has(section.title);
            return [
              <li key={`section-${section.title}`} className={`level-section ${section.difficulty ?? ''}`}>
                <button className="section-toggle" type="button" aria-expanded={open} onClick={() => onToggleSection(section.title)}>
                  <span className="section-caret">{open ? '▾' : '▸'}</span>
                  {section.title}
                  <span className="section-meta">{section.meta}</span>
                </button>
              </li>,
              ...(open ? section.items.map((item) => (
                <li key={item.id} className={[item.square && 'db', item.active && 'active', item.done && 'done'].filter(Boolean).join(' ')}>
                  <button className="level-link" type="button" aria-current={item.active ? 'page' : undefined} title={`${item.label}${item.done ? ' (concluída)' : ''}`} onClick={() => select(item)}>
                    <span className="level-number">{item.done && !item.active ? '✓' : item.badge}</span>
                    <span className="level-name">{item.label}</span>
                  </button>
                </li>
              )) : []),
            ];
          })}
        </ol>
        <div className="rail-footer"><span className="pulse-icon">✦</span><span>{footer}</span></div>
      </div>
    </aside>
  );
}
