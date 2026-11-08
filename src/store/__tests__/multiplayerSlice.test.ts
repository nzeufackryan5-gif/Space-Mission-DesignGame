import { afterEach, describe, expect, it } from "vitest";
import type { GamePlayer, GameRoom } from "../../shared/types/index";
import { useGameStore } from "../index";

const testRoom: GameRoom = {
  id: "room-001",
  name: "Équipe Mars",
  missionId: "mission-mars",
  hostPlayerId: "player-001",
  players: [],
  status: "waiting",
  createdAt: "2026-11-08T12:00:00.000Z",
};

const testPlayer: GamePlayer = {
  id: "player-001",
  displayName: "Ada",
  role: "engineer",
  isReady: true,
};

afterEach(() => {
  useGameStore.getState().reset();
});

describe("multiplayerSlice", () => {
  it("enregistre la salle courante", () => {
    useGameStore.getState().setRoom(testRoom);

    expect(useGameStore.getState().currentRoom).toEqual(testRoom);
  });

  it("enregistre le joueur courant", () => {
    useGameStore.getState().setPlayer(testPlayer);

    expect(useGameStore.getState().currentPlayer).toEqual(testPlayer);
  });

  it("réinitialise la salle et le joueur", () => {
    useGameStore.getState().setRoom(testRoom);
    useGameStore.getState().setPlayer(testPlayer);

    useGameStore.getState().reset();

    expect(useGameStore.getState().currentRoom).toBeNull();
    expect(useGameStore.getState().currentPlayer).toBeNull();
  });
});
