// Pure game logic for the algebra game: which tables a level uses, how a query is judged,
// and which operators a level exercises.
import RelationalEngine from './engine';
import databases from './databases';
import { allLevels as levels } from './trail';
import { plural } from '../format';

export { levels, databases };

export const sectionXp = { Tutorial: 100, 'Fácil': 100, 'Médio': 150, 'Difícil': 200, Insano: 300 };
export const sectionOrder = [...new Set(levels.map((level) => level.section))];
export const difficultyClass = { 'Fácil': 'easy', 'Médio': 'medium', 'Difícil': 'hard', Insano: 'insane' };

export const databaseOf = (level) => databases.find((db) => db.code === level.db);
export const levelTables = (level) => (level.db ? databaseOf(level).tables : level.tables);
export const sectionLevels = (section) => levels.map((level, index) => ({ level, index })).filter((item) => item.level.section === section);
export const positionInSection = (index) => sectionLevels(levels[index].section).findIndex((item) => item.index === index) + 1;

const expectedCache = new Map();
export function expectedRelation(level) {
  if (!expectedCache.has(level)) expectedCache.set(level, RelationalEngine.run(level.solution, levelTables(level)).relation);
  return expectedCache.get(level);
}

export const operatorNames = { 'σ': 'Seleção', 'π': 'Projeção', 'ρ': 'Renomeação', '←': 'Atribuição', '∪': 'União', '∩': 'Interseção', '−': 'Diferença', '×': 'Produto cartesiano', '⨝': 'Junção', '÷': 'Divisão' };
const solutionOperators = { 'σ': /σ/, 'π': /π/, 'ρ': /ρ/, '←': /←|<-|:=/, '∪': /∪/, '∩': /∩/, '−': /−|(?<![<\w])-(?!>)/, '×': /×/, '⨝': /⨝/, '÷': /÷/ };
// Operators a level exercises: those required plus those in the reference solution (quoted values ignored).
export function levelOperators(level) {
  const code = level.solution.replace(/'[^']*'|"[^"]*"/g, '');
  return Object.keys(operatorNames).filter((op) => (level.requires ?? []).includes(op) || solutionOperators[op].test(code));
}

const operatorAliases = { 'σ': /σ|select/i, 'π': /π|project/i, 'ρ': /ρ|rename/i, '∪': /∪/, '−': /−|(?<!<)-(?!>)/, '∩': /∩/, '⨝': /⨝/, '÷': /÷/, '×': /×/, '←': /←|<-|:=/ };

// Same columns (by base name, any order) and same set of tuples as the reference solution.
export function judgeLevel(level, query, outcome) {
  if (outcome.error) return { correct: false, reason: outcome.error };
  const used = (level.forbids ?? []).filter((operator) => operatorAliases[operator].test(query));
  if (used.length) return { correct: false, reason: `Nesta fase é proibido usar ${used.join(' e ')}. Reescreva com outros operadores.` };
  const missing = (level.requires ?? []).filter((operator) => !operatorAliases[operator].test(query));
  if (missing.length) return { correct: false, reason: `A tabela pode até bater, mas esta fase pede o operador ${missing.join(' e ')}.` };
  const actual = outcome.relation;
  const expected = expectedRelation(level);
  const expectedColumns = expected.columns.map((column) => column.split('.').pop());
  const order = expectedColumns.map((column) => RelationalEngine.findColumn(actual, column));
  if (actual.columns.length !== expected.columns.length || order.some((index) => index < 0)) return { correct: false, reason: `As colunas não batem: o objetivo tem ${expectedColumns.join(', ')} e sua consulta devolveu ${actual.columns.join(', ')}.` };
  const canonical = (rows) => rows.map((row) => JSON.stringify(row.map((cell) => String(cell).toLowerCase()))).sort();
  const left = canonical(actual.rows.map((row) => order.map((index) => row[index])));
  const right = canonical(expected.rows);
  if (left.length !== right.length) return { correct: false, reason: `As colunas estão certas, mas o objetivo tem ${plural(right.length, 'tupla', 'tuplas')} e sua consulta devolveu ${left.length}. Confira a consulta.` };
  if (left.some((row, index) => row !== right[index])) return { correct: false, reason: `Mesmo número de tuplas (${left.length}), mas não são as mesmas do objetivo. Confira a consulta.` };
  if (level.expectName && RelationalEngine.normalize(actual.name ?? '') !== RelationalEngine.normalize(level.expectName)) {
    return { correct: false, reason: `As tuplas estão certas, mas a relação resultante deveria se chamar ${level.expectName}${actual.name ? `, não ${actual.name}` : ''}.` };
  }
  return { correct: true };
}
