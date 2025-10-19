import jwt from "jsonwebtoken";
import { getCached, setCached } from "../clients/redisClient.js";

const JWT_SECRET = process.env.JWT_SECRET || "unsafe_jwt_secret";
const TTL_TOKEN_CACHE = 3600; // 1 Stunde Cache für die Token-Blacklist
const JWT_COOKIE_NAME = 'auth_token';

/**
 * Middleware zur Authentifizierung von Benutzern
 * Erfordert einen gültigen JWT-Token im Authorization-Header
 */
export function requireAuth(req, res, next) {
    try {
        // Token aus Cookie ODER Header extrahieren
        const token = req.cookies?.[JWT_COOKIE_NAME] ||
            (req.headers.authorization?.startsWith('Bearer ') ?
                req.headers.authorization.split(' ')[1] : null);

        if (!token) {
            // Bei Web-Zugriffen zum Login umleiten
            // if (req.headers.accept?.includes('text/html')) {
            return res.redirect('/user/login');
            // }
            // Bei API-Zugriffen 401 zurückgeben
            return res.status(401).json({ error: "Nicht authentifiziert" });
        }

        // Token validieren
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                if (req.cookies?.[JWT_COOKIE_NAME]) {
                    res.clearCookie(JWT_COOKIE_NAME);
                    return res.redirect('/user/login');
                }
                return res.status(401).json({ error: "Ungültiger Token" });
            }

            // Blacklist-Check
            const isBlacklisted = await getCached(`token_blacklist:${token}`);
            if (isBlacklisted) {
                if (req.cookies?.[JWT_COOKIE_NAME]) {
                    res.clearCookie(JWT_COOKIE_NAME);
                    return res.redirect('/user/login');
                }
                return res.status(401).json({ error: "Token ist nicht mehr gültig" });
            }
            console.log("Authentifizierung erfolgreich für Benutzer:", decoded);
            // User-Infos an Request anhängen
            req.user = {
                username: decoded.username,
                role: decoded.role,
                // userId: decoded.
            };

            // User-Info auch für Templates bereitstellen
            res.locals.user = req.user;

            next();
        });
    } catch (error) {
        console.error("Auth-Fehler:", error);

        if (req.cookies?.[JWT_COOKIE_NAME]) {
            res.clearCookie(JWT_COOKIE_NAME);
            return res.redirect('/user/login');
        }

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
 * Token als Cookie setzen (für Web-Login)
 */
export function setAuthCookie(res, token) {
    res.cookie(JWT_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    });
}
/**
 * Login - Helper für authRoutes.js
*/
export function loginUser(res, user) {
    const token = generateToken(user);
    setAuthCookie(res, token);
    return token;
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