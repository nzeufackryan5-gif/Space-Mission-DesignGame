-- MISSION FORGE : schéma initial et politiques d'accès Supabase.
-- Les clés étrangères vers auth.users/profiles sont utilisées pour lier les
-- enregistrements métier aux identités authentifiées.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CONSTRAINT rooms_code_unique UNIQUE,
  name text,
  mission_id text,
  host_player_id uuid NOT NULL REFERENCES public.profiles (id),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'designing', 'simulating', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ajoute la contrainte aussi si une table rooms préexistante a été créée sans elle.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.rooms'::regclass
      AND conname = 'rooms_code_unique'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT rooms_code_unique UNIQUE (code);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL
    CHECK (role IN ('commander', 'engineer', 'scientist', 'communicator')),
  is_ready boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.missions_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.spacecrafts_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  spacecraft_id text NOT NULL,
  success boolean NOT NULL,
  score integer NOT NULL,
  duration_days integer NOT NULL,
  resources_at_end jsonb NOT NULL,
  events_encountered jsonb NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_autopsies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_result_id uuid NOT NULL
    REFERENCES public.simulation_results (id) ON DELETE CASCADE,
  main_causes text[] NOT NULL DEFAULT ARRAY[]::text[],
  good_decisions text[] NOT NULL DEFAULT ARRAY[]::text[],
  bad_decisions text[] NOT NULL DEFAULT ARRAY[]::text[],
  lessons_learned text[] NOT NULL DEFAULT ARRAY[]::text[]
);

CREATE TABLE IF NOT EXISTS public.decisions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles (id),
  action text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- L'index B-tree de la contrainte UNIQUE sert aussi aux recherches par code.
CREATE INDEX IF NOT EXISTS players_room_id_idx
  ON public.players (room_id);
CREATE INDEX IF NOT EXISTS decisions_log_room_id_idx
  ON public.decisions_log (room_id);

