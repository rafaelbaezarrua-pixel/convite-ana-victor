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

COMMIT;