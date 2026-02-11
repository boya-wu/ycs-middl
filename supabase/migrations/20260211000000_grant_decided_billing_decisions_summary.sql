-- 讓 Data API (PostgREST) 能查詢 decided_billing_decisions_summary view
-- 未 GRANT 時會出現 "Could not find the table in the schema cache"
GRANT SELECT ON public.decided_billing_decisions_summary TO anon;
GRANT SELECT ON public.decided_billing_decisions_summary TO authenticated;
GRANT SELECT ON public.decided_billing_decisions_summary TO service_role;
