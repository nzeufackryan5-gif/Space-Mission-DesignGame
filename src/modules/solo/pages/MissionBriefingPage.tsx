import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { copy } from "../copy";
import { getMission, type Language } from "../data/missions";

export function MissionBriefingPage({ language }: { language: Language }) {
  const { missionId } = useParams();
  const mission = getMission(missionId);
  const [confirmed, setConfirmed] = useState(false);
  const t = copy[language];
  if (!mission) {
    return <main className="content-page not-found"><span className="eyebrow">404 · FLIGHT PLAN</span><h1>{t.notFound}</h1><p>{t.notFoundBody}</p><Link className="button button-primary" to="/missions">{t.back}</Link></main>;
  }

  const { mission: data } = mission;
  const localized = mission.localizedMission[language];
  return (
    <main className="content-page briefing-page">
      <div className="briefing-back"><Link to="/missions">← {t.back}</Link><span>{t.stage}</span></div>
      <section className="briefing-hero">
        <div className="briefing-hero-copy"><div className="eyebrow"><span className="eyebrow-line" />{t.briefing} · {mission.codename}</div><h1>{localized.name}</h1><p>{localized.description}</p><div className="briefing-location"><span className="location-icon">⌖</span><span><small>{t.destination.toUpperCase()}</small><b>{localized.destination}</b></span><span className="location-divider" /><span><small>{t.duration.toUpperCase()}</small><b>{data.durationDays} {language === "fr" ? "jours" : "days"}</b></span></div></div>
        <div className={`briefing-art mission-art-${mission.mission.id === "lunar-relay" ? 1 : mission.mission.id === "mars-weather" ? 2 : 3}`} aria-hidden="true"><div className="briefing-art-orbit" /><div className="briefing-art-planet" /><span className="briefing-art-coordinate">{mission.codename}<br />FLIGHT PLAN / 01</span></div>
      </section>
      <div className="briefing-layout">
        <div className="briefing-main-column">
          <section className="briefing-section objectives-section"><div className="section-title"><span className="section-number">01</span><h2>{t.primary}</h2></div><ul className="objective-list">{mission.primaryObjectives[language].map((item) => <li key={item}><span className="objective-check">◎</span>{item}</li>)}</ul><div className="section-title secondary-title"><span className="section-number">02</span><h2>{t.secondary}</h2></div><ul className="objective-list secondary-list">{mission.secondaryObjectives[language].map((item) => <li key={item}><span className="objective-check">◇</span>{item}</li>)}</ul></section>
          <section className="briefing-section"><div className="section-title"><span className="section-number">03</span><h2>{t.constraints}</h2></div><div className="constraint-list">{mission.constraints[language].map((item) => <div key={item}><span>↗</span>{item}</div>)}</div></section>
        </div>
        <aside className="resources-panel"><div className="resources-panel-heading"><span className="panel-icon">⌘</span><div><small>MISSION CONTROL</small><h2>{t.resources}</h2></div></div><div className="resource-list">{mission.resources[language].map(({ label, value }, index) => <div className="resource-row" key={label}><span className="resource-icon">{["◈", "◉", "◷"][index]}</span><span>{label}</span><b>{value}</b></div>)}</div><div className="resource-cost"><span>{t.estimated}</span><b>{mission.estimatedCost} <small>CR</small></b><div className="budget-meter"><i style={{ width: `${Math.round((mission.estimatedCost / data.budgetLimit) * 100)}%` }} /></div><small>{language === "fr" ? "DU BUDGET TOTAL" : "OF TOTAL BUDGET"} · {data.budgetLimit} CR</small></div></aside>
      </div>
      <div className={`briefing-confirmation ${confirmed ? "is-confirmed" : ""}`} aria-live="polite">
        <div><span className="confirmation-mark">{confirmed ? "✓" : "01"}</span><span><b>{confirmed ? t.confirmed : `${t.missionNumber} ${data.id.toUpperCase()}`}</b><small>{confirmed ? `${t.nextReady} ${t.nextPending}` : `${t.difficulty}: ${t[data.difficulty]} · ${t.stage}`}</small></span></div>
        <button className="button button-primary" type="button" onClick={() => setConfirmed(true)} disabled={confirmed}><span>{confirmed ? t.confirmed : t.confirm}</span><span aria-hidden="true">{confirmed ? "✓" : "→"}</span></button>
      </div>
    </main>
  );
}
