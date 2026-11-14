import { Link, NavLink, Outlet } from "react-router-dom";
import type { Language } from "../data/missions";
import { copy } from "../copy";

interface GameShellProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export function GameShell({ language, onLanguageChange }: GameShellProps) {
  const t = copy[language];
  return (
    <div className="game-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="MISSION FORGE — accueil">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">MISSION <b>FORGE</b></span>
        </Link>
        <nav className="main-nav" aria-label="Navigation principale">
          <NavLink to="/" end>{t.navHome}</NavLink>
          <NavLink to="/missions">{t.navMissions}</NavLink>
        </nav>
        <div className="topbar-tools">
          <span className="online-indicator"><i /> {t.launchStatus}</span>
          <label className="language-picker">
            <span className="sr-only">{t.language}</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)} aria-label={t.language}>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
      </header>
      <Outlet />
      <footer className="site-footer"><span>{t.footer}</span><span>FLIGHT DIRECTOR CONSOLE <i /></span></footer>
    </div>
  );
}
