import jwt from "jsonwebtoken";
import { getCached, setCached } from "../clients/redisClient.js";

const JWT_SECRET = process.env.JWT_SECRET || "unsicheres-geheimnis-bitte-in-env-andern";
const TTL_TOKEN_CACHE = 3600; // 1 Stunde Cache für die Token-Blacklist

/**
 * Middleware zur Authentifizierung von Benutzern
 * Erfordert einen gültigen JWT-Token im Authorization-Header
 */
export function requireAuth(req, res, next) {
    try {
        // Token aus Header extrahieren
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Kein Token bereitgestellt" });
        }

        const token = authHeader.split(' ')[1];

        // Token validieren
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: "Ungültiger Token" });
            }

            // Prüfen, ob der Token in der Blacklist ist (ausgeloggt)
            const isBlacklisted = await getCached(`token_blacklist:${token}`);
            if (isBlacklisted) {
                return res.status(401).json({ error: "Token ist nicht mehr gültig" });
            }

            // User-Infos an Request anhängen
            req.user = {
                username: decoded.username,
                role: decoded.role,
                userId: decoded.userId
            };

            next();
        });
    } catch (error) {
        console.error("Auth-Fehler:", error);
        res.status(500).json({ error: "Fehler bei der Authentifizierung" });
    }
}

/**
 * Middleware zur Überprüfung von Admin-Rechten
 * Muss nach requireAuth verwendet werden
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Keine ausreichenden Berechtigungen" });
    }

    next();
}

/**
 * Hilfsfunktion zum Generieren eines JWT-Tokens
 */
export function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Hilfsfunktion zum Invalidieren eines JWT-Tokens (Logout)
 */
export async function invalidateToken(token) {
    // Token in Blacklist speichern bis zum Ablaufdatum
    try {
        const decoded = jwt.decode(token);

        if (decoded && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            const ttl = decoded.exp - now;

            if (ttl > 0) {
                await setCached(`token_blacklist:${token}`, true, ttl);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error("Token-Invalidierung fehlgeschlagen:", error);
        return false;
    }
}