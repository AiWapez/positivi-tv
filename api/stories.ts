import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// One simple query per category per request. Keep these plain and direct.
const CATEGORY_QUERIES: Record<string, string[]> = {
  world: [
    "peace agreement",
    "humanitarian aid",
    "diplomatic success",
    "international cooperation",
    "refugees resettled",
  ],
  science: [
    "breakthrough discovery",
    "scientists discover",
    "space mission success",
    "renewable energy record",
    "new species found",
  ],
  community: [
    "volunteers rescue",
    "community rebuilds",
    "charity donates",
    "strangers kindness",
    "neighborhood saved",
  ],
  health: [
    "medical breakthrough",
    "vaccine success",
    "cancer treatment breakthrough",
    "disease eliminated",
    "surgery saves",
  ],
  business: [
    "jobs created",
    "startup success",
    "economic growth",
    "clean energy investment",
    "poverty reduction",
  ],
  sports: [
    "championship victory",
    "world record broken",
    "athlete donates",
    "underdog wins",
    "comeback victory sports",
  ],
};

const NEGATIVE_WORDS = [
  "killed", "dead", "dies", "murder", "attack", "crisis",
  "war ", "bomb", "shooting", "massacre", "collapse", "scandal",
  "arrest", "sentenced", "guilty", "fatal", "terror", "fraud",
  "abuse",
];

async function fetchCategory(
  categoryKey: string,
  queries: string[]
): Promise<any[]> {
  const query = queries[Math.floor(Math.random() * queries.length)];

  const params = new URLSearchParams({
    q: query,
    lang: "en",
    max: "10",
    sortby: "relevance",
    apikey: API_KEY || "",
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.articles) return [];

    return data.articles
      .filter(
        (a: any) =>
          !NEGATIVE_WORDS.some((w) =>
            a.title.toLowerCase().includes(w)
          )
      )
      .map((a: any) => ({
        title: a.title,
        description: a.description || "",
        url: a.url,
        image: a.image,
        publishedAt: a.publishedAt,
        source: a.source?.name || "Unknown",
        category: categoryKey,
      }));
  } catch {
    return [];
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!API_KEY) {
    return res.status(500).json({
      error: "GNEWS_API_KEY not set in Vercel environment variables",
    });
  }

  try {
    // Fetch all 6 categories in parallel
    const results = await Promise.all(
      Object.entries(CATEGORY_QUERIES).map(([key, queries]) =>
        fetchCategory(key, queries)
      )
    );

    // Flatten and deduplicate by URL
    const seen = new Set<string>();
    const stories = results
      .flat()
      .filter((s) => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime()
      );

    // Short cache while we're tuning (2 minutes)
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

    return res.status(200).json({ stories, count: stories.length });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Fetch failed", message: err.message });
  }
}
