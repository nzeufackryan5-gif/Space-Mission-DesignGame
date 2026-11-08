import { describe, expect, it, vi } from "vitest";
import type { Spacecraft } from "../../../../shared/types/index";
import type {
  SupabaseClientLike,
  SupabasePostgresChangePayload,
  SupabaseQueryLike,
  SupabaseQueryResponse,
  SupabaseRealtimeChannelLike,
  SupabaseTableLike,
} from "../../types/multiplayer.types";

vi.mock("../../../../lib/supabase", () => ({
  supabase: {},
}));

import { createSynchronizationService } from "../synchronizationService";

interface Listener {
  table: string;
  roomId: string;
  callback: (payload: SupabasePostgresChangePayload) => void;
  statusCallback?: (status: string) => void;
}

function createRealtimeHarness() {
  const listeners: Listener[] = [];
  let row: { spacecraft: Spacecraft; updatedAt: string } | null = null;

  function client(): SupabaseClientLike {
    return {
      from: () => new MockQuery(),
      rpc: async (_fn, args): Promise<SupabaseQueryResponse> => {
        const data = args.p_data as Spacecraft;
        const updatedAt = args.p_client_updated_at as string;
        if (!row || Date.parse(updatedAt) > Date.parse(row.updatedAt)) {
          row = { spacecraft: data, updatedAt };
          for (const listener of listeners) {
            if (listener.table === "spacecrafts_saved") {
              listener.callback({
                new: {
                  room_id: args.p_room_id,
                  spacecraft_id: data.id,
                  data,
                  updated_at: updatedAt,
                },
                old: {},
              });
            }
          }
        }
        return {
          data: {
            applied: Boolean(row && row.updatedAt === updatedAt),
            data: row?.spacecraft,
            updated_at: row?.updatedAt,
          },
          error: null,
        };
      },
      channel: () => new MockChannel(listeners),
      removeChannel: async () => "ok",
    };
  }

  return { client, listeners };
}

class MockQuery implements SupabaseQueryLike, SupabaseTableLike {
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
    return Promise.resolve({ data: null, error: null });
  }

  maybeSingle(): PromiseLike<SupabaseQueryResponse> {
    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = SupabaseQueryResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseQueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
  }
}

class MockChannel implements SupabaseRealtimeChannelLike {
  private roomId = "";
  private table = "";
  private handler:
    | ((payload: SupabasePostgresChangePayload) => void)
    | undefined;
  private statusHandler: ((status: string) => void) | undefined;

  constructor(private readonly listeners: Listener[]) {}

  on(
    _type: "postgres_changes",
    filter: { event: "*" | "DELETE"; schema: "public"; table: string; filter?: string },
    callback: (payload: SupabasePostgresChangePayload) => void,
  ): SupabaseRealtimeChannelLike {
    this.table = filter.table;
    this.roomId = filter.filter?.split("eq.")[1] ?? "";
    this.handler = callback;
    return this;
  }

  subscribe(callback?: (status: string) => void): SupabaseRealtimeChannelLike {
    this.statusHandler = callback;
    this.listeners.push({
      table: this.table,
      roomId: this.roomId,
      callback: this.handler ?? (() => undefined),
      statusCallback: callback,
    });
    this.statusHandler?.("SUBSCRIBED");
    return this;
  }
}

const baseSpacecraft: Spacecraft = {
  id: "ship-1",
  name: "Explorer",
  missionId: "mission-1",
  componentIds: ["engine-1"],
  totalMass: 100,
  totalCost: 500,
  availableEnergy: 80,
  fuel: 60,
  communicationRangeKm: 1000,
};

describe("synchronizationService", () => {
  it("fait converger deux clients sur le vaisseau dont l'horodatage est le plus récent", async () => {
    vi.useRealTimers();
    const harness = createRealtimeHarness();
    const clientOne = createSynchronizationService(harness.client());
    const clientTwo = createSynchronizationService(harness.client());
    let spacecraftOne: Spacecraft | undefined;
    let spacecraftTwo: Spacecraft | undefined;

    const unsubscribeOne = clientOne.subscribeToSpacecraftUpdates(
      "room-1",
      (spacecraft) => {
        spacecraftOne = spacecraft;
      },
    );
    const unsubscribeTwo = clientTwo.subscribeToSpacecraftUpdates(
      "room-1",
      (spacecraft) => {
        spacecraftTwo = spacecraft;
      },
    );

    await clientOne.syncLocalStateToServer("room-1", {
      ...baseSpacecraft,
      totalMass: 250,
    }, "2026-11-08T22:00:02.000Z");
    await clientTwo.syncLocalStateToServer("room-1", {
      ...baseSpacecraft,
      totalMass: 150,
    }, "2026-11-08T22:00:01.000Z");

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(spacecraftOne?.totalMass).toBe(250);
    expect(spacecraftTwo?.totalMass).toBe(250);
    expect(spacecraftOne).toEqual({ ...baseSpacecraft, totalMass: 250 });
    expect(spacecraftTwo).toEqual({ ...baseSpacecraft, totalMass: 250 });

    unsubscribeOne();
    unsubscribeTwo();
  });

  it("se réabonne avec backoff lorsqu'un canal échoue", async () => {
    vi.useFakeTimers();
    const harness = createRealtimeHarness();
    const service = createSynchronizationService(harness.client());
    const unsubscribe = service.subscribeToDecisions("room-1", () => undefined);
    const firstChannel = harness.listeners[0];

    firstChannel.statusCallback?.("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(300);

    expect(harness.listeners).toHaveLength(2);
    unsubscribe();
    vi.useRealTimers();
  });
});
