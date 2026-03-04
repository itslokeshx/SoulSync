interface EqBarsProps {
  size?: "sm" | "lg";
}

export const EqBars = ({ size = "sm" }: EqBarsProps) => {
  const anims = [
    "animate-eq1",
    "animate-eq2",
    "animate-eq3",
    "animate-eq4",
    "animate-eq5",
  ];
  const heights = size === "sm" ? [6, 12, 4, 10, 7] : [8, 16, 5, 14, 9];
  return (
    <span
      className="flex items-end gap-[2px]"
      style={{ height: size === "sm" ? 16 : 22 }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] bg-sp-green rounded-sm ${anims[i]}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
};
