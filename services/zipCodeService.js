import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { withCache } from '../cacheDecorator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STOP_SEARCH_TTL = 60 * 60; // Haltestellennamen ändern sich praktisch nie
const STOP_SEARCH_TIMEOUT_MS = 5000;

// In-Memory Cache für PLZ-Daten
let zipCodeData = null;

/**
 * Lädt die PLZ-Daten aus der CSV-Datei (einmalig)
 */
function loadZipCodeData() {
    if (zipCodeData) {
        return zipCodeData;
    }

    try {
        const csvPath = join(__dirname, '..', 'public', 'zip_code_to_lat_long.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');

        zipCodeData = new Map();

        const lines = csvContent.split('\n');
        // Erste Zeile (Header) überspringen
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [zipcode, lat, lng] = line.split(',');
            if (zipcode && lat && lng) {
                zipCodeData.set(zipcode, {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng)
                });
            }
        }

        console.log(`PLZ-Daten geladen: ${zipCodeData.size} Einträge`);
        return zipCodeData;
    } catch (error) {
        console.error('Fehler beim Laden der PLZ-Daten:', error);
        return new Map();
    }
}

/**
 * Gibt Latitude und Longitude für eine PLZ zurück
 * @param {string} zipCode - Die Postleitzahl (5 Zeichen)
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function getCoordinatesForZipCode(zipCode) {
    const data = loadZipCodeData();
    return data.get(zipCode) || null;
}

/**
 * Prüft ob eine PLZ existiert
 * @param {string} zipCode - Die Postleitzahl
 * @returns {boolean}
 */
export function isValidZipCode(zipCode) {
    const data = loadZipCodeData();
    return data.has(zipCode);
}

/**
 * Gibt alle PLZ als Array zurück (für Autocomplete etc.)
 * @returns {string[]}
 */
export function getAllZipCodes() {
    const data = loadZipCodeData();
    return Array.from(data.keys());
}

/**
 * Fragt Haltestellen bei der VBB-API ab
 * @param {string} query - Normalisierter Suchbegriff
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function fetchStops(query) {
    const url = `https://v6.vbb.transport.rest/locations?query=${encodeURIComponent(query)}&fuzzy=true&results=10&stops=true&addresses=false&poi=false&linesOfStops=false&language=en`;
    const response = await fetch(url, { signal: AbortSignal.timeout(STOP_SEARCH_TIMEOUT_MS) });

    if (!response.ok) {
        throw new Error(`VBB-API antwortete mit ${response.status}`);
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : [])
        .filter(stop => stop?.id && stop?.name)
        .map(stop => ({ id: stop.id, name: stop.name }));
}

const fetchStopsCached = withCache(fetchStops, {
    ttl: STOP_SEARCH_TTL,
    prefix: 'stopSearch',
    keyGenerator: query => query
});

/**
 * Setup der API-Route für PLZ-Lookup
 */
export function setupUtilRoutes(app) {
    // // Einzelne PLZ abfragen
    // app.get('/utils/zipCode/:zipCode', (req, res) => {
    //     const { zipCode } = req.params;

    //     if (!zipCode || zipCode.length !== 5) {
    //         return res.status(400).json({ error: 'PLZ muss 5 Zeichen haben' });
    //     }

    //     const coordinates = getCoordinatesForZipCode(zipCode);

    //     if (!coordinates) {
    //         return res.status(404).json({ error: 'PLZ nicht gefunden' });
    //     }

    //     res.json({
    //         zipCode,
    //         ...coordinates
    //     });
    // });

    // // PLZ validieren (für schnelle Checks)
    // app.get('/utils/zipCode/:zipCode/valid', (req, res) => {
    //     const { zipCode } = req.params;
    //     res.json({ valid: isValidZipCode(zipCode) });
    // });

    app.get("/utils/stopIdSearch/:query", async (req, res) => {
        // Normalisiert, damit "Alex", "alex " und "ALEX" denselben Cache-Eintrag treffen
        const query = (req.params.query || '').trim().toLowerCase();

        if (query.length < 3) {
            return res.status(400).json({ error: 'Suchbegriff muss mindestens 3 Zeichen haben' });
        }

        try {
            const stops = await fetchStopsCached(query);
            res.set('Cache-Control', 'private, max-age=3600');
            res.json(stops);
        } catch (error) {
            console.error('Haltestellen-Suche fehlgeschlagen:', error);
            res.status(502).json({ error: 'Haltestellen-Suche momentan nicht verfügbar' });
        }
    });
}
