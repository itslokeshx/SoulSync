import { Browser } from "@capacitor/browser";

type Props = {
    data: any;
    onUpdate: () => void;
    onClose?: () => void;
};

export const UpdatePopup = ({ data, onUpdate, onClose }: Props) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
            <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl w-full max-w-sm text-white shadow-2xl animate-scaleIn">
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-white">
                    <span className="text-xl">🚀</span> Update Available
                </h2>

                <p className="text-[13px] font-medium text-sp-green mb-4 bg-sp-green/10 inline-block px-2.5 py-1 rounded-md">
                    Version {data.version}
                </p>

                <div className="mb-6">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">What's new</p>
                    <ul className="text-[14px] text-white/80 space-y-1.5 list-disc pl-4">
                        {data.changelog?.map((c: string, i: number) => (
                            <li key={i}>{c}</li>
                        ))}
                    </ul>
                </div>

                <div className="flex gap-2.5">
                    {!data.force && (
                        <button
                            onClick={onClose}
                            className="flex-1 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] text-sm"
                        >
                            Later
                        </button>
                    )}

                    <button
                        onClick={onUpdate}
                        className="flex-[2] bg-sp-green text-black py-3 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all text-sm shadow-[0_0_20px_rgba(29,185,84,0.3)]"
                    >
                        Update Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export const openUpdateLink = async (url: string) => {
    try {
        await Browser.open({ url });
    } catch {
        // Fallback if capacitor browser fails
        window.open(url, "_blank");
    }
};
