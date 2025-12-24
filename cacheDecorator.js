import { getCached, setCached } from "./clients/cacheClient.js";
import crypto from 'crypto';

/**
 * Generiert einen kurzen Hash aus einem String
 * @param {string} str - Input string
 * @returns {string} - 12-stelliger Hash
 */
function shortHash(str) {
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
}

/**
 * Cache-Decorator für Funktionen - funktioniert wie Python-Decorators
 * @param {Function} fn - Die zu cachende Funktion
 * @param {Object} options - Cache-Optionen
 * @param {Function} options.keyGenerator - Funktion zur Generierung des Cache-Keys
 * @param {number} options.ttl - TTL in Sekunden (Standard: 300 = 5 Minuten)
 * @param {string} options.prefix - Prefix für Cache-Keys (Standard: 'cache')
 * @param {boolean} options.skipCache - Cache überspringen (für Testing)
 * @returns {Function} - Gecachte Version der ursprünglichen Funktion
 */
export function withCache(fn, options = {}) {
    const {
        keyGenerator = (...args) => shortHash(JSON.stringify(args)),
        ttl = 300, // 5 Minuten Standard
        prefix = 'cache',
        skipCache = false
    } = options;

    return async function cachedFunction(...args) {
        // Cache überspringen wenn gewünscht
        if (skipCache) {
            return await fn.apply(this, args);
        }

        // Cache-Key generieren
        const rawKey = keyGenerator(...args);
        const cacheKey = `${prefix}:${rawKey}`;

        try {
            // 1. Versuche aus Cache zu laden
            const cachedResult = await getCached(cacheKey);
            if (cachedResult !== null) {
                return cachedResult;
            }


            // 2. Führe ursprüngliche Funktion aus
            const result = await fn.apply(this, args);

            // 3. Speichere Ergebnis im Cache (nur bei erfolgreichem Ergebnis)
            if (result !== null && result !== undefined) {
                await setCached(cacheKey, result, ttl);
            }

            return result;

        } catch (error) {
            console.error(`Cache-Wrapper Fehler für:`, error);
            // Bei Cache-Fehlern trotzdem die ursprüngliche Funktion ausführen
            return await fn.apply(this, args);
        }
    };
}

/**
 * Einfacher Cache-Decorator mit Standard-Einstellungen
 * Nutzt Hash des Funktionsnamens + Argumente als Key
 * @param {number} ttl - TTL in Sekunden
 * @returns {Function} - Decorator-Funktion
 */
export function cached(ttl = 300) {
    return function decorator(fn) {
        return withCache(fn, { 
            ttl,
            keyGenerator: (...args) => `${fn.name}:${shortHash(JSON.stringify(args))}`
        });
    };
}

/**
 * Cache-Decorator speziell für API-Funktionen
 * @param {number} ttl - TTL in Sekunden
 * @param {string} prefix - Cache-Prefix
 * @returns {Function} - Decorator-Funktion
 */
export function apiCached(ttl = 600, prefix = 'api') {
    return function decorator(fn) {
        return withCache(fn, {
            ttl,
            prefix,
            keyGenerator: (...args) => `${fn.name}:${shortHash(JSON.stringify(args))}`
        });
    };
}

/**
 * Cache-Decorator für Device-spezifische Funktionen
 * Nutzt deviceId aus Config für lesbaren Cache-Key
 * @param {number} ttl - TTL in Sekunden
 * @returns {Function} - Decorator-Funktion
 */
export function deviceCached(ttl = 600) {
    return function decorator(fn) {
        return withCache(fn, {
            ttl,
            prefix: 'device',
            keyGenerator: (...args) => {
                // Versuche deviceId aus dem ersten Argument (Config) zu extrahieren
                const config = args[0];
                const deviceId = config?.deviceId || config?._id || 'unknown';
                const argsHash = shortHash(JSON.stringify(args));
                return `${fn.name}:${deviceId}:${argsHash}`;
            }
        });
    };
}