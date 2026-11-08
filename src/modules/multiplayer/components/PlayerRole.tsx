import { useEffect, useState } from "react";
import type { GamePlayer, PlayerRole as PlayerRoleType } from "../../../shared/types/index";
import { assignRole, getAvailableRoles } from "../services/playerService";

const ROLE_PRESENTATION: Record<
  PlayerRoleType,
  { label: string; icon: string; color: string }
> = {
  commander: {
    label: "Commandant",
    icon: "👨‍✈️",
    color: "bg-amber-950 text-amber-200 ring-amber-700",
  },
  engineer: {
    label: "Ingénieur",
    icon: "🔧",
    color: "bg-blue-950 text-blue-200 ring-blue-700",
  },
  scientist: {
    label: "Scientifique",
    icon: "🔬",
    color: "bg-violet-950 text-violet-200 ring-violet-700",
  },
  communicator: {
    label: "Communicateur",
    icon: "📡",
    color: "bg-emerald-950 text-emerald-200 ring-emerald-700",
  },
};

interface PlayerRoleProps {
  roomId: string;
  player: GamePlayer;
  isHost: boolean;
  isCurrentPlayer: boolean;
}

/** Affiche le badge du rôle et les contrôles autorisés pour le joueur ou l'hôte. */
export function PlayerRoleBadge({
  roomId,
  player,
  isHost,
  isCurrentPlayer,
}: PlayerRoleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<PlayerRoleType[]>([]);
  const [selectedRole, setSelectedRole] = useState(player.role);
  const [errorMessage, setErrorMessage] = useState("");
  const presentation = ROLE_PRESENTATION[player.role];
  const canEdit = isHost || isCurrentPlayer;

  useEffect(() => {
    let active = true;
    if (!isEditing) return () => {
      active = false;
    };
    void getAvailableRoles(roomId)
      .then((roles) => {
        if (active) setAvailableRoles(roles);
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Impossible de charger les rôles.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [isEditing, roomId]);

  /** Attribue le nouveau rôle; la contrainte unique gère les conflits concurrents. */
  async function saveRole(): Promise<void> {
    setErrorMessage("");
    try {
      await assignRole(roomId, player.id, selectedRole);
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rôle indisponible.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 ${presentation.color}`}
      >
        <span aria-hidden="true">{presentation.icon}</span>
        <span>{presentation.label}</span>
      </span>
      {canEdit && !isEditing && (
        <button
          className="rounded px-2 py-1 text-sm text-indigo-300 underline underline-offset-2 hover:text-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
          type="button"
          onClick={() => {
            setSelectedRole(player.role);
            setIsEditing(true);
          }}
        >
          {isHost ? "Attribuer" : "Changer"}
        </button>
      )}
      {isEditing && (
        <>
          <label className="sr-only" htmlFor={`role-${player.id}`}>
            Nouveau rôle pour {player.displayName}
          </label>
          <select
            id={`role-${player.id}`}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
            value={selectedRole}
            onChange={(event) =>
              setSelectedRole(event.target.value as PlayerRoleType)
            }
          >
            {[...new Set([player.role, ...availableRoles])].map((role) => (
              <option key={role} value={role}>
                {ROLE_PRESENTATION[role].label}
              </option>
            ))}
          </select>
          <button
            className="rounded bg-indigo-700 px-2 py-1 text-sm hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
            type="button"
            onClick={() => void saveRole()}
          >
            Enregistrer
          </button>
          <button
            className="rounded px-2 py-1 text-sm text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-300"
            type="button"
            onClick={() => setIsEditing(false)}
          >
            Annuler
          </button>
        </>
      )}
      {errorMessage && (
        <span className="basis-full text-xs text-red-300" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
