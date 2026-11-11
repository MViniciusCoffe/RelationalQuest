// Judges a challenge answer and builds the explanations shown after it.
// answer = { picked: Set, keys: string[][], classify: {index: kind}, choice, nf, text }
import NF from '@/lib/normalization/engine';
import { AttrSet, CodeList, Fd, KeyList, Trace, Violations, Decomposition, Spurious, kindLabel, kindHelp, partName, partsText } from './ui';
import { plural } from '@/lib/format';

const FdInline = ({ fds }) => fds.map((fd, index) => <span key={index}>{index > 0 && ', '}<Fd fd={fd} /></span>);

function parseDecomposition(text, rel) {
  const lines = text.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { error: 'Escreva pelo menos uma relação.' };
  const names = [];
  const parts = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)?\s*[({]([^)}]*)[)}]\s*$/) ?? [null, null, line];
    const { attrs, unknown } = NF.resolve(NF.splitAttrs(match[2]), rel.attrs);
    if (unknown.length) return { error: <>Na linha {index + 1}, <CodeList items={unknown} /> não é atributo de {rel.name}. Use: <CodeList items={rel.attrs} separator=" " />.</> };
    if (!attrs.length) return { error: `A linha ${index + 1} não tem atributos.` };
    names.push(match[1] ?? partName(index));
    parts.push(attrs);
  }
  return { names, parts };
}

function judgeDecomposition(level, rel, text) {
  if (!text.trim()) return { empty: 'Escreva as relações da decomposição.' };
  const parsed = parseDecomposition(text, rel);
  if (parsed.error) return { correct: false, reason: parsed.error };
  const { parts, names } = parsed;
  const analysis = <Decomposition rel={rel} parts={parts} names={names} target={level.target} />;
  const missing = rel.attrs.filter((attr) => !parts.some((part) => part.includes(attr)));
  if (missing.length) return { correct: false, analysis, reason: <><CodeList items={missing} /> sumiu: todo atributo precisa estar em alguma relação.</> };
  const below = parts.map((part, index) => ({ name: names[index], nf: NF.analyze(part, rel.fds).nf })).filter((item) => !NF.meets(item.nf, level.target));
  if (below.length) return { correct: false, analysis, reason: <>{below.map((item, index) => <span key={index}>{index > 0 && ', '}<b>{item.name}</b> está só na {item.nf}</span>)}; a meta é {level.target}. Veja as violações no cartão.</> };
  if (!NF.lossless(rel.attrs, parts, rel.fds)) {
    return {
      correct: false,
      analysis: <>{analysis}{rel.rows && <Spurious rel={rel} parts={parts} />}</>,
      reason: 'A junção das partes gera tuplas falsas (com perda). Os atributos em comum precisam ser chave de alguma parte; às vezes falta uma relação com uma chave candidata.',
    };
  }
  const lost = NF.lostDependencies(parts, rel.fds);
  if (level.preserve && lost.length) return { correct: false, analysis, reason: <>Sem perda e na {level.target}, mas perde <FdInline fds={lost} />. Mantenha cada dependência inteira dentro de alguma relação.</> };
  const redundant = parts.findIndex((part, index) => parts.some((other, j) => j !== index && NF.subset(part, other)));
  const note = redundant >= 0
    ? <>Dica: <b>{names[redundant]}</b> está contida em outra relação e poderia ser removida.</>
    : lost.length ? <>Como esperado na FNBC, <FdInline fds={lost} /> não é mais verificável dentro de uma tabela só.</> : null;
  return { correct: true, analysis, note };
}

