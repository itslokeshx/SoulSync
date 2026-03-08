import { Router, Request, Response } from "express";
import { detectPlatform } from "../services/importDetector.js";
import { importSpotifyPlaylist } from "../services/importers/spotifyImporter.js";
import { importYoutubeMusicPlaylist } from "../services/importers/youtubeMusicImporter.js";
import { importAppleMusicPlaylist } from "../services/importers/appleMusicImporter.js";
import { importGaanaPlaylist } from "../services/importers/gaanaImporter.js";
import {
    importFromText,
    importFromCSV,
} from "../services/importers/textImporter.js";
import { ImportResult } from "../services/importers/types.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

function getSuggestion(platform: string, error: string): string {
    if (error.includes("public")) {
        return "Make sure your playlist is set to Public in the app settings";
    }
    if (platform === "youtube_music") {
        return "Open the playlist on YouTube Music → Share → Copy Link";
    }
    if (platform === "spotify") {
        return "Open playlist → ••• → Share → Copy link to playlist";
    }
    return 'Try switching to "Paste Names" and paste song names directly';
}

// ── POST /api/import ───────────────────────────────────────────
router.post(
    "/",
    rateLimiter(20, 60000),
    async (req: Request, res: Response): Promise<void> => {
        const { input } = req.body;

        if (!input?.trim()) {
            res.status(400).json({ error: "No input provided" });
            return;
        }

        const detected = detectPlatform(input);

        try {
            let result: ImportResult;

            switch (detected.platform) {
                case "spotify":
                    result = await importSpotifyPlaylist(detected.url!);
                    break;

                case "youtube_music":
                    if (!detected.playlistId) {
                        res.status(400).json({
                            error: "Could not extract playlist ID from URL",
                            suggestion:
                                "Make sure you copy the full playlist URL from YouTube Music",
                        });
                        return;
                    }
                    result = await importYoutubeMusicPlaylist(
                        detected.url!,
                        detected.playlistId,
                    );
                    break;

                case "apple_music":
                    result = await importAppleMusicPlaylist(detected.url!);
                    break;

                case "gaana":
                    result = await importGaanaPlaylist(detected.url!);
                    break;

                case "csv":
                    result = importFromCSV(detected.rawText!);
                    break;

                case "text":
                default:
                    result = importFromText(detected.rawText || input);
                    break;
            }

            if (!result.success || result.count === 0) {
                res.status(422).json({
                    error: "No songs found in the playlist",
                    platform: detected.platform,
                    suggestion: getSuggestion(detected.platform, ""),
                });
                return;
            }

            res.json({
                ...result,
                detectedPlatform: detected.platform,
            });
        } catch (err: any) {
            console.error(`[Import] ${detected.platform} error:`, err.message);
            res.status(422).json({
                error: err.message || "Import failed",
                platform: detected.platform,
                suggestion: getSuggestion(detected.platform, err.message || ""),
            });
        }
    },
);

export default router;
