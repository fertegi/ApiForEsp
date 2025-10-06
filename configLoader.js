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

    console.log(`Cache invalidiert für Device: ${deviceId}`);
}

export function requireRegisteredDeviceWithConfig(req, res, next) {
    const deviceId = req.params.deviceId || req.headers['x-device-id'] || req.query.deviceId;

    if (!deviceId) {
        return res.status(400).json({
            error: "Device ID fehlt"
        });
    }

    loadConfig(deviceId)
        .then(config => {
            if (config.error) {
                return res.status(403).json({
                    error: config.error
                });
            }
            req.deviceId = deviceId;
            req.config = config;
            next();
        })
        .catch(error => {
            console.error('Config-Load Fehler:', error);
            res.status(500).json({
                error: "Fehler beim Laden der Gerätekonfiguration"
            });
        });
}

export function requireRegisteredDevice(req, res, next) {
    const deviceId = req.params.deviceId || req.headers['x-device-id'] || req.query.deviceId;

    if (!deviceId) {
        return res.status(400).json({
            error: "Device ID fehlt. Bitte als URL-Parameter, Query-Parameter oder Header 'x-device-id' senden."
        });
    }

    isDeviceRegistered(deviceId)
        .then(isRegistered => {
            if (!isRegistered) {
                return res.status(403).json({
                    error: `Gerät ${deviceId} ist nicht registriert`
                });
            }
            req.deviceId = deviceId;
            next();
        })
        .catch(error => {
            console.error('Device-Registration-Check Fehler:', error);
            res.status(500).json({
                error: "Fehler beim Prüfen der Geräteregistrierung"
            });
        });
}

export async function isDeviceRegistered(deviceId) {
    const cacheKey = `exists:${deviceId}`;

    // 1. Redis Cache check
    const cachedResult = await getCached(cacheKey);
    if (cachedResult !== null) {
        return cachedResult;
    }

    // 2. Request-lokaler Cache check (Fallback)
    if (requestCache.has(cacheKey)) {
        return requestCache.get(cacheKey);
    }

    try {
        const database = await getDatabase();
        const deviceConfigurations = database.collection("deviceConfigurations");

        const exists = await deviceConfigurations.countDocuments({ deviceId }, { limit: 1 });
        const result = exists > 0;

        // In beiden Caches speichern
        await setCached(cacheKey, result, 300); // 5 Minuten Redis Cache
        requestCache.set(cacheKey, result);

        return result;
    } catch (error) {
        console.error('Device-Registration-Check Fehler:', error);
        return false;
    }
}

export async function loadConfig(deviceId) {
    const cacheKey = `config:${deviceId}`;

    // 1. Redis Cache check
    const cachedConfig = await getCached(cacheKey);
    if (cachedConfig) {
        console.log("Redis-cached config used for deviceId:", deviceId);
        return cachedConfig;
    }

    // 2. Request-lokaler Cache check (Fallback)
    if (requestCache.has(deviceId)) {
        console.log(" Request-cached config used for deviceId:", deviceId);
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
