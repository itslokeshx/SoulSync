const PRESET_COLORS = [
  "#1a3a2a",
  "#1a2847",
  "#47251a",
  "#2d1a47",
  "#1a3d47",
  "#3a3a1a",
  "#471a2d",
  "#1a3347",
  "#3d2a1a",
  "#1a473d",
];

export function hashColor(id: string): string {
  let h = 0;
  for (const c of id || "") h = c.charCodeAt(0) + ((h << 5) - h);
  return PRESET_COLORS[Math.abs(h) % PRESET_COLORS.length];
}

export function extractColor(imgUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!imgUrl) return resolve(null);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 20;
        canvas.height = 20;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, 20, 20);
        const data = ctx.getImageData(0, 0, 20, 20).data;

        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (lum < 20 || lum > 230) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }

        if (!n) return resolve(null);
        const f = 0.42;
        resolve(
          `rgb(${Math.round((r / n) * f)},${Math.round((g / n) * f)},${Math.round((b / n) * f)})`,
        );
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}