-- La fonction SECURITY DEFINER évite la récursion RLS lorsqu'une politique
-- doit vérifier l'appartenance en consultant elle-même la table players.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_room_member(target_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players AS player_row
    WHERE player_row.room_id = target_room_id
      AND player_row.id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.is_room_host(target_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rooms AS room_row
    WHERE room_row.id = target_room_id
      AND room_row.host_player_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_room(target_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_room_member(target_room_id)
      OR private.is_room_host(target_room_id);
$$;

-- Permet à l'application de tenter une arrivée sans ouvrir les lignes rooms.
CREATE OR REPLACE FUNCTION private.can_join_room(target_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rooms AS room_row
    WHERE room_row.id = target_room_id
      AND room_row.status = 'waiting'
      AND (
        SELECT count(*)
        FROM public.players AS player_row
        WHERE player_row.room_id = room_row.id
      ) < 4
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_simulation(target_result_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.simulation_results AS result_row
    WHERE result_row.id = target_result_id
      AND private.can_access_room(result_row.room_id)
  );
$$;

REVOKE ALL ON FUNCTION private.is_room_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_room_host(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_room(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_join_room(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_simulation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_room_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_room_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_join_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_simulation(uuid) TO authenticated;

-- Active RLS sur chaque table afin que les droits restent filtrés par utilisateur.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacecrafts_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions_log ENABLE ROW LEVEL SECURITY;

-- Les privilèges SQL autorisent les opérations nécessaires; RLS les restreint ensuite.
REVOKE ALL ON TABLE
  public.profiles,
  public.rooms,
  public.players,
  public.missions_saved,
  public.spacecrafts_saved,
  public.simulation_results,
  public.mission_autopsies,
  public.decisions_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions_saved TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spacecrafts_saved TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_autopsies TO authenticated;
GRANT SELECT, INSERT ON public.decisions_log TO authenticated;

-- Un utilisateur ne lit et ne modifie que son propre profil.
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
COMMENT ON POLICY profiles_select_self ON public.profiles IS
  'Chaque utilisateur peut lire uniquement son propre profil.';

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
COMMENT ON POLICY profiles_insert_self ON public.profiles IS
  'Chaque utilisateur ne peut créer qu’un profil associé à son identité Auth.';

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
COMMENT ON POLICY profiles_update_self ON public.profiles IS
  'Chaque utilisateur ne peut modifier que son propre profil.';

-- Un membre voit sa salle; l’hôte voit aussi la salle qu’il vient de créer,
-- avant que son enregistrement de joueur soit ajouté.
DROP POLICY IF EXISTS rooms_select_members_and_host ON public.rooms;
CREATE POLICY rooms_select_members_and_host ON public.rooms
  FOR SELECT TO authenticated
  USING (private.can_access_room(id));
COMMENT ON POLICY rooms_select_members_and_host ON public.rooms IS
  'Lecture réservée aux membres de players et à l’hôte de cette salle.';

-- La création d’une salle est permise uniquement si l’utilisateur est son hôte.
DROP POLICY IF EXISTS rooms_insert_host ON public.rooms;
CREATE POLICY rooms_insert_host ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (host_player_id = (SELECT auth.uid()));
COMMENT ON POLICY rooms_insert_host ON public.rooms IS
  'Un utilisateur authentifié ne peut créer qu’une salle dont il est l’hôte.';

-- Seul l’hôte peut modifier les métadonnées ou le statut de sa salle.
DROP POLICY IF EXISTS rooms_update_host ON public.rooms;
CREATE POLICY rooms_update_host ON public.rooms
  FOR UPDATE TO authenticated
  USING (host_player_id = (SELECT auth.uid()))
  WITH CHECK (host_player_id = (SELECT auth.uid()));
COMMENT ON POLICY rooms_update_host ON public.rooms IS
  'Seul l’hôte de la salle peut modifier celle-ci.';

-- La suppression d’une salle est réservée à son hôte; les clés en cascade effacent ses données liées.
DROP POLICY IF EXISTS rooms_delete_host ON public.rooms;
CREATE POLICY rooms_delete_host ON public.rooms
  FOR DELETE TO authenticated
  USING (host_player_id = (SELECT auth.uid()));
COMMENT ON POLICY rooms_delete_host ON public.rooms IS
  'Seul l’hôte indiqué dans host_player_id peut supprimer la salle.';

-- Les participants d’une salle ne sont visibles que par ses membres ou son hôte.
DROP POLICY IF EXISTS players_select_room_members ON public.players;
CREATE POLICY players_select_room_members ON public.players
  FOR SELECT TO authenticated
  USING (private.can_access_room(room_id));
COMMENT ON POLICY players_select_room_members ON public.players IS
  'Un joueur ne peut consulter que les participants de sa salle; l’hôte est inclus.';

-- L’arrivée crée uniquement la ligne du joueur connecté dans une salle ouverte et non complète.
DROP POLICY IF EXISTS players_insert_self_into_open_room ON public.players;
CREATE POLICY players_insert_self_into_open_room ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND private.can_join_room(room_id)
  );
COMMENT ON POLICY players_insert_self_into_open_room ON public.players IS
  'Un utilisateur ne peut rejoindre que comme lui-même et une salle waiting comptant moins de quatre joueurs.';

-- Un participant ne modifie que sa propre ligne et ne peut la déplacer hors d’une salle accessible.
DROP POLICY IF EXISTS players_update_self ON public.players;
CREATE POLICY players_update_self ON public.players
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND private.can_access_room(room_id)
  );
COMMENT ON POLICY players_update_self ON public.players IS
  'Un joueur ne peut modifier que sa propre entrée de participant.';

-- Un joueur peut quitter sa salle; l’hôte peut retirer les entrées de sa salle.
DROP POLICY IF EXISTS players_delete_self_or_host ON public.players;
CREATE POLICY players_delete_self_or_host ON public.players
  FOR DELETE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.is_room_host(room_id)
  );
COMMENT ON POLICY players_delete_self_or_host ON public.players IS
  'Un joueur peut supprimer sa propre entrée et l’hôte peut supprimer les entrées de sa salle.';

-- Les données de mission sont réservées aux membres et à l’hôte de la salle associée.
DROP POLICY IF EXISTS missions_saved_room_access ON public.missions_saved;
CREATE POLICY missions_saved_room_access ON public.missions_saved
  FOR ALL TO authenticated
  USING (private.can_access_room(room_id))
  WITH CHECK (private.can_access_room(room_id));
COMMENT ON POLICY missions_saved_room_access ON public.missions_saved IS
  'Seuls les membres et l’hôte de la salle peuvent lire ou gérer ses missions sauvegardées.';

-- Les conceptions de vaisseau ne sont accessibles qu’aux membres et à l’hôte concernés.
DROP POLICY IF EXISTS spacecrafts_saved_room_access ON public.spacecrafts_saved;
CREATE POLICY spacecrafts_saved_room_access ON public.spacecrafts_saved
  FOR ALL TO authenticated
  USING (private.can_access_room(room_id))
  WITH CHECK (private.can_access_room(room_id));
COMMENT ON POLICY spacecrafts_saved_room_access ON public.spacecrafts_saved IS
  'Seuls les membres et l’hôte de la salle peuvent lire ou gérer les vaisseaux sauvegardés.';

-- Résultats et événements de simulation restent dans la salle qui les a produits.
DROP POLICY IF EXISTS simulation_results_room_access ON public.simulation_results;
CREATE POLICY simulation_results_room_access ON public.simulation_results
  FOR ALL TO authenticated
  USING (private.can_access_room(room_id))
  WITH CHECK (private.can_access_room(room_id));
COMMENT ON POLICY simulation_results_room_access ON public.simulation_results IS
  'Seuls les membres et l’hôte peuvent lire ou gérer les résultats de leur salle.';

-- L’accès à une autopsie est déterminé par la salle du résultat analysé.
DROP POLICY IF EXISTS mission_autopsies_result_room_access ON public.mission_autopsies;
CREATE POLICY mission_autopsies_result_room_access ON public.mission_autopsies
  FOR ALL TO authenticated
  USING (private.can_access_simulation(simulation_result_id))
  WITH CHECK (private.can_access_simulation(simulation_result_id));
COMMENT ON POLICY mission_autopsies_result_room_access ON public.mission_autopsies IS
  'Seuls les membres et l’hôte de la salle du résultat peuvent lire ou gérer son autopsie.';

-- L’historique est consultable par la salle; chaque ligne est écrite au nom du joueur connecté.
DROP POLICY IF EXISTS decisions_log_select_room_members ON public.decisions_log;
CREATE POLICY decisions_log_select_room_members ON public.decisions_log
  FOR SELECT TO authenticated
  USING (private.can_access_room(room_id));
COMMENT ON POLICY decisions_log_select_room_members ON public.decisions_log IS
  'Seuls les membres et l’hôte peuvent consulter l’historique des décisions de leur salle.';

DROP POLICY IF EXISTS decisions_log_insert_self ON public.decisions_log;
CREATE POLICY decisions_log_insert_self ON public.decisions_log
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id = (SELECT auth.uid())
    AND private.can_access_room(room_id)
  );
COMMENT ON POLICY decisions_log_insert_self ON public.decisions_log IS
  'Un joueur ne peut enregistrer que ses propres décisions dans une salle à laquelle il a accès.';
