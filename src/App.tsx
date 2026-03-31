import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import CategoryFilters from "./components/CategoryFilters";
import MapView from "./components/MapView";
import StoryCard from "./components/StoryCard";
import GamificationBar from "./components/GamificationBar";
import { fetchAllStories } from "./services/gnews";
import { CATEGORIES } from "./data/categories";
import { CATEGORY_MAP } from "./data/categories";
import type { Story, CategoryKey } from "./types";

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Story | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [filters, setFilters] = useState<Set<CategoryKey>>(
    new Set(CATEGORIES.map((c) => c.key))
  );
  const [gamifyOn, setGamifyOn] = useState(false);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  // Auto-load stories on mount
  const loadStories = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    const data = await fetchAllStories();
    setStories(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const toggleFilter = (key: CategoryKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectStory = (story: Story) => {
    setSelected(story);
    setReadSet((prev) => new Set(prev).add(story.id));
  };

  const visible = stories.filter((s) => filters.has(s.category));
  const mappable = visible.filter((s) => s.lat !== 0 || s.lng !== 0);
  const unmapped = visible.filter((s) => s.lat === 0 && s.lng === 0);

  // Group stories by category for list view
  const grouped = CATEGORIES.filter((c) => filters.has(c.key))
    .map((c) => ({
      ...c,
      items: stories.filter((s) => s.category === c.key),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black">
      <Header
        storyCount={visible.length}
        loading={loading}
        onRefresh={loadStories}
      />

      <CategoryFilters
        activeFilters={filters}
        onToggle={toggleFilter}
        stories={stories}
      />

      {/* View toggle */}
      <div className="flex px-4 pb-1.5 flex-shrink-0">
        {(["map", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setSelected(null);
            }}
            className={`flex-1 py-1.5 text-[11px] font-bold border transition-all ${
              view === v
                ? "bg-white/[0.08] text-white"
                : "bg-transparent text-white/25"
            } ${v === "map" ? "rounded-l-lg" : "rounded-r-lg"}`}
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            {v === "map" ? "🗺  Map" : "📋  Stories"}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* ── MAP VIEW ── */}
        {view === "map" && (
          <div className="h-full flex flex-col">
            <div
              className="transition-all duration-300 overflow-hidden px-2 pt-1"
              style={{ flex: selected ? "0 0 55%" : "1 1 100%" }}
            >
              <div className="h-full rounded-xl border border-white/5 overflow-hidden">
                {!loading && (
                  <MapView
                    stories={mappable}
                    selectedStory={selected}
                    onSelectStory={selectStory}
                  />
                )}
                {loading && (
                  <div className="h-full flex items-center justify-center text-white/30 text-sm">
                    Loading positive stories...
                  </div>
                )}
              </div>
            </div>

            {/* Bottom sheet */}
            {selected && (
              <div className="flex-shrink-0" style={{ flex: "0 0 45%" }}>
                <StoryCard
                  story={selected}
                  onClose={() => setSelected(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="h-full overflow-y-auto px-4 pt-2 pb-24 no-scrollbar">
            <GamificationBar
              visible={gamifyOn}
              storiesRead={readSet.size}
              totalStories={stories.length}
              streak={1}
            />

            {loading && (
              <div className="text-center text-white/30 text-sm py-12">
                Loading stories...
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.key} className="mb-4">
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: group.color,
                      boxShadow: `0 0 6px ${group.color}60`,
                    }}
                  />
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-wide"
                    style={{ color: group.color }}
                  >
                    {group.label}
                  </span>
                  <span className="text-[10px] text-white/20">
                    ({group.items.length})
                  </span>
                </div>

                {group.items.map((story) => {
                  const isSel = selected?.id === story.id;
                  const cat = CATEGORY_MAP[story.category];
                  const date = new Date(
                    story.publishedAt
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <button
                      key={story.id}
                      onClick={() => selectStory(story)}
                      className="w-full text-left rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-all border"
                      style={{
                        background: isSel
                          ? `${cat.color}0e`
                          : "rgba(255,255,255,0.02)",
                        borderColor: isSel
                          ? `${cat.color}30`
                          : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <p className="text-[13px] font-semibold text-gray-100 leading-snug">
                        {gamifyOn && readSet.has(story.id) ? "✓ " : ""}
                        {story.title}
                      </p>

                      {isSel && (
                        <>
                          <p className="text-[12px] text-white/45 leading-relaxed mt-1.5">
                            {story.description}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-white/20">
                              {story.source} · {date}
                            </span>
                            <a
                              href={story.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-bold no-underline px-3 py-1 rounded"
                              style={{
                                color: cat.color,
                                background: `${cat.color}12`,
                                border: `1px solid ${cat.color}25`,
                              }}
                            >
                              Read →
                            </a>
                          </div>
                        </>
                      )}

                      {!isSel && (
                        <p className="text-[10px] text-white/20 mt-0.5">
                          {story.locationName !== "Unknown"
                            ? `${story.locationName} · `
                            : ""}
                          {date}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Unmapped stories overflow */}
            {unmapped.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-white/30">
                    📍 Location Unknown
                  </span>
                  <span className="text-[10px] text-white/20">
                    ({unmapped.length})
                  </span>
                </div>
                {unmapped.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => selectStory(story)}
                    className="w-full text-left rounded-lg px-3 py-2.5 mb-1 cursor-pointer border"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <p className="text-[13px] font-semibold text-gray-100 leading-snug">
                      {story.title}
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">
                      {story.source}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Gamification toggle */}
            <div className="text-center py-3">
              <button
                onClick={() => setGamifyOn(!gamifyOn)}
                className="px-4 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                style={{
                  background: gamifyOn
                    ? "rgba(255,215,0,0.08)"
                    : "rgba(255,255,255,0.03)",
                  borderColor: gamifyOn
                    ? "rgba(255,215,0,0.15)"
                    : "rgba(255,255,255,0.06)",
                  color: gamifyOn
                    ? "#FFD700"
                    : "rgba(255,255,255,0.2)",
                }}
              >
                🎮{" "}
                {gamifyOn ? "Gamification ON" : "Enable Gamification"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
