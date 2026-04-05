
-- Add media columns to contents
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS audio_url text;

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Media files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Service role write access  
CREATE POLICY "Service role can upload media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Service role can update media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'media');

CREATE POLICY "Service role can delete media"
ON storage.objects FOR DELETE
USING (bucket_id = 'media');

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
