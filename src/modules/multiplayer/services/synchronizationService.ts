import { supabase } from "../../../lib/supabase";
import type {
  MissionEvent,
  ResourceState,
  SimulationResult,
  Spacecraft,
} from "../../../shared/types/index";
import type {
  DecisionLogEntry,
  SupabaseClientLike,
  SupabasePostgresChangePayload,
  SupabaseQueryResponse,
  SupabaseRealtimeChannelLike,
  Unsubscribe,
} from "../types/multiplayer.types";

const DEBOUNCE_MS = 300;
const INITIAL_RECONNECT_DELAY_MS = 300;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** Erreur explicite de configuration ou de réponse du service de synchronisation. */
export class SynchronizationServiceError extends Error {
  /** Construit une erreur de synchronisation en conservant sa cause éventuelle. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SynchronizationServiceError";
  }
}

interface PendingSync {
  spacecraft: Spacecraft;
  updatedAt: string;
  waiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }>;
  timer?: ReturnType<typeof setTimeout>;
}

type ChannelHandler = (payload: SupabasePostgresChangePayload) => void;

/** Vérifie qu'une valeur inconnue est un objet de données. */
function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SynchronizationServiceError(`Réponse invalide (${context}).`);
  }
  return value as Record<string, unknown>;
}

/** Lit une chaîne obligatoire d'une ligne de base de données. */
function readString(
  row: Record<string, unknown>,
  column: string,
  context: string,
): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new SynchronizationServiceError(`Colonne ${column} invalide (${context}).`);
  }
  return value;
}

/** Vérifie la structure de base d'un vaisseau chargé depuis JSONB. */
function parseSpacecraft(value: unknown): Spacecraft {
  const row = asRecord(value, "vaisseau");
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.missionId !== "string" ||
    !Array.isArray(row.componentIds) ||
    !row.componentIds.every((id) => typeof id === "string") ||
    typeof row.totalMass !== "number" ||
    typeof row.totalCost !== "number" ||
    typeof row.availableEnergy !== "number" ||
    typeof row.fuel !== "number" ||
    typeof row.communicationRangeKm !== "number"
  ) {
    throw new SynchronizationServiceError("Données de vaisseau invalides.");
  }
  return {
    id: row.id,
    name: row.name,
    missionId: row.missionId,
    componentIds: row.componentIds,
    totalMass: row.totalMass,
    totalCost: row.totalCost,
    availableEnergy: row.availableEnergy,
    fuel: row.fuel,
    communicationRangeKm: row.communicationRangeKm,
  };
}

/** Valide une ligne JSONB synchronisée et sa version serveur. */
function parseStoredSpacecraft(value: unknown): {
  spacecraft: Spacecraft;
  updatedAt: string;
} {
  const row = asRecord(value, "vaisseau sauvegardé");
  const updatedAt = readString(row, "updated_at", "vaisseau sauvegardé");
  const spacecraft = parseSpacecraft(row.data);
  return {
    spacecraft,
    updatedAt,
  };
}

/** Convertit une erreur Supabase en erreur explicite. */
function ensureResponse(
  response: SupabaseQueryResponse,
  operation: string,
): unknown {
  if (response.error) {
    throw new SynchronizationServiceError(
      `Échec Supabase pendant ${operation} : ${response.error.message}`,
    );
  }
  return response.data;
}

