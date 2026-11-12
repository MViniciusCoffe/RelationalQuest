// Normalization engine: functional dependencies, closures, keys, normal forms,
// lossless-join (chase), dependency preservation, minimal cover and 3NF synthesis.
// Attribute sets are arrays kept in schema order. The scale stops at 3FN.
const Normalization = (() => {
  const fold = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const splitAttrs = (text) => String(text ?? '').split(/[,\s{}]+/).map((item) => item.trim()).filter(Boolean);
  const NF_ORDER = ['1FN', '2FN', '3FN'];

  // "a, b -> c, d"  →  { lhs: ['a','b'], rhs: ['c','d'] }
  function parseFd(text) {
    const parts = String(text).split(/→|->|=>/);
    if (parts.length !== 2) throw new Error(`“${String(text).trim()}” não é uma dependência. Use o formato a, b → c.`);
    const fd = { lhs: splitAttrs(parts[0]), rhs: splitAttrs(parts[1]) };
    if (!fd.lhs.length || !fd.rhs.length) throw new Error(`“${String(text).trim()}” precisa de atributos dos dois lados da seta.`);
    return fd;
  }

  // Builds a relation from content: { name, attrs, fds: ['a -> b'] , rows? }
  // An unnormalized spec (0FN) has a repeating `group: { name, attrs }` and rows shaped
  // [...outer values, [[group values], …]]; it is flattened into one atomic relation.
  function relation(spec) {
    const fds = spec.fds.map((fd) => (typeof fd === 'string' ? parseFd(fd) : fd));
    if (!spec.group || spec.outer) return { ...spec, fds }; // `outer` marks an already flattened relation
    const rows = spec.rows?.flatMap((row) => row[spec.attrs.length].map((item) => [...row.slice(0, spec.attrs.length), ...item]));
    return { ...spec, attrs: [...spec.attrs, ...spec.group.attrs], outer: spec.attrs, fds, rows };
  }

  const ordered = (set, attrs) => attrs.filter((attr) => set.has(attr));
  const subset = (a, b) => a.every((item) => b.includes(item));
  const sameSet = (a, b) => a.length === b.length && subset(a, b);
  const fdText = (fd) => `${fd.lhs.join(', ')} → ${[].concat(fd.rhs).join(', ')}`;
  const singletons = (fds) => fds.flatMap((fd) => fd.rhs.map((attr) => ({ lhs: fd.lhs, rhs: [attr] })));

  function closure(attrs, fds) {
    const result = new Set(attrs);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fd of fds) {
        if (fd.lhs.every((attr) => result.has(attr)) && fd.rhs.some((attr) => !result.has(attr))) {
          fd.rhs.forEach((attr) => result.add(attr));
          changed = true;
        }
      }
    }
    return result;
  }

  // Same algorithm, recording which dependency added what (for explanations).
  function closureTrace(attrs, fds) {
    const result = new Set(attrs);
    const steps = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const fd of fds) {
        const added = fd.rhs.filter((attr) => !result.has(attr));
        if (added.length && fd.lhs.every((attr) => result.has(attr))) {
          added.forEach((attr) => result.add(attr));
          steps.push({ fd, added, after: [...result] });
          changed = true;
        }
      }
    }
    return { result, steps };
  }

  const isSuperkey = (set, attrs, fds) => { const cl = closure(set, fds); return attrs.every((attr) => cl.has(attr)); };

  // Every subset of `items`, smallest first.
  function subsetsBySize(items) {
    const all = [];
    for (let mask = 0; mask < 1 << items.length; mask += 1) all.push(items.filter((_, index) => mask & (1 << index)));
    return all.sort((a, b) => a.length - b.length);
  }

  function candidateKeys(attrs, fds) {
    const onRight = new Set(fds.flatMap((fd) => fd.rhs.filter((attr) => !fd.lhs.includes(attr))));
    const core = attrs.filter((attr) => !onRight.has(attr)); // never determined → in every key
    const rest = attrs.filter((attr) => onRight.has(attr));
    const keys = [];
    for (const extra of subsetsBySize(rest)) {
      const candidate = attrs.filter((attr) => core.includes(attr) || extra.includes(attr));
      if (keys.some((key) => subset(key, candidate))) continue;
      if (isSuperkey(candidate, attrs, fds)) keys.push(candidate);
    }
    return keys;
  }

  // All minimal non-trivial dependencies X → A that hold inside `attrs` (projection of F).
  function projectFds(attrs, fds) {
    const result = [];
    for (const lhs of subsetsBySize(attrs)) {
      if (!lhs.length || lhs.length === attrs.length) continue;
      const cl = closure(lhs, fds);
      for (const attr of attrs) {
        if (lhs.includes(attr) || !cl.has(attr)) continue;
        const minimal = lhs.every((drop) => !closure(lhs.filter((item) => item !== drop), fds).has(attr));
        if (minimal) result.push({ lhs, rhs: [attr] });
      }
    }
    return result;
  }

  // Groups single-attribute dependencies with the same left side: a→b, a→c ⇒ a→b,c
  function groupFds(fds, attrs) {
    const groups = new Map();
    for (const fd of fds) {
      const key = fd.lhs.join('\u0000');
      if (!groups.has(key)) groups.set(key, { lhs: fd.lhs, rhs: [] });
      fd.rhs.forEach((attr) => { if (!groups.get(key).rhs.includes(attr)) groups.get(key).rhs.push(attr); });
    }
    return [...groups.values()].map((fd) => ({ lhs: fd.lhs, rhs: attrs ? attrs.filter((attr) => fd.rhs.includes(attr)) : fd.rhs }));
  }

  // Why X → A breaks a normal form, given the candidate keys. A prime attribute on the
  // right never breaks the 3FN (formal definition: X is a superkey or A is prime).
  function violationKind(lhs, attr, attrs, fds, keys) {
    if (isSuperkey(lhs, attrs, fds)) return 'ok';
    if (keys.some((key) => key.includes(attr))) return 'ok';
    if (keys.some((key) => subset(lhs, key) && lhs.length < key.length)) return 'parcial';
    return 'transitiva';
  }
  const KIND_RANK = { ok: 0, transitiva: 1, parcial: 2 };

  function classifyFd(fd, attrs, fds, keys = candidateKeys(attrs, fds)) {
    return fd.rhs.filter((attr) => !fd.lhs.includes(attr))
      .map((attr) => violationKind(fd.lhs, attr, attrs, fds, keys))
      .reduce((worst, kind) => (KIND_RANK[kind] > KIND_RANK[worst] ? kind : worst), 'ok');
  }

  function analyze(attrs, fds) {
    const keys = candidateKeys(attrs, fds);
    const prime = attrs.filter((attr) => keys.some((key) => key.includes(attr)));
    const minimal = projectFds(attrs, fds);
    const violations = minimal.map((fd) => ({ ...fd, kind: violationKind(fd.lhs, fd.rhs[0], attrs, fds, keys) })).filter((fd) => fd.kind !== 'ok');
    const has = (kind) => violations.some((fd) => fd.kind === kind);
    const nf = has('parcial') ? '1FN' : has('transitiva') ? '2FN' : '3FN';
    return { keys, prime, minimal, violations, nf };
  }
  const meets = (nf, target) => NF_ORDER.indexOf(nf) >= NF_ORDER.indexOf(target);

  // Chase test for a lossless join of any number of parts.
  function lossless(attrs, parts, fds) {
    const table = parts.map((part, row) => attrs.map((attr) => (part.includes(attr) ? 'a' : `b${row}`)));
    const deps = singletons(fds).filter((fd) => fd.lhs.every((attr) => attrs.includes(attr)) && attrs.includes(fd.rhs[0]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const fd of deps) {
        const lhsIdx = fd.lhs.map((attr) => attrs.indexOf(attr));
        const target = attrs.indexOf(fd.rhs[0]);
        const groups = new Map();
        table.forEach((row) => { const key = lhsIdx.map((index) => row[index]).join('|'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
        for (const rows of groups.values()) {
          if (rows.length < 2) continue;
          const value = rows.some((row) => row[target] === 'a') ? 'a' : rows[0][target];
          rows.forEach((row) => { if (row[target] !== value) { row[target] = value; changed = true; } });
        }
      }
    }
    return table.some((row) => row.every((cell) => cell === 'a'));
  }

  // Dependencies of F that can no longer be enforced inside a single part.
  function lostDependencies(parts, fds) {
    return singletons(fds).filter((fd) => {
      const result = new Set(fd.lhs);
      let changed = true;
      while (changed) {
        changed = false;
        for (const part of parts) {
          const inside = part.filter((attr) => result.has(attr));
          for (const attr of closure(inside, fds)) {
            if (part.includes(attr) && !result.has(attr)) { result.add(attr); changed = true; }
          }
        }
      }
      return !result.has(fd.rhs[0]);
    });
  }

  function minimalCover(fds, attrs) {
    let cover = singletons(fds).filter((fd) => !fd.lhs.includes(fd.rhs[0]));
    // 1. remove extraneous attributes on the left
    cover = cover.map((fd) => {
      let lhs = [...fd.lhs];
      for (const attr of fd.lhs) {
        const reduced = lhs.filter((item) => item !== attr);
        if (reduced.length && closure(reduced, cover).has(fd.rhs[0])) lhs = reduced;
      }
      return { lhs: attrs ? attrs.filter((attr) => lhs.includes(attr)) : lhs, rhs: fd.rhs };
    });
    // dedupe
    cover = cover.filter((fd, index) => cover.findIndex((other) => sameSet(other.lhs, fd.lhs) && other.rhs[0] === fd.rhs[0]) === index);
    // 2. remove redundant dependencies
    for (let index = cover.length - 1; index >= 0; index -= 1) {
      const others = cover.filter((_, other) => other !== index);
      if (closure(cover[index].lhs, others).has(cover[index].rhs[0])) cover = others;
    }
    return cover;
  }

  const equivalent = (f, g) => f.every((fd) => subset(fd.rhs, [...closure(fd.lhs, g)])) && g.every((fd) => subset(fd.rhs, [...closure(fd.lhs, f)]));

  // Problems with a proposed minimal cover `g` of `f` (empty list = correct).
  function checkCover(f, g) {
    const issues = [];
    const missing = f.filter((fd) => !subset(fd.rhs, [...closure(fd.lhs, g)]));
    const extra = g.filter((fd) => !subset(fd.rhs, [...closure(fd.lhs, f)]));
    missing.forEach((fd) => issues.push(`Sua cobertura não consegue deduzir ${fdText(fd)}.`));
    extra.forEach((fd) => issues.push(`${fdText(fd)} não decorre das dependências originais.`));
    if (issues.length) return issues;
    g.filter((fd) => fd.rhs.length > 1).forEach((fd) => issues.push(`${fdText(fd)} tem mais de um atributo à direita; separe em uma dependência por atributo.`));
    g.forEach((fd) => {
      fd.lhs.forEach((attr) => {
        const reduced = fd.lhs.filter((item) => item !== attr);
        if (reduced.length && subset(fd.rhs, [...closure(reduced, g)])) issues.push(`Em ${fdText(fd)}, o atributo ${attr} é estranho: ${reduced.join(', ')} já determina ${fd.rhs.join(', ')}.`);
      });
    });
    g.forEach((fd, index) => {
      const others = g.filter((_, other) => other !== index);
      if (subset(fd.rhs, [...closure(fd.lhs, others)])) issues.push(`${fdText(fd)} é redundante: dá para deduzi-la das outras.`);
    });
    return issues;
  }

  // Removes parts contained in other parts.
  const dropContained = (parts) => parts.filter((part, index) => !parts.some((other, j) => j !== index && subset(part, other) && (part.length < other.length || j < index)));

  function synthesize3NF(attrs, fds) {
    const cover = groupFds(minimalCover(fds, attrs), attrs);
    let parts = cover.map((fd) => attrs.filter((attr) => fd.lhs.includes(attr) || fd.rhs.includes(attr)));
    const keys = candidateKeys(attrs, fds);
    if (!parts.some((part) => keys.some((key) => subset(key, part)))) parts.push(keys[0]);
    parts = dropContained(parts);
    const leftover = attrs.filter((attr) => !parts.some((part) => part.includes(attr)));
    if (leftover.length) parts[parts.length - 1] = attrs.filter((attr) => parts[parts.length - 1].includes(attr) || leftover.includes(attr));
    return parts;
  }

  // Sample-data helpers: projection (distinct) and natural join.
  function projectRows(attrs, rows, part) {
    const indexes = part.map((attr) => attrs.indexOf(attr));
    const seen = new Set();
    return rows.map((row) => indexes.map((index) => row[index])).filter((row) => { const key = JSON.stringify(row); if (seen.has(key)) return false; seen.add(key); return true; });
  }
  function joinRows(parts, rowsByPart) {
    let columns = parts[0];
    let rows = rowsByPart[0];
    for (let i = 1; i < parts.length; i += 1) {
      const common = parts[i].filter((attr) => columns.includes(attr));
      const extra = parts[i].filter((attr) => !columns.includes(attr));
      const next = [];
      for (const left of rows) {
        for (const right of rowsByPart[i]) {
          if (common.every((attr) => String(left[columns.indexOf(attr)]) === String(right[parts[i].indexOf(attr)]))) next.push([...left, ...extra.map((attr) => right[parts[i].indexOf(attr)])]);
        }
      }
      columns = [...columns, ...extra];
      rows = next;
    }
    return { columns, rows };
  }

  // Does sample data respect the dependencies? (used to validate content)
  function rowsSatisfy(attrs, rows, fds) {
    return singletons(fds).every((fd) => {
      const seen = new Map();
      return rows.every((row) => {
        const key = fd.lhs.map((attr) => row[attrs.indexOf(attr)]).join('|');
        const value = row[attrs.indexOf(fd.rhs[0])];
        if (seen.has(key) && seen.get(key) !== value) return false;
        seen.set(key, value);
        return true;
      });
    });
  }

  // Resolves user-typed attribute names against a schema (case/accent-insensitive).
  function resolve(names, attrs) {
    const unknown = [];
    const found = [];
    for (const name of names) {
      const match = attrs.find((attr) => fold(attr) === fold(name));
      if (match) { if (!found.includes(match)) found.push(match); } else unknown.push(name);
    }
    return { attrs: attrs.filter((attr) => found.includes(attr)), unknown };
  }

  return {
    fold, splitAttrs, parseFd, relation, fdText, singletons, ordered, subset, sameSet, NF_ORDER, meets,
    closure, closureTrace, isSuperkey, candidateKeys, projectFds, groupFds, classifyFd, analyze,
    lossless, lostDependencies, minimalCover, equivalent, checkCover, synthesize3NF,
    projectRows, joinRows, rowsSatisfy, resolve,
  };
})();

export default Normalization;
