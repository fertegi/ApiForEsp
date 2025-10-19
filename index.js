import express from 'express';
import { configDotenv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { isRedisHealthy } from './clients/redisClient.js';


import { requireRegisteredDevice, requireRegisteredDeviceWithConfig } from "./middlewares/deviceMiddleware.js"
import { sessionMiddleware } from './middlewares/sessionMiddleware.js';

import { getOffersFromConfig } from './services/marktguru.js';
import { getAllDepartures } from './services/bvg.js';
import { fetchWeather } from './services/weather.js';

import { setupUserRoutes } from "./user/userRoutes.js"
import { setupFirmwareRoutes } from './firmware/firmwareRoutes.js';
import { setupAuthRoutes } from './user/authRoutes.js';

configDotenv();


const app = express();
const PORT = process.env.PORT || 3000;

// __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use("/user/*splat", sessionMiddleware);
app.use("/api/firmware/*splat", requireRegisteredDevice);
app.use("/api/*splat", requireRegisteredDeviceWithConfig);

setupUserRoutes(app);
setupFirmwareRoutes(app);
setupAuthRoutes(app);


app.get("/", (req, res) => {
    res.redirect("/user/login");
});

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



app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
