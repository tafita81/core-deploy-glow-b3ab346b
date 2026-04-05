-- Drop old constraint and add expanded one
ALTER TABLE public.channels DROP CONSTRAINT channels_platform_check;
ALTER TABLE public.channels ADD CONSTRAINT channels_platform_check CHECK (platform = ANY (ARRAY['instagram'::text, 'youtube'::text, 'tiktok'::text, 'whatsapp'::text, 'twitter'::text, 'linkedin'::text]));

-- Create channel_tokens table for API credentials
CREATE TABLE public.channel_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL DEFAULT 'access_token',
  token_value TEXT NOT NULL,
  extra_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, token_type)
);

ALTER TABLE public.channel_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to channel_tokens" ON public.channel_tokens FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_channel_tokens_updated_at BEFORE UPDATE ON public.channel_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();