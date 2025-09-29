import express from 'express';
import { mapByRetailers, searchByConfig } from './marktguru.js';
import { getAllDepartures } from './bvg.js';
import { fetchWeather } from './weather.js';
import { loadConfig } from './configLoader.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/config', async (req, res) => {
    const deviceId = req.query.deviceId || 'defaultDevice';
    if (!deviceId) {
        return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
    }
    const config = await loadConfig(deviceId);
    res.json(config.deviceConfiguration || {});
});


app.get("/api/marktguru", async (req, res) => {
    try {
        const deviceId = req.query.deviceId || 'defaultDevice';
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }

        const config = await loadConfig(deviceId);
        if (config.error) {
            return res.status(500).json(config);
        }

        const { marktguru: options = {} } = config;
        const { searchKeywords: keyWords = [], retailers = [] } = options;
        const zipCode = (config.location && config.location.zipCode) || '60487';

        let offersResults = await Promise.all(keyWords.map(async keyWord => {
            const offers = await searchByConfig({ keyWord, retailers, zipCode });
            console.log(`Ergebnisse für ${keyWord}:`, offers.length);
            return offers;
        }));

        offersResults = mapByRetailers(offersResults.flat());
        console.log(`Anzahl der Angebote insgesamt: ${offersResults.length}`);


        res.json(offersResults);
    } catch (error) {
        console.error('Fehler beim Abrufen der Ergebnisse:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Ergebnisse.' });
    }
});

app.get("/api/bvg", async (req, res) => {
    try {
        const deviceId = req.query.deviceId || 'defaultDevice';
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }

        const config = await loadConfig(deviceId);
        if (config.error) {
            return res.status(500).json(config);
        }


        const stops = config.bvg.stops || [];
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
        const deviceId = req.query.deviceId || 'defaultDevice';
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }

        const config = await loadConfig(deviceId);
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

app.get('/api/time', (req, res) => {
    res.json({ time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
