'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import LevelRail from '@/components/LevelRail';
import MissionBanner from '@/components/MissionBanner';
import GameHeader from '@/components/GameHeader';
import RelationTable from '@/components/RelationTable';
import QueryEditor from './QueryEditor';
import LatexPreview, { MathBlock } from './Latex';
import ExecutionPanel from './ExecutionPanel';
import Rules from './Rules';
import RelationalEngine from '@/lib/algebra/engine';
import {
  levels, databases, sectionXp, sectionOrder, difficultyClass, databaseOf, levelTables, sectionLevels,
  positionInSection, expectedRelation, operatorNames, levelOperators, judgeLevel,
} from '@/lib/algebra/game';
import { pad, plural } from '@/lib/format';

const viewKey = (view) => `${view.kind}:${view.index}`;
const baseName = (column) => column.split('.').pop();

const Chips = ({ items, kind }) => items.map((item) => <span key={item} className={`chip ${kind}`}>{item}</span>);
const OperatorChips = ({ level }) => levelOperators(level).map((op) => (
  <span key={op} className="chip chip-op" title={operatorNames[op]}><b>{op}</b> {operatorNames[op]}</span>
));

function InputTables({ tables }) {
  return (
    <div className="tables-stack">
      {tables.map((table) => <RelationTable key={table.name} title={table.name} columns={table.columns} rows={table.rows} />)}
    </div>
  );
}

