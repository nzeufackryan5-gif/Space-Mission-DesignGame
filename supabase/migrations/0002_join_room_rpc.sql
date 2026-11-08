-- Ajoute une entrée atomique à une salle à partir de son code d'invitation.
-- Le verrou sur la ligne rooms sérialise les arrivées concurrentes dans cette salle.
CREATE OR REPLACE FUNCTION public.join_room_by_code(
  p_code text,
  p_display_name text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_player_count bigint;
  v_result jsonb;
BEGIN
  -- Étape 1 : refuser tout rôle qui n'appartient pas à l'union définie par le jeu.
  IF p_role IS NULL OR p_role NOT IN (
    'commander',
    'engineer',
    'scientist',
    'communicator'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'MFP05',
      MESSAGE = 'MFP05 INVALID_ROLE';
  END IF;

  -- Étape 2 : trouver et verrouiller la salle afin de sérialiser les arrivées.
  SELECT room_row.*
    INTO v_room
    FROM public.rooms AS room_row
   WHERE room_row.code = p_code
   FOR UPDATE;

  -- Étape 3 : signaler un code qui ne correspond à aucune salle.
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'MFP02',
      MESSAGE = 'MFP02 ROOM_NOT_FOUND';
  END IF;

  -- Étape 4 : n'autoriser l'arrivée que pendant la phase d'attente.
  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'MFP04',
      MESSAGE = 'MFP04 ROOM_NOT_JOINABLE';
  END IF;

  -- Étape 5 : réserver au plus un joueur par rôle dans la même salle.
  IF EXISTS (
    SELECT 1
      FROM public.players AS player_row
     WHERE player_row.room_id = v_room.id
       AND player_row.role = p_role
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'MFP03',
      MESSAGE = 'MFP03 ROLE_TAKEN';
  END IF;

  -- Étape 6 : compter les joueurs sous le verrou de salle pour appliquer la limite atomiquement.
  SELECT count(*)
    INTO v_player_count
    FROM public.players AS player_row
   WHERE player_row.room_id = v_room.id;

  IF v_player_count >= 4 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'MFP01',
      MESSAGE = 'MFP01 ROOM_FULL';
  END IF;

  -- Étape 7 : enregistrer l'utilisateur authentifié dans la salle.
  INSERT INTO public.players (
    id,
    room_id,
    display_name,
    role,
    is_ready
  )
  VALUES (
    auth.uid(),
    v_room.id,
    p_display_name,
    p_role,
    false
  );

  -- Étape 8 : renvoyer la salle dans le format camelCase attendu par l'application.
  SELECT jsonb_build_object(
    'id', v_room.id,
    'name', v_room.name,
    'missionId', v_room.mission_id,
    'hostPlayerId', v_room.host_player_id,
    'status', v_room.status,
    'createdAt', v_room.created_at,
    'players', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', player_row.id,
            'displayName', player_row.display_name,
            'role', player_row.role,
            'isReady', player_row.is_ready
          )
          ORDER BY player_row.joined_at, player_row.id
        )
        FROM public.players AS player_row
        WHERE player_row.room_id = v_room.id
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- La fonction n'est pas exécutable anonymement; seuls les utilisateurs authentifiés peuvent la joindre.
REVOKE ALL ON FUNCTION public.join_room_by_code(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_room_by_code(text, text, text) TO authenticated;

-- Test manuel dans Supabase : les étapes de préparation des fixtures sont à lancer en service_role.
-- 1. Créer un utilisateur de test dans Authentication > Users et copier son UUID.
-- 2. En SQL Editor avec les droits service_role, créer son profil et une salle :
--    INSERT INTO public.profiles (id, display_name)
--    VALUES ('<UUID_AUTH_USER>', 'Joueur de test')
--    ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
--
--    INSERT INTO public.rooms (code, name, mission_id, host_player_id, status)
--    VALUES ('MF2048', 'Salle de test', 'mission-test', '<UUID_AUTH_USER>', 'waiting');
--
-- 3. Appeler la fonction depuis une session client authentifiée avec cet utilisateur
--    (le rôle service_role du SQL Editor ne fournit pas auth.uid()) :
--    SELECT jsonb_pretty(
--      public.join_room_by_code('MF2048', 'Joueur de test', 'scientist')
--    ) AS joined_room;
--
-- 4. Vérifier le jsonb retourné : il doit contenir la salle et le joueur ajouté.
--    Les clés attendues sont id, name, missionId, hostPlayerId, status, createdAt et players.
--    Répéter avec un code absent, un rôle déjà pris, un statut non waiting et quatre joueurs
--    pour vérifier les messages ROOM_NOT_FOUND, ROLE_TAKEN, ROOM_NOT_JOINABLE et ROOM_FULL.
--    Supprimer ensuite les fixtures de test avec le compte service_role.

-- SQLSTATE personnalisés renvoyés par cette fonction :
-- MFP01 ROOM_FULL
-- MFP02 ROOM_NOT_FOUND
-- MFP03 ROLE_TAKEN
-- MFP04 ROOM_NOT_JOINABLE
-- MFP05 INVALID_ROLE
