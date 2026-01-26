import { getDeviceConfiguaration, updateDeviceConfiguration } from "../clients/mongoClient.js";
import { invalidateDeviceCache } from "../configLoader.js";
import { getCoordinatesForZipCode } from "../services/zipCodeService.js";
import { deviceConfigSchema } from "../deviceConfigSchema.js";


const TimeUtils = {
    MS_PER_SECOND: 1000,
    MS_PER_MINUTE: 60 * 1000,
    MS_PER_HOUR: 60 * 60 * 1000,

    msToHours: (ms) => Math.floor(ms / TimeUtils.MS_PER_HOUR),
    msToSeconds: (ms) => Math.floor(ms / TimeUtils.MS_PER_SECOND),
    msToMinutes: (ms) => Math.floor(ms / TimeUtils.MS_PER_MINUTE),

    hoursToMs: (h) => h * TimeUtils.MS_PER_HOUR,
    minutesToMs: (m) => m * TimeUtils.MS_PER_MINUTE,
    secondsToMs: (s) => s * TimeUtils.MS_PER_SECOND,
};

// Validierungsfunktionen
function validateLocation(location) {
    const errors = [];
    if (location.zipCode && (typeof location.zipCode !== 'string' || location.zipCode.length !== 5)) {
        errors.push('PLZ muss 5 Zeichen haben');
    }
    if (location.latitude !== undefined) {
        const lat = parseFloat(location.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            errors.push('Breitengrad muss zwischen -90 und 90 liegen');
        }
    }
    if (location.longitude !== undefined) {
        const lng = parseFloat(location.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
            errors.push('Längengrad muss zwischen -180 und 180 liegen');
        }
    }
    return errors;
}

function validateWeather(weather) {
    const errors = [];
    if (weather.hourThreshold !== undefined) {
        const threshold = parseInt(weather.hourThreshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 100) {
            errors.push('Stunden-Schwellwert muss zwischen 0 und 100 liegen');
        }
    }
    if (weather.hoursToForecast) {
        for (const hour of weather.hoursToForecast) {
            const h = parseInt(hour);
            if (isNaN(h) || h < 0 || h > 23) {
                errors.push('Vorhersage-Stunden müssen zwischen 0 und 23 liegen');
                break;
            }
        }
    }
    return errors;
}

function validateIntervals(intervals) {
    const errors = [];
    for (const [key, value] of Object.entries(intervals)) {
        const num = parseInt(value);
        if (isNaN(num) || num < 1000) {
            errors.push(`Intervall ${key} muss mindestens 1000ms sein`);
        }
    }
    return errors;
}

export function setupUserRoutes(app) {

    app.get("/user", (req, res) => {
        res.send("User endpoint is working");
    });

    app.get("/user/profile", (req, res) => {
        const user = req.user;

        if (!user) {
            return res.redirect('/user/login');
        }

        res.render("users/profile", {
            user: user,
            status: "Top"
        });
    });

    // Schema für dynamische Felder importieren
    app.get("/user/setDeviceConfiguration", async (req, res) => {
        const user = req.user;

        if (!user) {
            return res.redirect('/user/login');
        }

        // Sicherstellen, dass belongs ein Array ist
        const deviceIds = user.belongs || [];

        const deviceConfigurations = deviceIds.map(async (deviceId) => {
            const config = await getDeviceConfiguaration(deviceId);
            return {
                deviceId,
                config
            };
        });
        const configurations = await Promise.all(deviceConfigurations);

        // Flash-Message aus Cookie lesen und löschen
        const flashMessage = req.cookies.flash;
        if (flashMessage) {
            res.clearCookie('flash');
        }

        return res.render("users/setDeviceConfiguration", {
            user: user,
            configurations: configurations,
            deviceConfigSchema: deviceConfigSchema,
            flash: flashMessage ? JSON.parse(flashMessage) : null
        });
    });

    app.post("/user/setDeviceConfiguration", async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.redirect('/user/login');
        }

        let configObj = {};
        let deviceId = req.body.deviceId;
        try {
            if (req.body.configJson) {
                configObj = JSON.parse(req.body.configJson);
                deviceId = configObj.deviceId || deviceId;
            }
        } catch (e) {
            res.cookie('flash', JSON.stringify({ type: 'error', message: 'Ungültige Konfigurationsdaten.' }));
            return res.redirect('/user/setDeviceConfiguration');
        }

        // Berechtigungsprüfung
        const userDevices = user.belongs || [];
        if (!userDevices.includes(deviceId)) {
            res.cookie('flash', JSON.stringify({ type: 'error', message: 'Keine Berechtigung für dieses Gerät' }));
            return res.redirect('/user/setDeviceConfiguration');
        }

        // Validierung und ggf. Koordinaten-Lookup für location
        const errors = [];
        if (configObj.location && configObj.location.zipCode) {
            let latitude = parseFloat(configObj.location.latitude);
            let longitude = parseFloat(configObj.location.longitude);
            if (isNaN(latitude) || isNaN(longitude)) {
                const coords = getCoordinatesForZipCode(configObj.location.zipCode);
                if (coords) {
                    latitude = coords.latitude;
                    longitude = coords.longitude;
                } else {
                    errors.push('PLZ nicht gefunden - bitte gültige deutsche PLZ eingeben');
                }
            }
            configObj.location.latitude = latitude;
            configObj.location.longitude = longitude;
            errors.push(...validateLocation(configObj.location));
        }
        if (configObj.weather) {
            errors.push(...validateWeather(configObj.weather));
        }
        if (configObj.deviceConfiguration && configObj.deviceConfiguration.intervals) {
            errors.push(...validateIntervals(configObj.deviceConfiguration.intervals));
        }

        if (errors.length > 0) {
            res.cookie('flash', JSON.stringify({ type: 'error', message: errors.join(', ') }));
            return res.redirect('/user/setDeviceConfiguration');
        }

        try {
            await updateDeviceConfiguration(deviceId, configObj);
            await invalidateDeviceCache(deviceId);
            res.cookie('flash', JSON.stringify({ type: 'success', message: 'Konfiguration erfolgreich gespeichert!' }));
            return res.redirect('/user/setDeviceConfiguration');
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            res.cookie('flash', JSON.stringify({ type: 'error', message: 'Fehler beim Speichern der Konfiguration' }));
            return res.redirect('/user/setDeviceConfiguration');
        }
    });

}