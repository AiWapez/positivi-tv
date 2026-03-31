import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  world: [
    "peace agreement",
    "diplomatic breakthrough",
    "humanitarian milestone",
    "international cooperation",
    "treaty signed",
  ],
  science: [
    "scientific discovery",
    "breakthrough research",
    "space exploration success",
    "climate solution",
    "innovation milestone",
  ],
  community: [
    "community rescue",
    "acts of kindness",
    "volunteers rebuild",
    "neighborhood restored",
    "charity milestone",
  ],
  health: [
    "medical breakthrough",
    "disease eradicated",
    "health milestone",
    "treatment discovery",
    "mental health progress",
  ],
  business: [
    "job creation",
    "economic recovery",
    "social enterprise",
    "poverty reduction",
    "renewable energy jobs",
  ],
  sports: [
    "record breaking athlete",
    "underdog victory",
    "athlete charity",
    "sports achievement",
    "team community impact",
  ],
};

const NEGATIVE_SIGNALS = [
  "killed",
  "dead",
  "dies",
  "murder",
  "attack",
  "crisis",
  "war ",
  "bomb",
  "shooting",
  "massacre",
  "collapse",
  "scandal",
  "arrest",
  "sentenced",
  "guilty",
];

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

async function fetchCategory(
  categoryKey: string,
  keywords: string[]
): Promise<{ category: string; articles: GNewsArticle[] }> {
  // Pick 2 random keywords to vary results each refresh
  const shuffled = [...keywords].sort(() => Math.random() - 0.5);
  const query = shuffled.slice(0, 2).join(" OR ");

  const params = new URLSearchParams({
    q: query,
    lang: "en",
    max: "5",
    sortby: "publishedAt",
    apikey: API_KEY || "",
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      console.error(`GNews ${categoryKey}: HTTP ${res.status}`);
      return { category: categoryKey, articles: [] };
    }

    const data = await res.json();
    const articles = (data.articles || []).filter(
      (a: GNewsArticle) =>
        !NEGATIVE_SIGNALS.some((s) =>
          a.title.toLowerCase().includes(s)
        )
    );

    return { category: categoryKey, articles };
  } catch (err) {
    console.error(`GNews ${categoryKey} error:`, err);
    return { category: categoryKey, articles: [] };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!API_KEY) {
    console.error("GNEWS_API_KEY environment variable is not set");
    return res
      .status(500)
      .json({ error: "API key not configured" });
  }

  try {
    // Fetch all categories in parallel
    const results = await Promise.all(
      Object.entries(CATEGORY_KEYWORDS).map(([key, keywords]) =>
        fetchCategory(key, keywords)
      )
    );

    // Flatten into a single array with category tags
    const stories = results.flatMap(({ category, articles }) =>
      articles.map((a) => ({
        title: a.title,
        description: a.description || "",
        url: a.url,
        image: a.image,
        publishedAt: a.publishedAt,
        source: a.source.name,
        category,
      }))
    );

    // Sort by most recent
    stories.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

    // Cache for 15 minutes to stay under GNews rate limits
    res.setHeader(
      "Cache-Control",
      "s-maxage=900, stale-while-revalidate=1800"
    );

    return res.status(200).json({ stories });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Failed to fetch stories" });
  }
}
