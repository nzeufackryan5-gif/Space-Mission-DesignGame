import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import type { PlayerRole as PlayerRoleType } from "../../../shared/types/index";
import { joinRoomByCode } from "../services/roomService";
import { assignRole } from "../services/playerService";
import { useMultiplayerStore } from "../store/multiplayerStore";
import { PLAYER_ROLE_LABELS } from "./playerRoleLabels";
import { roomErrorMessage } from "./roomErrorMessage";
import { useAvailableRolesByCode } from "./useAvailableRolesByCode";

/** Formulaire permettant de rejoindre une salle par code et rôle disponible. */
export function JoinRoom() {
  const [digits, setDigits] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<PlayerRoleType | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setRoom = useMultiplayerStore((state) => state.setRoom);
  const setPlayer = useMultiplayerStore((state) => state.setPlayer);
  const code = `MF${digits}`;
  const { availableRoles, isLoadingRoles, errorMessage, setErrorMessage } =
    useAvailableRolesByCode(code, digits.length === 4);

  useEffect(() => {
    setSelectedRole((current) =>
      availableRoles.includes(current as PlayerRoleType)
        ? current
        : availableRoles[0] ?? "",
    );
  }, [availableRoles]);

  /** Rejoint la salle puis confirme son rôle et met à jour le store partagé. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    if (digits.length !== 4 || !selectedRole) {
      setErrorMessage("Saisissez un code valide et choisissez un rôle libre.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Connectez-vous pour rejoindre une salle.");
      const playerName =
        displayName.trim() ||
        (typeof data.user.user_metadata.display_name === "string"
          ? data.user.user_metadata.display_name
          : data.user.email ?? "Joueur");
      const room = await joinRoomByCode(code, {
        id: data.user.id,
        displayName: playerName,
        role: selectedRole,
      });
      await assignRole(room.id, data.user.id, selectedRole);
      setRoom(room);
      setPlayer({
        id: data.user.id,
        displayName: playerName,
        role: selectedRole,
        isReady: false,
      });
    } catch (error) {
      setErrorMessage(roomErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <h2 className="text-xl font-semibold">Rejoindre une salle</h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="join-code">
            Code de salle
          </label>
          <div className="flex items-center rounded-md border border-slate-600 bg-slate-800 focus-within:outline focus-within:outline-2 focus-within:outline-indigo-400">
            <span className="px-3 font-mono text-slate-300" aria-hidden="true">
              MF
            </span>
            <input
              id="join-code"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono tracking-widest focus-visible:outline-none"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={digits}
              onChange={(event) =>
                setDigits(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              aria-describedby="join-code-help"
              required
            />
          </div>
          <p id="join-code-help" className="mt-1 text-xs text-slate-400">
            Saisissez les quatre chiffres du code.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="join-name">
            Nom affiché
          </label>
          <input
            id="join-name"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={60}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="join-role">
            Rôle disponible
          </label>
          <select
            id="join-role"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as PlayerRoleType)}
            disabled={digits.length !== 4 || isLoadingRoles || availableRoles.length === 0}
            required
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {PLAYER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <button
          className="rounded-md bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:opacity-50"
          type="submit"
          disabled={isSubmitting || !selectedRole || isLoadingRoles}
        >
          {isSubmitting ? "Connexion..." : "Rejoindre"}
        </button>
      </form>
      {errorMessage && (
        <p className="text-sm text-red-300" role="alert">
          {errorMessage}
        </p>
      )}
      {digits.length === 4 && availableRoles.length === 0 && !isLoadingRoles && (
        <p className="text-sm text-amber-200" role="status">
          Aucun rôle libre dans cette salle.
        </p>
      )}
    </section>
  );
}
