import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Setup der API-Route für PLZ-Lookup
 */
export function setupUtilRoutes(app) {
    // Einzelne PLZ abfragen
    app.get('/utils/zipCode/:zipCode', (req, res) => {
        const { zipCode } = req.params;

        if (!zipCode || zipCode.length !== 5) {
            return res.status(400).json({ error: 'PLZ muss 5 Zeichen haben' });
        }

        const coordinates = getCoordinatesForZipCode(zipCode);

        if (!coordinates) {
            return res.status(404).json({ error: 'PLZ nicht gefunden' });
        }

        res.json({
            zipCode,
            ...coordinates
        });
    });

    // PLZ validieren (für schnelle Checks)
    app.get('/utils/zipCode/:zipCode/valid', (req, res) => {
        const { zipCode } = req.params;
        res.json({ valid: isValidZipCode(zipCode) });
    });
}
