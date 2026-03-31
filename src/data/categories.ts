import type { CategoryConfig } from "../types";

export const CATEGORIES: CategoryConfig[] = [
  {
    key: "world",
    label: "World News",
    emoji: "🌍",
    color: "#FFD700",
    glowColor: "rgba(255, 215, 0, 0.4)",
    keywords: [
      "peace agreement",
      "diplomatic breakthrough",
      "humanitarian milestone",
      "international cooperation",
      "treaty signed",
    ],
  },
  {
    key: "science",
    label: "Science & Tech",
    emoji: "🔬",
    color: "#00E676",
    glowColor: "rgba(0, 230, 118, 0.4)",
    keywords: [
      "scientific discovery",
      "breakthrough research",
      "space exploration success",
      "climate solution",
      "innovation milestone",
    ],
  },
  {
    key: "community",
    label: "Community",
    emoji: "💙",
    color: "#42A5F5",
    glowColor: "rgba(66, 165, 245, 0.4)",
    keywords: [
      "community rescue",
      "acts of kindness",
      "volunteers rebuild",
      "neighborhood restored",
      "charity milestone",
    ],
  },
  {
    key: "health",
    label: "Health",
    emoji: "💊",
    color: "#26C6DA",
    glowColor: "rgba(38, 198, 218, 0.4)",
    keywords: [
      "medical breakthrough",
      "disease eradicated",
      "health milestone",
      "treatment discovery",
      "mental health progress",
    ],
  },
  {
    key: "business",
    label: "Business",
    emoji: "📈",
    color: "#66BB6A",
    glowColor: "rgba(102, 187, 106, 0.4)",
    keywords: [
      "job creation",
      "economic recovery",
      "social enterprise",
      "poverty reduction",
      "renewable energy jobs",
    ],
  },
  {
    key: "sports",
    label: "Sports",
    emoji: "🏆",
    color: "#ECEFF1",
    glowColor: "rgba(236, 239, 241, 0.4)",
    keywords: [
      "record breaking athlete",
      "underdog victory",
      "athlete charity",
      "sports achievement",
      "team community impact",
    ],
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<string, CategoryConfig>;