export default function AlgebraGame() {
  const [view, setView] = useState({ kind: 'level', index: 0 });
  const [drafts, setDrafts] = useState({});
  const [attempts, setAttempts] = useState(0);
  const [run, setRun] = useState(null); // { outcome, status, feedback }
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [solutionSeen, setSolutionSeen] = useState(() => new Set());
  const [openSections, setOpenSections] = useState(() => new Set(['Tutorial']));
  const [hintShown, setHintShown] = useState(false);
  const firstRender = useRef(true);
  const dockSentinel = useRef(null);
  const executionRef = useRef(null);
  const [docked, setDocked] = useState(false);
  const [runCount, setRunCount] = useState(0);

  // The editor docks to the bottom of the screen while its normal place is below the fold,
  // so the tables can be scrolled while typing. The sentinel sits just above the editor and
  // does not move when the editor changes size, so docking never flickers.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !dockSentinel.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting && entry.boundingClientRect.top > 0), { rootMargin: '0px 0px -160px 0px' });
    observer.observe(dockSentinel.current);
    return () => observer.disconnect();
  }, []);

  // After running a query, bring the result into view. Scrolling un-docks the editor, which
  // grows back and pushes the result down, so the scroll is corrected once it ends.
  useEffect(() => {
    const el = executionRef.current;
    if (!runCount || !el) return undefined;
    const goThere = () => el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const correct = () => {
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (!atEnd && Math.abs(el.getBoundingClientRect().top - 12) > 6) goThere();
    };
    goThere();
    window.addEventListener('scrollend', correct, { once: true });
    const fallback = setTimeout(correct, 800); // browsers without the scrollend event
    return () => { window.removeEventListener('scrollend', correct); clearTimeout(fallback); };
  }, [runCount]);

  const playground = view.kind === 'db';
  const level = playground ? null : levels[view.index];
  const db = playground ? databases[view.index] : level.db ? databaseOf(level) : null;
  const tables = playground ? db.tables : levelTables(level);
  const query = drafts[viewKey(view)] ?? '';
  const setQuery = (text) => setDrafts((current) => ({ ...current, [viewKey(view)]: text }));

  const go = (next) => {
    setView(next);
    setAttempts(0);
    setRun(null);
    setHintShown(false);
    const section = next.kind === 'db' ? 'Playground' : levels[next.index].section;
    setOpenSections((current) => new Set(current).add(section));
  };

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.getElementById('level-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [view]);

  const toggleSection = (title) => setOpenSections((current) => {
    const next = new Set(current);
    if (next.has(title)) next.delete(title); else next.add(title);
    return next;
  });

  // ---------- running a query ----------
  const submit = () => {
    const text = query.trim();
    if (!text) return;
    const tries = attempts + 1;
    setAttempts(tries);
    const outcome = RelationalEngine.run(text, tables);
    setRunCount((count) => count + 1);

    if (playground) {
      setRun({ outcome, status: outcome.error ? 'erro' : 'executada', feedback: outcome.error ? { kind: 'playground-error', message: outcome.error } : { kind: 'playground-ok' } });
      return;
    }
    const verdict = judgeLevel(level, text, outcome);
    if (!verdict.correct) {
      setRun({ outcome, status: 'revise a lógica', feedback: { kind: 'error', reason: verdict.reason, offerSolution: tries >= 3 } });
      return;
    }
    const earned = !completed.has(view.index) && !solutionSeen.has(view.index);
    const reward = sectionXp[level.section] ?? 100;
    if (earned) setXp((value) => value + reward);
    const done = new Set(completed).add(view.index);
    setCompleted(done);
    setRun({ outcome, status: 'vitória', feedback: { kind: 'success', earned: earned ? reward : 0, sawSolution: solutionSeen.has(view.index), allDone: done.size === levels.length } });
  };

  const showSolution = () => {
    setSolutionSeen((current) => new Set(current).add(view.index));
    setRun((current) => ({ ...current, feedback: { kind: 'solution' } }));
  };

  // ---------- feedback ----------
  function renderFeedback(feedback, outcome) {
    if (feedback.kind === 'playground-error' || feedback.kind === 'error') {
      return (
        <div className="feedback error">
          <span className="feedback-icon">!</span>
          <div>
            <strong>{feedback.kind === 'error' ? 'Ainda não.' : 'Erro na consulta.'}</strong>
            {feedback.kind === 'error' ? feedback.reason : feedback.message}
            {feedback.offerSolution && <button className="ghost-button" type="button" onClick={showSolution}>Ver uma solução</button>}
          </div>
        </div>
      );
    }
    if (feedback.kind === 'playground-ok') {
      const rel = outcome.relation;
      return (
        <div className="feedback success">
          <span className="feedback-icon">✓</span>
          <div><strong>Consulta executada.</strong>{rel.name ? <>Relação <b>{rel.name}</b> com </> : 'Resultado com '}{plural(rel.rows.length, 'tupla', 'tuplas')} e {plural(rel.columns.length, 'atributo', 'atributos')}.</div>
        </div>
      );
    }
    if (feedback.kind === 'solution') {
      return (
        <div className="feedback error">
          <span className="feedback-icon">?</span>
          <div>
            <strong>Uma solução possível</strong>
            <MathBlock query={level.solution} className="solution-math" />
            <pre className="solution-code">{level.solution}</pre>
            <span className="solution-note">Existem outras formas corretas. Entenda cada linha antes de seguir; ver a solução não dá XP.</span>
            <button className="ghost-button" type="button" onClick={() => setQuery(level.solution)}>Carregar no editor</button>
          </div>
        </div>
      );
    }
    const last = view.index === levels.length - 1;
    const nextSection = !last && levels[view.index + 1].section !== level.section ? levels[view.index + 1].section : null;
    return (
      <div className="feedback success">
        <span className="feedback-icon">✓</span>
        <div>
          <strong>Correto! Resultado desbloqueado.</strong> A tabela resultante é idêntica ao objetivo desta fase.
          {feedback.earned ? ` +${feedback.earned} XP.` : feedback.sawSolution ? ' Sem XP: você viu a solução.' : ''}
          {last ? (
            <>
              <div className="final-note">Você chegou ao fim da trilha{feedback.allDone ? ' e concluiu todas as fases' : ''}.</div>
              <button className="next-level" type="button" onClick={() => go({ kind: 'db', index: 0 })}>Abrir o playground <span>→</span></button>
            </>
          ) : (
            <button className="next-level" type="button" onClick={() => go({ kind: 'level', index: view.index + 1 })}>{nextSection ? `Começar ${nextSection}` : 'Próxima fase'} <span>→</span></button>
          )}
        </div>
      </div>
    );
  }

  // ---------- header, panels ----------
  let header;
  let mission;
  let dataTitle;
  let relationChip;
  let syntaxTitle;
  let syntaxBody;
  let note;
  let placeholder;

  if (playground) {
    header = { kicker: `PLAYGROUND · ${db.code}`, mode: 'MODO LIVRE', title: db.title, subtitle: db.description };
    mission = { label: `MODO LIVRE · ${db.title.toUpperCase()}`, objective: 'Sem objetivo nem pontuação: qualquer consulta com sintaxe válida roda sobre as tabelas abaixo.' };
    dataTitle = 'Tabelas do banco';
    relationChip = plural(db.tables.length, 'tabela', 'tabelas');
    syntaxTitle = 'Ideias para explorar';
    syntaxBody = (
      <div className="idea-list">
        {db.ideas.map(([label, ideaQuery]) => (
          <button key={label} className="idea" type="button" onClick={() => setQuery(ideaQuery)}><span>{label}</span><code>{ideaQuery}</code></button>
        ))}
      </div>
    );
    note = 'Clique numa ideia para carregá-la no editor e modifique à vontade.';
    placeholder = `${db.tables[0].name}\n\nou combine tabelas:\nπ_{…}(${db.tables[0].name} ⨝ ${db.tables[1].name})`;
  } else {
    const total = sectionLevels(level.section).length;
    header = { kicker: `${level.section.toUpperCase()} · ${pad(positionInSection(view.index))} / ${pad(total)}`, mode: db ? `BANCO: ${db.title.toUpperCase()}` : 'CONSULTA GUIADA', title: level.title, subtitle: level.subtitle ?? db.description };
    dataTitle = db ? `Tabelas · ${db.title}` : 'Tabelas de entrada';
    relationChip = level.relation ?? plural(db.tables.length, 'tabela', 'tabelas');
    placeholder = db ? `${db.tables[0].name}\n\nEnter quebra linha; Ctrl+Enter executa.` : 'σ_{depto = 4}(Empregado)\n\nou, em várias linhas:\nT ← σ_{depto = 4}(Empregado)\nπ_{nomeE}(T)';
    if (!db) {
      mission = { label: `OBJETIVO · FASE ${pad(view.index + 1)}`, objective: level.objective, meta: <><span className="expect-label">Operadores</span><OperatorChips level={level} /></> };
      syntaxTitle = 'Kit de operadores';
      syntaxBody = level.operators.map(([symbol, name]) => <div key={symbol + name} className="operator"><b>{symbol}</b><span>{name}</span></div>);
      note = `${level.hint} Use os nomes literais das colunas; aliases só valem quando declarados com ρ.`;
    } else {
      const columns = expectedRelation(level).columns.map(baseName);
      mission = {
        label: `OBJETIVO · ${level.section.toUpperCase()} ${pad(positionInSection(view.index))} · +${sectionXp[level.section]} XP`,
        objective: level.objective,
        meta: (
          <>
            <span className="expect-label">Operadores</span><OperatorChips level={level} />
            <span className="expect-label">Colunas</span><Chips items={columns} kind="chip-column" />
            {level.requires?.length > 0 && <><span className="expect-label">Use</span><Chips items={level.requires} kind="chip-use" /></>}
            {level.forbids?.length > 0 && <><span className="expect-label">Proibido</span><Chips items={level.forbids} kind="chip-forbid" /></>}
            {level.expectName && <><span className="expect-label">Nome</span><Chips items={[level.expectName]} kind="chip-use" /></>}
          </>
        ),
      };
      syntaxTitle = 'Resultado esperado';
      syntaxBody = (
        <div className="expect">
          <div className="expect-row"><span className="expect-label">Operadores</span><OperatorChips level={level} /></div>
          <div className="expect-row"><span className="expect-label">Colunas</span><Chips items={columns} kind="chip-column" /></div>
          {level.requires?.length > 0 && <div className="expect-row"><span className="expect-label">Use</span><Chips items={level.requires} kind="chip-use" /></div>}
          {level.forbids?.length > 0 && <div className="expect-row"><span className="expect-label">Proibido</span><Chips items={level.forbids} kind="chip-forbid" /></div>}
          {level.expectName && <div className="expect-row"><span className="expect-label">Nome do resultado</span><Chips items={[level.expectName]} kind="chip-use" /></div>}
        </div>
      );
      note = hintShown ? level.hint : <button className="hint-toggle" type="button" onClick={() => setHintShown(true)}>Mostrar dica</button>;
    }
  }

  // ---------- trail ----------
  const railSections = [
    ...sectionOrder.map((section) => {
      const items = sectionLevels(section);
      return {
        title: section,
        difficulty: difficultyClass[section],
        meta: `${items.filter(({ index }) => completed.has(index)).length}/${items.length}`,
        items: items.map(({ level: item, index }, position) => ({ id: `level-${index}`, kind: 'level', index, label: item.title, badge: pad(position + 1), done: completed.has(index), active: !playground && view.index === index })),
      };
    }),
    {
      title: 'Playground',
      difficulty: 'free',
      meta: plural(databases.length, 'banco', 'bancos'),
      items: databases.map((item, index) => ({ id: `db-${index}`, kind: 'db', index, label: item.title, badge: item.code, square: true, active: playground && view.index === index })),
    },
  ];

  const attemptsLabel = playground ? plural(attempts, 'execução', 'execuções') : plural(attempts, 'tentativa', 'tentativas');

  return (
    <main className="app-shell">
      <Topbar back mark="RQ" title="Álgebra Relacional" progress={playground ? 'playground' : `${completed.size} / ${levels.length} concluídas`} />
      <section className="game-layout" aria-live="polite">
        <LevelRail heading="Trilha de relações" footer="Aprenda por tentativa." sections={railSections} openSections={openSections} onToggleSection={toggleSection} onSelect={(item) => go({ kind: item.kind, index: item.index })} />

        <section className={`play-area${tables.length > 2 ? ' wide' : ''}`}>
          <GameHeader {...header} xp={playground ? undefined : xp} />
          <MissionBanner {...mission} pinned={false} />

          <div className="workspace-grid">
            <section className="data-panel panel">
              <div className="panel-heading"><div><span className="panel-index">01</span><h2>{dataTitle}</h2></div><span className="relation-chip">{relationChip}</span></div>
              <InputTables tables={tables} />
            </section>
            <section className="syntax-panel panel">
              <div className="panel-heading"><div><span className="panel-index">02</span><h2>{syntaxTitle}</h2></div><span className="spark">✦</span></div>
              <div className="operator-list">{syntaxBody}</div>
              <div className="syntax-note"><span>↳</span><span>{note}</span></div>
            </section>
          </div>

          <div className="dock-sentinel" ref={dockSentinel} aria-hidden="true" />
          <section className={`query-panel panel query-dock${docked ? ' docked' : ''}`} aria-label="Monte sua consulta">
            <div className="query-heading"><div><span className="panel-index">03</span><h2>Monte sua consulta</h2></div><span className="live-pill"><span /> execução ao vivo</span></div>
            <p className="dock-objective" title={mission.objective}><span aria-hidden="true">🎯</span>{mission.objective}</p>
            <QueryEditor key={viewKey(view)} value={query} onChange={setQuery} onSubmit={submit} tables={tables} placeholder={placeholder} attemptsLabel={attemptsLabel} />
            <LatexPreview query={query} />
          </section>

          <Rules />

          {run && (
            <div ref={executionRef} className="execution-anchor">
            <ExecutionPanel outcome={run.outcome} status={run.status}>
              {renderFeedback(run.feedback, run.outcome)}
            </ExecutionPanel>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
