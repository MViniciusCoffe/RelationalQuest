'use client';

import { useRef, useState } from 'react';
import NF from '@/lib/normalization/engine';
import RelationTable from '@/components/RelationTable';
import { AttrSet, Fd, FdList, KeyList, Schema, kindLabel } from './ui';
import { judge, Explanation } from './judge';
import { plural } from '@/lib/format';

const NF_HINT = { '1FN': 'tem dependência parcial', '2FN': 'tem dependência transitiva', '3FN': 'só viola a FNBC', FNBC: 'todo determinante é superchave' };

function AttrPicker({ attrs, pressed, locked = [], onToggle }) {
  return (
    <div className="attr-picker">
      {attrs.map((attr) => (
        <button key={attr} type="button" className={`attr-toggle${locked.includes(attr) ? ' locked' : ''}`} aria-pressed={pressed.has(attr)} disabled={locked.includes(attr)} onClick={() => onToggle(attr)}>{attr}</button>
      ))}
    </div>
  );
}

function Choice({ options, value, onChange, render }) {
  return options.map((option, index) => (
    <button key={index} type="button" className={render.className} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{render.content(option, index)}</button>
  ));
}

// One challenge. Holds the answer being built; reports wins and solution views to the game.
export default function Challenge({ level, index, isLast, draft, setDraft, onCorrect, onSolutionSeen, onNext }) {
  const rel = NF.relation(level.rel);
  const keys = NF.candidateKeys(rel.attrs, rel.fds);
  const [picked, setPicked] = useState(() => new Set(level.type === 'closure' ? level.of : []));
  const [keyList, setKeyList] = useState([]);
  const [classify, setClassify] = useState({});
  const [choice, setChoice] = useState(null);
  const [nf, setNf] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState(null); // { outcome, earned } | { solution: true }
  const textarea = useRef(null);
  const resultPanel = useRef(null);

  const toggle = (attr) => setPicked((current) => { const next = new Set(current); if (next.has(attr)) next.delete(attr); else next.add(attr); return next; });

  const insert = (text) => {
    const el = textarea.current;
    const start = el.selectionStart ?? draft.length;
    const before = draft.slice(0, start);
    const glue = /\w/.test(text) && /[\wÀ-ÿ)]$/.test(before) ? ', ' : '';
    const value = before + glue + text + draft.slice(el.selectionEnd ?? start);
    setDraft(value);
    const cursor = start + glue.length + text.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor, cursor); });
  };

  const verify = () => {
    const outcome = judge(level, rel, { picked, keys: keyList, classify, choice, nf, text: draft });
    if (outcome.empty) { setResult({ outcome }); return; }
    setAttempts((value) => value + 1);
    setResult({ outcome, earned: outcome.correct ? onCorrect() : 0 });
    requestAnimationFrame(() => resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const showSolution = () => { onSolutionSeen(); setResult((current) => ({ ...current, solution: true })); };
  const wrongRows = result?.outcome?.wrongRows;

  let answer;
  switch (level.type) {
    case 'choice':
      answer = (
        <div className="choice-list">
          <Choice options={level.options.map((text, value) => ({ text, value }))} value={choice} onChange={setChoice}
            render={{ className: 'choice', content: (option, i) => <><span className="choice-letter">{'ABCD'[i]}</span><span>{option.text}</span></> }} />
        </div>
      );
      break;
    case 'atomic':
      answer = <><p className="answer-help">Clique nos atributos não atômicos.</p><AttrPicker attrs={rel.attrs} pressed={picked} onToggle={toggle} /></>;
      break;
    case 'closure':
      answer = (
        <>
          <p className="answer-help"><AttrSet attrs={level.of} /><sup>+</sup> = marque tudo que {level.of.length > 1 ? 'eles determinam' : 'ele determina'}. Os atributos de partida já estão incluídos.</p>
          <AttrPicker attrs={rel.attrs} pressed={picked} locked={level.of} onToggle={toggle} />
        </>
      );
      break;
    case 'keys':
      answer = (
        <>
          <p className="answer-help">Marque os atributos de uma chave e clique em <b>Adicionar chave</b>. Repita para cada chave.</p>
          <AttrPicker attrs={rel.attrs} pressed={picked} onToggle={toggle} />
          <div className="key-builder">
            <button type="button" className="ghost-button" onClick={() => {
              if (!picked.size) return;
              const key = rel.attrs.filter((attr) => picked.has(attr));
              if (!keyList.some((existing) => NF.sameSet(existing, key))) setKeyList([...keyList, key]);
              setPicked(new Set());
            }}>Adicionar chave</button>
            <div className="key-list">
              {keyList.length ? keyList.map((key, i) => (
                <span key={key.join()} className="key-chip"><AttrSet attrs={key} /><button type="button" aria-label={`Remover chave ${key.join(', ')}`} onClick={() => setKeyList(keyList.filter((_, j) => j !== i))}>×</button></span>
              )) : <span className="muted">Nenhuma chave adicionada.</span>}
            </div>
          </div>
        </>
      );
      break;
    case 'classify':
      answer = (
        <div className="classify-list">
          {rel.fds.map((fd, i) => (
            <div key={i} className={`classify-row${wrongRows && classify[i] ? (wrongRows.includes(i) ? ' wrong' : ' right') : ''}`}>
              <Fd fd={fd} />
              <div className="segmented">
                <Choice options={Object.keys(kindLabel).map((kind) => ({ value: kind }))} value={classify[i]} onChange={(kind) => {
                  setClassify({ ...classify, [i]: kind });
                  if (wrongRows) setResult((current) => ({ ...current, outcome: { ...current.outcome, wrongRows: wrongRows.filter((row) => row !== i) } }));
                }} render={{ className: undefined, content: (option) => kindLabel[option.value] }} />
              </div>
            </div>
          ))}
        </div>
      );
      break;
    case 'nf':
      answer = (
        <div className="nf-options">
          <Choice options={NF.NF_ORDER.map((value) => ({ value }))} value={nf} onChange={setNf}
            render={{ className: 'nf-option', content: (option) => <><b>{option.value}</b><small>{NF_HINT[option.value]}</small></> }} />
        </div>
      );
      break;
    default: {
      const decompose = level.type === 'decompose';
      answer = (
        <>
          <p className="answer-help">{decompose ? <>Uma relação por linha: <code>Nome(atributo, atributo, …)</code>.</> : <>Uma dependência por linha: <code>a, b -&gt; c</code> (ou →).</>} Clique num atributo para inseri-lo.</p>
          <div className="attr-picker">{rel.attrs.map((attr) => <button key={attr} type="button" className="attr-toggle" onClick={() => insert(attr)}>{attr}</button>)}</div>
          {!decompose && <div className="attr-picker"><button type="button" className="attr-toggle arrow" onClick={() => insert(' → ')}>→</button><button type="button" className="attr-toggle arrow" onClick={() => insert(', ')}>,</button></div>}
          <div className="input-wrap nf-input">
            <span className="prompt-symbol">›</span>
            <textarea ref={textarea} rows={4} spellCheck={false} autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)}
              aria-label={decompose ? 'Relações da decomposição' : 'Dependências da cobertura mínima'}
              placeholder={decompose ? `R1(${rel.attrs.slice(0, 2).join(', ')})\nR2(…)` : `${rel.fds[0].lhs.join(', ')} -> ${rel.fds[0].rhs[0]}\n…`}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); verify(); } }} />
          </div>
          <div className="input-help kbd-hint"><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> verificar</span></div>
        </>
      );
    }
  }

  const outcome = result?.outcome;
  let feedback = null;
  if (result?.solution) {
    feedback = (
      <div className="feedback error"><span className="feedback-icon">?</span><div><strong>Solução</strong><div className="explain"><Explanation level={level} rel={rel} onLoad={setDraft} /></div><span className="solution-note">Ver a solução não dá XP neste desafio.</span></div></div>
    );
  } else if (outcome?.empty) {
    feedback = <div className="feedback error"><span className="feedback-icon">!</span><div><strong>Falta responder.</strong>{outcome.empty}</div></div>;
  } else if (outcome?.correct) {
    feedback = (
      <div className="feedback success">
        <span className="feedback-icon">✓</span>
        <div>
          <strong>Correto!{result.earned ? ` +${result.earned} XP` : ''}</strong>
          {outcome.note && <p>{outcome.note}</p>}
          {level.type !== 'decompose' && <div className="explain"><Explanation level={level} rel={rel} onLoad={setDraft} /></div>}
          {isLast ? <p className="final-note">Você concluiu todos os desafios de normalização.</p> : <button className="next-level" type="button" onClick={onNext}>Próximo desafio<span>→</span></button>}
        </div>
      </div>
    );
  } else if (outcome) {
    feedback = (
      <div className="feedback error">
        <span className="feedback-icon">!</span>
        <div><strong>Ainda não.</strong><div>{outcome.reason}</div>{attempts >= 2 && <button className="ghost-button" type="button" onClick={showSolution}>Ver uma solução</button>}</div>
      </div>
    );
  }
  const status = result?.solution ? 'solução' : outcome?.empty ? 'incompleto' : outcome?.correct ? 'correto' : 'revise';

  return (
    <>
      <div className="workspace-grid">
        <section className="data-panel panel">
          <div className="panel-heading"><div><span className="panel-index">01</span><h2>Relação</h2></div><span className="relation-chip">{rel.name}</span></div>
          <div className="schema-line"><Schema name={rel.name} attrs={rel.attrs} /></div>
          {rel.rows
            ? <div className="tables-stack"><RelationTable columns={rel.attrs} rows={rel.rows} mark={level.mark} /></div>
            : <p className="muted">Sem dados de exemplo: raciocine só com as dependências.</p>}
        </section>
        <section className="syntax-panel panel">
          <div className="panel-heading"><div><span className="panel-index">02</span><h2>{level.type === 'atomic' ? 'Regra' : 'Dependências funcionais'}</h2></div><span className="spark">✦</span></div>
          {level.type === 'atomic'
            ? <p className="muted">Antes de falar de dependências, cada célula precisa guardar um único valor.</p>
            : <><FdList fds={rel.fds} />{level.showKeys && <p className="lesson-keys"><span className="expect-label">Chaves</span><KeyList keys={keys} /></p>}</>}
          <div className="syntax-note"><span>↳</span><span>{hint ? level.hint : <button className="hint-toggle" type="button" onClick={() => setHint(true)}>Mostrar dica</button>}</span></div>
        </section>
      </div>

      <section className="query-panel panel">
        <div className="query-heading"><div><span className="panel-index">03</span><h2>Sua resposta</h2></div></div>
        {answer}
        <div className="answer-actions">
          <button className="verify-button" type="button" onClick={verify}>Verificar <span>↗</span></button>
          <span>{plural(attempts, 'tentativa', 'tentativas')}</span>
        </div>
      </section>

      {result && (
        <section className="execution-panel" ref={resultPanel} data-index={index}>
          <div className="execution-header"><div><span className="panel-index">04</span><h2><span className="execution-spark">⚡</span> Correção</h2></div><span className="execution-status">{status}</span></div>
          {!outcome?.empty && outcome?.analysis}
          {feedback}
        </section>
      )}
    </>
  );
}
