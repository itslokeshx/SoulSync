import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Music2 } from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { useNavigate, useLocation } from "react-router-dom";

export function AuthGateModal() {
    const { open, message } = useUIStore((s) => s.authGate);
    const closeAuthGate = useUIStore((s) => s.closeAuthGate);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeAuthGate}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                    />
                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-sp-green flex items-center justify-center">
                                        <Music2 size={16} className="text-black" strokeWidth={2.5} />
                                    </div>
                                    <span className="text-sm font-bold text-white tracking-tight">
                                        Soul<span className="text-sp-green">Sync</span>
                                    </span>
                                </div>
                                <button
                                    onClick={closeAuthGate}
                                    className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 pt-6 pb-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-5 ring-4 ring-sp-green/10">
                                    <Lock size={24} className="text-sp-green" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{message || "Sign in to continue"}</h3>
                                <p className="text-[13px] text-white/40 leading-relaxed mb-8">
                                    Create a free account to save songs, build playlists, and experience real-time duo sessions with friends.
                                </p>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            closeAuthGate();
                                            navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
                                        }}
                                        className="w-full h-12 rounded-full bg-sp-green text-black font-bold text-[14px] hover:bg-sp-green/90 active:scale-[0.98] transition-all"
                                        style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.2)" }}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        onClick={() => {
                                            closeAuthGate();
                                            navigate(`/login?mode=register&returnTo=${encodeURIComponent(location.pathname + location.search)}`);
                                        }}
                                        className="w-full h-12 rounded-full bg-transparent border border-white/20 text-white font-bold text-[14px] hover:bg-white/[0.04] hover:border-white/40 active:scale-[0.98] transition-all"
                                    >
                                        Create Account
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
