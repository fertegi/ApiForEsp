import { getDeviceConfiguaration, updateDeviceConfiguration } from "../clients/mongoClient.js";
import { invalidateDeviceCache } from "../configLoader.js";
import { getCoordinatesForZipCode } from "../services/zipCodeService.js";

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
            flash: flashMessage ? JSON.parse(flashMessage) : null
        });
    });

    app.post("/user/setDeviceConfiguration", async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.redirect('/user/login');
        }

        const { deviceId } = req.body;

        // Berechtigungsprüfung
        const userDevices = user.belongs || [];
        if (!userDevices.includes(deviceId)) {
            res.cookie('flash', JSON.stringify({ type: 'error', message: 'Keine Berechtigung für dieses Gerät' }));
            return res.redirect('/user/setDeviceConfiguration');
        }

        // Daten aus dem Formular extrahieren und validieren
        const errors = [];
        const updateData = {};

        // Location - Koordinaten automatisch aus PLZ ermitteln wenn nur PLZ angegeben
        if (req.body.zipCode) {
            let latitude = parseFloat(req.body.latitude);
            let longitude = parseFloat(req.body.longitude);

            // Wenn Koordinaten fehlen oder ungültig, aus PLZ ermitteln
            if (isNaN(latitude) || isNaN(longitude)) {
                const coords = getCoordinatesForZipCode(req.body.zipCode);
                if (coords) {
                    latitude = coords.latitude;
                    longitude = coords.longitude;
                } else {
                    errors.push('PLZ nicht gefunden - bitte gültige deutsche PLZ eingeben');
                }
            }

            const location = {
                zipCode: req.body.zipCode,
                latitude: latitude,
                longitude: longitude
            };

            errors.push(...validateLocation(location));
            updateData.location = location;
        }

        // Weather
        if (req.body.hourThreshold || req.body.hour1 || req.body.hour2 || req.body.hour3) {
            const weather = {
                hourThreshold: parseInt(req.body.hourThreshold),
                hoursToForecast: [
                    parseInt(req.body.hour1),
                    parseInt(req.body.hour2),
                    parseInt(req.body.hour3)
                ].filter(h => !isNaN(h))
            };
            errors.push(...validateWeather(weather));
            updateData.weather = weather;
        }

        // Intervals
        if (req.body.intervalWeather || req.body.intervalOffers || req.body.intervalDepartures) {
            const intervals = {
                weather: parseInt(req.body.intervalWeather),
                offers: parseInt(req.body.intervalOffers),
                departures: parseInt(req.body.intervalDepartures)
            };
            errors.push(...validateIntervals(intervals));
            updateData['deviceConfiguration.intervals'] = intervals;
        }

        // Features (Checkboxen)
        updateData['deviceConfiguration.features'] = {
            weather: req.body.featureWeather === 'on',
            offers: req.body.featureOffers === 'on',
            departures: req.body.featureDepartures === 'on'
        };

        // Bei Validierungsfehlern zurück
        if (errors.length > 0) {
            res.cookie('flash', JSON.stringify({ type: 'error', message: errors.join(', ') }));
            return res.redirect('/user/setDeviceConfiguration');
        }

        try {
            // Update in MongoDB
            await updateDeviceConfiguration(deviceId, updateData);

            // Cache invalidieren
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