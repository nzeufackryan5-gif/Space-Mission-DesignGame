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

import {
  createPlayerService,
  PlayerServiceError,
} from "../playerService";

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

/** Crée un client Supabase simulé avec réponses ordonnées pour tests. */
function createMockClient(
  responses: SupabaseQueryResponse[],
  rpcResponse: SupabaseQueryResponse = { data: null, error: null },
): SupabaseClientLike {
  return {
    from: () =>
      new MockQuery(() => {
        const nextResponse = responses.shift();
        if (!nextResponse) throw new Error("Aucune réponse mock disponible.");
        return nextResponse;
      }),
    rpc: () => Promise.resolve(rpcResponse),
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

/** Formate une réponse Supabase simulée. */
function response(data: unknown): SupabaseQueryResponse {
  return { data, error: null };
}

const currentPlayer = {
  id: "player-1",
  room_id: "room-1",
  display_name: "Ada",
  role: "engineer",
  is_ready: false,
};

describe("playerService", () => {
  it("attribue un rôle et libère l'ancien par une mise à jour de la ligne", async () => {
    const service = createPlayerService(createMockClient([response({ id: "player-1" })]));

    await expect(
      service.assignRole("room-1", "player-1", "scientist"),
    ).resolves.toBeUndefined();
  });

  it("refuse un rôle déjà utilisé dans la salle", async () => {
    const service = createPlayerService(
      createMockClient([
        {
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        },
      ]),
    );

    const result = service.assignRole("room-1", "player-1", "scientist");
    await expect(result).rejects.toBeInstanceOf(PlayerServiceError);
    await expect(result).rejects.toMatchObject({ code: "ROLE_TAKEN" });
  });

  it("transfère la gestion du départ de l'hôte à la RPC transactionnelle", async () => {
    const rpc = vi.fn(
      async (): Promise<SupabaseQueryResponse> => response("player-2"),
    );
    const service = createPlayerService({
      ...createMockClient([]),
      rpc,
    });

    await service.removePlayer("room-1", "host-1");

    expect(rpc).toHaveBeenCalledWith("remove_player_and_transfer_host", {
      p_room_id: "room-1",
      p_player_id: "host-1",
    });
  });

  it("retourne uniquement les rôles libres", async () => {
    const service = createPlayerService(
      createMockClient([response([currentPlayer])]),
    );

    await expect(service.getAvailableRoles("room-1")).resolves.toEqual([
      "commander",
      "scientist",
      "communicator",
    ]);
  });

  it("indique si tous les joueurs présents sont prêts", async () => {
    const service = createPlayerService(
      createMockClient([
        response([
          { ...currentPlayer, is_ready: true },
          { ...currentPlayer, id: "player-2", role: "scientist", is_ready: true },
        ]),
      ]),
    );

    await expect(service.areAllPlayersReady("room-1")).resolves.toBe(true);
  });

  it("retourne le rôle du joueur, ou null si le joueur est absent", async () => {
    const service = createPlayerService(
      createMockClient([response({ role: "engineer" }), response(null)]),
    );

    await expect(service.getPlayerRole("room-1", "player-1")).resolves.toBe(
      "engineer",
    );
    await expect(service.getPlayerRole("room-1", "player-2")).resolves.toBeNull();
  });
});
