import type { GamePlayer, GameRoom } from "../../../shared/types/index";

/** Décision du journal multijoueur, conservée hors du contrat partagé officiel. */
export interface DecisionLogEntry {
  id: string;
  roomId: string;
  playerId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Salle retournée par le service avec son code d'invitation propre au multijoueur. */
export interface RoomWithCode extends GameRoom {
  code: string;
}

/** Joueur avec l'état de présence fourni par la table multijoueur. */
export interface OnlineGamePlayer extends GamePlayer {
  isOnline?: boolean;
}

/** Mission de démonstration disponible dans le formulaire de création. */
export interface MissionOption {
  id: string;
  name: string;
}

/** Erreurs métier possibles lors des opérations sur une salle. */
export type RoomError =
  | "ROOM_FULL"
  | "ROOM_NOT_FOUND"
  | "NOT_HOST"
  | "CODE_TAKEN";

/** Fonction de désabonnement à un canal Realtime. */
export type Unsubscribe = () => void;

/** Réponse normalisée des requêtes Supabase utilisée par le service et ses tests. */
export interface SupabaseQueryResponse {
  data: unknown;
  error: {
    code?: string;
    message: string;
  } | null;
}

/** Interface minimale d'une requête Supabase chaînable. */
export interface SupabaseQueryLike extends PromiseLike<SupabaseQueryResponse> {
  select(columns?: string): SupabaseQueryLike;
  eq(column: string, value: string | boolean): SupabaseQueryLike;
  single(): PromiseLike<SupabaseQueryResponse>;
  maybeSingle(): PromiseLike<SupabaseQueryResponse>;
}

/** Interface d'une table avant l'ajout de filtres à la requête. */
export interface SupabaseTableLike {
  select(columns?: string): SupabaseQueryLike;
  insert(values: Record<string, unknown>): SupabaseQueryLike;
  update(values: Record<string, unknown>): SupabaseQueryLike;
  delete(): SupabaseQueryLike;
}

/** Interface minimale d'un canal Supabase Realtime. */
export interface SupabaseRealtimeChannelLike {
  on(
    type: "postgres_changes",
    filter: {
      event: "*" | "DELETE";
      schema: "public";
      table: string;
      filter?: string;
    },
    callback: (payload: SupabasePostgresChangePayload) => void,
  ): SupabaseRealtimeChannelLike;
  subscribe(
    callback?: (status: string) => void,
  ): SupabaseRealtimeChannelLike;
}

/** Contenu normalisé d'une notification Postgres Realtime. */
export interface SupabasePostgresChangePayload {
  new: unknown;
  old: unknown;
}

/** Surface Supabase requise par le service, injectable pour les tests. */
export interface SupabaseClientLike {
  from(table: string): SupabaseTableLike;
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<SupabaseQueryResponse>;
  channel(name: string): SupabaseRealtimeChannelLike;
  removeChannel(channel: SupabaseRealtimeChannelLike): Promise<unknown>;
}

/** Signature des fonctions de mise à jour émises par roomService. */
export type RoomUpdateListener = (room: GameRoom) => void;
