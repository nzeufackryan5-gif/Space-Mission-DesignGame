/** Réutilise la slice Zustand multijoueur de l'état global afin de garder une source unique. */
export { useGameStore as useMultiplayerStore } from "../../../store/index";
export type { MultiplayerSlice as MultiplayerStore } from "../../../store/multiplayerSlice";
