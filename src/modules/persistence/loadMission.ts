import { supabase } from "../../lib/supabase";
import type { Mission, MissionAutopsy, SimulationResult, Spacecraft } from "../../shared/types/index";
import type { PersistenceClient } from "./missionRepository";

export interface LoadedMission {
  mission: Mission;
  spacecraft?: Spacecraft;
  result?: SimulationResult;
  autopsy?: MissionAutopsy;
}

/** Charge mission et données associées; retourne null si la salle n'a pas de mission. */
export function createLoadMission(db: PersistenceClient) {
 return async function loadMissionWithClient(roomId: string): Promise<LoadedMission | null> {
  const missionResponse = await db.from("missions_saved").select("data")
    .eq("room_id", roomId).maybeSingle();
  if (missionResponse.error) throw new Error(`Échec Supabase pendant la lecture de mission : ${missionResponse.error.message}`);
  if (!missionResponse.data) return null;
  const spacecraftResponse = await db.from("spacecrafts_saved").select("data, updated_at")
    .eq("room_id", roomId).maybeSingle();
  if (spacecraftResponse.error) throw new Error(`Échec Supabase pendant la lecture du vaisseau : ${spacecraftResponse.error.message}`);
  const resultResponse = await db.from("simulation_results").select("id, mission_id, spacecraft_id, success, score, duration_days, resources_at_end, events_encountered, summary")
    .eq("room_id", roomId).maybeSingle();
  if (resultResponse.error) throw new Error(`Échec Supabase pendant la lecture du résultat : ${resultResponse.error.message}`);
  let result: SimulationResult | undefined;
  let autopsy: MissionAutopsy | undefined;
  if (resultResponse.data) {
    const row = resultResponse.data as Record<string, unknown>;
    result = {
      id: row.id as string,
      missionId: row.mission_id as string,
      spacecraftId: row.spacecraft_id as string,
      success: row.success as boolean,
      score: row.score as number,
      durationDays: row.duration_days as number,
      resourcesAtEnd: row.resources_at_end as SimulationResult["resourcesAtEnd"],
      eventsEncountered: row.events_encountered as SimulationResult["eventsEncountered"],
      summary: row.summary as string,
    };
    const autopsyResponse = await db.from("mission_autopsies").select("simulation_result_id, main_causes, good_decisions, bad_decisions, lessons_learned")
      .eq("simulation_result_id", result.id).maybeSingle();
    if (autopsyResponse.error) throw new Error(`Échec Supabase pendant la lecture de l'autopsie : ${autopsyResponse.error.message}`);
    if (autopsyResponse.data) {
      const a = autopsyResponse.data as Record<string, unknown>;
      autopsy = {
        simulationResultId: a.simulation_result_id as string,
        mainCauses: a.main_causes as string[],
        goodDecisions: a.good_decisions as string[],
        badDecisions: a.bad_decisions as string[],
        lessonsLearned: a.lessons_learned as string[],
      };
    }
  }
  const spacecraftRow = spacecraftResponse.data as { data: Spacecraft; updated_at: string } | null;
  const spacecraft = spacecraftRow ? spacecraftRow.data : undefined;
  return {
    mission: (missionResponse.data as { data: Mission }).data,
    ...(spacecraft ? { spacecraft } : {}),
    ...(result ? { result } : {}),
    ...(autopsy ? { autopsy } : {}),
  };
 };
}

/** Charge depuis Supabase la mission et ses éventuelles données associées. */
export const loadMission = createLoadMission(supabase as unknown as PersistenceClient);
