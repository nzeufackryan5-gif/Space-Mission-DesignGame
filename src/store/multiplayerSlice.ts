import type { StateCreator } from "zustand";
import type { GamePlayer, GameRoom } from "../shared/types/index";
import type { RootStore } from "./index";

/** État et actions du module multijoueur dans le store racine. */
export interface MultiplayerSlice {
  currentRoom: GameRoom | null;
  currentPlayer: GamePlayer | null;
  setRoom: (room: GameRoom | null) => void;
  setPlayer: (player: GamePlayer | null) => void;
  reset: () => void;
}

/** Fabrique de la slice multijoueur, composée dans le store racine. */
export const createMultiplayerSlice: StateCreator<
  RootStore,
  [],
  [],
  MultiplayerSlice
> = (set) => ({
  currentRoom: null,
  currentPlayer: null,
  setRoom: (room) => set({ currentRoom: room }),
  setPlayer: (player) => set({ currentPlayer: player }),
  reset: () => set({ currentRoom: null, currentPlayer: null }),
});
