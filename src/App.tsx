import { BrowserRouter, Route, Routes } from "react-router-dom";

/** Point d'entrée navigable, en attente du design final de l'application. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <main className="min-h-screen bg-slate-950 p-8 text-white">
              <h1 className="text-2xl font-bold">
                MISSION FORGE — Membre 4 (Multijoueur)
              </h1>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
