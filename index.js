import { configDotenv } from 'dotenv';
const res = configDotenv();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { isCacheHealthy, initCacheCollection } from './clients/cacheClient.js';
import cookieParser from 'cookie-parser';

import { requireRegisteredDevice, requireRegisteredDeviceWithConfig } from "./middlewares/deviceMiddleware.js"

import { getOffersFromConfig } from './services/marktguru.js';
import { getAllDepartures } from './services/bvg.js';
import { getWeatherData } from './services/weather.js';
import { getQuoteOfTheDay } from './services/quoteOfTheDay.js';
import { setupUserRoutes } from "./user/userRoutes.js"
import { setupFirmwareRoutes } from './firmware/firmwareRoutes.js';
import { setupAuthRoutes } from './user/authRoutes.js';
import { setupZipCodeRoutes } from './services/zipCodeService.js';
import { requireAuth } from './middlewares/authMiddleware.js';



const app = express();
const PORT = process.env.PORT || 3000;

// __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
console.log("Statischer Pfad:", path.join(__dirname, 'public'));
app.use("/user/profile", requireAuth);
app.use("/user/setDeviceConfiguration", requireAuth);
app.use("/user/offers", requireAuth);
app.use("/api/firmware/*splat", requireRegisteredDevice);
app.use("/api/*splat", requireRegisteredDeviceWithConfig);

setupUserRoutes(app);
setupFirmwareRoutes(app);
setupAuthRoutes(app);
setupZipCodeRoutes(app);


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
        const userLines = config.departures.userLines || [];
        const departures = await getAllDepartures(stops, userLines);
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

        const nextWeatherData = await getWeatherData(config);
        res.json(nextWeatherData);
    } catch (error) {
        console.error('Fehler beim Abrufen der Wetterdaten:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Wetterdaten.' });
    }
});


app.get("/api/quoteOfTheDay", async (req, res) => {
    try {
        const { deviceId, config } = req;
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }
        if (config.error) {
            return res.status(500).json(config);
        }
        // we expecting an array with one element
        const data = await getQuoteOfTheDay();
        const quoteOfTheDayData = data[0];
        res.json(quoteOfTheDayData);

    } catch (error) {
        console.error('Fehler beim Abrufen des Zitats:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des Zitats.' });
    }
});


// Debug-Endpoint außerhalb der Device-Middleware (kein /api/ Prefix)
app.get("/debug/cache", async (req, res) => {
    const cacheHealthy = await isCacheHealthy();

    res.json({
        cache: {
            healthy: cacheHealthy,
            type: 'mongodb'
        },
        timestamp: new Date().toISOString(),
        process: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        }
    });
});



app.listen(PORT, async () => {
    console.log(`Server läuft auf Port ${PORT}`);

    // MongoDB Cache Collection initialisieren (TTL-Index erstellen)
    await initCacheCollection();
});
