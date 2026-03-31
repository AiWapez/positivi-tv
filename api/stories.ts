import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// Broader keywords that actually return results on GNews
const CATEGORY_KEYWORDS: Record<string, string[][]> = {
  world: [
    ["peace", "agreement"],
    ["humanitarian", "aid"],
    ["united nations", "milestone"],
    ["cooperation", "countries"],
    ["diplomacy", "success"],
    ["refugees", "welcomed"],
  ],
  science: [
    ["scientists", "discovery"],
    ["breakthrough", "research"],
    ["NASA", "success"],
    ["renewable energy", "record"],
    ["species", "discovered"],
    ["climate", "solution"],
    ["space", "launch success"],
  ],
  community: [
    ["rescue", "saved"],
    ["volunteers", "helped"],
    ["kindness", "community"],
    ["donated", "charity"],
    ["rebuilt", "neighborhood"],
    ["food bank", "families"],
  ],
  health: [
    ["medical", "breakthrough"],
    ["vaccine", "approved"],
    ["cancer", "treatment breakthrough"],
    ["cure", "discovered"],
    ["hospital", "milestone"],
    ["disease", "eliminated"],
  ],
  business: [
    ["jobs", "created"],
    ["startup", "launched"],
    ["economic", "growth"],
    ["renewable", "investment"],
    ["small business", "success"],
    ["poverty", "reduced"],
  ],
  sports: [
    ["championship", "wins"],
    ["record", "breaking athlete"],
    ["olympic", "gold"],
    ["underdog", "victory"],
    ["athlete", "charity"],
    ["comeback", "win"],
  ],
};

const NEGATIVE_SIGNALS = [
  "killed", "dead", "dies", "murder", "attack", "crisis",
  "war ", "bomb", "shooting", "massacre", "collapse", "scandal",
  "arrest", "sentenced", "guilty", "fatal", "terror", "charged",
  "fraud", "abuse", "crash", "explosion",
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
  keywordPairs: string[][]
): Promise<{ category: string; articles: GNewsArticle[] }> {
  // Pick 2 random keyword pairs and build query
  const shuffled = [...keywordPairs].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3);
  const query = picked.map((pair) => pair.join(" ")).join(" OR ");

  const params = new URLSearchParams({
    q: query,
    lang: "en",
    max: "10",
    sortby: "relevance",
    apikey: API_KEY || "",
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      console.error(`GNews ${categoryKey}: HTTP ${res.status}`);
      return { category: categoryKey, articles: [] };
    }

    const data = await res.json();
    const filtered = (data.articles || []).filter(
      (a: GNewsArticle) =>
        !NEGATIVE_SIGNALS.some((s) =>
          a.title.toLowerCase().includes(s)
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
    console.error("GNEWS_API_KEY environment variable is not set");
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const results = await Promise.all(
      Object.entries(CATEGORY_KEYWORDS).map(([key, pairs]) =>
        fetchCategory(key, pairs)
      )
    );

    const seen = new Set<string>();
    const stories = results.flatMap(({ category, articles }) =>
      articles
        .filter((a) => {
          // Deduplicate by URL
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

    stories.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

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
