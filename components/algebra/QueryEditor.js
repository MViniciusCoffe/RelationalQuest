'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import QueryAutocomplete from '@/lib/algebra/autocomplete';

const SYMBOLS = [['σ', 'seleção'], ['π', 'projeção'], ['ρ', 'renomear'], ['⨝', 'junção'], ['∪', 'união'], ['∩', 'interseção'], ['−', 'diferença'], ['÷', 'divisão'], ['×', 'produto'], ['←', 'atribuição / renomear coluna'], ['→', 'renomear coluna (antigo→novo)'], ['∧', 'e (and)'], ['∨', 'ou (or)']];
const fold = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Highlight({ label, typed }) {
  const wanted = fold(typed);
  const index = wanted ? fold(label).indexOf(wanted) : -1;
  if (index < 0) return label;
  return <>{label.slice(0, index)}<mark>{label.slice(index, index + wanted.length)}</mark>{label.slice(index + wanted.length)}</>;
}

// Query textarea with operator toolbar and context-aware autocomplete
// (relations, columns and aliases created with ρ or ←).
export default function QueryEditor({ value, onChange, onSubmit, tables, placeholder, attemptsLabel }) {
  const input = useRef(null);
  const list = useRef(null);
  const wrap = useRef(null);
  const pending = useRef(null); // { caret, reopen } applied after React re-renders the textarea
  const [ac, setAc] = useState(null); // { start, items, active, top, left }

  const close = () => setAc(null);

  const open = (forced = false) => {
    const el = input.current;
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return close();
    const result = QueryAutocomplete.suggestions(el.value, caret, tables, forced);
    if (!result || !result.items.length) return close();
    const coords = QueryAutocomplete.caretCoordinates(el, result.start);
    return setAc({ ...result, active: 0, top: el.offsetTop + coords.top + coords.height + 4, left: el.offsetLeft + coords.left });
  };

  // Replace text, then put the caret where it belongs once React has updated the textarea.
  const replace = (start, end, text, reopen = false) => {
    const current = input.current.value;
    pending.current = { caret: start + text.length, reopen };
    onChange(current.slice(0, start) + text + current.slice(end));
  };

  useLayoutEffect(() => {
    if (!pending.current) return;
    const { caret, reopen } = pending.current;
    pending.current = null;
    input.current.focus();
    input.current.setSelectionRange(caret, caret);
    if (reopen) open(true); else close();
  });

  // Keep the dropdown inside the editor horizontally.
  useLayoutEffect(() => {
    if (!ac || !list.current || !wrap.current) return;
    const maxLeft = Math.max(0, wrap.current.clientWidth - list.current.offsetWidth - 4);
    list.current.style.left = `${Math.min(ac.left, maxLeft)}px`;
    list.current.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [ac]);

  const accept = (index) => {
    const item = ac.items[index];
    const caret = input.current.selectionStart;
    const tail = input.current.value.slice(caret).match(/^[\wÀ-ÿ]*/)[0]; // replace the rest of the word too
    replace(ac.start, caret + tail.length, item.insert, Boolean(item.reopen));
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); close(); onSubmit(); return; }
    if (event.key === ' ' && event.ctrlKey) { event.preventDefault(); open(true); return; }
    if (!ac) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setAc({ ...ac, active: (ac.active + step + ac.items.length) % ac.items.length });
    } else if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault();
      accept(ac.active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const insertSymbol = (symbol) => {
    const el = input.current;
    const start = el.selectionStart ?? el.value.length;
    replace(start, el.selectionEnd ?? start, symbol);
  };

  const typed = ac ? value.slice(ac.start, input.current?.selectionStart ?? ac.start) : '';

  return (
    <>
      <div className="symbol-toolbar" aria-label="Teclado de operadores relacionais">
        <span className="symbol-toolbar-label">Inserir operador</span>
        <div className="symbol-buttons">
          {SYMBOLS.map(([symbol, label]) => (
            <button key={symbol} className="symbol-button" type="button" title={`Inserir ${label}`} aria-label={`Inserir ${label}`} onClick={() => insertSymbol(symbol)}>{symbol}</button>
          ))}
        </div>
        <button className="clear-symbols" type="button" title="Limpar consulta" onClick={() => { onChange(''); input.current.focus(); }}>limpar</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); close(); onSubmit(); }}>
        <div className="input-wrap" ref={wrap}>
          <span className="prompt-symbol">›</span>
          <textarea
            ref={input}
            rows={3}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Expressão de álgebra relacional"
            aria-describedby="query-shortcut"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="ac-list"
            aria-expanded={Boolean(ac)}
            aria-activedescendant={ac ? `ac-item-${ac.active}` : undefined}
            onChange={(event) => { onChange(event.target.value); requestAnimationFrame(() => open()); }}
            onKeyDown={onKeyDown}
            onClick={close}
            onBlur={() => setTimeout(close, 120)}
          />
          <button type="submit">Executar <span>↗</span></button>
          {ac && (
            <ul className="ac-list" id="ac-list" role="listbox" ref={list} style={{ top: ac.top, left: ac.left }}>
              {ac.items.map((item, index) => (
                <li key={`${item.label}-${index}`} className="ac-item" id={`ac-item-${index}`} role="option" aria-selected={index === ac.active}
                  onMouseDown={(event) => { event.preventDefault(); accept(index); }}>
                  <span className="ac-label"><Highlight label={item.label} typed={typed} /></span>
                  <span className="ac-kind">{item.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="input-help">
          <span id="query-shortcut" className="kbd-hint"><kbd>Enter</kbd> nova linha · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> executar · <kbd>Ctrl</kbd>+<kbd>Espaço</kbd> sugestões</span>
          <span>{attemptsLabel}</span>
        </div>
      </form>
    </>
  );
}
