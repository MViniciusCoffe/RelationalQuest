import NF from '@/lib/normalization/engine';
import RelationTable from '@/components/RelationTable';

export const kindLabel = { ok: 'OK', parcial: 'Parcial', transitiva: 'Transitiva' };
export const kindHelp = {
  ok: 'o determinante é superchave (ou o atributo da direita faz parte de uma chave)',
  parcial: 'parte de uma chave determina um atributo não primo (viola a 2FN)',
  transitiva: 'um determinante que não é superchave determina um atributo não primo (viola a 3FN)',
};
export const nfHelp = { '1FN': 'há dependência parcial', '2FN': 'há dependência transitiva', '3FN': 'sem dependências parciais nem transitivas' };

export const partName = (index) => `R${index + 1}`;
export const partsText = (parts, names) => parts.map((part, index) => `${names?.[index] ?? partName(index)}(${part.join(', ')})`).join('\n');

export const AttrSet = ({ attrs }) => <code className="attr-set">{`{${attrs.join(', ')}}`}</code>;
export const Code = ({ children }) => <code>{children}</code>;
export const CodeList = ({ items, separator = ', ' }) => items.map((item, index) => <span key={item}>{index > 0 && separator}<code>{item}</code></span>);

export function Fd({ fd }) {
  return (
    <span className="fd">
      <span className="fd-side">{fd.lhs.join(', ')}</span>
      <span className="fd-arrow">→</span>
      <span className="fd-side">{[].concat(fd.rhs).join(', ')}</span>
    </span>
  );
}

export const FdList = ({ fds }) => <ul className="fd-list">{fds.map((fd, index) => <li key={index}><Fd fd={fd} /></li>)}</ul>;

export const KeyList = ({ keys }) => keys.map((key, index) => <span key={key.join()}>{index > 0 && ' '}<AttrSet attrs={key} /></span>);

export function Schema({ name, attrs, keyAttrs = [] }) {
  return (
    <code className="schema">
      {name}(
      {attrs.map((attr, index) => <span key={attr}>{index > 0 && ', '}{keyAttrs.includes(attr) ? <u>{attr}</u> : attr}</span>)}
      )
    </code>
  );
}

// Schema of an unnormalized relation: Nome(a, b, grupo(c, d)).
export function UnfSchema({ unf }) {
  return <code className="schema">{unf.name}({unf.attrs.join(', ')}, <span className="unf-group-name">{unf.group.name}({unf.group.attrs.join(', ')})</span>)</code>;
}

