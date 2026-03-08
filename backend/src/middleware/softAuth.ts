import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface SoftAuthRequest extends Request {
    userId?: string;
    googleId?: string;
}

export function softAuth(
    req: SoftAuthRequest,
    res: Response,
    next: NextFunction,
): void {
    // Accept token from cookie OR Authorization header (for native APK)
    let token = req.cookies?.saavn_token;
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.slice(7);
        }
    }

    // If no token exists, they are a guest. Just continue.
    if (!token) {
        return next();
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (secret) {
            const decoded = jwt.verify(token, secret) as {
                userId: string;
                googleId: string;
            };

            // Inject user ID if token is valid
            req.userId = decoded.userId;
            req.googleId = decoded.googleId;
        }
    } catch (err: unknown) {
        // If the token is invalid/expired, we just ignore it and treat them as a guest
    }

    // Continue regardless of whether auth worked
    next();
}
