import { CATEGORIES } from "../data/categories";
import type { CategoryKey, Story } from "../types";

interface CategoryFiltersProps {
  activeFilters: Set<CategoryKey>;
  onToggle: (key: CategoryKey) => void;
  stories: Story[];
}

export default function CategoryFilters({
  activeFilters,
  onToggle,
  stories,
}: CategoryFiltersProps) {
  return (
    <div className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar flex-shrink-0">
      {CATEGORIES.map((cat) => {
        const active = activeFilters.has(cat.key);
        const count = stories.filter(
          (s) => s.category === cat.key
        ).length;

        return (
          <button
            key={cat.key}
            onClick={() => onToggle(cat.key)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-all border"
            style={{
              background: active
                ? `${cat.color}14`
                : "rgba(255,255,255,0.03)",
              borderColor: active
                ? `${cat.color}40`
                : "rgba(255,255,255,0.07)",
              color: active ? cat.color : "rgba(255,255,255,0.25)",
            }}
          >
            <span className="text-[10px]">{cat.emoji}</span>
            {cat.label}
            <span className="opacity-50 text-[10px]">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
