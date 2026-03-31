import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// Simple keywords that GNews reliably returns results for.
// Each category has multiple options; we pick one per request to vary results.
const CATEGORY_QUERIES: Record<string, string[]> = {
  world: [
    "peace treaty",
    "humanitarian aid success",
    "refugees welcomed",
    "countries cooperate",
    "diplomatic agreement",
  ],
  science: [
    "breakthrough discovery",
    "scientists created",
    "NASA success",
    "renewable energy record",
    "new species discovered",
    "medical breakthrough",
  ],
  community: [
    "volunteers rescued",
    "community rebuilt",
    "charity donated millions",
    "kindness strangers",
    "neighborhood saved",
  ],
  health: [
    "cure discovered",
    "vaccine breakthrough",
    "cancer treatment success",
    "disease eliminated",
    "surgery breakthrough",
  ],
  business: [
    "jobs created thousands",
    "startup launched",
    "economic growth record",
    "renewable energy investment",
    "poverty reduction milestone",
  ],
  sports: [
    "championship underdog wins",
    "world record broken",
    "athlete donates charity",
    "comeback victory",
    "Olympic gold medal",
  ],
};

const NEGATIVE_WORDS = [
  "killed", "dead", "dies", "murder", "attack", "crisis",
  "war ", "bomb", "shooting", "massacre", "collapse", "scandal",
  "arrest", "sentenced", "guilty", "fatal", "terror", "fraud",
  "abuse", "crash killed", "explosion killed",
];

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string };
}

async function fetchCategory(
  categoryKey: string,
  queries: string[]
): Promise<{ category: string; articles: GNewsArticle[] }> {
  // Pick one random query for this category
  const query = queries[Math.floor(Math.random() * queries.length)];

  const params = new URLSearchParams({
    q: query,
    lang: "en",
    max: "10",
    sortby: "relevance",
    apikey: API_KEY || "",
  });

  const url = `${BASE_URL}?${params}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error(`GNews ${categoryKey} HTTP ${res.status}: ${text}`);
      return { category: categoryKey, articles: [] };
    }

    const data = await res.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      console.error(`GNews ${categoryKey}: no articles array in response`);
      return { category: categoryKey, articles: [] };
    }

    // Filter out negative stories
    const filtered = data.articles.filter(
      (a: GNewsArticle) =>
        !NEGATIVE_WORDS.some((word) =>
          a.title.toLowerCase().includes(word)
        )
    );

    return { category: categoryKey, articles: filtered };
  } catch (err) {
    console.error(`GNews ${categoryKey} error:`, err);
    return { category: categoryKey, articles: [] };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!API_KEY) {
    return res.status(500).json({
      error: "GNEWS_API_KEY not set",
      hint: "Add GNEWS_API_KEY to Vercel Environment Variables and redeploy",
    });
  }

  try {
    // Fetch all 6 categories in parallel
    const results = await Promise.all(
      Object.entries(CATEGORY_QUERIES).map(([key, queries]) =>
        fetchCategory(key, queries)
      )
    );

    // Deduplicate by URL and flatten
    const seen = new Set<string>();
    const stories = results.flatMap(({ category, articles }) =>
      articles
        .filter((a) => {
          if (seen.has(a.url)) return false;
          seen.add(a.url);
          return true;
        })
        .map((a) => ({
          title: a.title,
          description: a.description || "",
          url: a.url,
          image: a.image,
          publishedAt: a.publishedAt,
          source: a.source.name,
          category,
        }))
    );

    // Sort newest first
    stories.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

    // Cache 15 min
    res.setHeader(
      "Cache-Control",
      "s-maxage=900, stale-while-revalidate=1800"
    );

    return res.status(200).json({ stories, count: stories.length });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Failed to fetch stories" });
  }
}
