
REVOKE EXECUTE ON FUNCTION public.is_global_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_empresa(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_role_on_empresa(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_empresa(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_loja(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_loja(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_global_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_empresa(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_on_empresa(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_empresa(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_loja(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_loja(UUID, UUID) TO authenticated;
