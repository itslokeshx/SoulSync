import type { ReactNode, MouseEvent } from "react";

interface GreenButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  small?: boolean;
}

export const GreenButton = ({
  children,
  onClick,
  className = "",
  small = false,
}: GreenButtonProps) => (
  <button
    onClick={onClick}
    className={`bg-sp-green hover:bg-sp-green-light text-black font-bold rounded-full flex items-center gap-2 transition-all duration-200 hover:scale-[1.04] active:scale-100 ${
      small ? "px-5 py-2 text-[13px]" : "px-6 py-3 text-[13px]"
    } ${className}`}
    style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.3)" }}
  >
    {children}
  </button>
);
