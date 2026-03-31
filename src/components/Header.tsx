interface HeaderProps {
  storyCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export default function Header({
  storyCount,
  loading,
  onRefresh,
}: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 z-50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">☀️</span>
        <div>
          <h1
            className="text-lg font-extrabold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #FFD700, #00E676)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PositiviTV
          </h1>
          <p className="text-[10px] text-white/30 tracking-wide">
            {today}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1 text-xs font-bold text-yellow-400">
          {loading ? "..." : storyCount}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          title="Refresh stories"
        >
          <span
            className={loading ? "animate-spin" : ""}
            style={{ fontSize: 14 }}
          >
            ↻
          </span>
        </button>
      </div>
    </header>
  );
}
