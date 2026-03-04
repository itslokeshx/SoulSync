export function formatTime(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "0 min";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} hr ${minutes} min`;
  return `${minutes} min`;
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

export function getGreetingEmoji(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "☀️";
  if (h >= 12 && h < 17) return "👋";
  if (h >= 17 && h < 21) return "🌆";
  return "🌙";
}
