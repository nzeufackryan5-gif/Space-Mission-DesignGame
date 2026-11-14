import { Link } from "react-router-dom";
import { copy } from "../copy";
import type { Language } from "../data/missions";

export function HomePage({ language }: { language: Language }) {
  const t = copy[language];
  return (
    <main className="home-page">
      <div className="home-grid" aria-hidden="true" />
      <div className="home-copy">
        <div className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</div>
        <h1>{t.homeTitle}</h1>
        <p>{t.homeBody}</p>
        <div className="home-actions">
          <Link className="button button-primary" to="/missions"><span>{t.start}</span><span aria-hidden="true">↗</span></Link>
          <Link className="text-link" to="/missions">{t.browse}<span aria-hidden="true"> →</span></Link>
        </div>
        <div className="home-meta"><span className="meta-dot" />{t.homeFoot}</div>
      </div>
      <div className="orbit-visual" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
        <div className="planet"><div className="planet-shade" /><div className="planet-ring" /></div>
        <div className="orbit-moon" /><div className="orbit-satellite"><span /></div>
        <div className="visual-coordinate coordinate-one">09° 18′ 42″ N<br />MISSION ORBIT</div>
        <div className="visual-coordinate coordinate-two">SYSTEM 01<br />READY FOR FLIGHT</div>
      </div>
      <div className="home-index"><span>01</span><i /> <span>03</span></div>
      <div className="home-side-label">MISSION DESIGN SIMULATOR <span>·</span> EST. 2026</div>
    </main>
  );
}
