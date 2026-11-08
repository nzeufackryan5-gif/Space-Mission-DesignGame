import { supabase } from "../../../lib/supabase";
import type { GamePlayer, GameRoom, PlayerRole, RoomStatus, Spacecraft } from "../../../shared/types/index";

const HEARTBEAT_INTERVAL_MS = 10_000;
const OFFLINE_AFTER_MS = 30_000;
const PLAYER_COLUMNS = "id, room_id, display_name, role, is_ready, is_online, last_seen_at";

type DbResponse = { data: unknown; error: { message: string } | null };
type DbQuery = PromiseLike<DbResponse> & {
  select(columns?: string): DbQuery;
  update(values: Record<string, unknown>): DbQuery;
  eq(column: string, value: string): DbQuery;
  lt(column: string, value: string): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  maybeSingle(): PromiseLike<DbResponse>;
};
interface ReconnectionClient {
  from(table: string): DbQuery;
}

/** Erreur remontée quand la restauration ou le heartbeat échoue. */
export class ReconnectionServiceError extends Error {
  constructor(operation: string, message: string) {
    super(`Échec Supabase pendant ${operation} : ${message}`);
    this.name = "ReconnectionServiceError";
  }
}

function dataOrThrow(response: DbResponse, operation: string): unknown {
  if (response.error) throw new ReconnectionServiceError(operation, response.error.message);
  return response.data;
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReconnectionServiceError(context, "réponse invalide");
  }
  return value as Record<string, unknown>;
}

function parsePlayer(value: unknown): GamePlayer {
  const row = record(value, "lecture du joueur");
  if (
    typeof row.id !== "string" || typeof row.display_name !== "string" ||
    typeof row.role !== "string" || typeof row.is_ready !== "boolean"
  ) throw new ReconnectionServiceError("lecture du joueur", "colonnes joueur invalides");
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role as PlayerRole,
    isReady: row.is_ready,
  };
}

/** Construit le service de reconnexion avec un client Supabase injectable. */
export function createReconnectionService(client: ReconnectionClient) {
  const heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

  /** Marque un joueur hors ligne sans supprimer son entrée ni son rôle. */
  async function markPlayerOffline(roomId: string, playerId: string): Promise<void> {
    const response = await client.from("players").update({ is_online: false, last_seen_at: new Date().toISOString() })
      .eq("room_id", roomId).eq("id", playerId);
    dataOrThrow(response, "le passage hors ligne");
    const key = `${roomId}:${playerId}`;
    const timer = heartbeatTimers.get(key);
    if (timer) clearInterval(timer);
    heartbeatTimers.delete(key);
  }

  /** Marque un joueur en ligne et actualise son dernier heartbeat. */
  async function markPlayerOnline(roomId: string, playerId: string): Promise<void> {
    dataOrThrow(await client.from("players").update({ is_online: true, last_seen_at: new Date().toISOString() })
      .eq("room_id", roomId).eq("id", playerId), "le retour en ligne");
  }

  /** Retourne les joueurs dont le heartbeat date de plus de trente secondes. */
  async function detectDisconnections(roomId: string): Promise<GamePlayer[]> {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS).toISOString();
    const response = await client.from("players").select(PLAYER_COLUMNS).eq("room_id", roomId).lt("last_seen_at", cutoff);
    const value = dataOrThrow(response, "la détection des déconnexions");
    if (!Array.isArray(value)) throw new ReconnectionServiceError("la détection des déconnexions", "liste invalide");
    return value.filter((item) => {
      const row = record(item, "joueur déconnecté");
      return row.is_online === false || (typeof row.last_seen_at === "string" && row.last_seen_at < cutoff);
    }).map(parsePlayer);
  }

  /** Restaure salle, rôle, vaisseau et dernière décision d'un joueur encore membre. */
  async function restoreSession(playerId: string): Promise<{ room: GameRoom; spacecraft: Spacecraft | null; lastDecisionAt: string | null } | null> {
    const playerResponse = await client.from("players").select(PLAYER_COLUMNS).eq("id", playerId).maybeSingle();
    const playerValue = dataOrThrow(playerResponse, "la recherche de session");
    if (!playerValue) return null;
    const playerRow = record(playerValue, "session joueur");
    const player = parsePlayer(playerRow);
    const roomId = playerRow.room_id;
    if (typeof roomId !== "string") throw new ReconnectionServiceError("la recherche de session", "room_id invalide");

    const roomResponse = await client.from("rooms").select("id, name, mission_id, host_player_id, status, created_at")
      .eq("id", roomId).maybeSingle();
    const roomValue = dataOrThrow(roomResponse, "la lecture de la salle");
    if (!roomValue) return null;
    const roomRow = record(roomValue, "salle");
    const playersResponse = await client.from("players").select(PLAYER_COLUMNS).eq("room_id", roomId);
    const playersValue = dataOrThrow(playersResponse, "la lecture des membres");
    if (!Array.isArray(playersValue)) throw new ReconnectionServiceError("la lecture des membres", "liste invalide");
    const players = playersValue.map(parsePlayer);
    // Garantit que le rôle de session est celui de la ligne toujours membre.
    const restoredPlayer = players.find((item) => item.id === player.id);
    if (!restoredPlayer) return null;
    const room: GameRoom = {
      id: roomRow.id as string,
      name: roomRow.name as string,
      missionId: roomRow.mission_id as string,
      hostPlayerId: roomRow.host_player_id as string,
      status: roomRow.status as RoomStatus,
      createdAt: roomRow.created_at as string,
      players,
    };

    const spacecraftResponse = await client.from("spacecrafts_saved").select("data, updated_at")
      .eq("room_id", roomId).maybeSingle();
    const spacecraftValue = dataOrThrow(spacecraftResponse, "la restauration du vaisseau");
    const spacecraftRow = spacecraftValue ? record(spacecraftValue, "vaisseau sauvegardé") : null;
    const spacecraft = spacecraftRow ? spacecraftRow.data as Spacecraft : null;

    const decisionResponse = await client.from("decisions_log").select("created_at")
      .eq("room_id", roomId).eq("player_id", playerId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const decisionValue = dataOrThrow(decisionResponse, "la restauration de la dernière décision");
    const decisionRow = decisionValue ? record(decisionValue, "dernière décision") : null;
    return { room, spacecraft, lastDecisionAt: decisionRow ? decisionRow.created_at as string : null };
  }

  /** Démarre un heartbeat immédiat puis toutes les dix secondes pour ce joueur. */
  function heartbeat(roomId: string, playerId: string): void {
    const key = `${roomId}:${playerId}`;
    const previous = heartbeatTimers.get(key);
    if (previous) clearInterval(previous);
    const send = () => {
      void markPlayerOnline(roomId, playerId).catch(() => {
        // Les coupures réseau sont attendues; la prochaine pulsation tentera de rétablir l'état.
      });
    };
    send();
    heartbeatTimers.set(key, setInterval(send, HEARTBEAT_INTERVAL_MS));
  }

  return { markPlayerOffline, markPlayerOnline, detectDisconnections, restoreSession, heartbeat };
}

const service = createReconnectionService(supabase as unknown as ReconnectionClient);
export const markPlayerOffline = service.markPlayerOffline;
export const markPlayerOnline = service.markPlayerOnline;
export const detectDisconnections = service.detectDisconnections;
export const restoreSession = service.restoreSession;
export const heartbeat = service.heartbeat;
