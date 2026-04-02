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
 * The server handles GNews API calls, keyword filtering, and negative story filtering.
 * Client handles coordinate resolution and final story assembly.
 */
export async function fetchAllStories(): Promise<Story[]> {
  try {
    const res = await fetch("/api/stories");

    if (!res.ok) {
      console.error(`API fetch failed: ${res.status}`);
      return [];
    }

    const data: { stories: APIStory[] } = await res.json();

    const stories: Story[] = data.stories.map((article, index) => {
      // Resolve coordinates from article text
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