function judgeCover(rel, text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { empty: 'Escreva as dependências da cobertura.' };
  const fds = [];
  for (const line of lines) {
    let fd;
    try { fd = NF.parseFd(line); } catch (error) { return { correct: false, reason: error.message }; }
    const lhs = NF.resolve(fd.lhs, rel.attrs);
    const rhs = NF.resolve(fd.rhs, rel.attrs);
    const unknown = [...lhs.unknown, ...rhs.unknown];
    if (unknown.length) return { correct: false, reason: <><CodeList items={unknown} /> não é atributo de {rel.name}.</> };
    fds.push({ lhs: lhs.attrs, rhs: rhs.attrs });
  }
  const issues = NF.checkCover(rel.fds, fds);
  return issues.length ? { correct: false, reason: <ul className="issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> } : { correct: true };
}

export function judge(level, rel, answer) {
  const keys = NF.candidateKeys(rel.attrs, rel.fds);
  switch (level.type) {
    case 'choice':
      if (answer.choice === null) return { empty: 'Escolha uma alternativa.' };
      return answer.choice === level.answer ? { correct: true } : { correct: false, reason: 'Essa não é a melhor resposta. Releia a tabela destacada.' };
    case 'atomic': {
      if (!answer.picked.size) return { empty: 'Marque pelo menos um atributo.' };
      const wrong = [...answer.picked].filter((attr) => !level.answer.includes(attr));
      const missing = level.answer.filter((attr) => !answer.picked.has(attr));
      if (wrong.length) return { correct: false, reason: <><CodeList items={wrong} /> guarda um único valor por célula.</> };
      if (missing.length) return { correct: false, reason: `Falta ${plural(missing.length, 'atributo', 'atributos')}: ainda há células com listas.` };
      return { correct: true };
    }
    case 'closure': {
      const truth = NF.closure(level.of, rel.fds);
      const extra = [...answer.picked].filter((attr) => !truth.has(attr));
      if (extra.length) return { correct: false, reason: <><CodeList items={extra} /> não é determinado por <AttrSet attrs={level.of} />.</> };
      const applicable = rel.fds.find((fd) => fd.lhs.every((attr) => answer.picked.has(attr)) && fd.rhs.some((attr) => !answer.picked.has(attr)));
      if (applicable) return { correct: false, reason: <>Seu conjunto ainda não está fechado: <Fd fd={applicable} /> tem o lado esquerdo todo marcado e acrescenta algo novo.</> };
      return { correct: true };
    }
    case 'keys': {
      if (!answer.keys.length) return { empty: 'Adicione pelo menos uma chave.' };
      for (const key of answer.keys) {
        const cl = NF.closure(key, rel.fds);
        if (!rel.attrs.every((attr) => cl.has(attr))) return { correct: false, reason: <><AttrSet attrs={key} /> não é superchave: <AttrSet attrs={key} /><sup>+</sup> = <AttrSet attrs={rel.attrs.filter((attr) => cl.has(attr))} />.</> };
        const smaller = key.find((drop) => NF.isSuperkey(key.filter((attr) => attr !== drop), rel.attrs, rel.fds));
        if (smaller) return { correct: false, reason: <><AttrSet attrs={key} /> é superchave, mas não é mínima: sem <code>{smaller}</code> ainda determina tudo.</> };
      }
      const found = keys.filter((key) => answer.keys.some((mine) => NF.sameSet(mine, key))).length;
      if (found < keys.length) return { correct: false, reason: `Suas chaves estão certas, mas você achou ${found} de ${keys.length}. Procure outra combinação.` };
      return { correct: true };
    }
    case 'classify': {
      if (rel.fds.some((_, index) => !answer.classify[index])) return { empty: 'Classifique todas as dependências.' };
      const wrongRows = rel.fds.map((fd, index) => (answer.classify[index] === NF.classifyFd(fd, rel.attrs, rel.fds, keys) ? null : index)).filter((index) => index !== null);
      return wrongRows.length
        ? { correct: false, wrongRows, reason: `${plural(wrongRows.length, 'classificação errada', 'classificações erradas')} (marcadas em laranja). Lembre: primeiro veja se o lado esquerdo é superchave, depois se o atributo da direita é primo.` }
        : { correct: true, wrongRows };
    }
    case 'nf': {
      if (!answer.nf) return { empty: 'Escolha uma forma normal.' };
      const analysis = NF.analyze(rel.attrs, rel.fds);
      if (answer.nf === analysis.nf) return { correct: true };
      const chosen = NF.NF_ORDER.indexOf(answer.nf);
      if (chosen > NF.NF_ORDER.indexOf(analysis.nf)) {
        const breaking = { '2FN': 'parcial', '3FN': 'transitiva', FNBC: 'fnbc' };
        const kinds = NF.NF_ORDER.slice(1, chosen + 1).map((nf) => breaking[nf]);
        const culprit = analysis.violations.find((fd) => kinds.includes(fd.kind));
        return { correct: false, reason: <>Não chega à {answer.nf}: <Fd fd={culprit} /> é {kindLabel[culprit.kind].toLowerCase()} ({kindHelp[culprit.kind]}).</> };
      }
      return { correct: false, reason: `Ela está acima da ${answer.nf}: nenhuma dependência viola essa forma. Confira as chaves candidatas.` };
    }
    case 'decompose': return judgeDecomposition(level, rel, answer.text);
    case 'cover': return judgeCover(rel, answer.text);
    default: return { empty: 'Tipo de desafio desconhecido.' };
  }
}

// Shown after a correct answer, or when the player asks for the solution.
export function solutionText(level, rel) {
  if (level.type === 'decompose') return partsText(level.target === 'FNBC' ? NF.decomposeBCNF(rel.attrs, rel.fds) : NF.synthesize3NF(rel.attrs, rel.fds));
  if (level.type === 'cover') return NF.minimalCover(rel.fds, rel.attrs).map((fd) => `${fd.lhs.join(', ')} -> ${fd.rhs[0]}`).join('\n');
  return null;
}

export function Explanation({ level, rel, onLoad }) {
  const keys = NF.candidateKeys(rel.attrs, rel.fds);
  switch (level.type) {
    case 'choice': return <p>Resposta: <b>{'ABCD'[level.answer]}</b>. <span dangerouslySetInnerHTML={{ __html: level.explain }} /></p>;
    case 'atomic': return <p dangerouslySetInnerHTML={{ __html: level.explain }} />;
    case 'closure': return <Trace rel={rel} of={level.of} />;
    case 'keys': {
      const onRight = new Set(rel.fds.flatMap((fd) => fd.rhs));
      const core = rel.attrs.filter((attr) => !onRight.has(attr));
      return (
        <>
          <p>Chaves candidatas: <KeyList keys={keys} />.{core.length > 0 && <> <AttrSet attrs={core} /> nunca aparece à direita, então está em todas.</>}</p>
          {keys.map((key) => <Trace key={key.join()} rel={rel} of={key} />)}
        </>
      );
    }
    case 'classify':
      return (
        <>
          <p className="lesson-keys"><span className="expect-label">Chaves</span><KeyList keys={keys} /></p>
          <ul className="violation-list">
            {rel.fds.map((fd, index) => {
              const kind = NF.classifyFd(fd, rel.attrs, rel.fds, keys);
              return <li key={index}><Fd fd={fd} /><span className={`tag ${kind}`}>{kindLabel[kind]}</span><span className="muted">{kindHelp[kind]}</span></li>;
            })}
          </ul>
        </>
      );
    case 'nf': {
      const analysis = NF.analyze(rel.attrs, rel.fds);
      return (
        <>
          <p>{rel.name} está na <b>{analysis.nf}</b>. Chaves: <KeyList keys={analysis.keys} />; atributos primos: <AttrSet attrs={analysis.prime} />.</p>
          <Violations rel={rel} analysis={analysis} />
        </>
      );
    }
    case 'decompose':
    case 'cover': {
      const text = solutionText(level, rel);
      const intro = level.type === 'cover'
        ? 'Uma cobertura mínima (pode haver outras):'
        : `Uma decomposição possível (${level.target === 'FNBC' ? 'algoritmo de decomposição FNBC' : 'algoritmo de síntese 3FN'}):`;
      return (
        <>
          <p>{intro}</p>
          <pre className="solution-code">{text}</pre>
          <button className="ghost-button" type="button" onClick={() => onLoad(text)}>Carregar no editor</button>
        </>
      );
    }
    default: return null;
  }
}
