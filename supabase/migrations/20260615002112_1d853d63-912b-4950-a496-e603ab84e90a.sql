
-- 1) Fix privilege escalation: self-insert must be role='viewer'; admins can insert any role.
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'viewer'::public.app_role)
    OR public.is_global_admin(auth.uid())
  );

-- Also prevent non-admins from elevating their own role via UPDATE.
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin(auth.uid()))
  WITH CHECK (
    public.is_global_admin(auth.uid())
    OR (user_id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()))
  );

-- 2) Hide integration secrets from any authenticated read.
-- All app reads go through server functions using the service role, which bypasses column grants.
REVOKE SELECT ON public.integration_configs FROM authenticated;
GRANT SELECT (
  id, loja_id, bridge_url, maxapi_url, maxapi_client_id,
  status_bridge, status_maxapi, ultimo_teste_bridge, ultimo_teste_maxapi,
  maxapi_token_expires_at, created_at, updated_at
) ON public.integration_configs TO authenticated;
