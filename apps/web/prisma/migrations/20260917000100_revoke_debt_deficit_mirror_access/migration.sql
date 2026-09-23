-- Every later mirror table revokes these grants; RLS without policies already denies
-- both roles, so this is defence in depth for the two tables that predate the rule.
REVOKE ALL ON TABLE "GovernmentDebtFact" FROM anon, authenticated;
REVOKE ALL ON TABLE "GeneralGovernmentBalanceFact" FROM anon, authenticated;
