// Relational algebra evaluator.
// A relation is { name, columns, origins, rows }:
//   name     – relation name shown in the UI (null for anonymous results such as A × B)
//   columns  – attribute labels as displayed (may be qualified, e.g. "Medico.nome")
//   origins  – for each column, the relation it came from; lets "E.depto" resolve
//   rows     – arrays of cell values
const RelationalEngine = (() => {
  class QueryError extends Error {}
  const fail = (message) => { throw new QueryError(message); };

  const IDENT = /^[A-Za-zÀ-ÿ_][\wÀ-ÿ]*$/;
  const BINARY = ['∪', '∩', '−', '-', '×', '⨝', '÷'];
  const UNARY = /^(σ|select|π|project|ρ|rename)\s*_?\s*\{([^}]*)\}\s*([\s\S]*)$/i;
  const RENAME_SHORT = /^(ρ|rename)\s*_\s*([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\s*(\([\s\S]*)$/i;
  const AND = /\s+(?:and|e)\s+|&&|∧|,/i;
  const OR = /\s+(?:or|ou)\s+|\|\||∨/i;
  const ATOM = /^([\wÀ-ÿ.]+)\s*(===|==|=|!=|<>|≠|>=|≥|<=|≤|>|<)\s*('[^']*'|"[^"]*"|[^\s<>=!'"≠≥≤]+)$/;
  const ASSIGNMENT = /^([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\s*(\([^)]*\))?\s*(?:←|<-|:=)\s*([\s\S]+)$/;

  const stripAccents = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalize = (text) => stripAccents(text).toLowerCase().replace(/[^a-z0-9_.]/g, '');
  const baseLabel = (column) => String(column).split('.').pop();
  const baseName = (column) => normalize(baseLabel(column));
  const prefixOf = (column) => { const n = normalize(column); const dot = n.lastIndexOf('.'); return dot > 0 ? n.slice(0, dot) : null; };
  const rowKey = (row) => JSON.stringify(row.map(String));
  const dedupe = (rows) => { const seen = new Set(); return rows.filter((row) => { const key = rowKey(row); if (seen.has(key)) return false; seen.add(key); return true; }); };
  const comparable = (value) => { const text = String(value).trim(); return text !== '' && !Number.isNaN(Number(text)) ? Number(text) : stripAccents(text).toLowerCase(); };
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

  function relation(name, columns, rows, origins) {
    return { name, columns, rows, origins: origins ?? columns.map(() => name) };
  }

  // ---------- attribute lookup ----------
  function findColumn(rel, attribute, { optional = false } = {}) {
    const wanted = normalize(attribute);
    const dot = wanted.lastIndexOf('.');
    const candidates = rel.columns.flatMap((column, index) => {
      if (dot < 0) return baseName(column) === wanted ? [index] : [];
      const prefix = wanted.slice(0, dot); const base = wanted.slice(dot + 1);
      const fromOrigin = rel.origins[index] && normalize(rel.origins[index]) === prefix;
      return baseName(column) === base && (fromOrigin || prefixOf(column) === prefix) ? [index] : [];
    });
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const options = candidates.map((index) => qualifiedLabel(rel, index));
      fail(`“${attribute}” é ambíguo: aparece em ${options.join(' e ')}. Escreva o nome completo, como “${options[0]}”.`);
    }
    if (optional) return -1;
    fail(`A coluna “${attribute}” não existe${rel.name ? ` em ${rel.name}` : ''}. Colunas disponíveis: ${rel.columns.join(', ')}.`);
  }
  const qualifiedLabel = (rel, index) => (prefixOf(rel.columns[index]) || !rel.origins[index] ? rel.columns[index] : `${rel.origins[index]}.${rel.columns[index]}`);

  // Qualify labels whose base name appears more than once ("nome" → "Medico.nome").
  function qualifyClashes(columns, origins) {
    const counts = new Map();
    columns.forEach((column) => counts.set(baseName(column), (counts.get(baseName(column)) ?? 0) + 1));
    const labels = columns.map((column, index) => (counts.get(baseName(column)) > 1 && !prefixOf(column) && origins[index] ? `${origins[index]}.${column}` : column));
    const seen = new Set();
    for (const label of labels) {
      if (seen.has(normalize(label))) fail(`O resultado teria duas colunas “${label}”. Dê nomes diferentes às relações com ρ antes de combiná-las, por exemplo ρ_{X}(…).`);
      seen.add(normalize(label));
    }
    return labels;
  }

  function ensureUnique(columns, hint = 'Escolha nomes diferentes.') {
    const seen = new Set();
    for (const column of columns) {
      if (seen.has(normalize(column))) fail(`O atributo “${column}” ficaria repetido. ${hint}`);
      seen.add(normalize(column));
    }
  }

  // ---------- parsing helpers ----------
  function matchingParen(text, start) {
    let depth = 0;
    for (let index = start; index < text.length; index += 1) {
      if (text[index] === '(') depth += 1;
      else if (text[index] === ')') { depth -= 1; if (depth === 0) return index; }
    }
    return -1;
  }
  function stripParens(text) {
    let value = text.trim();
    while (value.startsWith('(') && matchingParen(value, 0) === value.length - 1) value = value.slice(1, -1).trim();
    return value;
  }
  function checkBalance(text) {
    let round = 0; let curly = 0;
    for (const char of text) {
      if (char === '(') round += 1; if (char === ')') round -= 1;
      if (char === '{') curly += 1; if (char === '}') curly -= 1;
      if (round < 0 || curly < 0) break;
    }
    if (round !== 0) fail('Os parênteses não estão balanceados: confira se cada “(” tem seu “)”.');
    if (curly !== 0) fail('As chaves não estão balanceadas: confira se cada “{” tem seu “}”.');
  }
  // Binary operators share one precedence level and associate to the left,
  // so the expression is split at the LAST top-level operator.
  function lastTopLevelOperator(text) {
    let depth = 0; let found = null;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '(' || char === '{') depth += 1;
      else if (char === ')' || char === '}') depth -= 1;
      else if (depth === 0) {
        const operator = BINARY.find((symbol) => text.startsWith(symbol, index));
        if (operator) found = { operator, index };
      }
    }
    return found;
  }

  // ---------- operators ----------
  function compileCondition(rel, condition) {
    if (!condition.trim()) fail('A condição está vazia: escreva algo como σ_{salario>4000}(R).');
    return condition.split(OR).map((group) => group.split(AND).map((part) => {
      const text = part.trim();
      const match = text.match(ATOM);
      if (!match) fail(`Não entendi a condição “${text || condition}”. Use atributo, comparador e valor, como “salario>4000”.`);
      const raw = match[3];
      const quoted = /^['"]/.test(raw);
      const numeric = !Number.isNaN(Number(raw));
      const rightIndex = quoted || numeric ? -1 : findColumn(rel, raw, { optional: true });
      return { leftIndex: findColumn(rel, match[1]), operator: match[2], rightIndex, literal: comparable(quoted ? raw.slice(1, -1) : raw) };
    }));
  }
  function testAtom(row, atom) {
    let left = comparable(row[atom.leftIndex]);
    let right = atom.rightIndex >= 0 ? comparable(row[atom.rightIndex]) : atom.literal;
    if (typeof left !== typeof right) { left = String(left); right = String(right); }
    switch (atom.operator) {
      case '=': case '==': case '===': return left === right;
      case '!=': case '<>': case '≠': return left !== right;
      case '>': return left > right;
      case '<': return left < right;
      case '>=': case '≥': return left >= right;
      case '<=': case '≤': return left <= right;
      default: return false;
    }
  }
  function select(rel, condition) {
    const groups = compileCondition(rel, condition);
    return relation(rel.name, rel.columns, rel.rows.filter((row) => groups.some((group) => group.every((atom) => testAtom(row, atom)))), rel.origins);
  }

  function project(rel, list) {
    const names = list.split(',').map((name) => name.trim()).filter(Boolean);
    if (!names.length) fail('A projeção precisa de pelo menos um atributo: π_{coluna}(R).');
    const indexes = names.map((name) => findColumn(rel, name));
    if (new Set(indexes).size !== indexes.length) fail('A projeção pediu o mesmo atributo duas vezes.');
    return relation(rel.name, indexes.map((index) => rel.columns[index]), dedupe(rel.rows.map((row) => indexes.map((index) => row[index]))), indexes.map((index) => rel.origins[index]));
  }

  // ρ_{E}(R)  ρ_{E(a,b)}(R)  ρ_{(a,b)}(R)  ρ_{novo←antigo, …}(R)  ρ_{antigo→novo}(R)  ρ_{novo/antigo}(R)
  function rename(rel, spec) {
    const text = spec.trim();
    if (!text) fail('ρ precisa de um nome: ρ_{Nome}(R).');
    const whole = text.match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)?\s*(?:\(([^)]*)\))?$/);
    if (whole && (whole[1] || whole[2] !== undefined)) {
      const name = whole[1] ?? null;
      let columns = rel.columns.map(baseLabel);
      if (whole[2] !== undefined) {
        const list = whole[2].split(',').map((column) => column.trim());
        if (list.length !== rel.columns.length || list.some((column) => !IDENT.test(column))) {
          fail(`ρ_{${text}} precisa de ${plural(rel.columns.length, 'nome', 'nomes')} de atributo, um para cada coluna (${rel.columns.join(', ')}).`);
        }
        columns = list;
      } else if (!name) {
        columns = rel.columns;
      }
      const origins = columns.map((_, index) => name ?? rel.origins[index]);
      if (name) ensureUnique(columns, whole[2] === undefined ? `Use ρ_{${name}(a, b, …)} para dar um nome a cada uma das ${rel.columns.length} colunas.` : undefined);
      return { rel: relation(name ?? rel.name, name ? columns : qualifyClashes(columns, origins), rel.rows, origins), newName: name };
    }
    const columns = [...rel.columns];
    for (const item of text.split(',').map((part) => part.trim()).filter(Boolean)) {
      let match; let oldName; let newName;
      if ((match = item.match(/^(.+?)\s*(?:←|<-)\s*(.+)$/))) [, newName, oldName] = match;
      else if ((match = item.match(/^(.+?)\s*(?:→|->)\s*(.+)$/))) [, oldName, newName] = match;
      else if ((match = item.match(/^(.+?)\s*\/\s*(.+)$/))) [, newName, oldName] = match;
      else fail(`Não entendi a renomeação “${item}”. Use ρ_{Nome}(R), ρ_{Nome(a,b)}(R) ou ρ_{novo←antigo}(R).`);
      newName = newName.trim();
      if (!IDENT.test(newName)) fail(`“${newName}” não é um nome de atributo válido.`);
      columns[findColumn(rel, oldName.trim())] = newName;
    }
    ensureUnique(columns);
    return { rel: relation(rel.name, columns, rel.rows, rel.origins), newName: null };
  }

  function setOperation(operator, left, right) {
    const label = { '∪': 'A união', '∩': 'A interseção', '−': 'A diferença' }[operator];
    if (left.columns.length !== right.columns.length) {
      fail(`${label} exige relações compatíveis: a da esquerda tem ${plural(left.columns.length, 'atributo', 'atributos')} (${left.columns.join(', ')}) e a da direita, ${right.columns.length} (${right.columns.join(', ')}).`);
    }
    const rightKeys = new Set(right.rows.map(rowKey));
    const rows = operator === '∪' ? [...left.rows, ...right.rows]
      : operator === '∩' ? left.rows.filter((row) => rightKeys.has(rowKey(row)))
        : left.rows.filter((row) => !rightKeys.has(rowKey(row)));
    const sameName = left.name && right.name && normalize(left.name) === normalize(right.name);
    return relation(sameName ? left.name : null, left.columns, dedupe(rows), left.origins);
  }

  function product(left, right) {
    const origins = [...left.origins, ...right.origins];
    const columns = qualifyClashes([...left.columns, ...right.columns], origins);
    return relation(null, columns, left.rows.flatMap((leftRow) => right.rows.map((rightRow) => [...leftRow, ...rightRow])), origins);
  }

  function naturalJoin(left, right) {
    const count = (rel, base) => rel.columns.filter((column) => baseName(column) === base).length;
    const shared = left.columns.map(baseName).filter((base, index, all) => all.indexOf(base) === index && count(left, base) === 1 && count(right, base) === 1);
    if (!shared.length) return product(left, right);
    const pairs = shared.map((base) => [left.columns.findIndex((column) => baseName(column) === base), right.columns.findIndex((column) => baseName(column) === base)]);
    const rightKept = right.columns.map((_, index) => index).filter((index) => !pairs.some(([, rightIndex]) => rightIndex === index));
    const origins = [...left.origins, ...rightKept.map((index) => right.origins[index])];
    const columns = qualifyClashes([...left.columns.map((column, index) => (pairs.some(([leftIndex]) => leftIndex === index) ? baseLabel(column) : column)), ...rightKept.map((index) => right.columns[index])], origins);
    const rows = left.rows.flatMap((leftRow) => right.rows
      .filter((rightRow) => pairs.every(([leftIndex, rightIndex]) => String(leftRow[leftIndex]) === String(rightRow[rightIndex])))
      .map((rightRow) => [...leftRow, ...rightKept.map((index) => rightRow[index])]));
    return relation(null, columns, rows, origins);
  }

  function divide(left, right) {
    const divisorIndexes = right.columns.map((column) => findColumn(left, baseLabel(column), { optional: true }));
    if (divisorIndexes.some((index) => index < 0)) fail(`Na divisão A ÷ B, todos os atributos de B (${right.columns.join(', ')}) precisam existir em A (${left.columns.join(', ')}).`);
    const kept = left.columns.map((_, index) => index).filter((index) => !divisorIndexes.includes(index));
    if (!kept.length) fail('Na divisão A ÷ B, A precisa ter atributos além dos de B.');
    const candidates = dedupe(left.rows.map((row) => kept.map((index) => row[index])));
    const present = new Set(left.rows.map((row) => rowKey([...kept.map((index) => row[index]), ...divisorIndexes.map((index) => row[index])])));
    const rows = candidates.filter((tuple) => right.rows.every((required) => present.has(rowKey([...tuple, ...required]))));
    return relation(left.name, kept.map((index) => left.columns[index]), rows, kept.map((index) => left.origins[index]));
  }

  // ---------- evaluation ----------
  function lookup(name, context) {
    const found = context.temps.get(normalize(name)) ?? context.catalog.get(normalize(name));
    if (!found) {
      const temps = [...context.temps.values()].map((rel) => rel.name);
      fail(`Não encontrei a relação “${name}”. Disponíveis: ${[...context.catalog.values()].map((table) => table.name).join(', ')}${temps.length ? `; criadas na consulta: ${temps.join(', ')}` : ''}.`);
    }
    return relation(found.name, [...found.columns], found.rows.map((row) => [...row]), found.origins ? [...found.origins] : undefined);
  }

  function evaluate(expression, context) {
    const text = stripParens(expression);
    if (!text) fail('Há uma expressão vazia: confira parênteses e operadores.');
    const binary = lastTopLevelOperator(text);
    if (binary) {
      const leftText = text.slice(0, binary.index);
      let rightText = text.slice(binary.index + binary.operator.length);
      let theta = null;
      if (binary.operator === '⨝') {
        const match = rightText.match(/^\s*_?\s*\{([^}]*)\}([\s\S]*)$/);
        if (match) { theta = match[1]; rightText = match[2]; }
      }
      if (!leftText.trim() || !rightText.trim()) fail(`O operador ${binary.operator} precisa de uma relação de cada lado.`);
      const left = evaluate(leftText, context);
      const right = evaluate(rightText, context);
      const operator = binary.operator === '-' ? '−' : binary.operator;
      if (operator === '×') return product(left, right);
      if (operator === '⨝') return theta !== null ? select(product(left, right), theta) : naturalJoin(left, right);
      if (operator === '÷') return divide(left, right);
      return setOperation(operator, left, right);
    }
    const unary = text.match(UNARY) ?? text.match(RENAME_SHORT);
    if (unary) {
      const symbol = { select: 'σ', project: 'π', rename: 'ρ' }[unary[1].toLowerCase()] ?? unary[1];
      const rest = unary[3].trim();
      if (!rest.startsWith('(') || matchingParen(rest, 0) !== rest.length - 1) fail(`Depois de ${symbol}_{…} escreva a relação entre parênteses, como ${symbol}_{…}(Relação).`);
      const source = evaluate(rest.slice(1, -1), context);
      if (symbol === 'σ') return select(source, unary[2]);
      if (symbol === 'π') return project(source, unary[2]);
      const { rel, newName } = rename(source, unary[2]);
      if (newName) context.temps.set(normalize(newName), rel);
      return rel;
    }
    if (IDENT.test(text)) return lookup(text, context);
    if (/^(σ|π|ρ|select|project|rename)/i.test(text)) fail(`Não entendi “${text}”. A forma é operador_{parâmetro}(Relação), como σ_{depto=4}(Empregado).`);
    fail(`Não entendi “${text}”. Confira os operadores e os nomes das relações.`);
  }

  // Runs one or more statements (separated by line breaks or “;”).
  function run(query, tables) {
    const context = { catalog: new Map(tables.map((table) => [normalize(table.name), table])), temps: new Map() };
    const statements = query.split(/;|\n/).map((statement) => statement.trim()).filter(Boolean);
    const steps = [];
    let current = null;
    try {
      if (!statements.length) fail('A consulta está vazia.');
      for (const statement of statements) {
        current = statement;
        checkBalance(statement);
        const assignment = statement.match(ASSIGNMENT);
        let result = evaluate(assignment ? assignment[3] : statement, context);
        if (assignment) {
          result = rename(result, `${assignment[1]}${assignment[2] ?? ''}`).rel;
          context.temps.set(normalize(result.name), result);
        }
        steps.push({ statement, relation: result, assigned: Boolean(assignment) });
      }
      return { relation: steps[steps.length - 1].relation, steps };
    } catch (error) {
      if (!(error instanceof QueryError)) throw error;
      return { error: error.message, failedStatement: current, steps };
    }
  }

  function tryFindColumn(rel, attribute) {
    try { return findColumn(rel, attribute, { optional: true }); } catch (error) { if (error instanceof QueryError) return -1; throw error; }
  }

  // Names visible to the player while typing: base tables plus every alias
  // created by ρ or ← in statements that evaluate (errors are skipped).
  function schemas(query, tables) {
    const context = { catalog: new Map(tables.map((table) => [normalize(table.name), table])), temps: new Map() };
    for (const statement of query.split(/;|\n/).map((line) => line.trim()).filter(Boolean)) {
      try {
        checkBalance(statement);
        const assignment = statement.match(ASSIGNMENT);
        const result = evaluate(assignment ? assignment[3] : statement, context);
        if (assignment) {
          const renamed = rename(result, `${assignment[1]}${assignment[2] ?? ''}`).rel;
          context.temps.set(normalize(renamed.name), renamed);
        }
      } catch (error) {
        if (!(error instanceof QueryError)) throw error;
      }
    }
    return [...context.temps.values()].map((rel) => ({ name: rel.name, columns: rel.columns.map(baseLabel) }));
  }

  return { run, normalize, findColumn: tryFindColumn, schemas };
})();

export default RelationalEngine;
