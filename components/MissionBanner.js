'use client';

import { useEffect, useRef, useState } from 'react';

// The objective bar: sticks to the top of the screen while the player scrolls.
export default function MissionBanner({ label, objective, meta }) {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !sentinel.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div className="mission-sentinel" ref={sentinel} aria-hidden="true" />
      <div className={`mission-banner${stuck ? ' stuck' : ''}`}>
        <span className="mission-icon">🎯</span>
        <div className="mission-body">
          <span className="label">{label}</span>
          <p>{objective}</p>
          {meta && <div className="mission-meta">{meta}</div>}
        </div>
      </div>
    </>
  );
}
