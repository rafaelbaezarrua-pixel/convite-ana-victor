BEGIN;

ALTER TABLE public.rsvps
ADD COLUMN IF NOT EXISTS age smallint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.rsvps'::regclass
          AND conname = 'rsvps_age_range_check'
    ) THEN
        ALTER TABLE public.rsvps
        ADD CONSTRAINT rsvps_age_range_check
        CHECK (age IS NULL OR age BETWEEN 0 AND 120);
    END IF;
END
$$;

UPDATE public.rsvps
SET age = substring(name FROM '\(([0-9]+) anos?\)$')::smallint,
    name = regexp_replace(name, '\s+\([0-9]+ anos?\)$', '')
WHERE age IS NULL
  AND name ~ '\([0-9]+ anos?\)$'
  AND substring(name FROM '\(([0-9]+) anos?\)$')::integer BETWEEN 0 AND 120;

UPDATE public.rsvps AS rsvp
SET companions = (
    SELECT jsonb_agg(
        CASE
            WHEN jsonb_typeof(companion.value) = 'string' THEN
                CASE
                    WHEN (companion.value #>> '{}') ~ '\([0-9]+ anos?\)$'
                         AND substring(companion.value #>> '{}' FROM '\(([0-9]+) anos?\)$')::integer BETWEEN 0 AND 120
                    THEN jsonb_build_object(
                        'name', regexp_replace(companion.value #>> '{}', '\s+\([0-9]+ anos?\)$', ''),
                        'age', substring(companion.value #>> '{}' FROM '\(([0-9]+) anos?\)$')::integer
                    )
                    ELSE jsonb_build_object('name', companion.value #>> '{}', 'age', NULL)
                END
            ELSE companion.value
        END
        ORDER BY companion.ordinality
    )
    FROM jsonb_array_elements(rsvp.companions) WITH ORDINALITY AS companion(value, ordinality)
)
WHERE jsonb_typeof(rsvp.companions) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(rsvp.companions) AS item(value)
      WHERE jsonb_typeof(item.value) = 'string'
  );

ALTER TABLE public.rsvps
ADD COLUMN IF NOT EXISTS edit_token uuid DEFAULT gen_random_uuid();

UPDATE public.rsvps
SET edit_token = gen_random_uuid()
WHERE edit_token IS NULL;

ALTER TABLE public.rsvps
ALTER COLUMN edit_token SET DEFAULT gen_random_uuid(),
ALTER COLUMN edit_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rsvps_edit_token_unique
ON public.rsvps (edit_token);

CREATE OR REPLACE FUNCTION public.get_rsvp_for_edit(p_edit_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT jsonb_build_object(
        'name', rsvp.name,
        'age', rsvp.age,
        'companions', rsvp.companions
    )
    FROM public.rsvps AS rsvp
    WHERE rsvp.edit_token = p_edit_token
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_rsvp_with_edit_token(
    p_edit_token uuid,
    p_name text,
    p_age integer,
    p_companions jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_edit_token IS NULL OR btrim(coalesce(p_name, '')) = '' THEN
        RAISE EXCEPTION 'Dados de edição inválidos.';
    END IF;

    IF p_age IS NULL OR p_age NOT BETWEEN 0 AND 120 THEN
        RAISE EXCEPTION 'Informe uma idade entre 0 e 120 anos.';
    END IF;

    IF p_companions IS NULL OR jsonb_typeof(p_companions) <> 'array' THEN
        RAISE EXCEPTION 'A lista de acompanhantes é inválida.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_companions) AS companion(value)
        WHERE jsonb_typeof(companion.value) <> 'object'
           OR jsonb_typeof(companion.value -> 'name') IS DISTINCT FROM 'string'
           OR btrim(coalesce(companion.value ->> 'name', '')) = ''
           OR CASE
               WHEN jsonb_typeof(companion.value -> 'age') = 'number' THEN
                   (companion.value ->> 'age')::numeric < 0
                   OR (companion.value ->> 'age')::numeric > 120
                   OR (companion.value ->> 'age')::numeric <> trunc((companion.value ->> 'age')::numeric)
               ELSE true
           END
    ) THEN
        RAISE EXCEPTION 'Confira o nome e a idade de cada acompanhante.';
    END IF;

    UPDATE public.rsvps
    SET name = btrim(p_name),
        age = p_age,
        companions = p_companions
    WHERE edit_token = p_edit_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Link de edição inválido.';
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rsvp_for_edit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_rsvp_with_edit_token(uuid, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rsvp_for_edit(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_rsvp_with_edit_token(uuid, text, integer, jsonb) TO anon, authenticated;

COMMIT;