import { useAuth } from "../auth/AuthContext";
import { useUIStore } from "../store/uiStore";
import { useCallback } from "react";

export function useAuthGate() {
    const { isAuthenticated } = useAuth();
    const openAuthGate = useUIStore((s) => s.openAuthGate);

    /**
     * gate() wraps any restricted action.
     * If the user is authenticated, the action executes immediately.
     * Otherwise, the global soft auth prompt is triggered.
     */
    const gate = useCallback(
        (action: () => void, message?: string) => {
            if (isAuthenticated) {
                action();
            } else {
                openAuthGate(message);
            }
        },
        [isAuthenticated, openAuthGate]
    );

    return { gate, isAuthenticated };
}
