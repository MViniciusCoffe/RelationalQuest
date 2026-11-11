import Link from 'next/link';
import Topbar from '@/components/Topbar';

const games = [
  {
    href: '/algebra', index: 'JOGO 01', title: 'Álgebra Relacional', glyphs: ['σ', 'π', '⨝', '÷'],
    text: 'Escreva consultas com seleção, projeção, junções, divisão e mais, e veja cada passo virar uma tabela.',
    items: ['10 fases de tutorial', '50 desafios em 5 bancos de dados', 'Playground livre e notação LaTeX'],
  },
  {
    href: '/normalizacao', index: 'JOGO 02', title: 'Normalização', glyphs: ['X⁺', '→', '3FN', 'BC'],
    text: 'Entenda dependências funcionais, chaves e formas normais, e decomponha tabelas sem perder informação.',
    items: ['9 aulas, da anomalia à FNBC', '26 desafios: fecho, chaves, formas normais, decomposição', 'Laboratório que analisa qualquer relação'],
  },
];

export default function Home() {
  return (
    <main className="app-shell">
      <Topbar />
      <section className="hub">
        <div className="eyebrow"><span>BANCO DE DADOS NA PRÁTICA</span><span className="eyebrow-line" /><span>ESCOLHA UM JOGO</span></div>
        <h1 className="hub-title">Aprenda bancos de dados<br />jogando com relações.</h1>
        <p className="hub-lead">Dois jogos, cada um com aulas guiadas, desafios do fácil ao insano e um modo livre para experimentar.</p>
        <div className="hub-grid">
          {games.map((game) => (
            <Link key={game.href} className="hub-card" href={game.href}>
              <div className="hub-glyphs" aria-hidden="true">{game.glyphs.map((glyph) => <span key={glyph}>{glyph}</span>)}</div>
              <span className="panel-index">{game.index}</span>
              <h2>{game.title}</h2>
              <p>{game.text}</p>
              <ul className="hub-list">{game.items.map((item) => <li key={item}>{item}</li>)}</ul>
              <span className="hub-cta">Jogar <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
