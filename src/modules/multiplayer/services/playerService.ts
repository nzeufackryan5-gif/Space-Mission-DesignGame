import { supabase } from "../../../lib/supabase";
import type { GamePlayer, PlayerRole } from "../../../shared/types/index";
import type {
  SupabaseClientLike,
  SupabaseQueryResponse,
} from "../types/multiplayer.types";

const PLAYER_COLUMNS = "id, room_id, display_name, role, is_ready, is_online";
const PLAYER_ROLES: readonly PlayerRole[] = [
  "commander",
  "engineer",
  "scientist",
  "communicator",
];

/** Codes d'erreur métier renvoyés par les opérations sur les joueurs. */
export type PlayerServiceErrorCode =
  | "ROLE_TAKEN"
  | "PLAYER_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "NOT_HOST";

/** Erreur métier typée du service des joueurs. */
export class PlayerServiceError extends Error {
  /** Construit une erreur joueur portant un code stable. */
  constructor(readonly code: PlayerServiceErrorCode) {
    super(code);
    this.name = "PlayerServiceError";
  }
}

/** Erreur technique distincte des erreurs métier du service. */
export class PlayerServiceFailure extends Error {
  /** Construit une erreur technique en conservant sa cause éventuelle. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlayerServiceFailure";
  }
}

/** Vérifie le format d'une réponse Supabase et remonte les erreurs explicitement. */
function ensureResponse(
  response: SupabaseQueryResponse,
  operation: string,
): unknown {
  if (response.error) {
    if (response.error.code === "23505") {
      throw new PlayerServiceError("ROLE_TAKEN");
    }
    const errorCode = response.error.message.match(
      /\b(PLAYER_NOT_FOUND|ROOM_NOT_FOUND|NOT_HOST)\b/,
    )?.[0] as PlayerServiceErrorCode | undefined;
    if (errorCode) throw new PlayerServiceError(errorCode);
    throw new PlayerServiceFailure(
      `Échec Supabase pendant ${operation} : ${response.error.message}`,
    );
  }
  return response.data;
}

/** Valide et convertit les lignes de joueurs issues de Supabase. */
function parsePlayers(value: unknown): GamePlayer[] {
  if (!Array.isArray(value)) {
    throw new PlayerServiceFailure("Réponse Supabase invalide (liste de joueurs).");
  }
  return value.map((item): GamePlayer => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new PlayerServiceFailure("Réponse Supabase invalide (joueur).");
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.display_name !== "string" ||
      typeof row.role !== "string" ||
      !PLAYER_ROLES.includes(row.role as PlayerRole) ||
      typeof row.is_ready !== "boolean"
    ) {
      throw new PlayerServiceFailure("Colonnes joueur invalides dans Supabase.");
    }
    return {
      id: row.id,
      displayName: row.display_name,
      role: row.role as PlayerRole,
      isReady: row.is_ready,
    };
  });
}

