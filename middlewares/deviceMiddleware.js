
import { getCached, setCached } from "../clients/redisClient.js";
import { getDatabase } from "../clients/mongoClient.js";
import { loadConfig } from "../configLoader.js";


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
