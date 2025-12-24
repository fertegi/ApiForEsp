import { getDatabase } from './mongoClient.js';

const CACHE_COLLECTION = 'cache';
let cacheInitialized = false;

/**
 * Initialisiert die Cache-Collection mit TTL-Index
 * Sollte einmal beim App-Start aufgerufen werden
 */
export async function initCacheCollection() {
    if (cacheInitialized) return true;

    try {
        const db = await getDatabase();
        const cache = db.collection(CACHE_COLLECTION);

        // TTL-Index erstellen (idempotent - existiert er bereits, passiert nichts)
        await cache.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0, background: true }
        );

        cacheInitialized = true;
        console.log('MongoDB Cache Collection initialisiert');
        return true;
    } catch (error) {
        console.error('Cache Collection Init Fehler:', error);
        return false;
    }
}

// Cache-Wrapper Funktionen
export async function getCached(key) {
    try {
        const db = await getDatabase();
        const cache = db.collection(CACHE_COLLECTION);

        const doc = await cache.findOne({
            _id: key,
            expiresAt: { $gt: new Date() }
        });

        return doc?.value ?? null;
    } catch (error) {
        console.error('Cache GET Fehler:', error);
        return null;
    }
}

export async function setCached(key, value, ttlSeconds = 300) {
    try {
        const db = await getDatabase();
        const cache = db.collection(CACHE_COLLECTION);

        await cache.updateOne(
            { _id: key },
            {
                $set: {
                    value,
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        return true;
    } catch (error) {
        console.error('Cache SET Fehler:', error);
        return false;
    }
}

export async function deleteCached(key) {
    try {
        const db = await getDatabase();
        const cache = db.collection(CACHE_COLLECTION);

        await cache.deleteOne({ _id: key });
        return true;
    } catch (error) {
        console.error('Cache DELETE Fehler:', error);
        return false;
    }
}

export async function invalidatePattern(pattern) {
    try {
        const db = await getDatabase();
        const cache = db.collection(CACHE_COLLECTION);

        // MongoDB Regex Pattern aus Redis-style Pattern erstellen
        // z.B. "config:*" → /^config:/
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');

        const result = await cache.deleteMany({
            _id: { $regex: new RegExp(`^${regexPattern}`) }
        });

        if (result.deletedCount > 0) {
            console.log(`Cache Pattern invalidiert: ${pattern} (${result.deletedCount} keys)`);
        }

        return true;
    } catch (error) {
        console.error('Cache Pattern Invalidation Fehler:', error);
        return false;
    }
}

// Health Check
export async function isCacheHealthy() {
    try {
        const db = await getDatabase();
        await db.command({ ping: 1 });
        return true;
    } catch (error) {
        console.error('Cache Health Check Fehler:', error);
        return false;
    }
}