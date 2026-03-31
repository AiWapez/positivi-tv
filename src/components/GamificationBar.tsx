interface GamificationBarProps {
  visible: boolean;
  storiesRead: number;
  totalStories: number;
  streak: number;
}

export default function GamificationBar({
  visible,
  storiesRead,
  totalStories,
  streak,
}: GamificationBarProps) {
  if (!visible) return null;

  const points = storiesRead * 10;
  const badge =
    storiesRead >= 20
      ? "🏆"
      : storiesRead >= 10
        ? "⭐"
        : storiesRead >= 5
          ? "🌟"
          : "🌱";
  const badgeLabel =
    storiesRead >= 20
      ? "Champion"
      : storiesRead >= 10
        ? "Explorer"
        : storiesRead >= 5
          ? "Curious"
          : "Starter";

  return (
    <div className="mx-4 mb-2 rounded-xl border p-3 flex justify-around items-center"
      style={{
        background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,230,118,0.08))",
        borderColor: "rgba(255,215,0,0.15)",
      }}
    >
      <div className="text-center">
        <div className="text-lg font-extrabold text-yellow-400">
          🔥 {streak}
        </div>
        <div className="text-[9px] text-white/35 mt-0.5">Streak</div>
      </div>

      <div className="w-px h-7 bg-white/10" />

      <div className="text-center">
        <div className="text-lg font-extrabold text-green-400">
          +{points}
        </div>
        <div className="text-[9px] text-white/35 mt-0.5">Points</div>
      </div>

      <div className="w-px h-7 bg-white/10" />

      <div className="text-center">
        <div className="text-lg">{badge}</div>
        <div className="text-[9px] text-white/35 mt-0.5">
          {badgeLabel}
        </div>
      </div>

      <div className="w-px h-7 bg-white/10" />

      <div className="text-center">
        <div className="text-sm font-bold text-white/60">
          {storiesRead}/{totalStories}
        </div>
        <div className="text-[9px] text-white/35 mt-0.5">Read</div>
      </div>
    </div>
  );
}
