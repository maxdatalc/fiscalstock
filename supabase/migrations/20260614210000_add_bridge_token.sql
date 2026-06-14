-- Add bridge_token to integration_configs so the bridge client can authenticate.
-- The token is stored server-side only and never exposed to the browser.
ALTER TABLE public.integration_configs
  ADD COLUMN IF NOT EXISTS bridge_token TEXT;