import { CATEGORY_MAP } from "../data/categories";
import type { Story } from "../types";

interface StoryCardProps {
  story: Story;
  onClose: () => void;
}

export default function StoryCard({ story, onClose }: StoryCardProps) {
  const cat = CATEGORY_MAP[story.category];
  const date = new Date(story.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="slide-up"
      style={{
        background: "rgba(10, 14, 26, 0.98)",
        borderTop: `2px solid ${cat.color}40`,
        borderRadius: "16px 16px 0 0",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-9 h-1 rounded-full bg-white/15" />
      </div>

      <div className="px-4 pb-5 overflow-y-auto max-h-[40vh]">
        {/* Category tag + location + close */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                color: cat.color,
                background: `${cat.color}15`,
              }}
            >
              {cat.emoji} {cat.label}
            </span>
            <span className="text-[10px] text-white/30">
              {story.locationName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>

        {/* Headline */}
        <h2 className="text-[17px] font-bold leading-snug mb-2">
          {story.title}
        </h2>

        {/* Summary */}
        <p className="text-[13px] leading-relaxed text-white/55 mb-4">
          {story.description}
        </p>

        {/* Source + link */}
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-white/25">
            {story.source} · {date}
          </span>
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold no-underline px-3.5 py-1.5 rounded-lg"
            style={{
              color: cat.color,
              background: `${cat.color}12`,
              border: `1px solid ${cat.color}30`,
            }}
          >
            Read Full Story →
          </a>
        </div>
      </div>
    </div>
  );
}
