import { getDatabase } from "./clients/mongoClient.js";
import { getCached, setCached, deleteCached } from "./clients/cacheClient.js";

const TTL_SECONDS_CONFIG = 6000; // 100 Minuten

export async function invalidateDeviceCache(deviceId) {
    // MongoDB Cache löschen
    await deleteCached(`config:${deviceId}`);
    await deleteCached(`exists:${deviceId}`);
}

export async function loadConfig(deviceId) {
    const cacheKey = `config:${deviceId}`;

    // 1. MongoDB Cache check
    const cachedConfig = await getCached(cacheKey);
    if (cachedConfig) {
        return cachedConfig;
    }

    try {
        const database = await getDatabase();
        const deviceConfigurations = database.collection("deviceConfigurations");
        const deviceConfiguration = await deviceConfigurations.findOne({ deviceId });

        if (!deviceConfiguration) {
            const errorConfig = { error: `Keine Konfiguration für Gerät mit ID ${deviceId} gefunden.` };

            // Fehler auch cachen (kurze TTL)
            await setCached(cacheKey, errorConfig, 60); // 1 Minute

            return errorConfig;
        }

        // Erfolgreiche Config cachen
        await setCached(cacheKey, deviceConfiguration, TTL_SECONDS_CONFIG);

        return deviceConfiguration;
    } catch (error) {
        return { error: `Fehler beim Laden der Konfiguration: ${error.message}` };
    }
}
