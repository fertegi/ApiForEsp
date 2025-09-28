import { MongoClient, ServerApiVersion } from "mongodb";
import { apiUrls } from "./apiUrls.js";
import NodeCache from 'node-cache';

const client = new MongoClient(apiUrls.mongoDBUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const configCache = new NodeCache({ stdTTL: 600, checkperiod: 60 }); // Cache mit 10 Minuten TTL


export function invalidateConfigCache(deviceId) {
    configCache.del(deviceId);
}


export async function loadConfig(deviceId) {
    const cachedConfig = configCache.get(deviceId);
    if (cachedConfig) {
        return cachedConfig;
    }
    try {
        await client.connect();
        const database = client.db("ApiForEsp");
        const deviceConfigurations = database.collection("deviceConfigurations");
        const deviceConfiguration = await deviceConfigurations.findOne({ deviceId: deviceId });
        if (!deviceConfiguration) {
            const errorConfig = { error: `Keine Konfiguration für Gerät mit ID ${deviceId} gefunden.` };
            configCache.set(deviceId, errorConfig);
            return errorConfig;
        }
        configCache.set(deviceId, deviceConfiguration);
        return deviceConfiguration;
    } catch (error) {
        const errorConfig = { error: `Fehler beim Laden der Konfiguration: ${error.message}` };
        configCache.set(deviceId, errorConfig);
        return errorConfig;
    } finally {
        await client.close();
    }
}