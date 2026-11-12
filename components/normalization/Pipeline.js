'use client';

import { useRef, useState } from 'react';
import NF from '@/lib/normalization/engine';
import { FdList, UnfSchema, UnfTable } from './ui';
import { judgeDecomposition } from './judge';
import { plural } from '@/lib/format';

export const STAGES = ['1FN', '2FN', '3FN'];

const TASK = {
  '1FN': (rel) => <>Elimine o grupo repetitivo <code>{rel.group.name}</code>: nenhuma célula pode guardar uma lista.</>,
  '2FN': () => <>Parta da sua 1FN e elimine as <b>dependências parciais</b> (atributo que depende só de parte de uma chave composta). Se nenhuma tabela tiver, a mesma resposta serve.</>,
  '3FN': () => <>Elimine as <b>dependências transitivas</b> (atributo não chave que depende de outro atributo não chave).</>,
};

// One stage of the pipeline: editor, verification and feedback. Keyed by stage, so
// attempts, hint and result start fresh on every stage.
function Stage({ level, rel, stage, draft, setDraft, onPassed, onSolutionSeen, next }) {
  const target = STAGES[stage];
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState(null); // { outcome, earned } | { solution: true }
  const textarea = useRef(null);
  const resultPanel = useRef(null);

  const insert = (text) => {
    const el = textarea.current;
    const start = el.selectionStart ?? draft.length;
    const before = draft.slice(0, start);
    const glue = /[\wÀ-ÿ]$/.test(before) ? ', ' : '';
    const value = before + glue + text + draft.slice(el.selectionEnd ?? start);
    setDraft(value);
    const cursor = start + glue.length + text.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor, cursor); });
  };

  const verify = () => {
    const outcome = judgeDecomposition({ target, preserve: target !== '1FN' }, rel, draft);
    if (outcome.empty) { setResult({ outcome }); return; }
    setAttempts((value) => value + 1);
    setResult({ outcome, earned: outcome.correct ? onPassed() : 0 });
    requestAnimationFrame(() => resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const solution = level.solutions[target];
  const outcome = result?.outcome;
  let feedback = null;
  if (result?.solution) {
    feedback = (
      <div className="feedback error">
        <span className="feedback-icon">?</span>
        <div>
          <strong>Uma solução para a {target}</strong>
          <pre className="solution-code">{solution}</pre>
          <button className="ghost-button" type="button" onClick={() => setDraft(solution)}>Carregar no editor</button>
          <span className="solution-note">Ver a solução não dá XP neste desafio.</span>
        </div>
      </div>
    );
  } else if (outcome?.empty) {
    feedback = <div className="feedback error"><span className="feedback-icon">!</span><div><strong>Falta responder.</strong>{outcome.empty}</div></div>;
  } else if (outcome?.correct) {
    feedback = (
      <div className="feedback success">
        <span className="feedback-icon">✓</span>
        <div>
          <strong>{target} alcançada!{result.earned ? ` +${result.earned} XP` : ''}</strong>
          {outcome.note && <p>{outcome.note}</p>}
          {next}
        </div>
      </div>
    );
  } else if (outcome) {
    feedback = (
      <div className="feedback error">
        <span className="feedback-icon">!</span>
        <div><strong>Ainda não.</strong><div>{outcome.reason}</div>{attempts >= 2 && <button className="ghost-button" type="button" onClick={() => { onSolutionSeen(); setResult((current) => ({ ...current, solution: true })); }}>Ver uma solução</button>}</div>
      </div>
    );
  }
  const status = result?.solution ? 'solução' : outcome?.empty ? 'incompleto' : outcome?.correct ? 'correto' : 'revise';

  return (
    <>
      <p className="answer-help">{TASK[target](rel)} Uma relação por linha: <code>Nome(atributo, …)</code>. Clique num atributo para inseri-lo.</p>
      <div className="attr-picker">{rel.attrs.map((attr) => <button key={attr} type="button" className="attr-toggle" onClick={() => insert(attr)}>{attr}</button>)}</div>
      <div className="input-wrap nf-input">
        <span className="prompt-symbol">›</span>
        <textarea ref={textarea} rows={5} spellCheck={false} autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)}
          aria-label={`Relações na ${target}`}
          placeholder={`${rel.name}(${rel.outer.slice(0, 2).join(', ')}, …)\nR2(…)`}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); verify(); } }} />
      </div>
      <div className="input-help kbd-hint"><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> verificar</span></div>
      <div className="syntax-note stage-hint"><span>↳</span><span>{hint ? level.hints[target] : <button className="hint-toggle" type="button" onClick={() => setHint(true)}>Dica para a {target}</button>}</span></div>
      <div className="answer-actions">
        <button className="verify-button" type="button" onClick={verify}>Verificar {target} <span>↗</span></button>
        <span>{plural(attempts, 'tentativa', 'tentativas')}</span>
      </div>

      {result && (
        <section className="execution-panel stage-result" ref={resultPanel}>
          <div className="execution-header"><div><span className="panel-index">04</span><h2><span className="execution-spark">⚡</span> Correção · {target}</h2></div><span className="execution-status">{status}</span></div>
          {!outcome?.empty && outcome?.analysis}
          {feedback}
        </section>
      )}
    </>
  );
}

