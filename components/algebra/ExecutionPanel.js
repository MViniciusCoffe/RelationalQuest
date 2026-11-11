import RelationTable from '@/components/RelationTable';
import { pad, plural } from '@/lib/format';

const size = (rel) => `${plural(rel.rows.length, 'tupla', 'tuplas')} · ${plural(rel.columns.length, 'atributo', 'atributos')}`;

// Steps of a multi-statement query (each one expands to show its table) + final result.
export default function ExecutionPanel({ outcome, status, children }) {
  const rel = outcome.relation;
  return (
    <section className="execution-panel">
      <div className="execution-header">
        <div><span className="panel-index">04</span><h2><span className="execution-spark">⚡</span> Execução da consulta</h2></div>
        <span className="execution-status">{status}</span>
      </div>
      <div className="steps">
        {outcome.steps.map((step, index) => (
          <details className="step-item" key={index}>
            <summary className="step">
              <span className="step-caret" aria-hidden="true">▸</span>
              <span className="step-number">{pad(index + 1)}</span>
              <code className="step-code">{step.statement}</code>
              <span className="step-meta">→ {step.relation.name && <><b>{step.relation.name}</b> · </>}{size(step.relation)}</span>
            </summary>
            <div className="step-table"><RelationTable columns={step.relation.columns} rows={step.relation.rows} empty="Nenhuma tupla (0 linhas)." /></div>
          </details>
        ))}
        {outcome.error && (
          <div className="step step-error">
            <span className="step-caret" aria-hidden="true" />
            <span className="step-number">{pad(outcome.steps.length + 1)}</span>
            <code className="step-code">{outcome.failedStatement ?? ''}</code>
            <span className="step-meta">✕ erro</span>
          </div>
        )}
      </div>
      <div className="result-block">
        <div className="result-heading">
          <h3>Tabela resultante {rel?.name && <span className="result-name">{rel.name}</span>}</h3>
          <span>{rel ? size(rel) : 'sem resultado'}</span>
        </div>
        {outcome.error
          ? <p className="empty-result">{outcome.error}</p>
          : <RelationTable columns={rel.columns} rows={rel.rows} empty="Nenhuma tupla satisfaz a consulta (0 linhas)." />}
      </div>
      {children}
    </section>
  );
}
