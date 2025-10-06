import express from 'express';
import { getOffersFromConfig } from './apps/marktguru.js';
import { getAllDepartures } from './apps/bvg.js';
import { fetchWeather } from './apps/weather.js';
import { requireRegisteredDevice, requireRegisteredDeviceWithConfig } from "./configLoader.js"
import { setupUserRoutes } from "./user/userRoutes.js"
import { setupFirmwareRoutes } from './firmware/firmwareRoutes.js';
import { configDotenv } from 'dotenv';
import { isRedisHealthy } from './clients/redisClient.js';

configDotenv();


const app = express();
const PORT = process.env.PORT || 3000;


app.use("/api/firmware/*splat", requireRegisteredDevice);
app.use("/api/*splat", requireRegisteredDeviceWithConfig);

app.get("/api", (req, res) => {
    res.send("API is working");
});

app.get('/api/config/', async (req, res) => {
    const { deviceId, config } = req;
    if (!deviceId || deviceId === 'defaultDevice') {
        return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
    }
    res.json(config.deviceConfiguration || {});
});


app.get("/api/offers", async (req, res) => {
    try {
        const { deviceId, config } = req;
        if (!deviceId || deviceId === 'defaultDevice') {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }
        if (config.error) {
            return res.status(500).json(config);
        }
        const offers = await getOffersFromConfig(config);
        if (!offers || offers.length === 0) {
            return res.status(404).json({ message: 'Keine Angebote in der Konfiguration gefunden.' });
        }
        res.json(offers);
    } catch (error) {
        console.error('Fehler beim Abrufen der Ergebnisse:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Ergebnisse.' });
    }
});

app.get("/api/departures", async (req, res) => {
    try {
        const { deviceId, config } = req;
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }
        if (config.error) {
            return res.status(500).json(config);
        }

        const stops = config.departures.stops || [];
        const departures = await getAllDepartures(stops);
        if (!departures || departures.length === 0) {
            return res.status(404).json({ message: 'Keine Abfahrten gefunden.' });
        }
        return res.json(departures);

    } catch (error) {
        console.error('Fehler beim Abrufen der BVG-Daten:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der BVG-Daten.' });
    }
});

app.get('/api/weather', async (req, res) => {
    try {
        const { deviceId, config } = req;
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }
        if (config.error) {
            return res.status(500).json(config);
        }

        const { location = {} } = config;
        const { latitude, longitude } = location;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Standortkoordinaten fehlen in der Konfiguration.' });
        }
        const weatherData = await fetchWeather(latitude, longitude);
        res.json(weatherData);
    } catch (error) {
        console.error('Fehler beim Abrufen der Wetterdaten:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Wetterdaten.' });
    }
});


// ...existing code...

app.get("/api/debug/cache", async (req, res) => {
    const redisHealthy = await isRedisHealthy();

    res.json({
        redis: {
            healthy: redisHealthy,
            enabled: !!process.env.UPSTASH_REDIS_REST_URL
        },
        timestamp: new Date().toISOString(),
        process: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        }
    });
});

setupUserRoutes(app);
setupFirmwareRoutes(app);

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