// "Da 0FN à 3FN": the player normalizes one relation a form at a time.
// `done` = how many stages are already passed (0–3); drafts are kept per stage.
export default function Pipeline({ level, isLast, done, getDraft, setDraft, onStagePassed, onSolutionSeen, onNext }) {
  const rel = NF.relation(level.rel);
  const [stage, setStage] = useState(Math.min(done, STAGES.length - 1));

  const open = (target) => {
    if (target > done) return;
    if (!getDraft(target).trim() && target > 0) setDraft(target, getDraft(target - 1));
    setStage(target);
    requestAnimationFrame(() => document.getElementById('pipeline-answer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const next = stage < STAGES.length - 1
    ? <button className="next-level" type="button" onClick={() => open(stage + 1)}>Avançar para a {STAGES[stage + 1]}<span>→</span></button>
    : <>
        <p className="final-note">Pronto: {rel.name} saiu da 0FN e chegou à 3FN, sem perda e sem perder dependências.</p>
        {!isLast && <button className="next-level" type="button" onClick={onNext}>Próximo desafio<span>→</span></button>}
      </>;

  return (
    <>
      <div className="workspace-grid">
        <section className="data-panel panel">
          <div className="panel-heading"><div><span className="panel-index">01</span><h2>Relação não normalizada</h2></div><span className="relation-chip">0FN</span></div>
          <div className="schema-line"><UnfSchema unf={level.rel} /></div>
          <div className="tables-stack"><UnfTable unf={level.rel} /></div>
        </section>
        <section className="syntax-panel panel">
          <div className="panel-heading"><div><span className="panel-index">02</span><h2>Dependências funcionais</h2></div><span className="spark">✦</span></div>
          <FdList fds={rel.fds} />
          <p className="muted stage-note">Valem para a tabela “achatada”, com uma linha por item de <code>{rel.group.name}</code>.</p>
        </section>
      </div>

      <section className="query-panel panel" id="pipeline-answer">
        <div className="query-heading">
          <div><span className="panel-index">03</span><h2>Sua resposta</h2></div>
          <ol className="stage-steps" aria-label="Etapas">
            <li className="stage-step done"><span>0FN</span></li>
            {STAGES.map((name, index) => (
              <li key={name} className={`stage-step${index < done ? ' done' : ''}${index === stage ? ' current' : ''}`}>
                <button type="button" disabled={index > done} aria-current={index === stage ? 'step' : undefined} onClick={() => open(index)}>
                  {index < done ? '✓ ' : ''}{name}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <Stage key={stage} level={level} rel={rel} stage={stage} draft={getDraft(stage)} setDraft={(text) => setDraft(stage, text)}
          onPassed={() => onStagePassed(stage)} onSolutionSeen={onSolutionSeen} next={next} />
      </section>
    </>
  );
}
