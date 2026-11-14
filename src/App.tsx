import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GameShell } from "./modules/solo/components/GameShell";
import type { Language } from "./modules/solo/data/missions";
import { HomePage } from "./modules/solo/pages/HomePage";
import { MissionBriefingPage } from "./modules/solo/pages/MissionBriefingPage";
import { MissionCatalogPage } from "./modules/solo/pages/MissionCatalogPage";

/** Parcours solo : accueil, sélection d'une mission et briefing détaillé. */
export default function App() {
  const [language, setLanguage] = useState<Language>("fr");
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GameShell language={language} onLanguageChange={setLanguage} />}>
          <Route index element={<HomePage language={language} />} />
          <Route path="missions" element={<MissionCatalogPage language={language} />} />
          <Route path="missions/:missionId/briefing" element={<MissionBriefingPage language={language} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