// 0FN table: the single-valued cells span all the rows of their repeating group.
export function UnfTable({ unf }) {
  const width = unf.attrs.length;
  return (
    <div className="table-card">
      <div className="table-label"><span>{unf.name} · 0FN</span><small>{unf.rows.length} registros</small></div>
      <div className="table-scroll">
        <table className="relation-table unf-table">
          <thead>
            <tr>{unf.attrs.map((attr) => <th key={attr} rowSpan={2}>{attr}</th>)}<th className="unf-head" colSpan={unf.group.attrs.length}>{unf.group.name} <small>(repete)</small></th></tr>
            <tr>{unf.group.attrs.map((attr) => <th key={attr} className="unf-sub">{attr}</th>)}</tr>
          </thead>
          {unf.rows.map((row, r) => (
            <tbody key={r}>
              {row[width].map((item, i) => (
                <tr key={i}>
                  {i === 0 && row.slice(0, width).map((cell, c) => <td key={c} rowSpan={row[width].length}>{cell}</td>)}
                  {item.map((cell, c) => <td key={c} className="unf-cell">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export function Trace({ rel, of }) {
  const { result, steps } = NF.closureTrace(of, rel.fds);
  const all = rel.attrs.every((attr) => result.has(attr));
  return (
    <div className="trace">
      <div className="trace-title"><AttrSet attrs={of} /><sup>+</sup> = <AttrSet attrs={rel.attrs.filter((attr) => result.has(attr))} />{all && <span className="tag ok">superchave</span>}</div>
      <ol>
        <li><span className="trace-start">início</span><AttrSet attrs={of} /></li>
        {steps.map((step, index) => (
          <li key={index}><Fd fd={step.fd} /><span className="trace-add">+ {step.added.join(', ')}</span><AttrSet attrs={rel.attrs.filter((attr) => step.after.includes(attr))} /></li>
        ))}
      </ol>
      {!steps.length && <p className="muted">Nenhuma dependência tem o lado esquerdo dentro do conjunto: o fecho é ele mesmo.</p>}
    </div>
  );
}

export function Violations({ rel, analysis = NF.analyze(rel.attrs, rel.fds) }) {
  if (!analysis.violations.length) return <p className="muted">Nenhuma violação: todo determinante é superchave.</p>;
  return (
    <ul className="violation-list">
      {analysis.violations.map((fd, index) => (
        <li key={index}><Fd fd={fd} /><span className={`tag ${fd.kind}`}>{kindLabel[fd.kind]}</span><span className="muted">{kindHelp[fd.kind]}</span></li>
      ))}
    </ul>
  );
}

// One card per relation of a decomposition: keys, normal form, violations, data.
function PartCard({ rel, part, name, target }) {
  const analysis = NF.analyze(part, rel.fds);
  const good = !target || NF.meets(analysis.nf, target);
  const rows = rel.rows ? NF.projectRows(rel.attrs, rel.rows, part) : null;
  return (
    <article className={`part-card${good ? '' : ' bad'}`}>
      <header><Schema name={name} attrs={part} keyAttrs={analysis.keys[0]} /><span className={`tag ${good ? 'ok' : 'parcial'}`}>{analysis.nf}</span></header>
      <div className="part-meta"><span className="expect-label">Chaves</span><KeyList keys={analysis.keys} /></div>
      {analysis.minimal.length > 0 && (
        <div className="part-meta"><span className="expect-label">Dependências</span>{NF.groupFds(analysis.minimal, part).map((fd, index) => <Fd key={index} fd={fd} />)}</div>
      )}
      {analysis.violations.length > 0 && <Violations rel={rel} analysis={analysis} />}
      {rows && <RelationTable columns={part} rows={rows} keyColumns={analysis.keys[0]} />}
    </article>
  );
}

export function Decomposition({ rel, parts, names, target }) {
  const lost = NF.lostDependencies(parts, rel.fds);
  const lossless = NF.lossless(rel.attrs, parts, rel.fds);
  return (
    <>
      <div className="part-grid">
        {parts.map((part, index) => <PartCard key={index} rel={rel} part={part} name={names?.[index] ?? partName(index)} target={target} />)}
      </div>
      <div className="checks">
        <span className={`tag ${lossless ? 'ok' : 'parcial'}`}>{lossless ? '✓ junção sem perda' : '✕ junção com perda'}</span>
        <span className={`tag ${lost.length ? 'warn' : 'ok'}`}>{lost.length ? `✕ perde ${lost.map(NF.fdText).join('; ')}` : '✓ preserva as dependências'}</span>
      </div>
    </>
  );
}

// Projects the sample rows onto each part, joins them back and highlights false tuples.
export function Spurious({ rel, parts }) {
  const projected = parts.map((part) => NF.projectRows(rel.attrs, rel.rows, part));
  const joined = NF.joinRows(parts, projected);
  const original = new Set(rel.rows.map((row) => JSON.stringify(joined.columns.map((column) => row[rel.attrs.indexOf(column)]))));
  const fake = joined.rows.filter((row) => !original.has(JSON.stringify(row))).length;
  return (
    <>
      <div className="lesson-split">
        {parts.map((part, index) => <RelationTable key={index} columns={part} rows={projected[index]} title={`${partName(index)}(${part.join(', ')})`} />)}
      </div>
      <RelationTable columns={joined.columns} rows={joined.rows} title={parts.map((_, index) => partName(index)).join(' ⨝ ')} rowClass={(row) => (original.has(JSON.stringify(row)) ? '' : 'spurious')} />
      <p className="spurious-note">
        {fake
          ? <>A junção devolveu <b>{joined.rows.length}</b> tuplas, mas a original tem <b>{rel.rows.length}</b>: as <b>{fake}</b> destacadas são falsas.</>
          : 'A junção devolveu exatamente a relação original.'}
      </p>
    </>
  );
}
