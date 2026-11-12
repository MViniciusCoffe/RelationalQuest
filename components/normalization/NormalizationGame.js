'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import LevelRail from '@/components/LevelRail';
import MissionBanner from '@/components/MissionBanner';
import GameHeader from '@/components/GameHeader';
import NF from '@/lib/normalization/engine';
import { nfLevels } from '@/lib/normalization/content';
import { nfLessons } from './lessons';
import Challenge from './Challenge';
import Pipeline, { STAGES } from './Pipeline';
import Lab from './Lab';
import { pad, plural } from '@/lib/format';
import useSavedGame, { clearSavedGame, indexIn, indexSet, stringMap } from '@/components/useSavedGame';

const SAVE_KEY = 'rq-normalization-v2'; // v2: FNBC removed and 0FN→3FN challenges added (indexes changed)
const DEFAULT_SECTIONS = ['Aula'];
const sectionXp = { 'Fácil': 100, 'Médio': 150, 'Difícil': 200, Insano: 300 };
const difficultyClass = { 'Fácil': 'easy', 'Médio': 'medium', 'Difícil': 'hard', Insano: 'insane' };
const challengeSections = ['Fácil', 'Médio', 'Difícil', 'Insano'];
const typeLabel = { choice: 'Anomalias', atomic: 'Primeira forma normal', closure: 'Fecho de atributos', keys: 'Chaves candidatas', classify: 'Classificar dependências', nf: 'Forma normal', decompose: 'Decomposição', cover: 'Cobertura mínima', pipeline: 'Da 0FN à 3FN' };
const sectionLevels = (section) => nfLevels.map((level, index) => ({ level, index })).filter(({ level }) => level.section === section);
const positionInSection = (index) => sectionLevels(nfLevels[index].section).findIndex((item) => item.index === index) + 1;

