import { describe, expect, it, vi } from "vitest";
import type {
  SupabaseClientLike,
  SupabaseQueryLike,
  SupabaseQueryResponse,
  SupabaseRealtimeChannelLike,
  SupabaseTableLike,
} from "../../types/multiplayer.types";

vi.mock("../../../../lib/supabase", () => ({
  supabase: {},
}));

import { createRoomService, generateRoomCode } from "../roomService";

class MockQuery implements SupabaseQueryLike, SupabaseTableLike {
  constructor(private readonly resolve: () => SupabaseQueryResponse) {}

  select(): SupabaseQueryLike {
    return this;
  }

  insert(): SupabaseQueryLike {
    return this;
  }

  update(): SupabaseQueryLike {
    return this;
  }

  delete(): SupabaseQueryLike {
    return this;
  }

  eq(): SupabaseQueryLike {
    return this;
  }

  single(): PromiseLike<SupabaseQueryResponse> {
    return Promise.resolve(this.resolve());
  }

  maybeSingle(): PromiseLike<SupabaseQueryResponse> {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = SupabaseQueryResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseQueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

/** Construit un client Supabase simulé pour les tables et la RPC de jonction. */
function createMockClient(
  responses: SupabaseQueryResponse[],
  rpcResponses: SupabaseQueryResponse[] = [],
): SupabaseClientLike {
  return {
    from: () =>
      new MockQuery(() => {
        const nextResponse = responses.shift();
        if (!nextResponse) throw new Error("Aucune réponse mock disponible.");
        return nextResponse;
      }),
    rpc: () => {
      const nextResponse = rpcResponses.shift();
      if (!nextResponse) throw new Error("Aucune réponse RPC mock disponible.");
      return Promise.resolve(nextResponse);
    },
    channel: () => {
      const channel: SupabaseRealtimeChannelLike = {
        on: () => channel,
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: async () => "ok",
  };
}

const roomRow = {
  id: "room-1",
  code: "MF2048",
  name: "Mission Mars",
  mission_id: "mission-1",
  host_player_id: "host-1",
  status: "waiting",
  created_at: "2026-11-08T12:00:00.000Z",
};
const rpcRoom = {
  id: "room-1",
  name: "Mission Mars",
  missionId: "mission-1",
  hostPlayerId: "host-1",
  status: "waiting",
  createdAt: "2026-11-08T12:00:00.000Z",
  players: [
    {
      id: "player-2",
      displayName: "Ada",
      role: "engineer",
      isReady: false,
    },
  ],
};
/** Formate une réponse Supabase réussie pour les scénarios de test. */
function response(data: unknown): SupabaseQueryResponse {
  return { data, error: null };
}

describe("roomService", () => {
  it("génère un code au format MF suivi de quatre chiffres", () => {
    expect(generateRoomCode()).toMatch(/^MF\d{4}$/);
  });

  it("crée une salle avec sa liste de joueurs initiale", async () => {
    const service = createRoomService(
      createMockClient([
        response(roomRow),
        response({}),
        response(roomRow),
        response([
          {
            id: "host-1",
            display_name: "host-1",
            role: "commander",
            is_ready: false,
          },
        ]),
      ]),
      { generateRoomCode: () => "MF2048" },
    );

    await expect(
      service.createRoom("Mission Mars", "mission-1", "host-1"),
    ).resolves.toEqual({
      id: "room-1",
      code: "MF2048",
      name: "Mission Mars",
      missionId: "mission-1",
      hostPlayerId: "host-1",
      players: [
        {
          id: "host-1",
          displayName: "host-1",
          role: "commander",
          isReady: false,
        },
      ],
      status: "waiting",
      createdAt: "2026-11-08T12:00:00.000Z",
    });
  });

  it("rejoint une salle via la RPC et retourne sa réponse GameRoom", async () => {
    const service = createRoomService(createMockClient([], [response(rpcRoom)]));

    await expect(
      service.joinRoomByCode("MF1234", {
        id: "player-2",
        displayName: "Ada",
        role: "engineer",
      }),
    ).resolves.toEqual(rpcRoom);
  });

  it("refuse un cinquième joueur avec ROOM_FULL", async () => {
    const service = createRoomService(
      createMockClient([], [{ data: null, error: { message: "MFP01 ROOM_FULL" } }]),
    );

    await expect(
      service.joinRoomByCode("MF1234", {
        id: "player-5",
        displayName: "Ada",
        role: "commander",
      }),
    ).rejects.toMatchObject({ code: "ROOM_FULL" });
  });

  it("lève ROOM_NOT_FOUND si le code ne correspond à aucune salle", async () => {
    const service = createRoomService(
      createMockClient([], [{ data: null, error: { message: "MFP02 ROOM_NOT_FOUND" } }]),
    );

    await expect(
      service.joinRoomByCode("MF1234", {
        id: "player-1",
        displayName: "Ada",
        role: "engineer",
      }),
    ).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("lève NOT_HOST lors d'une fermeture demandée par un autre joueur", async () => {
    const service = createRoomService(
      createMockClient([response(roomRow), response([])]),
    );

    await expect(service.closeRoom("room-1", "other-player")).rejects.toMatchObject({
      code: "NOT_HOST",
    });
  });

  it("réessaie trois collisions avant de lever CODE_TAKEN", async () => {
    const uniqueViolation: SupabaseQueryResponse = {
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    };
    const service = createRoomService(
      createMockClient([uniqueViolation, uniqueViolation, uniqueViolation]),
      { generateRoomCode: () => "MF2048" },
    );

    await expect(
      service.createRoom("Mars", "mission-1", "host-1"),
    ).rejects.toMatchObject({ code: "CODE_TAKEN" });
  });
});
