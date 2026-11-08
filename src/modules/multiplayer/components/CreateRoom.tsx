import { useState, type FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import type { MissionOption } from "../types/multiplayer.types";
import { createRoom } from "../services/roomService";
import { useMultiplayerStore } from "../store/multiplayerStore";

const MISSIONS: readonly MissionOption[] = [
  { id: "mission-alpha", name: "Mission Alpha" },
  { id: "mission-beta", name: "Mission Beta" },
  { id: "mission-gamma", name: "Mission Gamma" },
];

/** Formulaire de création de salle avec affichage et copie de son code. */
export function CreateRoom() {
  const [name, setName] = useState("");
  const [missionId, setMissionId] = useState(MISSIONS[0].id);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setRoom = useMultiplayerStore((state) => state.setRoom);
  const setPlayer = useMultiplayerStore((state) => state.setPlayer);

  /** Crée la salle pour l'utilisateur authentifié et enregistre son état local. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Connectez-vous pour créer une salle.");
      const displayName =
        typeof data.user.user_metadata.display_name === "string"
          ? data.user.user_metadata.display_name
          : data.user.email ?? "Joueur";
      const room = await createRoom(name.trim(), missionId, data.user.id, displayName);
      if (!room.code) throw new Error("Le code de la salle n'a pas été retourné.");
      setRoom(room);
      setPlayer({
        id: data.user.id,
        displayName,
        role: "commander",
        isReady: false,
      });
      setRoomCode(room.code);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de créer la salle.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Copie le code de salle dans le presse-papiers. */
  async function copyRoomCode(): Promise<void> {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyMessage("Code copié.");
    } catch {
      setCopyMessage("Copie impossible; sélectionnez le code pour le copier.");
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <h2 className="text-xl font-semibold">Créer une salle</h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="room-name">
            Nom de la salle
          </label>
          <input
            id="room-name"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="room-mission">
            Mission
          </label>
          <select
            id="room-mission"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
            value={missionId}
            onChange={(event) => setMissionId(event.target.value)}
          >
            {MISSIONS.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="rounded-md bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Création..." : "Créer"}
        </button>
      </form>
      {errorMessage && (
        <p className="text-sm text-red-300" role="alert">
          {errorMessage}
        </p>
      )}
      {roomCode && (
        <div className="space-y-2 rounded-lg bg-slate-800 p-4" aria-live="polite">
          <p className="text-sm text-slate-300">Partagez ce code :</p>
          <p className="text-center font-mono text-4xl font-bold tracking-widest">
            {roomCode}
          </p>
          <button
            className="w-full rounded-md border border-indigo-400 px-3 py-2 hover:bg-indigo-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
            type="button"
            onClick={() => void copyRoomCode()}
          >
            Copier le code
          </button>
          {copyMessage && <p className="text-sm text-slate-300">{copyMessage}</p>}
        </div>
      )}
    </section>
  );
}
