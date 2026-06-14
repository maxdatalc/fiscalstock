
-- ============ Enums ============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'operador', 'viewer');
CREATE TYPE public.integration_status AS ENUM ('online', 'offline', 'erro', 'nao_configurado');

-- ============ Generic updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ empresas ============
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER empresas_set_updated_at BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ lojas ============
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  emp_id_maxdata TEXT NOT NULL,
  terminal_maxdata TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lojas_empresa_idx ON public.lojas(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lojas TO authenticated;
GRANT ALL ON public.lojas TO service_role;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER lojas_set_updated_at BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ user_empresas ============
CREATE TABLE public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role_na_empresa public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);
CREATE INDEX user_empresas_user_idx ON public.user_empresas(user_id);
CREATE INDEX user_empresas_empresa_idx ON public.user_empresas(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_empresas TO authenticated;
GRANT ALL ON public.user_empresas TO service_role;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- ============ Helper functions (SECURITY DEFINER, avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('owner','admin') AND ativo
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_empresa(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = _user_id AND empresa_id = _empresa_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_role_on_empresa(_user_id UUID, _empresa_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role_na_empresa FROM public.user_empresas WHERE user_id = _user_id AND empresa_id = _empresa_id),
    (SELECT role FROM public.profiles WHERE user_id = _user_id AND role IN ('owner','admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_empresa(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = _user_id AND empresa_id = _empresa_id
      AND role_na_empresa IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = _loja_id AND public.user_has_empresa(_user_id, l.empresa_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = _loja_id AND public.user_can_manage_empresa(_user_id, l.empresa_id)
  );
$$;

-- ============ integration_configs ============
CREATE TABLE public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL UNIQUE REFERENCES public.lojas(id) ON DELETE CASCADE,
  bridge_url TEXT,
  maxapi_url TEXT,
  maxapi_client_id TEXT,
  maxapi_secret_key TEXT,
  maxapi_token_cache TEXT,
  maxapi_token_expires_at TIMESTAMPTZ,
  status_bridge public.integration_status NOT NULL DEFAULT 'nao_configurado',
  status_maxapi public.integration_status NOT NULL DEFAULT 'nao_configurado',
  ultimo_teste_bridge TIMESTAMPTZ,
  ultimo_teste_maxapi TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_configs TO authenticated;
GRANT ALL ON public.integration_configs TO service_role;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER integration_configs_set_updated_at BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ audit_logs ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id TEXT,
  detalhes_json JSONB,
  ip_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_empresa_idx ON public.audit_logs(empresa_id, created_at DESC);
CREATE INDEX audit_logs_user_idx ON public.audit_logs(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ stock_cache ============
CREATE TABLE public.stock_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  produto_id_maxdata TEXT NOT NULL,
  codigo TEXT,
  descricao TEXT,
  estoque_fisico NUMERIC(14,3) NOT NULL DEFAULT 0,
  estoque_fiscal NUMERIC(14,3) NOT NULL DEFAULT 0,
  diferenca NUMERIC(14,3) NOT NULL DEFAULT 0,
  status_risco TEXT,
  composicao_json JSONB,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loja_id, produto_id_maxdata)
);
CREATE INDEX stock_cache_loja_idx ON public.stock_cache(loja_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_cache TO authenticated;
GRANT ALL ON public.stock_cache TO service_role;
ALTER TABLE public.stock_cache ENABLE ROW LEVEL SECURITY;

-- ============ service_order_cache ============
CREATE TABLE public.service_order_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  os_id_maxdata TEXT NOT NULL,
  numero_os TEXT,
  cliente_nome TEXT,
  veiculo_placa TEXT,
  status TEXT,
  data_abertura TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json JSONB,
  UNIQUE (loja_id, os_id_maxdata)
);
CREATE INDEX service_order_cache_loja_idx ON public.service_order_cache(loja_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_cache TO authenticated;
GRANT ALL ON public.service_order_cache TO service_role;
ALTER TABLE public.service_order_cache ENABLE ROW LEVEL SECURITY;

-- ============ RLS Policies ============

-- profiles: usuário vê e edita o próprio; admins/owners globais veem todos
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin(auth.uid()));
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin(auth.uid()));
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_global_admin(auth.uid()));
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_global_admin(auth.uid()));

-- empresas
CREATE POLICY "empresas_select_member" ON public.empresas
  FOR SELECT TO authenticated
  USING (public.user_has_empresa(auth.uid(), id));
CREATE POLICY "empresas_modify_admin" ON public.empresas
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()) OR public.user_can_manage_empresa(auth.uid(), id))
  WITH CHECK (public.is_global_admin(auth.uid()) OR public.user_can_manage_empresa(auth.uid(), id));

-- lojas
CREATE POLICY "lojas_select_member" ON public.lojas
  FOR SELECT TO authenticated
  USING (public.user_has_empresa(auth.uid(), empresa_id));
CREATE POLICY "lojas_modify_admin" ON public.lojas
  FOR ALL TO authenticated
  USING (public.user_can_manage_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.user_can_manage_empresa(auth.uid(), empresa_id));

-- user_empresas: usuário vê os próprios vínculos; admins gerenciam
CREATE POLICY "user_empresas_select_self_or_admin" ON public.user_empresas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_can_manage_empresa(auth.uid(), empresa_id));
CREATE POLICY "user_empresas_modify_admin" ON public.user_empresas
  FOR ALL TO authenticated
  USING (public.user_can_manage_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.user_can_manage_empresa(auth.uid(), empresa_id));

-- integration_configs: apenas admins/owners da empresa.
-- Frontend nunca deve ler colunas sensíveis (uso de visão filtrada via server functions).
CREATE POLICY "integration_configs_admin_only" ON public.integration_configs
  FOR ALL TO authenticated
  USING (public.user_can_manage_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_can_manage_loja(auth.uid(), loja_id));

-- audit_logs: usuário vê logs das empresas a que pertence; admin vê tudo dela
CREATE POLICY "audit_logs_select_member" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.user_has_empresa(auth.uid(), empresa_id))
    OR user_id = auth.uid()
  );
CREATE POLICY "audit_logs_insert_self" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_global_admin(auth.uid()));

-- stock_cache & service_order_cache: leitura por membros, escrita por admins/serverFn
CREATE POLICY "stock_cache_select_member" ON public.stock_cache
  FOR SELECT TO authenticated USING (public.user_can_access_loja(auth.uid(), loja_id));
CREATE POLICY "stock_cache_modify_admin" ON public.stock_cache
  FOR ALL TO authenticated
  USING (public.user_can_manage_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_can_manage_loja(auth.uid(), loja_id));

CREATE POLICY "service_order_cache_select_member" ON public.service_order_cache
  FOR SELECT TO authenticated USING (public.user_can_access_loja(auth.uid(), loja_id));
CREATE POLICY "service_order_cache_modify_admin" ON public.service_order_cache
  FOR ALL TO authenticated
  USING (public.user_can_manage_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_can_manage_loja(auth.uid(), loja_id));

-- ============ handle_new_user trigger: cria profile ao signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  v_role public.app_role := 'viewer';
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 0 THEN
    v_role := 'owner';
  END IF;
  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_role
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
