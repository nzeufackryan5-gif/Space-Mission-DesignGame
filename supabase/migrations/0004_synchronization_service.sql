-- Identifie le vaisseau synchronisé et protège son état par une version monotone.
ALTER TABLE public.spacecrafts_saved
  ADD COLUMN IF NOT EXISTS spacecraft_id text;

UPDATE public.spacecrafts_saved
   SET spacecraft_id = data ->> 'id'
 WHERE spacecraft_id IS NULL
   AND data ? 'id';

CREATE UNIQUE INDEX IF NOT EXISTS spacecrafts_saved_room_spacecraft_unique
  ON public.spacecrafts_saved (room_id, spacecraft_id)
  WHERE spacecraft_id IS NOT NULL;

-- Écrit uniquement si la version locale est plus récente que celle en base.
CREATE OR REPLACE FUNCTION public.sync_spacecraft_state(
  p_room_id uuid,
  p_mission_id text,
  p_data jsonb,
  p_client_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_spacecraft_id text;
  v_data jsonb;
  v_updated_at timestamptz;
  v_applied boolean := false;
BEGIN
  v_spacecraft_id := p_data ->> 'id';
  IF v_spacecraft_id IS NULL OR v_spacecraft_id = '' THEN
    RAISE EXCEPTION 'Spacecraft id is required';
  END IF;

  INSERT INTO public.spacecrafts_saved AS saved (
    room_id,
    mission_id,
    spacecraft_id,
    data,
    updated_at
  )
  VALUES (
    p_room_id,
    p_mission_id,
    v_spacecraft_id,
    jsonb_set(p_data, '{updatedAt}', to_jsonb(p_client_updated_at), true),
    p_client_updated_at
  )
  ON CONFLICT (room_id, spacecraft_id)
    WHERE spacecraft_id IS NOT NULL
  DO UPDATE SET
    mission_id = EXCLUDED.mission_id,
    data = EXCLUDED.data,
    updated_at = EXCLUDED.updated_at
  WHERE EXCLUDED.updated_at > saved.updated_at
  RETURNING saved.data, saved.updated_at
       INTO v_data, v_updated_at;

  IF FOUND THEN
    v_applied := true;
  ELSE
    SELECT saved.data, saved.updated_at
      INTO v_data, v_updated_at
      FROM public.spacecrafts_saved AS saved
     WHERE saved.room_id = p_room_id
       AND saved.spacecraft_id = v_spacecraft_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room or spacecraft not found';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'applied', v_applied,
    'data', v_data,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_spacecraft_state(uuid, text, jsonb, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_spacecraft_state(uuid, text, jsonb, timestamptz)
  TO authenticated;

-- Rend les modifications des quatre types de données visibles via Realtime.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'spacecrafts_saved',
    'simulation_results',
    'decisions_log'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = v_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
