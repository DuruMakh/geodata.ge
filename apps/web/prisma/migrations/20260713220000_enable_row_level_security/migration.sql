-- Harden the Supabase Data API surface: enable row level security with no
-- policies (deny-all) on every mirror table. Nothing in this project reads
-- via PostgREST, and Prisma connects as the table owner (owners bypass RLS),
-- so the import and db-mode builds are unaffected.
ALTER TABLE "BudgetItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSpendingCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSpendingFact" ENABLE ROW LEVEL SECURITY;
