
CREATE TABLE public.video_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_title text NOT NULL,
  creator text,
  platform text NOT NULL,
  region text NOT NULL DEFAULT 'brasil',
  total_views text,
  views_growth_1h text,
  momentum_score integer DEFAULT 0,
  acceleration text,
  snapshot_hour timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to video_snapshots" ON public.video_snapshots FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX idx_video_snapshots_hour ON public.video_snapshots (snapshot_hour DESC);
CREATE INDEX idx_video_snapshots_platform ON public.video_snapshots (platform, region);
