import { useEffect, useState } from "react";
import type { GameRoom } from "../../../shared/types/index";
import type { OnlineGamePlayer } from "../types/multiplayer.types";
import {
  getRoomById,
  subscribeToRoom,
} from "../services/roomService";
import { useMultiplayerStore } from "../store/multiplayerStore";
import { PlayerRoleBadge } from "./PlayerRole";

interface PlayerListProps {
  roomId?: string;
}

/** Affiche les joueurs de la salle courante et les actualise via Supabase Realtime. */
export function PlayerList({ roomId }: PlayerListProps) {
  const currentRoom = useMultiplayerStore((state) => state.currentRoom);
  const currentPlayer = useMultiplayerStore((state) => state.currentPlayer);
  const setRoom = useMultiplayerStore((state) => state.setRoom);
  const [loadError, setLoadError] = useState("");
  const activeRoomId = roomId ?? currentRoom?.id;

  useEffect(() => {
    if (!activeRoomId) return;
    let active = true;
    void getRoomById(activeRoomId)
      .then((room) => {
        if (active && room) setRoom(room);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Impossible de charger la salle.",
          );
        }
      });
    const unsubscribe = subscribeToRoom(activeRoomId, (room: GameRoom) => {
      setRoom(room);
      setLoadError("");
    });
    const refreshTimer = setInterval(() => {
      void getRoomById(activeRoomId)
        .then((room) => {
          if (active && room) setRoom(room);
        })
        .catch(() => {
          // La prochaine actualisation peut récupérer une coupure réseau temporaire.
        });
    }, 10_000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
      unsubscribe();
    };
  }, [activeRoomId, setRoom]);

  const room = currentRoom?.id === activeRoomId ? currentRoom : null;
  if (!activeRoomId) {
    return <p className="text-sm text-slate-400">Aucune salle sélectionnée.</p>;
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6 text-white"
      aria-labelledby="player-list-title"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold" id="player-list-title">
          Joueurs
        </h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm" aria-live="polite">
          {room?.players.length ?? 0}/4
        </span>
      </div>
      {loadError && <p role="alert" className="text-sm text-red-300">{loadError}</p>}
      {!room && !loadError && (
        <p className="text-sm text-slate-400" role="status">
          Chargement des joueurs...
        </p>
      )}
      {room && room.players.length === 0 && (
        <p className="text-sm text-slate-400">Aucun joueur pour le moment.</p>
      )}
      {room && room.players.length > 0 && (
        <ul className="divide-y divide-slate-700">
          {room.players.map((player) => {
            const playerWithPresence = player as OnlineGamePlayer;
            return (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              key={player.id}
            >
              <div>
                <p className="font-medium">{player.displayName}</p>
                {playerWithPresence.isOnline === false && (
                  <p className="text-xs text-amber-300" aria-label="Hors ligne">Hors ligne</p>
                )}
                <p
                  className={`text-xs ${player.isReady ? "text-emerald-300" : "text-slate-400"}`}
                  aria-label={player.isReady ? "Prêt" : "Pas prêt"}
                >
                  {player.isReady ? "Prêt" : "Pas prêt"}
                </p>
              </div>
              <PlayerRoleBadge
                roomId={room.id}
                player={player}
                isHost={room.hostPlayerId === currentPlayer?.id}
                isCurrentPlayer={player.id === currentPlayer?.id}
              />
            </li>
          );
          })}
        </ul>
      )}
    </section>
  );
}
