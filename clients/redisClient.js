import { Redis } from '@upstash/redis';

// Singleton Redis Client für Vercel optimiert
let redisClient = null;

function getRedisClient() {
    if (!redisClient) {
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.warn('Redis nicht konfiguriert - Cache deaktiviert');
            return null;
        }

        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        console.log('Redis Client initialisiert');
    }

    return redisClient;
}

// Cache-Wrapper Funktionen
export async function getCached(key) {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
        const cached = await redis.get(key);
        if (cached) {
            return typeof cached === 'string' ? JSON.parse(cached) : cached;
        }
        return null;
    } catch (error) {
        console.error('Redis GET Fehler:', error);
        return null;
    }
}

export async function setCached(key, value, ttlSeconds = 300) {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        await redis.setex(key, ttlSeconds, serialized);
        return true;
    } catch (error) {
        console.error('Redis SET Fehler:', error);
        return false;
    }
}

export async function deleteCached(key) {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
        await redis.del(key);
        return true;
    } catch (error) {
        console.error('Redis DELETE Fehler:', error);
        return false;
    }
}

export async function invalidatePattern(pattern) {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`Redis Pattern invalidiert: ${pattern} (${keys.length} keys)`);
        }
        return true;
    } catch (error) {
        console.error('Redis Pattern Invalidation Fehler:', error);
        return false;
    }
}

// Health Check
export async function isRedisHealthy() {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
        const result = await redis.ping();
        return result === 'PONG';
    } catch (error) {
        console.error('Redis Health Check Fehler:', error);
        return false;
    }
}