export interface Story {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image: string | null;
  category: CategoryKey;
  lat: number;
  lng: number;
  locationName: string;
}

export type CategoryKey =
  | "world"
  | "science"
  | "community"
  | "health"
  | "business"
  | "sports";

export interface CategoryConfig {
  key: CategoryKey;
  label: string;
  emoji: string;
  color: string;
  glowColor: string;
  keywords: string[];
}

export interface Coordinates {
  lat: number;
  lng: number;
  name: string;
}
