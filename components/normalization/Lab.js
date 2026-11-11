'use client';

import { useState } from 'react';
import NF from '@/lib/normalization/engine';
import { nfSchemas } from '@/lib/normalization/content';
import { AttrSet, CodeList, FdList, KeyList, Trace, Violations, Decomposition, nfHelp } from './ui';

const examples = Object.values(nfSchemas);
const toForm = (spec) => ({ schema: `${spec.name}(${spec.attrs.join(', ')})`, fds: spec.fds.join('\n'), closure: '' });

// Reads the form; returns { rel, closureOf } or { error }.
function read(form) {
  const match = form.schema.trim().match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)?\s*\(([^)]*)\)$/) ?? [null, 'R', form.schema];
  const attrs = [...new Set(NF.splitAttrs(match[2]))];
  if (!attrs.length) return { error: <>Escreva o esquema, como <code>R(A, B, C)</code>.</> };
  if (attrs.length > 12) return { error: 'Use no máximo 12 atributos: o cálculo de chaves testa todas as combinações.' };
  const fds = [];
  for (const [index, line] of form.fds.split('\n').map((item) => item.trim()).entries()) {
    if (!line) continue;
    let fd;
    try { fd = NF.parseFd(line); } catch (error) { return { error: error.message }; }
    const lhs = NF.resolve(fd.lhs, attrs);
    const rhs = NF.resolve(fd.rhs, attrs);
    if (lhs.unknown.length || rhs.unknown.length) return { error: <>Na linha {index + 1}, <CodeList items={[...lhs.unknown, ...rhs.unknown]} /> não está no esquema.</> };
    fds.push({ lhs: lhs.attrs, rhs: rhs.attrs });
  }
  return { rel: { name: match[1] ?? 'R', attrs, fds }, closureOf: NF.resolve(NF.splitAttrs(form.closure), attrs).attrs };
}

function Analysis({ rel, closureOf }) {
  const analysis = NF.analyze(rel.attrs, rel.fds);
  return (
    <section className="execution-panel">
      <div className="execution-header"><div><span className="panel-index">02</span><h2><span className="execution-spark">⚡</span> Análise</h2></div><span className="execution-status">{analysis.nf}</span></div>
      <div className="lab-grid">
        <div className="lab-card"><span className="expect-label">Forma normal</span><strong className="nf-big">{analysis.nf}</strong><span className="muted">{nfHelp[analysis.nf]}</span></div>
        <div className="lab-card"><span className="expect-label">Chaves candidatas</span><div><KeyList keys={analysis.keys} /></div><span className="expect-label">Atributos primos</span><div><AttrSet attrs={analysis.prime} /></div></div>
      </div>
      {closureOf.length > 0 && <><h3 className="lab-heading">Fecho</h3><Trace rel={rel} of={closureOf} /></>}
      <h3 className="lab-heading">Violações</h3><Violations rel={rel} analysis={analysis} />
      <h3 className="lab-heading">Cobertura mínima</h3><FdList fds={NF.groupFds(NF.minimalCover(rel.fds, rel.attrs), rel.attrs)} />
      <h3 className="lab-heading">Síntese 3FN</h3><Decomposition rel={rel} parts={NF.synthesize3NF(rel.attrs, rel.fds)} target="3FN" />
      <h3 className="lab-heading">Decomposição FNBC</h3><Decomposition rel={rel} parts={NF.decomposeBCNF(rel.attrs, rel.fds)} target="FNBC" />
    </section>
  );
}

export default function Lab() {
  const [form, setForm] = useState(() => toForm(examples[0]));
  const [shown, setShown] = useState(null); // result of read() at the last “Analisar”
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const analyze = (source = form) => setShown(read(source));
  const onKeyDown = (event) => {
    const single = event.target.tagName === 'INPUT';
    if (event.key === 'Enter' && (single || event.ctrlKey || event.metaKey)) { event.preventDefault(); analyze(); }
  };

  return (
    <>
      <section className="query-panel panel lab-panel">
        <div className="query-heading"><div><span className="panel-index">01</span><h2>Relação e dependências</h2></div></div>
        <div className="lab-examples">
          <span className="symbol-toolbar-label">Exemplos</span>
          {examples.map((spec) => (
            <button key={spec.name + spec.attrs.length} type="button" className="symbol-button lab-example" onClick={() => { const next = toForm(spec); setForm(next); analyze(next); }}>
              {spec.name}<small>{spec.attrs.length} atrib.</small>
            </button>
          ))}
        </div>
        <label className="lab-label" htmlFor="lab-schema">Esquema</label>
        <div className="input-wrap nf-input"><span className="prompt-symbol">›</span><input id="lab-schema" spellCheck={false} autoComplete="off" placeholder="R(A, B, C, D)" value={form.schema} onChange={set('schema')} onKeyDown={onKeyDown} /></div>
        <label className="lab-label" htmlFor="lab-fds">Dependências (uma por linha)</label>
        <div className="input-wrap nf-input"><span className="prompt-symbol">›</span><textarea id="lab-fds" rows={5} spellCheck={false} autoComplete="off" placeholder={'A -> B\nB, C -> D'} value={form.fds} onChange={set('fds')} onKeyDown={onKeyDown} /></div>
        <label className="lab-label" htmlFor="lab-closure">Calcular fecho de (opcional)</label>
        <div className="input-wrap nf-input"><span className="prompt-symbol">›</span><input id="lab-closure" spellCheck={false} autoComplete="off" placeholder="A, C" value={form.closure} onChange={set('closure')} onKeyDown={onKeyDown} /></div>
        <div className="answer-actions"><button className="verify-button" type="button" onClick={() => analyze()}>Analisar <span>↗</span></button><span className="muted kbd-hint">Ctrl+Enter também analisa</span></div>
      </section>
      {shown?.error && (
        <section className="execution-panel"><div className="feedback error"><span className="feedback-icon">!</span><div><strong>Não consegui ler.</strong>{shown.error}</div></div></section>
      )}
      {shown?.rel && <Analysis rel={shown.rel} closureOf={shown.closureOf} />}
    </>
  );
}