/** Crée un service injectable pour les tests et l'application. */
export function createSynchronizationService(client: SupabaseClientLike) {
  const spacecraftListeners = new Map<string, Set<(spacecraft: Spacecraft) => void>>();
  const spacecraftVersions = new Map<string, string>();
  const latestSpacecraft = new Map<string, Spacecraft>();
  const spacecraftDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingSyncs = new Map<string, PendingSync>();
  let channelSequence = 0;

  /** Construit une clé de cache qui isole chaque vaisseau dans sa salle. */
  function spacecraftKey(roomId: string, spacecraftId: string): string {
    return `${roomId}:${spacecraftId}`;
  }

  /** Diffuse un vaisseau uniquement s'il est plus récent que la version déjà observée. */
  function publishSpacecraft(
    roomId: string,
    spacecraft: Spacecraft,
    updatedAt: string,
  ): void {
    const key = spacecraftKey(roomId, spacecraft.id);
    const previousVersion = spacecraftVersions.get(key);
    if (previousVersion && Date.parse(updatedAt) <= Date.parse(previousVersion)) {
      return;
    }
    spacecraftVersions.set(key, updatedAt);
    latestSpacecraft.set(key, spacecraft);
    const previousTimer = spacecraftDebounceTimers.get(key);
    if (previousTimer) clearTimeout(previousTimer);
    spacecraftDebounceTimers.set(
      key,
      setTimeout(() => {
        spacecraftDebounceTimers.delete(key);
        const latest = latestSpacecraft.get(key);
        if (!latest) return;
        for (const listener of spacecraftListeners.get(roomId) ?? []) {
          listener(latest);
        }
      }, DEBOUNCE_MS),
    );
  }

  /** S'abonne à une table Realtime et réessaie les connexions avec délai exponentiel. */
  function subscribeWithReconnect(
    roomId: string,
    table: string,
    eventHandler: ChannelHandler,
    filterColumn = "room_id",
  ): Unsubscribe {
    let active = true;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: SupabaseRealtimeChannelLike | undefined;
    const channelName = `sync:${table}:${roomId}:${++channelSequence}`;

    const removeCurrentChannel = (): void => {
      if (!channel) return;
      const currentChannel = channel;
      channel = undefined;
      void client.removeChannel(currentChannel).catch((error: unknown) => {
        console.error("Échec du nettoyage du canal Realtime.", error);
      });
    };

    const connect = (): void => {
      if (!active) return;
      const newChannel = client
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `${filterColumn}=eq.${roomId}`,
          },
          eventHandler,
        );
      channel = newChannel;
      newChannel.subscribe((status) => {
        if (!active || channel !== newChannel) return;
        if (status === "SUBSCRIBED") {
          retryAttempt = 0;
          return;
        }
        if (
          status !== "CHANNEL_ERROR" &&
          status !== "TIMED_OUT" &&
          status !== "CLOSED"
        ) {
          return;
        }
        if (retryTimer) return;
        removeCurrentChannel();
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** retryAttempt,
          MAX_RECONNECT_DELAY_MS,
        );
        retryAttempt += 1;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          connect();
        }, delay);
      });
    };

    connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
      removeCurrentChannel();
    };
  }

  /** Abonne le client aux changements de vaisseau, avec debounce et filtre de version. */
  function subscribeToSpacecraftUpdates(
    roomId: string,
    callback: (spacecraft: Spacecraft) => void,
  ): Unsubscribe {
    const listeners = spacecraftListeners.get(roomId) ?? new Set();
    listeners.add(callback);
    spacecraftListeners.set(roomId, listeners);

    const unsubscribeRealtime = subscribeWithReconnect(
      roomId,
      "spacecrafts_saved",
      (payload) => {
        if (payload.new === null) return;
        const row = asRecord(payload.new, "événement vaisseau");
        if (Object.keys(row).length === 0) return;
        const parsed = parseStoredSpacecraft(row);
        publishSpacecraft(roomId, parsed.spacecraft, parsed.updatedAt);
      },
    );

    return () => {
      unsubscribeRealtime();
      listeners.delete(callback);
      if (listeners.size === 0) spacecraftListeners.delete(roomId);
    };
  }

  /** Abonne le client aux nouveaux résultats de simulation de la salle. */
  function subscribeToSimulationResults(
    roomId: string,
    callback: (result: SimulationResult) => void,
  ): Unsubscribe {
    return subscribeWithReconnect(roomId, "simulation_results", (payload) => {
      if (payload.new === null) return;
      const row = asRecord(payload.new, "résultat de simulation");
      if (Object.keys(row).length === 0) return;
      const data: SimulationResult = {
        id: readString(row, "id", "résultat de simulation"),
        missionId: readString(row, "mission_id", "résultat de simulation"),
        spacecraftId: readString(row, "spacecraft_id", "résultat de simulation"),
        success: row.success === true,
        score: Number(row.score),
        durationDays: Number(row.duration_days),
        resourcesAtEnd: row.resources_at_end as ResourceState,
        eventsEncountered: row.events_encountered as MissionEvent[],
        summary: readString(row, "summary", "résultat de simulation"),
      };
      callback(data);
    });
  }

  /** Abonne le client aux décisions ajoutées au journal de la salle. */
  function subscribeToDecisions(
    roomId: string,
    callback: (decision: DecisionLogEntry) => void,
  ): Unsubscribe {
    return subscribeWithReconnect(roomId, "decisions_log", (payload) => {
      if (payload.new === null) return;
      const row = asRecord(payload.new, "décision");
      if (Object.keys(row).length === 0) return;
      const decision: DecisionLogEntry = {
        id: readString(row, "id", "décision"),
        roomId: readString(row, "room_id", "décision"),
        playerId: readString(row, "player_id", "décision"),
        action: readString(row, "action", "décision"),
        payload: asRecord(row.payload, "contenu de décision"),
        createdAt: readString(row, "created_at", "décision"),
      };
      callback(decision);
    });
  }

  /** Insère une décision dans le journal partagé de la salle. */
  async function broadcastDecision(
    roomId: string,
    entry: DecisionLogEntry,
  ): Promise<void> {
    try {
      const response = await client
        .from("decisions_log")
        .insert({
          id: entry.id,
          room_id: roomId,
          player_id: entry.playerId,
          action: entry.action,
          payload: entry.payload,
          created_at: entry.createdAt,
        });
      ensureResponse(response, "la publication de décision");
    } catch (error) {
      if (error instanceof SynchronizationServiceError) throw error;
      throw new SynchronizationServiceError("Impossible de publier la décision.", {
        cause: error,
      });
    }
  }

  /** Synchronise le vaisseau après 300 ms et laisse gagner la version la plus récente. */
  function syncLocalStateToServer(
    roomId: string,
    spacecraft: Spacecraft,
    updatedAt = new Date().toISOString(),
  ): Promise<void> {
    if (
      typeof updatedAt !== "string" ||
      Number.isNaN(Date.parse(updatedAt))
    ) {
      return Promise.reject(
        new SynchronizationServiceError(
          "Un horodatage ISO valide est requis pour synchroniser le vaisseau.",
        ),
      );
    }

    const key = spacecraftKey(roomId, spacecraft.id);
    const existing = pendingSyncs.get(key);
    if (existing) {
      existing.spacecraft = spacecraft;
      clearTimeout(existing.timer);
    }

    return new Promise<void>((resolve, reject) => {
      const pending =
        existing ??
        ({
          spacecraft,
          updatedAt,
          waiters: [],
        } satisfies PendingSync);
      const pendingVersion = pending.updatedAt;
      if (
        Date.parse(updatedAt) > Date.parse(pendingVersion)
      ) {
        pending.spacecraft = spacecraft;
        pending.updatedAt = updatedAt;
      }
      pending.waiters.push({ resolve, reject });
      pending.timer = setTimeout(() => {
        pendingSyncs.delete(key);
        void (async () => {
          try {
            const response = await client.rpc("sync_spacecraft_state", {
              p_room_id: roomId,
              p_mission_id: pending.spacecraft.missionId,
              p_data: pending.spacecraft,
              p_client_updated_at: pending.updatedAt,
            });
            const result = asRecord(
              ensureResponse(response, "la synchronisation du vaisseau"),
              "résultat de synchronisation",
            );
            const parsed = parseStoredSpacecraft({
              data: result.data,
              updated_at: result.updated_at,
            });
            publishSpacecraft(roomId, parsed.spacecraft, parsed.updatedAt);
            for (const waiter of pending.waiters) waiter.resolve();
          } catch (error) {
            for (const waiter of pending.waiters) waiter.reject(error);
          }
        })();
      }, DEBOUNCE_MS);
      pendingSyncs.set(key, pending);
    });
  }

  return {
    subscribeToSpacecraftUpdates,
    subscribeToSimulationResults,
    subscribeToDecisions,
    broadcastDecision,
    syncLocalStateToServer,
  };
}

const defaultSynchronizationService = createSynchronizationService(
  supabase as unknown as SupabaseClientLike,
);

/** S'abonne aux modifications d'un vaisseau dans une salle. */
export const subscribeToSpacecraftUpdates =
  defaultSynchronizationService.subscribeToSpacecraftUpdates;

/** S'abonne aux résultats de simulation d'une salle. */
export const subscribeToSimulationResults =
  defaultSynchronizationService.subscribeToSimulationResults;

/** S'abonne aux décisions du journal d'une salle. */
export const subscribeToDecisions =
  defaultSynchronizationService.subscribeToDecisions;

/** Enregistre une décision dans le journal partagé. */
export const broadcastDecision = defaultSynchronizationService.broadcastDecision;

/** Synchronise un vaisseau en comparant sa version ISO à celle du serveur. */
export const syncLocalStateToServer =
  defaultSynchronizationService.syncLocalStateToServer;
