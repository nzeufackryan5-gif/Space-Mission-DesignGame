import { RoomServiceError } from "../services/roomService";
import { PlayerServiceError } from "../services/playerService";

/** Traduit les erreurs de salle en messages adaptés à l'interface. */
export function roomErrorMessage(error: unknown): string {
  if (error instanceof RoomServiceError && error.code === "ROOM_FULL") {
    return "Cette salle est complète.";
  }
  if (
    (error instanceof RoomServiceError || error instanceof PlayerServiceError) &&
    error.code === "ROOM_NOT_FOUND"
  ) {
    return "Cette salle est introuvable.";
  }
  return error instanceof Error ? error.message : "Impossible de rejoindre la salle.";
}
