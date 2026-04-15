import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const owner = url.searchParams.get("owner") || "tafita81";
    const repo = url.searchParams.get("repo") || "core-deploy-glow-b3ab346b";

    const token = Deno.env.get("GITHUB_TOKEN");
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "User-Agent": "cerebrodani-github-proxy",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const [repoRes, commitsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, { headers }),
    ]);

    if (!repoRes.ok) {
      const err = await repoRes.text();
      return new Response(JSON.stringify({ error: "Erro ao buscar repositório", details: err }), {
        status: repoRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoData = await repoRes.json();
    const commitsData = commitsRes.ok ? await commitsRes.json() : [];

    const payload = {
      repository: {
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        default_branch: repoData.default_branch,
        stargazers_count: repoData.stargazers_count,
        forks_count: repoData.forks_count,
        open_issues_count: repoData.open_issues_count,
        pushed_at: repoData.pushed_at,
        html_url: repoData.html_url,
      },
      recent_commits: (commitsData || []).map((c: any) => ({
        sha: c.sha,
        message: c.commit?.message,
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
        html_url: c.html_url,
      })),
      fetched_at: new Date().toISOString(),
      source: "github_api",
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Falha interna", details: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
