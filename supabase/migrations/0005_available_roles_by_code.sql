-- Expose uniquement les rôles libres d'une salle ouverte à partir du code.
CREATE OR REPLACE FUNCTION public.get_available_roles_by_code(p_code text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id uuid;
  v_status text;
  v_roles text[];
BEGIN
  SELECT room_row.id, room_row.status
    INTO v_room_id, v_status
    FROM public.rooms AS room_row
   WHERE room_row.code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ROOM_NOT_FOUND';
  END IF;

  IF v_status <> 'waiting' THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT COALESCE(array_agg(role_name ORDER BY role_name), ARRAY[]::text[])
    INTO v_roles
    FROM unnest(ARRAY[
      'commander',
      'engineer',
      'scientist',
      'communicator'
    ]) AS available(role_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.players AS player_row
      WHERE player_row.room_id = v_room_id
        AND player_row.role = role_name
   );

  RETURN v_roles;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_roles_by_code(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_roles_by_code(text)
  TO authenticated;
