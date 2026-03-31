import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

// 3 broad queries instead of 6 narrow ones. Saves API quota and avoids rate limits.
const QUERIES = [
  "breakthrough discovery scientists research",
  "rescue charity volunteers community rebuilt",
  "victory championship record economic growth",
];

const NEGATIVE_WORDS = [
  "killed", "dead", "dies", "murder", "attack", "crisis",
  "war ", "bomb", "shooting", "massacre", "collapse", "scandal",
  "arrest", "sentenced", "guilty", "fatal", "terror", "fraud",
  "abuse", "crash", "assaulted",
];

// Auto-categorize a story based on its title and description
function categorize(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();

  // Science & Tech
  if (
    /scientist|research|discovery|breakthrough|nasa|space|asteroid|dna|study|lab|universit|genome|quantum|ai |robot|solar|energy|climate|species|fossil/.test(text)
  ) return "science";

  // Health
  if (
    /medical|health|hospital|cancer|disease|treatment|vaccine|surgery|drug|patient|doctor|cure|therap|mental health|transplant/.test(text)
  ) return "health";

  // Sports
  if (
    /championship|tournament|medal|olympic|athlete|coach|football|basketball|soccer|tennis|record.*(broken|set)|victory.*game|sports|nba|nfl|fifa|underdog|playoff|season/.test(text)
  ) return "sports";

  // Business
  if (
    /jobs? created|economic|startup|business|invest|growth|poverty|entrepreneur|company launch|renewable.*invest|market.*record|billion.*fund/.test(text)
  ) return "business";

  // Community
  if (
    /communit|volunteer|charit|donat|rescue|kindness|rebuild|shelter|food bank|neighbor|homeless|saved.*life|hero|fundrais/.test(text)
  ) return "community";

  // World (default for international / political positive stories)
  if (
    /peace|diplomat|treaty|humanitarian|united nations|refugee|international|cooperation|agreement|summit|foreign/.test(text)
  ) return "world";

  // Fallback: use rough mapping based on which query probably found it
  return "world";
}

// Small delay helper to avoid rate limiting
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuery(query: string): Promise<any[]> {
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
    return data.articles || [];
  } catch {
    return [];
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!API_KEY) {
    return res.status(500).json({ error: "GNEWS_API_KEY not set" });
  }

  try {
    // Run queries sequentially with a small delay to avoid rate limits
    const allArticles: any[] = [];

    for (const query of QUERIES) {
      const articles = await fetchQuery(query);
      allArticles.push(...articles);
      // Small delay between requests
      if (query !== QUERIES[QUERIES.length - 1]) {
        await delay(300);
      }
    }

    // Deduplicate by URL, filter negative, categorize
    const seen = new Set<string>();
    const stories = allArticles
      .filter((a) => {
        if (!a.title || seen.has(a.url)) return false;
        seen.add(a.url);
        return !NEGATIVE_WORDS.some((w) =>
          a.title.toLowerCase().includes(w)
        );
      })
      .map((a) => ({
        title: a.title,
        description: a.description || "",
        url: a.url,
        image: a.image,
        publishedAt: a.publishedAt,
        source: a.source?.name || "Unknown",
        category: categorize(a.title, a.description || ""),
      }))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime()
      );

    // Cache for 5 minutes
    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({ stories, count: stories.length });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Fetch failed", message: err.message });
  }
}
