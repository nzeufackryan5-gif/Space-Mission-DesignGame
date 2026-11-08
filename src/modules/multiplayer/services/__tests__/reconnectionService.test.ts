import { afterEach, describe, expect, it, vi } from "vitest";
import type { GamePlayer, Spacecraft } from "../../../../shared/types/index";

vi.mock("../../../../lib/supabase", () => ({ supabase: {} }));

import { createReconnectionService } from "../reconnectionService";

function createMemoryClient() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    players: [{ id: "player-1", room_id: "room-1", display_name: "Ada", role: "engineer", is_ready: false, is_online: true, last_seen_at: new Date().toISOString() }],
    rooms: [{ id: "room-1", name: "Europa crew", mission_id: "mission-1", host_player_id: "player-1", status: "designing", created_at: "2026-01-01T00:00:00.000Z" }],
    spacecrafts_saved: [{ room_id: "room-1", data: { id: "sc-1", name: "Odyssey", missionId: "mission-1", componentIds: ["engine"], totalMass: 123, totalCost: 500, availableEnergy: 80, fuel: 40, communicationRangeKm: 900 }, updated_at: "2026-01-01T00:00:00.000Z" }],
    decisions_log: [{ room_id: "room-1", player_id: "player-1", created_at: "2026-01-01T00:02:00.000Z" }],
  };
  const client = {
    from(table: string) {
      let filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let update: Record<string, unknown> | null = null;
      let sort: { key: string; ascending: boolean } | null = null;
      let count: number | null = null;
      const execute = () => {
        let rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        if (update) rows.forEach((row) => Object.assign(row, update));
        if (sort) rows = [...rows].sort((a, b) => String(a[sort!.key]).localeCompare(String(b[sort!.key])) * (sort!.ascending ? 1 : -1));
        if (count !== null) rows = rows.slice(0, count);
        return { data: rows, error: null };
      };
      const query = {
        select: () => query,
        update: (values: Record<string, unknown>) => { update = values; return query; },
        eq: (key: string, value: string) => { filters.push((row) => row[key] === value); return query; },
        lt: (key: string, value: string) => { filters.push((row) => String(row[key]) < value); return query; },
        order: (key: string, options?: { ascending?: boolean }) => { sort = { key, ascending: options?.ascending ?? true }; return query; },
        limit: (value: number) => { count = value; return query; },
        maybeSingle: () => { const rows = execute().data; return Promise.resolve({ data: rows[0] ?? null, error: null }); },
        then: (resolve: (value: ReturnType<typeof execute>) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve().then(execute).then(resolve, reject),
      };
      return query;
    },
  };
  return { client, tables };
}

afterEach(() => vi.useRealTimers());

describe("reconnectionService", () => {
  it("retient le joueur hors ligne après 30 s et restaure son rôle et son vaisseau après 5 min", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T12:00:00.000Z"));
    const { client, tables } = createMemoryClient();
    const service = createReconnectionService(client as unknown as Parameters<typeof createReconnectionService>[0]);

    await service.markPlayerOffline("room-1", "player-1");
    expect(tables.players).toHaveLength(1);
    expect(tables.players[0]).toMatchObject({ is_online: false, role: "engineer" });

    vi.advanceTimersByTime(31_000);
    const disconnected: GamePlayer[] = await service.detectDisconnections("room-1");
    expect(disconnected).toMatchObject([{ id: "player-1", role: "engineer" }]);

    vi.advanceTimersByTime(4 * 60_000);
    await service.markPlayerOnline("room-1", "player-1");
    const restored = await service.restoreSession("player-1");

    expect(restored?.room.players).toContainEqual(expect.objectContaining({ id: "player-1", role: "engineer" }));
    expect(restored?.spacecraft).toMatchObject<Partial<Spacecraft>>({ id: "sc-1", totalMass: 123 });
    expect(restored?.lastDecisionAt).toBe("2026-01-01T00:02:00.000Z");
    expect(tables.players).toHaveLength(1);
    expect(tables.players[0]?.is_online).toBe(true);
  });
});
