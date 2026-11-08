import { supabase } from "../../../lib/supabase";
import type {
  GameRoom,
  PlayerRole,
  RoomStatus,
} from "../../../shared/types/index";
import type {
  RoomError,
  OnlineGamePlayer,
  RoomWithCode,
  RoomUpdateListener,
  SupabaseClientLike,
  SupabaseQueryResponse,
  Unsubscribe,
} from "../types/multiplayer.types";

const ROOM_COLUMNS =
  "id, code, name, mission_id, host_player_id, status, created_at";
const PLAYER_COLUMNS = "id, room_id, display_name, role, is_ready, is_online, last_seen_at";
const MAX_CODE_ATTEMPTS = 3;

/** Erreur métier levée par le service; `code` appartient à l'union RoomError. */
export class RoomServiceError extends Error {
  /** Construit une erreur métier portant son code stable. */
  constructor(readonly code: RoomError) {
    super(code);
    this.name = "RoomServiceError";
  }
}

/** Erreur technique (réseau, schéma ou réponse invalide) distincte des erreurs métier. */
export class RoomServiceFailure extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RoomServiceFailure";
  }
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  mission_id: string;
  host_player_id: string;
  status: RoomStatus;
  created_at: string;
}

interface RoomServiceOptions {
  generateRoomCode?: () => string;
}

const ROOM_STATUSES: readonly RoomStatus[] = [
  "waiting",
  "designing",
  "simulating",
  "finished",
];
const PLAYER_ROLES: readonly PlayerRole[] = [
  "commander",
  "engineer",
  "scientist",
  "communicator",
];

/** Vérifie qu'une valeur inconnue est un objet de données simple. */
function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RoomServiceFailure(`Réponse Supabase invalide (${context}).`);
  }
  return value as Record<string, unknown>;
}

/** Lit une chaîne obligatoire dans une ligne retournée par Supabase. */
function readString(
  row: Record<string, unknown>,
  column: string,
  context: string,
): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new RoomServiceFailure(`Colonne ${column} invalide (${context}).`);
  }
  return value;
}

/** Convertit et valide une ligne de salle Supabase. */
function parseRoomRow(value: unknown): RoomRow {
  const row = asRecord(value, "salle");
  const status = readString(row, "status", "salle");
  if (!ROOM_STATUSES.includes(status as RoomStatus)) {
    throw new RoomServiceFailure("Statut de salle invalide dans Supabase.");
  }
  return {
    id: readString(row, "id", "salle"),
    code: readString(row, "code", "salle"),
    name: readString(row, "name", "salle"),
    mission_id: readString(row, "mission_id", "salle"),
    host_player_id: readString(row, "host_player_id", "salle"),
    status: status as RoomStatus,
    created_at: readString(row, "created_at", "salle"),
  };
}

/** Convertit et valide une ligne de joueur Supabase. */
function parsePlayerRow(value: unknown): OnlineGamePlayer {
  const row = asRecord(value, "joueur");
  const role = readString(row, "role", "joueur");
  if (!PLAYER_ROLES.includes(role as PlayerRole)) {
    throw new RoomServiceFailure("Rôle de joueur invalide dans Supabase.");
  }
  if (typeof row.is_ready !== "boolean") {
    throw new RoomServiceFailure("Colonne is_ready invalide (joueur).");
  }
  return {
    id: readString(row, "id", "joueur"),
    displayName: readString(row, "display_name", "joueur"),
    role: role as PlayerRole,
    isReady: row.is_ready,
    ...(typeof row.is_online === "boolean"
      ? {
          isOnline:
            row.is_online &&
            (typeof row.last_seen_at !== "string" ||
              Date.now() - Date.parse(row.last_seen_at) <= 30_000),
        }
      : {}),
  };
}

/** Convertit un joueur au format partagé retourné par la RPC. */
function parseRpcPlayer(value: unknown): OnlineGamePlayer {
  const row = asRecord(value, "joueur RPC");
  const role = readString(row, "role", "joueur RPC");
  if (!PLAYER_ROLES.includes(role as PlayerRole)) {
    throw new RoomServiceFailure("Rôle de joueur invalide dans la réponse RPC.");
  }
  if (typeof row.isReady !== "boolean") {
    throw new RoomServiceFailure("Propriété isReady invalide dans la réponse RPC.");
  }
  return {
    id: readString(row, "id", "joueur RPC"),
    displayName: readString(row, "displayName", "joueur RPC"),
    role: role as PlayerRole,
    isReady: row.isReady,
    ...(typeof row.isOnline === "boolean" ? { isOnline: row.isOnline } : {}),
  };
}

