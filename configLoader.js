import { getDatabase, getAllDevices } from "./clients/mongoClient.js";
import { getCached, setCached, deleteCached } from "./clients/redisClient.js";

// Fallback: Request-lokaler Cache falls Redis nicht verfügbar
const requestCache = new Map();

const TTL_SECONDS_CONFIG = 6000; // 100 Minuten

export function invalidateRequestCache() {
    requestCache.clear();
}

export async function invalidateDeviceCache(deviceId) {
    // Redis Cache löschen
    await deleteCached(`config:${deviceId}`);
    await deleteCached(`exists:${deviceId}`);

    // Request Cache löschen
    requestCache.delete(deviceId);
    requestCache.delete(`exists_${deviceId}`);

}

export async function loadConfig(deviceId) {
    const cacheKey = `config:${deviceId}`;

    // 1. Redis Cache check
    const cachedConfig = await getCached(cacheKey);
    if (cachedConfig) {
        return cachedConfig;
    }

    // 2. Request-lokaler Cache check (Fallback)
    if (requestCache.has(deviceId)) {
        return requestCache.get(deviceId);
    }

    try {
        const database = await getDatabase();
        const deviceConfigurations = database.collection("deviceConfigurations");
        const deviceConfiguration = await deviceConfigurations.findOne({ deviceId });

        if (!deviceConfiguration) {
            const errorConfig = { error: `Keine Konfiguration für Gerät mit ID ${deviceId} gefunden.` };

            // Fehler auch cachen (kurze TTL)
            await setCached(cacheKey, errorConfig, 60); // 1 Minute
            requestCache.set(deviceId, errorConfig);

            return errorConfig;
        }

        // Erfolgreiche Config cachen
        await setCached(cacheKey, deviceConfiguration, TTL_SECONDS_CONFIG);
        requestCache.set(deviceId, deviceConfiguration);

        return deviceConfiguration;
    } catch (error) {
        const errorConfig = { error: `Fehler beim Laden der Konfiguration: ${error.message}` };
        requestCache.set(deviceId, errorConfig);
        return errorConfig;
    }
}
