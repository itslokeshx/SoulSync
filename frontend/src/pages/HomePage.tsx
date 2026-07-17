import { useNavigate } from "react-router-dom";
import { AlertCircle, Download, Heart, ArrowRight, Radio } from "lucide-react";

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 animate-fadeIn relative overflow-hidden">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-sp-rose/10 blur-3xl pointer-events-none animate-breathe" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-sp-amber/5 blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative w-full max-w-lg bg-sp-card/60 backdrop-blur-xl border border-white/[0.08] p-8 md:p-12 rounded-3xl text-center shadow-2xl space-y-8 animate-scaleIn">
        {/* Animated Icon & Badge */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-sp-rose/10 border border-sp-rose/20 text-sp-rose animate-bounce-slow">
            <Radio size={36} className="animate-pulse" />
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-sp-rose border-4 border-sp-black flex items-center justify-center">
              <AlertCircle size={12} className="text-white" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sp-rose/10 text-sp-rose border border-sp-rose/20 uppercase tracking-widest">
            Service Interruption
          </span>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            SoulSync is Offline
          </h1>
          <p className="text-white/60 text-sm md:text-base leading-relaxed">
            We are experiencing temporary streaming API connection issues. Our team is working to restore connection to the catalog as quickly as possible.
          </p>
          <div className="p-3.5 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
            <p className="text-xs text-sp-amber font-medium">
              💡 Search and online playback are temporarily disabled, but your offline features are fully operational!
            </p>
          </div>
        </div>

        {/* Actions / CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
          <button
            onClick={() => navigate("/downloads")}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-bold bg-white text-sp-black hover:bg-white/90 active:scale-95 transition-all duration-200 shadow-lg shadow-white/5"
          >
            <Download size={16} />
            Offline Downloads
            <ArrowRight size={14} className="opacity-60" />
          </button>
          
          <button
            onClick={() => navigate("/liked")}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-bold bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.1] active:scale-95 transition-all duration-200"
          >
            <Heart size={16} className="text-sp-rose fill-sp-rose/20" />
            Liked Songs
          </button>
        </div>
      </div>

      {/* Mini Status Footer */}
      <p className="text-[10px] uppercase tracking-widest text-white/20 mt-8">
        SoulSync v4.0.0 • Emergency Mode
      </p>
    </div>
  );
};

export default HomePage;