export default function NormalizationGame() {
  const [view, setView] = useState({ kind: 'lesson', index: 0 });
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [solutionSeen, setSolutionSeen] = useState(() => new Set());
  const [drafts, setDrafts] = useState({});
  const [stages, setStages] = useState({}); // pipeline challenges: { index: stages passed }
  const [openSections, setOpenSections] = useState(() => new Set(DEFAULT_SECTIONS));
  const firstRender = useRef(true);
  const skipScroll = useRef(false); // restoring the saved screen must not scroll the page

  // Progress and typed answers survive reloads.
  const ready = useSavedGame(
    SAVE_KEY,
    { view, drafts, stages, xp, completed: [...completed], solutionSeen: [...solutionSeen], openSections: [...openSections] },
    (saved) => {
      const { view: savedView } = saved;
      const validView = savedView && ((savedView.kind === 'lesson' && indexIn(savedView.index, nfLessons.length)) || (savedView.kind === 'level' && indexIn(savedView.index, nfLevels.length)) || (savedView.kind === 'lab' && savedView.index === 0));
      if (validView) { skipScroll.current = true; setView({ kind: savedView.kind, index: savedView.index }); }
      setDrafts(stringMap(saved.drafts));
      if (saved.stages && typeof saved.stages === 'object') {
        setStages(Object.fromEntries(Object.entries(saved.stages).filter(([index, count]) => nfLevels[index]?.type === 'pipeline' && Number.isInteger(count) && count >= 0 && count <= STAGES.length)));
      }
      if (Number.isFinite(saved.xp) && saved.xp >= 0) setXp(saved.xp);
      setCompleted(indexSet(saved.completed, nfLevels.length));
      setSolutionSeen(indexSet(saved.solutionSeen, nfLevels.length));
      if (Array.isArray(saved.openSections)) setOpenSections(new Set(saved.openSections.filter((title) => typeof title === 'string')));
    },
  );

  const resetProgress = () => {
    if (!window.confirm('Apagar todo o progresso da Normalização (XP, desafios concluídos e respostas digitadas)?')) return;
    clearSavedGame(SAVE_KEY);
    setView({ kind: 'lesson', index: 0 });
    setDrafts({});
    setStages({});
    setXp(0);
    setCompleted(new Set());
    setSolutionSeen(new Set());
    setOpenSections(new Set(DEFAULT_SECTIONS));
  };

  const go = (next) => {
    setView(next);
    const section = next.kind === 'lesson' ? 'Aula' : next.kind === 'lab' ? 'Laboratório' : nfLevels[next.index].section;
    setOpenSections((current) => new Set(current).add(section));
  };
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (skipScroll.current) { skipScroll.current = false; return; }
    document.getElementById('level-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [view]);
  const toggleSection = (title) => setOpenSections((current) => {
    const next = new Set(current);
    if (next.has(title)) next.delete(title); else next.add(title);
    return next;
  });

  const isActive = (kind, index) => view.kind === kind && view.index === index;
  const railSections = [
    { title: 'Aula', meta: plural(nfLessons.length, 'lição', 'lições'), items: nfLessons.map((lesson, index) => ({ id: `lesson-${index}`, kind: 'lesson', index, label: lesson.title, badge: pad(index + 1), active: isActive('lesson', index) })) },
    ...challengeSections.map((section) => {
      const items = sectionLevels(section);
      return {
        title: section, difficulty: difficultyClass[section], meta: `${items.filter(({ index }) => completed.has(index)).length}/${items.length}`,
        items: items.map(({ level, index }, position) => ({ id: `level-${index}`, kind: 'level', index, label: level.title, badge: pad(position + 1), done: completed.has(index), active: isActive('level', index) })),
      };
    }),
    { title: 'Laboratório', meta: 'livre', difficulty: 'free', items: [{ id: 'lab', kind: 'lab', index: 0, label: 'Analisar uma relação', badge: 'LB', square: true, active: isActive('lab', 0) }] },
  ];

  let header;
  let mission;
  let content;
  if (view.kind === 'lesson') {
    const lesson = nfLessons[view.index];
    const practice = nfLevels.findIndex((level) => level.title === lesson.practice);
    const { Body } = lesson;
    header = { kicker: `AULA · ${pad(view.index + 1)} / ${pad(nfLessons.length)}`, mode: 'NORMALIZAÇÃO', title: lesson.title, subtitle: lesson.subtitle };
    mission = { label: 'NESTA AULA', objective: lesson.goal };
    content = (
      <article className="lesson panel">
        <Body />
        <footer className="lesson-footer">
          {view.index > 0 ? <button className="ghost-button" type="button" onClick={() => go({ kind: 'lesson', index: view.index - 1 })}>← {nfLessons[view.index - 1].title}</button> : <span />}
          <div className="lesson-footer-actions">
            {practice >= 0 && <button className="ghost-button" type="button" onClick={() => go({ kind: 'level', index: practice })}>Praticar: {lesson.practice} ↗</button>}
            {view.index < nfLessons.length - 1
              ? <button className="next-level" type="button" onClick={() => go({ kind: 'lesson', index: view.index + 1 })}>Próxima aula: {nfLessons[view.index + 1].title}<span>→</span></button>
              : <button className="next-level" type="button" onClick={() => go({ kind: 'level', index: 0 })}>Começar os desafios<span>→</span></button>}
          </div>
        </footer>
      </article>
    );
  } else if (view.kind === 'lab') {
    header = { kicker: 'LABORATÓRIO', mode: 'ANÁLISE LIVRE', title: 'Laboratório de normalização', subtitle: 'Escreva qualquer relação e suas dependências: o laboratório mostra chaves, forma normal, cobertura mínima e decomposições.' };
    mission = { label: 'MODO LIVRE', objective: 'Use para conferir exercícios de livros e listas, ou para experimentar.' };
    content = <Lab />;
  } else {
    const level = nfLevels[view.index];
    const rel = NF.relation(level.rel);
    const position = pad(positionInSection(view.index));
    header = { kicker: `${level.section.toUpperCase()} · ${position} / ${pad(sectionLevels(level.section).length)}`, mode: typeLabel[level.type].toUpperCase(), title: level.title, subtitle: level.type === 'pipeline' ? `Relação ${rel.name} · grupo repetitivo ${rel.group.name} · 3 etapas` : `Relação ${rel.name} · ${plural(rel.attrs.length, 'atributo', 'atributos')}` };
    mission = {
      label: `OBJETIVO · ${level.section.toUpperCase()} ${position} · +${sectionXp[level.section]} XP`,
      objective: level.objective,
      meta: (
        <>
          <span className="expect-label">Tarefa</span><span className="chip chip-op">{typeLabel[level.type]}</span>
          {level.target && <><span className="expect-label">Meta</span><span className="chip chip-use">{level.target}</span>{level.preserve && <span className="chip chip-use">preservar dependências</span>}<span className="chip chip-use">sem perda</span></>}
          {level.type === 'pipeline' && <><span className="expect-label">Etapas</span><span className="chip chip-use">0FN → 1FN → 2FN → 3FN</span><span className="chip chip-use">sem perda</span><span className="chip chip-use">preservar dependências a partir da 2FN</span></>}
        </>
      ),
    };
    const earn = () => {
      const earned = !completed.has(view.index) && !solutionSeen.has(view.index) ? sectionXp[level.section] : 0;
      if (earned) setXp((value) => value + earned);
      setCompleted((current) => new Set(current).add(view.index));
      return earned;
    };
    content = level.type === 'pipeline' ? (
      <Pipeline
        key={view.index}
        level={level}
        isLast={view.index === nfLevels.length - 1}
        done={stages[view.index] ?? 0}
        getDraft={(stage) => drafts[`${view.index}:${STAGES[stage]}`] ?? ''}
        setDraft={(stage, text) => setDrafts((current) => ({ ...current, [`${view.index}:${STAGES[stage]}`]: text }))}
        onStagePassed={(stage) => {
          setStages((current) => ({ ...current, [view.index]: Math.max(current[view.index] ?? 0, stage + 1) }));
          return stage === STAGES.length - 1 ? earn() : 0;
        }}
        onSolutionSeen={() => setSolutionSeen((current) => new Set(current).add(view.index))}
        onNext={() => go({ kind: 'level', index: view.index + 1 })}
      />
    ) : (
      <Challenge
        key={view.index}
        level={level}
        index={view.index}
        isLast={view.index === nfLevels.length - 1}
        draft={drafts[view.index] ?? ''}
        setDraft={(text) => setDrafts((current) => ({ ...current, [view.index]: text }))}
        onCorrect={earn}
        onSolutionSeen={() => setSolutionSeen((current) => new Set(current).add(view.index))}
        onNext={() => go({ kind: 'level', index: view.index + 1 })}
      />
    );
  }

  return (
    <main className="app-shell">
      <Topbar back mark="NF" title="Normalização" progress={`${completed.size} / ${nfLevels.length} desafios`} />
      <section className="game-layout" aria-live="polite" style={ready ? undefined : { visibility: 'hidden' }}>
        <LevelRail heading="Trilha da normalização" footer="Cada fato em um só lugar." onReset={resetProgress} sections={railSections} openSections={openSections} onToggleSection={toggleSection} onSelect={(item) => go({ kind: item.kind, index: item.index })} />
        <section className="play-area">
          <GameHeader {...header} xp={xp} />
          <MissionBanner {...mission} />
          {content}
        </section>
      </section>
    </main>
  );
}
