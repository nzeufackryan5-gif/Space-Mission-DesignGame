import { Link } from "react-router-dom";
import { copy } from "../copy";
import { missions, type Language } from "../data/missions";

const difficultyClass = { easy: "difficulty-easy", medium: "difficulty-medium", hard: "difficulty-hard" } as const;

export function MissionCatalogPage({ language }: { language: Language }) {
  const t = copy[language];
  return (
    <main className="content-page catalog-page">
      <section className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" />{t.catalogEyebrow}</div><h1>{t.catalogTitle}</h1><p>{t.catalogBody}</p></div>
        <div className="heading-index"><span>01 — 03</span><small>{t.available}</small></div>
      </section>
      <section className="mission-list" aria-label={t.available}>
        {missions.map(({ mission, localizedMission, codename, primaryObjectives, tags }, index) => (
          <article className="mission-card" key={mission.id}>
            <div className={`mission-art mission-art-${index + 1}`} aria-hidden="true">
              <div className="mission-art-orbit" /><div className="mission-art-body" /><span className="mission-art-star">✳</span>
              <span className="mission-sequence">0{index + 1}</span>
            </div>
            <div className="mission-card-main">
              <div className="mission-card-top"><span className="mission-codename">{codename}</span><span className={`difficulty ${difficultyClass[mission.difficulty]}`}><i />{t[mission.difficulty]}</span></div>
              <h2>{localizedMission[language].name}</h2>
              <p className="mission-description">{localizedMission[language].description}</p>
              <div className="mission-tags">{tags[language].map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="mission-summary"><span><small>{t.objectives.toUpperCase()}</small><b>{primaryObjectives[language][0]}</b></span><span><small>{t.destination.toUpperCase()}</small><b>{localizedMission[language].destination}</b></span><span><small>{t.duration.toUpperCase()}</small><b>{mission.durationDays} {language === "fr" ? "jours" : "days"}</b></span></div>
            </div>
            <div className="mission-card-action"><Link to={`/missions/${mission.id}/briefing`} aria-label={`${t.select} : ${localizedMission[language].name}`}><span>{t.select}</span><b aria-hidden="true">↗</b></Link></div>
          </article>
        ))}
      </section>
    </main>
  );
}
