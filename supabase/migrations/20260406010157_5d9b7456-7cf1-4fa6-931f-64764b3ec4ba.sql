
CREATE TABLE public.social_metrics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  channel_name TEXT NOT NULL DEFAULT '',
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  followers INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  snapshot_type TEXT NOT NULL DEFAULT 'hourly',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast period queries
CREATE INDEX idx_social_metrics_platform_time ON public.social_metrics_snapshots (platform, created_at DESC);
CREATE INDEX idx_social_metrics_channel_time ON public.social_metrics_snapshots (channel_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.social_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to social_metrics_snapshots"
ON public.social_metrics_snapshots
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_metrics_snapshots;
