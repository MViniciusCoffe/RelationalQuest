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
import Lab from './Lab';
import { pad, plural } from '@/lib/format';

const sectionXp = { 'Fácil': 100, 'Médio': 150, 'Difícil': 200, Insano: 300 };
const difficultyClass = { 'Fácil': 'easy', 'Médio': 'medium', 'Difícil': 'hard', Insano: 'insane' };
const challengeSections = ['Fácil', 'Médio', 'Difícil', 'Insano'];
const typeLabel = { choice: 'Anomalias', atomic: 'Primeira forma normal', closure: 'Fecho de atributos', keys: 'Chaves candidatas', classify: 'Classificar dependências', nf: 'Forma normal', decompose: 'Decomposição', cover: 'Cobertura mínima' };
const sectionLevels = (section) => nfLevels.map((level, index) => ({ level, index })).filter(({ level }) => level.section === section);
const positionInSection = (index) => sectionLevels(nfLevels[index].section).findIndex((item) => item.index === index) + 1;

export default function NormalizationGame() {
  const [view, setView] = useState({ kind: 'lesson', index: 0 });
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [solutionSeen, setSolutionSeen] = useState(() => new Set());
  const [drafts, setDrafts] = useState({});
  const [openSections, setOpenSections] = useState(() => new Set(['Aula']));
  const firstRender = useRef(true);

  const go = (next) => {
    setView(next);
    const section = next.kind === 'lesson' ? 'Aula' : next.kind === 'lab' ? 'Laboratório' : nfLevels[next.index].section;
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
    header = { kicker: `${level.section.toUpperCase()} · ${position} / ${pad(sectionLevels(level.section).length)}`, mode: typeLabel[level.type].toUpperCase(), title: level.title, subtitle: `Relação ${rel.name} · ${plural(rel.attrs.length, 'atributo', 'atributos')}` };
    mission = {
      label: `OBJETIVO · ${level.section.toUpperCase()} ${position} · +${sectionXp[level.section]} XP`,
      objective: level.objective,
      meta: (
        <>
          <span className="expect-label">Tarefa</span><span className="chip chip-op">{typeLabel[level.type]}</span>
          {level.target && <><span className="expect-label">Meta</span><span className="chip chip-use">{level.target}</span>{level.preserve && <span className="chip chip-use">preservar dependências</span>}<span className="chip chip-use">sem perda</span></>}
        </>
      ),
    };
    content = (
      <Challenge
        key={view.index}
        level={level}
        index={view.index}
        isLast={view.index === nfLevels.length - 1}
        draft={drafts[view.index] ?? ''}
        setDraft={(text) => setDrafts((current) => ({ ...current, [view.index]: text }))}
        onCorrect={() => {
          const earned = !completed.has(view.index) && !solutionSeen.has(view.index) ? sectionXp[level.section] : 0;
          if (earned) setXp((value) => value + earned);
          setCompleted((current) => new Set(current).add(view.index));
          return earned;
        }}
        onSolutionSeen={() => setSolutionSeen((current) => new Set(current).add(view.index))}
        onNext={() => go({ kind: 'level', index: view.index + 1 })}
      />
    );
  }

  return (
    <main className="app-shell">
      <Topbar back mark="NF" title="Normalização" progress={`${completed.size} / ${nfLevels.length} desafios`} />
      <section className="game-layout" aria-live="polite">
        <LevelRail heading="Trilha da normalização" footer="Cada fato em um só lugar." sections={railSections} openSections={openSections} onToggleSection={toggleSection} onSelect={(item) => go({ kind: item.kind, index: item.index })} />
        <section className="play-area">
          <GameHeader {...header} xp={xp} />
          <MissionBanner {...mission} />
          {content}
        </section>
      </section>
    </main>
  );
}
