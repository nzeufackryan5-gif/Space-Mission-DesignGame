import { create } from "zustand";
import { createMultiplayerSlice, type MultiplayerSlice } from "./multiplayerSlice";
import { createPersistenceSlice, type PersistenceSlice } from "./persistenceSlice";

/** État global composé des slices métier de l'application. */
export type RootStore = MultiplayerSlice & PersistenceSlice;

/** Store Zustand partagé par les modules de l'application. */
export const useGameStore = create<RootStore>()((...args) => ({
  ...createMultiplayerSlice(...args),
  ...createPersistenceSlice(...args),
}));