/** Valide une salle complète retournée par la RPC de jonction. */
function parseRpcRoom(value: unknown): GameRoom {
  const row = asRecord(value, "salle RPC");
  const status = readString(row, "status", "salle RPC");
  if (!ROOM_STATUSES.includes(status as RoomStatus)) {
    throw new RoomServiceFailure("Statut de salle invalide dans la réponse RPC.");
  }
  if (!Array.isArray(row.players)) {
    throw new RoomServiceFailure("Liste de joueurs invalide dans la réponse RPC.");
  }
  return {
    id: readString(row, "id", "salle RPC"),
    name: readString(row, "name", "salle RPC"),
    missionId: readString(row, "missionId", "salle RPC"),
    hostPlayerId: readString(row, "hostPlayerId", "salle RPC"),
    status: status as RoomStatus,
    createdAt: readString(row, "createdAt", "salle RPC"),
    players: row.players.map(parseRpcPlayer),
  };
}

/** Convertit une erreur Supabase en erreur technique explicite. */
function ensureResponse(response: SupabaseQueryResponse, context: string): unknown {
  if (response.error) {
    throw new RoomServiceFailure(
      `Échec Supabase pendant ${context} : ${response.error.message}`,
    );
  }
  return response.data;
}

/** Valide et convertit une liste de lignes de joueurs. */
function parsePlayerRows(value: unknown): OnlineGamePlayer[] {
  if (!Array.isArray(value)) {
    throw new RoomServiceFailure("Réponse Supabase invalide (liste de joueurs).");
  }
  return value.map(parsePlayerRow);
}

