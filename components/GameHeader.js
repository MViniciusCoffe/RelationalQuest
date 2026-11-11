import { pad } from '@/lib/format';

export default function GameHeader({ kicker, mode, title, subtitle, xp }) {
  return (
    <>
      <div className="eyebrow"><span>{kicker}</span><span className="eyebrow-line" /><span>{mode}</span></div>
      <div className="title-row">
        <div><h1 id="level-title">{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {xp !== undefined && <div className="xp-badge"><span>XP</span><strong>{pad(xp, 3)}</strong></div>}
      </div>
    </>
  );
}
