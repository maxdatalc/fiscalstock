DROP POLICY IF EXISTS audit_logs_insert_self ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;