DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'social_notification_type'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'social_notification_type_new'
  ) THEN
    DROP TYPE public.social_notification_type_new;
  END IF;

  CREATE TYPE public.social_notification_type_new AS ENUM ('reaction', 'comment', 'profile_view', 'follow');

  ALTER TABLE public.social_notifications
    ALTER COLUMN type TYPE text
    USING (
      CASE
        WHEN type::text = 'friend_request' THEN 'follow'
        ELSE type::text
      END
    );

  ALTER TABLE public.social_notifications
    ALTER COLUMN type TYPE public.social_notification_type_new
    USING type::public.social_notification_type_new;

  DROP TYPE public.social_notification_type;
  ALTER TYPE public.social_notification_type_new RENAME TO social_notification_type;
END
$$;
