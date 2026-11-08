-- Conserve l'état d'appartenance et permet de distinguer une coupure temporaire.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

UPDATE public.players
   SET last_seen_at = joined_at
 WHERE last_seen_at IS NULL;

COMMENT ON COLUMN public.players.is_online IS
  'Indique si le joueur a signalé sa présence récemment; un joueur hors ligne reste membre de la salle.';
COMMENT ON COLUMN public.players.last_seen_at IS
  'Horodatage du dernier heartbeat reçu du joueur.';
