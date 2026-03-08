import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";
import { initCapacitor } from "./capacitor";
import { isNative } from "./utils/platform";
import { saveNativeToken } from "./api/backend";
import { Capacitor } from "@capacitor/core";
import { NetworkProvider } from "./providers/NetworkProvider";

// @ts-ignore
if (import.meta.env.VITE_PREVIEW_OFFLINE === "true") {
  // @ts-ignore
  Capacitor.isNativePlatform = () => true;
  // @ts-ignore
  Capacitor.getPlatform = () => "android";
}

// Initialise native plugins (no-op on web)
initCapacitor();

// Listen for deep link auth callback (native Google OAuth flow)
if (isNative()) {
  import("@capacitor/app").then(({ App: CapApp }) => {
    CapApp.addListener("appUrlOpen", async ({ url }) => {
      // Handle auth-callback deep link: soulsync://auth-callback?token=...
      if (url.includes("auth-callback")) {
        try {
          // Custom scheme URLs: extract query string manually
          const qs = url.split("?")[1] || "";
          const params = new URLSearchParams(qs);
          const token = params.get("token");
          if (token) {
            await saveNativeToken(token);
            window.location.href = "/";
          }
        } catch (e) {
          console.error("[DeepLink] Failed to parse auth callback:", e);
        }
      }
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <AuthProvider>
            <App />
            <Toaster
              position="bottom-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "#282828",
                  color: "#fff",
                  fontSize: "13px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                },
                success: {
                  iconTheme: { primary: "#1db954", secondary: "#000" },
                },
              }}
            />
          </AuthProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
