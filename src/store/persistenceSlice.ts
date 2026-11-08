import type { StateCreator } from "zustand";
import type { RootStore } from "./index";

/** Type vide servant de point d'extension à la future slice de persistance. */
export type PersistenceSlice = Record<never, never>;

/** Slice volontairement vide jusqu'à l'ajout des actions de sauvegarde. */
export const createPersistenceSlice: StateCreator<
  RootStore,
  [],
  [],
  PersistenceSlice
> = () => ({});
