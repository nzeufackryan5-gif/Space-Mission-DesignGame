import { describe, expect, it, vi } from "vitest";
vi.mock("../../../lib/supabase", () => ({ supabase: {} }));
import type { Mission } from "../../../shared/types/index";
import type { PersistenceClient } from "../missionRepository";
import { createLoadMission } from "../loadMission";
import { createSaveMission } from "../saveMission";

function memoryClient(): PersistenceClient {
  const tables = new Map<string, Array<Record<string, unknown>>>();
  return {
    from(name: string) {
      const filters: Array<[string, string | string[]]> = [];
      let action: "select" | "insert" | "update" = "select";
      let values: Record<string, unknown> = {};
      const execute = () => {
        const rows = tables.get(name) ?? [];
        let matched = rows.filter((row) => filters.every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key] as string) : row[key] === value));
        if (action === "insert") {
          const row = { ...values, id: `row-${rows.length + 1}`, created_at: "2026-01-01T00:00:00Z" };
          rows.push(row);
          tables.set(name, rows);
          matched = [row];
        } else if (action === "update") {
          matched.forEach((row) => Object.assign(row, values));
        }
        return { data: matched, error: null };
      };
      const query = {
        select() { action = "select"; return query; },
        insert(next: Record<string, unknown>) { action = "insert"; values = next; return query; },
        update(next: Record<string, unknown>) { action = "update"; values = next; return query; },
        eq(key: string, value: string) { filters.push([key, value]); return query; },
        in(key: string, value: string[]) { filters.push([key, value]); return query; },
        maybeSingle() { return Promise.resolve({ ...execute(), data: execute().data[0] ?? null }); },
        single() { return Promise.resolve({ ...execute(), data: execute().data[0] ?? null }); },
        then(resolve: (value: ReturnType<typeof execute>) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve().then(execute).then(resolve, reject);
        },
      };
      return query;
    },
  } as PersistenceClient;
}

const mission: Mission = {
  id: "mission-1",
  name: "Europa",
  description: "Explorer la lune",
  objective: "Collecter des données",
  difficulty: "hard",
  destination: "Europa",
  durationDays: 120,
  budgetLimit: 900,
  maxSpacecraftMass: 450,
};

describe("mission persistence", () => {
  it("round-trips une mission sans perte et renvoie null pour une salle vide", async () => {
    const db = memoryClient();
    const save = createSaveMission(db);
    const load = createLoadMission(db);

    expect(await load("unknown-room")).toBeNull();
    await save("room-1", mission);

    expect(await load("room-1")).toEqual({ mission });
  });
});
