-- Un même rôle ne peut être attribué qu'à un seul joueur par salle.
CREATE UNIQUE INDEX IF NOT EXISTS players_room_role_unique
  ON public.players (room_id, role);

-- Retire un membre et, si nécessaire, transfère l'hôte au membre le plus ancien.
CREATE OR REPLACE FUNCTION public.remove_player_and_transfer_host(
  p_room_id uuid,
  p_player_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_host_player_id uuid;
  v_next_host_id uuid;
BEGIN
  SELECT room_row.host_player_id
    INTO v_host_player_id
    FROM public.rooms AS room_row
   WHERE room_row.id = p_room_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ROOM_NOT_FOUND';
  END IF;

  IF p_player_id <> (SELECT auth.uid())
     AND v_host_player_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'NOT_HOST';
  END IF;

  DELETE FROM public.players AS player_row
   WHERE player_row.room_id = p_room_id
     AND player_row.id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PLAYER_NOT_FOUND';
  END IF;

  IF p_player_id = v_host_player_id THEN
    SELECT player_row.id
      INTO v_next_host_id
      FROM public.players AS player_row
     WHERE player_row.room_id = p_room_id
     ORDER BY player_row.joined_at, player_row.id
     LIMIT 1
     FOR UPDATE;

    IF v_next_host_id IS NULL THEN
      DELETE FROM public.rooms AS room_row
       WHERE room_row.id = p_room_id;
      RETURN NULL;
    END IF;

    UPDATE public.rooms AS room_row
       SET host_player_id = v_next_host_id
     WHERE room_row.id = p_room_id;

    RETURN v_next_host_id;
  END IF;

  RETURN v_host_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_player_and_transfer_host(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_player_and_transfer_host(uuid, uuid)
  TO authenticated;

-- Ajoute les deux tables à Realtime sans échouer si elles y figurent déjà.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END;
$$;
