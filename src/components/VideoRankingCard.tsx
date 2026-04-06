import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoRankingCardProps {
  title: string;
  subtitle?: string;
  priorityBadge?: string;
  videos: any[];
  maxVideos?: number;
  updatedAt?: string;
  rankingInfo?: any;
}

export function VideoRankingCard({ title, subtitle, priorityBadge, videos, maxVideos = 15, updatedAt, rankingInfo }: VideoRankingCardProps) {
  if (videos.length === 0) return null;

  return (
    <Card className={priorityBadge ? "border-primary/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
          {title}
          {priorityBadge && <Badge variant="secondary" className="text-[9px]">{priorityBadge}</Badge>}
        </CardTitle>
        <div className="text-[9px] text-muted-foreground space-y-0.5">
          {updatedAt && <p>✅ Dados reais • {new Date(updatedAt).toLocaleString("pt-BR")}</p>}
          {rankingInfo && (
            <p>📊 Algoritmo v3: {rankingInfo.formula ? "views/dia × freshness × engagement × monetização" : "viral_score"} • Min: {rankingInfo.min_views ? `${(rankingInfo.min_views / 1000000).toFixed(1)}M` : "500K"} views • Período: {rankingInfo.period || "14d"}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {videos.slice(0, maxVideos).map((v: any, i: number) => {
          const videoUrl = v.video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(v.video_title || "")}`;
          return (
            <div
              key={i}
              onClick={() => window.open(videoUrl, "_blank")}
              className="flex items-start gap-2 text-xs hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors cursor-pointer group/link"
            >
              <span className="font-bold text-primary min-w-[24px] text-center">#{v.rank || i + 1}</span>
              <div className="min-w-0 flex-1">
                {/* Title + Viral Score */}
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="font-medium truncate group-hover/link:text-primary transition-colors">
                    {v.content_format?.includes("Short") ? "📱" : "🎬"} {v.video_title}
                  </p>
                  {v.viral_score > 0 && (
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      🔥{v.viral_score > 1000000 ? `${(v.viral_score / 1000000).toFixed(1)}M` : v.viral_score > 1000 ? `${(v.viral_score / 1000).toFixed(0)}K` : v.viral_score}
                    </Badge>
                  )}
                  {v.monetization_potential?.includes("💎") && (
                    <Badge variant="outline" className="text-[8px] shrink-0 border-yellow-500/50 text-yellow-600">
                      {v.monetization_potential}
                    </Badge>
                  )}
                </div>

                {/* Creator + Link */}
                <p className="text-[10px] text-muted-foreground truncate">
                  {v.creator} {v.country ? `• ${v.country}` : ""} • <span className="text-primary underline font-medium">ver vídeo ↗</span>
                </p>

                {/* Key Metrics Row */}
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {v.total_views && (
                    <span className="text-[10px] text-success font-semibold">👁 {v.total_views}</span>
                  )}
                  {v.views_per_day > 0 && (
                    <span className="text-[10px] text-primary font-medium">
                      🚀 {v.views_per_day > 1000000 ? `${(v.views_per_day / 1000000).toFixed(1)}M` : v.views_per_day > 1000 ? `${(v.views_per_day / 1000).toFixed(0)}K` : v.views_per_day}/dia
                    </span>
                  )}
                  {v.age_days && (
                    <span className={`text-[10px] font-medium ${v.age_days <= 3 ? "text-red-500" : v.age_days <= 7 ? "text-orange-500" : "text-muted-foreground"}`}>
                      ⏱ {v.age_days}d {v.age_days <= 3 ? "🔥" : v.age_days <= 7 ? "⚡" : ""}
                    </span>
                  )}
                  {v.duration_label && (
                    <span className="text-[10px] text-muted-foreground">⏳ {v.duration_label}</span>
                  )}
                </div>

                {/* Engagement Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {v.likes > 0 && (
                    <span className="text-[10px] text-muted-foreground">❤️ {v.likes?.toLocaleString()}</span>
                  )}
                  {v.comments > 0 && (
                    <span className="text-[10px] text-muted-foreground">💬 {v.comments?.toLocaleString()}</span>
                  )}
                  {v.comment_rate > 0 && (
                    <span className={`text-[10px] font-medium ${v.comment_rate > 0.5 ? "text-success" : "text-muted-foreground"}`}>
                      💬 {v.comment_rate}% {v.comment_rate > 0.5 ? "🔥" : ""}
                    </span>
                  )}
                  {v.like_rate > 0 && (
                    <span className={`text-[10px] ${v.like_rate > 4 ? "text-success" : "text-muted-foreground"}`}>
                      ❤️ {v.like_rate}%
                    </span>
                  )}
                </div>

                {/* Format + Hook */}
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {v.content_format && (
                    <Badge variant="outline" className="text-[8px]">{v.content_format}</Badge>
                  )}
                  {v.hook_pattern && (
                    <Badge variant="outline" className="text-[8px]">{v.hook_pattern}</Badge>
                  )}
                  {v.freshness_bonus && v.freshness_bonus >= 1.8 && (
                    <Badge variant="secondary" className="text-[8px] bg-red-500/10 text-red-500">
                      🔥 Freshness {v.freshness_bonus}x
                    </Badge>
                  )}
                </div>

                {/* Adaptation guide */}
                {v.adaptation_guide && (
                  <p className="text-[10px] text-warning truncate mt-0.5">🔄 {v.adaptation_guide}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
