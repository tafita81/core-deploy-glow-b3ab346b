CREATE TABLE public.whatsapp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'geral',
  invite_link TEXT,
  members_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to whatsapp_groups" ON public.whatsapp_groups FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL DEFAULT 'conversa',
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  engagement_score INTEGER DEFAULT 0,
  source_content_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to whatsapp_content" ON public.whatsapp_content FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_content_updated_at
  BEFORE UPDATE ON public.whatsapp_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();