/** Assemble une salle partagée à partir de la ligne de salle et de ses joueurs. */
function toGameRoom(row: RoomRow, players: OnlineGamePlayer[]): RoomWithCode {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    missionId: row.mission_id,
    hostPlayerId: row.host_player_id,
    players,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Détecte une violation de contrainte d'unicité PostgreSQL. */
function isUniqueViolation(response: SupabaseQueryResponse): boolean {
  return response.error?.code === "23505";
}

/** Relance les erreurs connues et enveloppe les erreurs techniques imprévues. */
function rethrowFailure(error: unknown, context: string): never {
  if (error instanceof RoomServiceError || error instanceof RoomServiceFailure) {
    throw error;
  }
  throw new RoomServiceFailure(context, { cause: error });
}

/** Crée un service de salles avec un client injectable pour les tests. */
export function createRoomService(
  client: SupabaseClientLike,
  options: RoomServiceOptions = {},
) {
  const makeRoomCode = options.generateRoomCode ?? generateRoomCode;

  /** Récupère les joueurs associés à une salle. */
  async function getPlayersInRoom(roomId: string): Promise<OnlineGamePlayer[]> {
    try {
      const response = await client
        .from("players")
        .select(PLAYER_COLUMNS)
        .eq("room_id", roomId);
      return parsePlayerRows(ensureResponse(response, "la lecture des joueurs"));
    } catch (error) {
      return rethrowFailure(error, "Impossible de lire les joueurs.");
    }
  }

  /** Recherche une salle par identifiant; renvoie null si elle n'existe pas. */
  async function getRoomById(roomId: string): Promise<RoomWithCode | null> {
    try {
      const response = await client
        .from("rooms")
        .select(ROOM_COLUMNS)
        .eq("id", roomId)
        .maybeSingle();
      const data = ensureResponse(response, "la lecture de la salle");
      if (data === null) return null;
      const row = parseRoomRow(data);
      return toGameRoom(row, await getPlayersInRoom(row.id));
    } catch (error) {
      return rethrowFailure(error, "Impossible de lire la salle.");
    }
  }

  /** Crée une salle; retente trois codes en cas de collision en base. */
  async function createRoom(
    name: string,
    missionId: string,
    hostPlayerId: string,
    hostDisplayName?: string,
  ): Promise<RoomWithCode> {
    try {
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const code = makeRoomCode();
        const response = await client
          .from("rooms")
          .insert({
            code,
            name,
            mission_id: missionId,
            host_player_id: hostPlayerId,
            status: "waiting",
          })
          .select(ROOM_COLUMNS)
          .single();

        if (isUniqueViolation(response)) continue;
        const row = parseRoomRow(ensureResponse(response, "la création de la salle"));
        // Le nom affiché n'étant pas fourni à cette fonction, l'identifiant sert de valeur initiale.
        const hostResponse = await client
          .from("players")
          .insert({
            id: hostPlayerId,
            room_id: row.id,
            display_name: hostDisplayName ?? hostPlayerId,
            role: "commander",
            is_ready: false,
          })
          .select(PLAYER_COLUMNS)
          .single();
        ensureResponse(hostResponse, "l'ajout du joueur hôte");
        const room = await getRoomById(row.id);
        if (room === null) throw new RoomServiceError("ROOM_NOT_FOUND");
        return room;
      }
      throw new RoomServiceError("CODE_TAKEN");
    } catch (error) {
      return rethrowFailure(error, "Impossible de créer la salle.");
    }
  }

  /** Rejoint une salle par code via la RPC qui applique atomiquement les règles d'accès. */
  async function joinRoomByCode(
    code: string,
    player: { id: string; displayName: string; role: PlayerRole },
  ): Promise<GameRoom> {
    try {
      const response = await client.rpc("join_room_by_code", {
        p_code: code,
        p_display_name: player.displayName,
        p_role: player.role,
      });
      if (response.error) {
        const code = /^MFP01\b/.test(response.error.message)
          ? "ROOM_FULL"
          : /^MFP02\b/.test(response.error.message)
            ? "ROOM_NOT_FOUND"
            : null;
        if (code) throw new RoomServiceError(code);
        throw new RoomServiceFailure(
          `Échec Supabase pendant la jonction : ${response.error.message}`,
        );
      }
      return parseRpcRoom(response.data);
    } catch (error) {
      return rethrowFailure(error, "Impossible de rejoindre la salle.");
    }
  }

  /** Modifie le statut d'une salle ou lève ROOM_NOT_FOUND. */
  async function updateRoomStatus(
    roomId: string,
    status: RoomStatus,
  ): Promise<void> {
    try {
      const response = await client
        .from("rooms")
        .update({ status })
        .eq("id", roomId)
        .select("id")
        .maybeSingle();
      const data = ensureResponse(response, "la mise à jour du statut");
      if (data === null) throw new RoomServiceError("ROOM_NOT_FOUND");
    } catch (error) {
      return rethrowFailure(error, "Impossible de modifier le statut.");
    }
  }

  /** Supprime une salle après vérification de son hôte; sinon lève NOT_HOST. */
  async function closeRoom(
    roomId: string,
    hostPlayerId: string,
  ): Promise<void> {
    try {
      const room = await getRoomById(roomId);
      if (room === null) throw new RoomServiceError("ROOM_NOT_FOUND");
      if (room.hostPlayerId !== hostPlayerId) {
        throw new RoomServiceError("NOT_HOST");
      }
      const response = await client
        .from("rooms")
        .delete()
        .eq("id", roomId)
        .eq("host_player_id", hostPlayerId);
      ensureResponse(response, "la fermeture de la salle");
    } catch (error) {
      return rethrowFailure(error, "Impossible de fermer la salle.");
    }
  }

  /** S'abonne aux changements de la salle et de ses joueurs via Realtime. */
  function subscribeToRoom(
    roomId: string,
    onUpdate: RoomUpdateListener,
  ): Unsubscribe {
    /** Recharge puis publie l'état courant après une notification. */
    const refreshRoom = async (): Promise<void> => {
      try {
        const room = await getRoomById(roomId);
        if (room !== null) onUpdate(room);
      } catch (error) {
        console.error(
          "Échec du rechargement de la salle après un événement Realtime.",
          error,
        );
      }
    };

    const channel = client
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => {
          void refreshRoom();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refreshRoom();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "players" },
        () => {
          void refreshRoom();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel).catch((error: unknown) => {
        console.error("Échec du désabonnement Realtime de la salle.", error);
      });
    };
  }

  return {
    createRoom,
    joinRoomByCode,
    getRoomById,
    updateRoomStatus,
    closeRoom,
    getPlayersInRoom,
    subscribeToRoom,
  };
}

/** Génère un code candidat MF suivi de quatre chiffres; l'unicité est imposée en base. */
export function generateRoomCode(): string {
  return `MF${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
}

const defaultRoomService = createRoomService(
  supabase as unknown as SupabaseClientLike,
);

/** Crée une salle avec le client Supabase partagé de l'application. */
export const createRoom = defaultRoomService.createRoom;

/** Rejoint une salle avec son code et les informations du joueur. */
export const joinRoomByCode = defaultRoomService.joinRoomByCode;

/** Récupère une salle et ses joueurs, ou null si elle n'existe pas. */
export const getRoomById = defaultRoomService.getRoomById;

/** Modifie le statut d'une salle; lève ROOM_NOT_FOUND si elle est absente. */
export const updateRoomStatus = defaultRoomService.updateRoomStatus;

/** Ferme une salle après vérification de l'identité de son hôte. */
export const closeRoom = defaultRoomService.closeRoom;

/** Récupère les joueurs présents dans une salle. */
export const getPlayersInRoom = defaultRoomService.getPlayersInRoom;

/** S'abonne aux changements d'une salle et renvoie la fonction de désabonnement. */
export const subscribeToRoom = defaultRoomService.subscribeToRoom;
