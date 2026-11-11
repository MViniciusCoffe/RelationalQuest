import RelationalEngine from './engine';

// Autocomplete for the query editor: relation names, column names and aliases
// (created with ρ or ←). Context-aware:
//   outside braces          → relations and aliases
//   inside σ_{…} π_{…} ⨝_{…} → columns (of relations used in the statement first) + aliases as “A.”
//   after “X.”               → columns of X
const QueryAutocomplete = (() => {
  const WORD = /[A-Za-zÀ-ÿ_][\wÀ-ÿ]*$/;
  const QUALIFIED = /([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\.([\wÀ-ÿ]*)$/;
  const IDENT = '[A-Za-zÀ-ÿ_][\\wÀ-ÿ]*';
  const RENAME = new RegExp(`(?:ρ|rename)\\s*_?\\s*\\{\\s*(${IDENT})\\s*(?:\\(([^)]*)\\))?\\s*\\}\\s*\\(\\s*(${IDENT})?`, 'gi');
  const ASSIGN = new RegExp(`^\\s*(${IDENT})\\s*(?:\\(([^)]*)\\))?\\s*(?:←|<-|:=)`, 'gm');
  const MAX_ITEMS = 8;
  const fold = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const splitList = (list) => (list ?? '').split(',').map((item) => item.trim()).filter(Boolean);

  // ---------- what names exist ----------
  function collectRelations(query, caret, tables) {
    const relations = new Map(tables.map((table) => [fold(table.name), { name: table.name, columns: table.columns, kind: 'tabela' }]));
    const add = (name, columns) => {
      const key = fold(name);
      const existing = relations.get(key);
      if (existing?.kind === 'tabela') return;
      relations.set(key, { name, columns: columns.length ? columns : existing?.columns ?? [], kind: 'alias' });
    };
    // Complete statements: ask the engine (knows the real columns of every alias).
    const before = query.slice(0, caret);
    const complete = before.slice(0, before.lastIndexOf('\n') + 1) + query.slice(caret).split('\n').slice(1).join('\n');
    for (const alias of RelationalEngine.schemas(complete, tables)) add(alias.name, alias.columns);
    // Half-typed text: scan for ρ_{A}(R), ρ_{A(x,y)}(R) and “T ←”.
    for (const match of query.matchAll(RENAME)) {
      const source = match[3] ? relations.get(fold(match[3])) : null;
      add(match[1], match[2] !== undefined ? splitList(match[2]) : source?.columns ?? []);
    }
    for (const match of query.matchAll(ASSIGN)) add(match[1], splitList(match[2]));
    return relations;
  }

  // ---------- where the caret is ----------
  function caretContext(text) {
    const line = text.slice(text.lastIndexOf('\n') + 1);
    let depth = 0;
    for (const char of line) { if (char === '{') depth += 1; if (char === '}') depth = Math.max(0, depth - 1); }
    const quotes = (line.match(/'/g) ?? []).length % 2 === 1 || (line.match(/"/g) ?? []).length % 2 === 1;
    return { line, insideBraces: depth > 0, insideQuotes: quotes };
  }

  function rank(candidates, prefix) {
    const wanted = fold(prefix);
    const scored = candidates.map((candidate) => {
      const label = fold(candidate.label);
      const score = label.startsWith(wanted) ? 0 : label.includes(wanted) ? 1 : -1;
      return { ...candidate, score };
    }).filter((candidate) => candidate.score >= 0 && fold(candidate.insert) !== wanted);
    return scored.sort((a, b) => a.score - b.score || a.priority - b.priority || a.label.localeCompare(b.label)).slice(0, MAX_ITEMS);
  }

  function suggestions(query, caret, tables, forced) {
    const before = query.slice(0, caret);
    const { line, insideBraces, insideQuotes } = caretContext(before);
    if (insideQuotes) return null;
    const relations = collectRelations(query, caret, tables);

    const qualified = before.match(QUALIFIED);
    if (qualified) {
      const owner = relations.get(fold(qualified[1]));
      if (!owner) return null;
      const items = owner.columns.map((column) => ({ label: column, insert: column, detail: `coluna · ${owner.name}`, priority: 0 }));
      return { start: caret - qualified[2].length, items: rank(items, qualified[2]) };
    }

    const word = (before.match(WORD) ?? [''])[0];
    if (!word && !forced) return null;
    const start = caret - word.length;
    const relationItems = (insert) => [...relations.values()].map((rel) => ({ label: rel.name, insert: insert(rel), detail: rel.kind === 'tabela' ? 'tabela' : 'alias', priority: rel.kind === 'alias' ? 1 : 2, reopen: insert(rel).endsWith('.') }));

    if (!insideBraces) return { start, items: rank(relationItems((rel) => rel.name), word) };

    // Inside braces: columns, preferring relations mentioned in the current statement.
    const statement = line + query.slice(caret).split('\n')[0];
    const mentioned = new Set((statement.match(/[A-Za-zÀ-ÿ_][\wÀ-ÿ]*/g) ?? []).map(fold).filter((name) => relations.has(name)));
    const columns = new Map();
    for (const rel of relations.values()) {
      for (const column of rel.columns) {
        const key = fold(column);
        const entry = columns.get(key) ?? { label: column, insert: column, owners: [], priority: 9 };
        entry.owners.push(rel.name);
        if (mentioned.has(fold(rel.name))) entry.priority = 0;
        columns.set(key, entry);
      }
    }
    const columnItems = [...columns.values()].map((entry) => ({ ...entry, detail: `coluna · ${entry.owners.slice(0, 2).join(', ')}${entry.owners.length > 2 ? '…' : ''}` }));
    const qualifiers = relationItems((rel) => `${rel.name}.`).map((item) => ({ ...item, priority: mentioned.has(fold(item.label)) ? 1 : 10 }));
    return { start, items: rank([...columnItems, ...qualifiers], word) };
  }

  // ---------- caret pixel position (mirror-div technique) ----------
  const MIRRORED = ['boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize'];
  function caretCoordinates(textarea, position) {
    const mirror = document.createElement('div');
    const style = getComputedStyle(textarea);
    MIRRORED.forEach((property) => { mirror.style[property] = style[property]; });
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });
    mirror.textContent = textarea.value.slice(0, position);
    const marker = document.createElement('span');
    marker.textContent = textarea.value.slice(position) || '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const coords = { top: marker.offsetTop - textarea.scrollTop, left: marker.offsetLeft - textarea.scrollLeft, height: parseFloat(style.lineHeight) || 20 };
    mirror.remove();
    return coords;
  }

  return { suggestions, caretCoordinates };
})();

export default QueryAutocomplete;
