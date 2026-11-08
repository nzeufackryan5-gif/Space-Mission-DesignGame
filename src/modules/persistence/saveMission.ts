import { supabase } from "../../lib/supabase";
import type { Mission } from "../../shared/types/index";
import type { PersistenceClient } from "./missionRepository";

/** Construit une sauvegarde de mission avec un client injectable. */
export function createSaveMission(db: PersistenceClient) {
  return async function saveMissionWithClient(roomId: string, mission: Mission): Promise<void> {
    const existing = await db.from("missions_saved").select("id")
      .eq("room_id", roomId).eq("mission_id", mission.id).maybeSingle();
    if (existing.error) throw new Error(`Échec Supabase pendant la recherche de mission : ${existing.error.message}`);
    const values = { room_id: roomId, mission_id: mission.id, data: mission };
    const response = existing.data
      ? await db.from("missions_saved").update(values).eq("room_id", roomId).eq("mission_id", mission.id)
      : await db.from("missions_saved").insert(values);
    if (response.error) throw new Error(`Échec Supabase pendant la sauvegarde de mission : ${response.error.message}`);
  };
}

/** Sauvegarde la mission complète dans la colonne JSONB de la salle. */
export const saveMission = createSaveMission(supabase as unknown as PersistenceClient);
