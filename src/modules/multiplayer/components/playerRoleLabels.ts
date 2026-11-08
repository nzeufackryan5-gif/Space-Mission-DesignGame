import type { PlayerRole } from "../../../shared/types/index";

/** Libellés français des rôles disponibles dans les formulaires. */
export const PLAYER_ROLE_LABELS: Record<PlayerRole, string> = {
  commander: "Commandant",
  engineer: "Ingénieur",
  scientist: "Scientifique",
  communicator: "Communicateur",
};
