const { app, BrowserWindow, shell, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");

// Keep a global reference to prevent garbage collection
let mainWindow = null;

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: "#060606",
        icon: path.join(__dirname, "../dist/favicon.svg"),
        autoHideMenuBar: true,
        titleBarStyle: "hiddenInset",
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Load the production URL. Our protocol handler will intercept this and serve the local files!
    // This tricks Google Auth into believing the app is running on the authorized web domain.
    mainWindow.loadURL("https://soul-sync-beta.vercel.app/");

    // Handle external links — open in default browser instead of Electron
    // EXCEPT for Google Auth popups, which must stay in Electron to work
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://accounts.google.com/")) {
            return { action: "allow" };
        }
        if (url.startsWith("https://") || url.startsWith("http://")) {
            shell.openExternal(url);
            return { action: "deny" };
        }
        return { action: "allow" };
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// Intercept HTTPS requests matching our frontend domain
function setupProtocolInterceptor() {
    protocol.handle("https", (request) => {
        const url = new URL(request.url);

        // If it's a request to our frontend domain, serve the local bundled files offline!
        if (url.origin === "https://soul-sync-beta.vercel.app") {
            let p = url.pathname;
            if (p === "/") p = "/index.html";

            let filePath = path.join(__dirname, "../dist", p);

            // SPA routing - if file doesn't exist, fallback to index.html
            if (!fs.existsSync(filePath)) {
                filePath = path.join(__dirname, "../dist/index.html");
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            try {
                const fileContent = fs.readFileSync(filePath);
                return new Response(fileContent, {
                    headers: {
                        "Content-Type": contentType,
                        "Cross-Origin-Opener-Policy": "unsafe-none",
                        "Cross-Origin-Embedder-Policy": "unsafe-none",
                    },
                });
            } catch (err) {
                return new Response("Server Error", { status: 500 });
            }
        }

        // For ALL OTHER domains (Google, Backend API, Cloudinary), pass the request through normally
        return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
}

app.whenReady().then(() => {
    setupProtocolInterceptor();
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    app.quit();
});