/** Crée un service injectable pour utiliser un client simulé dans les tests. */
export function createPlayerService(
  client: SupabaseClientLike,
): {
  assignRole: (roomId: string, playerId: string, role: PlayerRole) => Promise<void>;
  getAvailableRoles: (roomId: string) => Promise<PlayerRole[]>;
  getAvailableRolesByCode: (code: string) => Promise<PlayerRole[]>;
  setPlayerReady: (
    roomId: string,
    playerId: string,
    isReady: boolean,
  ) => Promise<void>;
  removePlayer: (roomId: string, playerId: string) => Promise<void>;
  areAllPlayersReady: (roomId: string) => Promise<boolean>;
  getPlayerRole: (
    roomId: string,
    playerId: string,
  ) => Promise<PlayerRole | null>;
} {
  /** Récupère les joueurs d'une salle pour les calculs locaux. */
  async function getPlayers(roomId: string): Promise<GamePlayer[]> {
    try {
      const response = await client
        .from("players")
        .select(PLAYER_COLUMNS)
        .eq("room_id", roomId);
      return parsePlayers(ensureResponse(response, "la lecture des joueurs"));
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure("Impossible de lire les joueurs.", {
        cause: error,
      });
    }
  }

  /** Attribue un rôle; la contrainte unique garantit son unicité dans la salle. */
  async function assignRole(
    roomId: string,
    playerId: string,
    role: PlayerRole,
  ): Promise<void> {
    try {
      const response = await client
        .from("players")
        .update({ role })
        .eq("room_id", roomId)
        .eq("id", playerId)
        .select("id")
        .maybeSingle();
      const data = ensureResponse(response, "l'attribution du rôle");
      if (data === null) throw new PlayerServiceError("PLAYER_NOT_FOUND");
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure("Impossible d'attribuer le rôle.", {
        cause: error,
      });
    }
  }

  /** Retourne les rôles qui ne sont pas encore utilisés dans la salle. */
  async function getAvailableRoles(roomId: string): Promise<PlayerRole[]> {
    const players = await getPlayers(roomId);
    const assignedRoles = new Set(players.map((player) => player.role));
    return PLAYER_ROLES.filter((role) => !assignedRoles.has(role));
  }

  /** Récupère les rôles disponibles d'une salle via son code d'invitation. */
  async function getAvailableRolesByCode(code: string): Promise<PlayerRole[]> {
    try {
      const response = await client.rpc("get_available_roles_by_code", {
        p_code: code,
      });
      const data = ensureResponse(response, "la lecture des rôles disponibles");
      if (
        !Array.isArray(data) ||
        !data.every(
          (role): role is PlayerRole =>
            typeof role === "string" && PLAYER_ROLES.includes(role as PlayerRole),
        )
      ) {
        throw new PlayerServiceFailure("Liste de rôles disponibles invalide.");
      }
      return data;
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure("Impossible de lire les rôles disponibles.", {
        cause: error,
      });
    }
  }

  /** Modifie l'état prêt d'un joueur de la salle. */
  async function setPlayerReady(
    roomId: string,
    playerId: string,
    isReady: boolean,
  ): Promise<void> {
    try {
      const response = await client
        .from("players")
        .update({ is_ready: isReady })
        .eq("room_id", roomId)
        .eq("id", playerId)
        .select("id")
        .maybeSingle();
      const data = ensureResponse(response, "la mise à jour de disponibilité");
      if (data === null) throw new PlayerServiceError("PLAYER_NOT_FOUND");
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure(
        "Impossible de modifier l'état de disponibilité.",
        { cause: error },
      );
    }
  }

  /** Retire un joueur; la base transfère l'hôte au plus ancien joueur restant. */
  async function removePlayer(roomId: string, playerId: string): Promise<void> {
    try {
      const response = await client.rpc("remove_player_and_transfer_host", {
        p_room_id: roomId,
        p_player_id: playerId,
      });
      ensureResponse(response, "le départ du joueur");
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure("Impossible de retirer le joueur.", {
        cause: error,
      });
    }
  }

  /** Indique si au moins un joueur est présent et si tous sont prêts. */
  async function areAllPlayersReady(roomId: string): Promise<boolean> {
    const players = await getPlayers(roomId);
    return players.length > 0 && players.every((player) => player.isReady);
  }

  /** Retourne le rôle du joueur, ou null s'il n'est pas membre de cette salle. */
  async function getPlayerRole(
    roomId: string,
    playerId: string,
  ): Promise<PlayerRole | null> {
    try {
      const response = await client
        .from("players")
        .select("role")
        .eq("room_id", roomId)
        .eq("id", playerId)
        .maybeSingle();
      const data = ensureResponse(response, "la lecture du rôle");
      if (data === null) return null;
      if (
        typeof data !== "object" ||
        data === null ||
        Array.isArray(data) ||
        typeof (data as Record<string, unknown>).role !== "string" ||
        !PLAYER_ROLES.includes((data as Record<string, unknown>).role as PlayerRole)
      ) {
        throw new PlayerServiceFailure("Rôle joueur invalide dans Supabase.");
      }
      return (data as Record<string, unknown>).role as PlayerRole;
    } catch (error) {
      if (error instanceof PlayerServiceError || error instanceof PlayerServiceFailure) {
        throw error;
      }
      throw new PlayerServiceFailure("Impossible de lire le rôle du joueur.", {
        cause: error,
      });
    }
  }

  return {
    assignRole,
    getAvailableRoles,
    getAvailableRolesByCode,
    setPlayerReady,
    removePlayer,
    areAllPlayersReady,
    getPlayerRole,
  };
}

const defaultPlayerService = createPlayerService(
  supabase as unknown as SupabaseClientLike,
);

/** Attribue un rôle à un joueur en laissant la base détecter les conflits. */
export const assignRole = defaultPlayerService.assignRole;

/** Récupère la liste des rôles encore disponibles dans une salle. */
export const getAvailableRoles = defaultPlayerService.getAvailableRoles;

/** Récupère par code les rôles libres avant qu'un joueur rejoigne la salle. */
export const getAvailableRolesByCode =
  defaultPlayerService.getAvailableRolesByCode;

/** Met à jour l'état prêt d'un joueur. */
export const setPlayerReady = defaultPlayerService.setPlayerReady;

/** Retire un joueur et transfère éventuellement l'hôte via la base. */
export const removePlayer = defaultPlayerService.removePlayer;

/** Vérifie si tous les joueurs présents ont indiqué être prêts. */
export const areAllPlayersReady = defaultPlayerService.areAllPlayersReady;

/** Récupère le rôle d'un joueur, ou null s'il n'est pas dans la salle. */
export const getPlayerRole = defaultPlayerService.getPlayerRole;
