import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

// Top bar shared by every screen. Game screens pass `back` to show the “← Jogos” button.
export default function Topbar({ back = false, mark = 'RQ', title = 'Relational Quest', progress }) {
  const brand = (
    <Link className="brand" href="/" aria-label="Relational Quest, início">
      <span className="brand-mark">{mark}</span>
      <span>{title}</span>
    </Link>
  );
  return (
    <header className="topbar">
      {back ? (
        <div className="topbar-start">
          <Link className="back-link" href="/" title="Voltar para a escolha de jogos"><span aria-hidden="true">←</span> Jogos</Link>
          {brand}
        </div>
      ) : brand}
      <div className="topbar-meta">
        <span className="status-dot" />
        <span>laboratório online</span>
        <span className="divider" />
        {progress !== undefined && <span>{progress}</span>}
        <ThemeToggle />
      </div>
    </header>
  );
}
