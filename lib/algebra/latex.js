// Converts a Relational Quest query into textbook LaTeX, e.g.
//   π_{nomeE}(σ_{depto=4, salario>4000}(Empregado))
//   → \pi_{\textit{nomeE}}(\sigma_{\textit{depto} = 4 \land \textit{salario} > 4000}(\textit{Empregado}))
// Tolerant of half-typed input: unclosed braces are closed at the end of each line.
const QueryLatex = (() => {
  const TOKEN = /\s+|'[^']*'?|"[^"]*"?|===|==|!=|<>|>=|<=|<-|->|:=|&&|\|\||[A-Za-zÀ-ÿ_][\wÀ-ÿ]*(?:\.[A-Za-zÀ-ÿ_][\wÀ-ÿ]*)*|\d+(?:\.\d+)?|[\s\S]/gu;
  const SUBSCRIPTED = { 'σ': '\\sigma', 'π': '\\pi', 'ρ': '\\rho', '⨝': '\\bowtie' };
  const KEYWORDS = { select: 'σ', project: 'π', rename: 'ρ' };
  const SYMBOLS = {
    '∪': '\\cup', '∩': '\\cap', '−': '-', '-': '-', '×': '\\times', '÷': '\\div',
    '←': '\\leftarrow', '<-': '\\leftarrow', ':=': '\\leftarrow', '→': '\\rightarrow', '->': '\\rightarrow',
    '∧': '\\land', '&&': '\\land', '∨': '\\lor', '||': '\\lor',
    '≠': '\\neq', '!=': '\\neq', '<>': '\\neq', '≥': '\\geq', '>=': '\\geq', '≤': '\\leq', '<=': '\\leq',
    '==': '=', '===': '=', '=': '=', '<': '<', '>': '>', '(': '(', ')': ')', '/': '/',
  };
  const CONDITION_CONTEXTS = new Set(['σ', '⨝']);

  const escapeText = (text) => text.replace(/[\\{}$&#^_%~]/g, (char) => ({ '\\': '\\textbackslash{}', '^': '\\^{}', '~': '\\~{}' }[char] ?? `\\${char}`));

  function statementToLatex(statement) {
    const tokens = statement.match(TOKEN) ?? [];
    const out = [];
    const stack = [];
    let pending = null;      // operator waiting for its subscript
    let underscore = false;  // "_" already emitted for the pending operator
    const nextSolid = (from) => tokens.slice(from + 1).find((token) => !/^\s+$/.test(token));

    tokens.forEach((token, index) => {
      if (/^\s+$/.test(token)) return;
      const context = stack[stack.length - 1];
      const inCondition = CONDITION_CONTEXTS.has(context);
      const lower = token.toLowerCase();

      if (token === '_') {
        if (pending) { out.push('_'); underscore = true; } else out.push('\\_');
        return;
      }
      if (token === '{') {
        out.push(pending ? (underscore ? '{' : '_{') : '\\{');
        stack.push(pending ?? 'group');
        pending = null; underscore = false;
        return;
      }
      if (token === '}') {
        if (stack.length) { const opened = stack.pop(); out.push(opened === 'group' ? '\\}' : '}'); }
        return;
      }
      pending = null; underscore = false;

      const operator = SUBSCRIPTED[token] ? token : (KEYWORDS[lower] && ['_', '{'].includes(nextSolid(index)) ? KEYWORDS[lower] : null);
      if (operator) { out.push(SUBSCRIPTED[operator]); pending = operator; return; }
      if (inCondition && (lower === 'and' || lower === 'e' || token === ',')) { out.push('\\land'); return; }
      if (inCondition && (lower === 'or' || lower === 'ou')) { out.push('\\lor'); return; }
      if (token === ',') { out.push(',\\,'); return; }
      if (SYMBOLS[token]) { out.push(SYMBOLS[token]); return; }
      if (/^['"]/.test(token)) { out.push(`\\text{${escapeText(token)}}`); return; }
      if (/^\d/.test(token)) { out.push(token); return; }
      if (/^[A-Za-zÀ-ÿ_]/.test(token)) { out.push(`\\textit{${escapeText(token)}}`); return; }
      out.push(escapeText(token));
    });
    while (stack.length) out.push(stack.pop() === 'group' ? '\\}' : '}');
    return out.join(' ').replace(/ ([_)}]|\^)/g, '$1').replace(/([({_]) /g, '$1').replace(/\\(sigma|pi|rho|bowtie) _/g, '\\$1_');
  }

  function toLatex(query) {
    const lines = query.split(/;|\n/).map((line) => line.trim()).filter(Boolean).map(statementToLatex);
    if (lines.length <= 1) return lines[0] ?? '';
    return `\\begin{aligned}\n${lines.map((line) => `&${line}`).join(' \\\\\n')}\n\\end{aligned}`;
  }

  return { toLatex };
})();

export default QueryLatex;
