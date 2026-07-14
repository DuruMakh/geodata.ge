-- Complete the Data-API hardening: Prisma's own migration-history table also
-- lives in the public schema, where Supabase's default grants would expose it
-- through PostgREST. Deny-all RLS hides it from the anon/authenticated roles;
-- Prisma itself connects as the table owner and is unaffected.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
