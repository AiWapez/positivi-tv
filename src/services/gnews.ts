import { extractLocation } from "../data/countryCoords";
import type { Story, CategoryKey } from "../types";

interface APIStory {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: string;
  category: string;
}

/**
 * Fetches positive stories from our /api/stories serverless function.
 * When forceRefresh is true, adds a cache-busting param so Vercel
 * skips the edge cache and makes fresh GNews API calls.
 * On normal page load, uses the cached version to save API quota.
 */
export async function fetchAllStories(
  forceRefresh: boolean = false
): Promise<Story[]> {
  try {
    const url = forceRefresh
      ? `/api/stories?t=${Date.now()}`
      : "/api/stories";

    const res = await fetch(url);

    if (!res.ok) {
      console.error(`API fetch failed: ${res.status}`);
      return [];
    }

    const data: { stories: APIStory[] } = await res.json();

    const stories: Story[] = data.stories.map((article, index) => {
      const coords = extractLocation({
        title: article.title,
        description: article.description,
      });

      return {
        id: `${article.category}-${index}-${article.url.slice(-20)}`,
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        publishedAt: article.publishedAt,
        image: article.image,
        category: article.category as CategoryKey,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        locationName: coords?.name ?? "Unknown",
      };
    });

    return stories;
  } catch (err) {
    console.error("Failed to fetch stories:", err);
    return [];
  }
}
