import { supabase } from "../../lib/supabase";
import type {
  MissionAutopsy,
  SimulationResult,
  Spacecraft,
} from "../../shared/types/index";

type Response = { data: unknown; error: { message: string } | null };
type Query = PromiseLike<Response> & {
  select(columns?: string): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: string[]): Query;
  maybeSingle(): PromiseLike<Response>;
  single(): PromiseLike<Response>;
};
type Table = {
  select(columns?: string): Query;
  insert(values: Record<string, unknown>): Query;
  update(values: Record<string, unknown>): Query;
};
export interface PersistenceClient {
  from(table: string): Table;
}

/** Erreur levée quand Supabase refuse une opération de persistance. */
export class MissionRepositoryError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`Échec Supabase pendant ${operation} : ${cause.message}`);
    this.name = "MissionRepositoryError";
  }
}

const client = supabase as unknown as PersistenceClient;

function check(response: Response, operation: string): unknown {
  if (response.error) throw new MissionRepositoryError(operation, response.error);
  return response.data;
}

/** Crée les opérations de persistance avec un client Supabase injectable. */
export function createMissionRepository(db: PersistenceClient) {
  /** Enregistre ou remplace le vaisseau identifié dans une salle. */
  async function saveSpacecraft(roomId: string, sc: Spacecraft): Promise<void> {
    const updatedAt = new Date().toISOString();
    const data: Spacecraft = sc;
    const existing = check(await db.from("spacecrafts_saved").select("id")
      .eq("room_id", roomId).eq("spacecraft_id", sc.id).maybeSingle(), "la recherche du vaisseau");
    const values = {
      room_id: roomId,
      mission_id: sc.missionId,
      spacecraft_id: sc.id,
      data,
      updated_at: updatedAt,
    };
    const query = existing
      ? db.from("spacecrafts_saved").update(values).eq("room_id", roomId).eq("spacecraft_id", sc.id)
      : db.from("spacecrafts_saved").insert(values);
    check(await query, "la sauvegarde du vaisseau");
  }

  /** Charge le vaisseau sauvegardé d'une salle, ou null si absent. */
  async function loadSpacecraft(roomId: string): Promise<Spacecraft | null> {
    const value = check(await db.from("spacecrafts_saved").select("data, updated_at")
      .eq("room_id", roomId).maybeSingle(), "la lecture du vaisseau");
    if (value === null) return null;
    const row = value as { data: Spacecraft; updated_at: string };
    return row.data;
  }

  /** Enregistre un résultat en colonnes et JSONB pour les ressources/événements. */
  async function saveSimulationResult(roomId: string, r: SimulationResult): Promise<void> {
    check(await db.from("simulation_results").insert({
      id: r.id,
      room_id: roomId,
      mission_id: r.missionId,
      spacecraft_id: r.spacecraftId,
      success: r.success,
      score: r.score,
      duration_days: r.durationDays,
      resources_at_end: r.resourcesAtEnd,
      events_encountered: r.eventsEncountered,
      summary: r.summary,
    }), "la sauvegarde du résultat");
  }

  /** Enregistre l'autopsie liée au résultat de simulation. */
  async function saveAutopsy(roomId: string, a: MissionAutopsy): Promise<void> {
    const resultId = check(await db.from("simulation_results").select("id")
      .eq("room_id", roomId).eq("id", a.simulationResultId).maybeSingle(), "la recherche du résultat");
    if (!resultId) throw new MissionRepositoryError("la recherche du résultat", { message: "résultat absent" });
    const existing = check(await db.from("mission_autopsies").select("id")
      .eq("simulation_result_id", a.simulationResultId).maybeSingle(), "la recherche de l'autopsie");
    const values = {
      simulation_result_id: a.simulationResultId,
      main_causes: a.mainCauses,
      good_decisions: a.goodDecisions,
      bad_decisions: a.badDecisions,
      lessons_learned: a.lessonsLearned,
    };
    const query = existing
      ? db.from("mission_autopsies").update(values).eq("simulation_result_id", a.simulationResultId)
      : db.from("mission_autopsies").insert(values);
    check(await query, "la sauvegarde de l'autopsie");
  }

  /** Liste les missions des salles auxquelles le joueur appartient. */
  async function listPlayerHistory(playerId: string): Promise<Array<{ roomId: string; missionId: string; createdAt: string }>> {
    const players = check(await db.from("players").select("room_id").eq("id", playerId), "la recherche des salles du joueur");
    const roomIds = (players as Array<{ room_id: string }>).map(({ room_id }) => room_id);
    if (!roomIds.length) return [];
    const missions = check(await db.from("missions_saved").select("room_id, mission_id, created_at")
      .in("room_id", roomIds), "la lecture de l'historique");
    return (missions as Array<{ room_id: string; mission_id: string; created_at: string }>).map((row) => ({
      roomId: row.room_id,
      missionId: row.mission_id,
      createdAt: row.created_at,
    }));
  }

  return { saveSpacecraft, loadSpacecraft, saveSimulationResult, saveAutopsy, listPlayerHistory };
}

const repository = createMissionRepository(client);
export const saveSpacecraft = repository.saveSpacecraft;
export const loadSpacecraft = repository.loadSpacecraft;
export const saveSimulationResult = repository.saveSimulationResult;
export const saveAutopsy = repository.saveAutopsy;
export const listPlayerHistory = repository.listPlayerHistory;
