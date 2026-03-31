import { CATEGORIES } from "../data/categories";
import { extractLocation } from "../data/countryCoords";
import type { Story, CategoryKey } from "../types";

const API_KEY = import.meta.env.VITE_GNEWS_API_KEY;
const BASE_URL = "https://gnews.io/api/v4/search";

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

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

/**
 * Fetches positive news stories from GNews for a single category.
 * Combines the category's keywords into one search query.
 * Returns stories with coordinates resolved from article text.
 */
async function fetchCategoryStories(
  category: (typeof CATEGORIES)[number],
  maxArticles: number = 5
): Promise<Story[]> {
  // Pick 2 random keywords from the category to vary results each load
  const shuffled = [...category.keywords].sort(() => Math.random() - 0.5);
  const queryKeywords = shuffled.slice(0, 2).join(" OR ");

  const params = new URLSearchParams({
    q: queryKeywords,
    lang: "en",
    max: String(maxArticles),
    sortby: "publishedAt",
    apikey: API_KEY,
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);

    if (!res.ok) {
      console.error(
        `GNews fetch failed for ${category.key}: ${res.status}`
      );
      return [];
    }

    const data: GNewsResponse = await res.json();

    const stories: Story[] = [];

    for (const article of data.articles) {
      // Skip articles that seem primarily negative
      const lowerTitle = article.title.toLowerCase();
      const negativeSignals = [
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
      ];
      if (negativeSignals.some((s) => lowerTitle.includes(s))) continue;

      // Try to resolve coordinates from article text
      const coords = extractLocation({
        title: article.title,
        description: article.description || "",
        source: article.source,
      });

      stories.push({
        id: `${category.key}-${stories.length}-${Date.now()}`,
        title: article.title,
        description: article.description || "",
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        image: article.image,
        category: category.key as CategoryKey,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        locationName: coords?.name ?? "Unknown",
      });
    }

    return stories;
  } catch (err) {
    console.error(`GNews fetch error for ${category.key}:`, err);
    return [];
  }
}

/**
 * Fetches positive stories across all categories.
 * Runs all category fetches in parallel for speed.
 * Returns combined array sorted by publication date.
 */
export async function fetchAllStories(): Promise<Story[]> {
  if (!API_KEY) {
    console.error(
      "VITE_GNEWS_API_KEY is not set. Add it to your .env.local or Vercel environment variables."
    );
    return [];
  }

  const results = await Promise.allSettled(
    CATEGORIES.map((cat) => fetchCategoryStories(cat, 5))
  );

  const allStories: Story[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allStories.push(...result.value);
    }
  }

  // Sort by most recent first
  allStories.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
  );

  return allStories;
}
