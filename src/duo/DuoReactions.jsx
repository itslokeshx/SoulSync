// ─────────────────────────────────────────────────────────────────────────────
// DuoReactions — Floating emoji reaction bubbles
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useDuoStore } from "./duoStore.js";

export function DuoReactions() {
  const { incomingReactions, removeIncomingReaction, active } = useDuoStore();

  // Auto-remove after animation
  useEffect(() => {
    if (!incomingReactions.length) return;
    const timers = incomingReactions.map((r) =>
      setTimeout(() => removeIncomingReaction(r.id), 2500),
    );
    return () => timers.forEach(clearTimeout);
  }, [incomingReactions, removeIncomingReaction]);

  if (!active || !incomingReactions.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[55] overflow-hidden">
      {incomingReactions.slice(-8).map((r) => {
        // Random horizontal position
        const left = 20 + Math.random() * 60; // 20-80%
        return (
          <span
            key={r.id}
            className="absolute text-3xl animate-reactionFloat"
            style={{
              left: `${left}%`,
              bottom: "120px",
              animation: "reactionFloat 2.5s ease-out forwards",
            }}
          >
            {r.emoji}
          </span>
        );
      })}
    </div>
  );
}
