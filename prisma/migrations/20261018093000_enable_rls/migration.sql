-- App tables are reachable only through the Next.js API, which connects as the table owner.
-- RLS is enabled and forced with an owner-only policy, so Supabase client roles (anon,
-- authenticated) can never read or write them even if grants change later.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['_prisma_migrations','users','refresh_tokens','rate_limit_buckets','meetings',
                           'participants','chat_messages','shared_files','whiteboards'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    EXECUTE format('CREATE POLICY app_owner_all ON public.%I FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
