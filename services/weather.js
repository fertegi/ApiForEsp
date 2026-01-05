import { apiUrls } from "../apiUrls.js";
import { deviceCached } from "../cacheDecorator.js";

// Konstanten für Fallback-Werte
const DEFAULT_HOURS_TO_FORECAST = [9, 12, 18];
const DEFAULT_HOUR_THRESHOLD = 20;
const TTL_WEATHER = 3600; // 1 Stunde Cache

// Bestimmt das Zieldatum basierend auf aktueller Stunde und Threshold
export function getTargetDate(currentHour, threshold = DEFAULT_HOUR_THRESHOLD) {
    const now = new Date();
    if (currentHour >= threshold) {
        // Nach Threshold: morgen
        now.setDate(now.getDate() + 1);
    }
    return now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

// Generischer API-Call für Wetterdaten
export async function fetchWeatherRaw(lat, lon, options = {}) {
    const url = apiUrls.weatherApiUrl(lat, lon, options);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Wetterdaten: ${response.status}`);
    }
    return response.json();
}

// Parst die hourly-Daten aus der API-Response
export function parseHourlyData(apiResponse) {
    const hourlyData = apiResponse.hourly || {};
    const times = hourlyData.time || [];
    const temperatures = hourlyData.temperature_2m || [];
    const windDirections = hourlyData.wind_direction_10m || [];
    const windSpeeds = hourlyData.wind_speed_10m || [];
    const weatherCode = hourlyData.weather_code || [];
    const precipitation = hourlyData.precipitation || [];
    const precipitationProbability = hourlyData.precipitation_probability || [];
    const humidity = hourlyData.relative_humidity_2m || [];
    const apparentTemperatures = hourlyData.apparent_temperature || [];

    return times.map((time, index) => ({
        time,
        hour: new Date(time).getHours(),
        date: time.split('T')[0],
        temperature: temperatures[index],
        windDirection: windDirections[index],
        windSpeed: windSpeeds[index],
        weatherCode: weatherCode[index],
        precipitation: precipitation[index],
        precipitationProbability: precipitationProbability[index],
        humidity: humidity[index],
        apparentTemperature: apparentTemperatures[index],
    }));
}

// Parst die current-Daten aus der API-Response
export function parseCurrentData(apiResponse) {
    const current = apiResponse.current || {};
    return {
        time: new Date().getHours(),
        temperature: current.temperature_2m,
        windDirection: current.wind_direction_10m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        precipitation: current.precipitation,
        humidity: current.relative_humidity_2m,
        apparentTemperature: current.apparent_temperature,
    };
}

// Filtert Daten nach gewünschten Stunden und Datum
export function filterByHours(data, hours, targetDate) {
    return data.filter(item =>
        hours.includes(item.hour) && item.date === targetDate
    ).map(item => ({
        time: item.hour,
        temperature: item.temperature,
        windDirection: item.windDirection,
        windSpeed: item.windSpeed,
        weatherCode: item.weatherCode,
        precipitation: item.precipitation,
        precipitationProbability: item.precipitationProbability,
        humidity: item.humidity,
        apparentTemperature: item.apparentTemperature,
    }));
}

// Private Hauptfunktion - erhält config als erstes Argument
async function _getWeatherData(config) {
    const { location = {}, weather = {} } = config;
    const { latitude, longitude } = location;

    if (!latitude || !longitude) {
        throw new Error('Standortkoordinaten fehlen in der Konfiguration.');
    }

    // Konfiguration aus config mit Fallbacks
    const hoursToForecast = weather.hoursToForecast || DEFAULT_HOURS_TO_FORECAST;
    const hourThreshold = weather.hourThreshold || DEFAULT_HOUR_THRESHOLD;

    const currentHour = new Date().getHours();
    const targetDate = getTargetDate(currentHour, hourThreshold);

    const rawData = await fetchWeatherRaw(latitude, longitude, { forecastDays: 2 });

    // Current-Daten parsen und enrichen
    const currentData = parseCurrentData(rawData);
    const enrichedCurrent = enrichWeatherData([currentData])[0];

    // Forecast-Daten parsen, filtern und enrichen
    const parsedData = parseHourlyData(rawData);
    const filteredData = filterByHours(parsedData, hoursToForecast, targetDate);
    const enrichedForecast = enrichWeatherData(filteredData);

    return {
        current: enrichedCurrent,
        dayForecast: enrichedForecast
    };
}

// Exportierte, gecachte Version
export const getWeatherData = deviceCached(TTL_WEATHER)(_getWeatherData);


export function enrichWeatherData(weatherData) {
    // Fügt zusätzliche Informationen zu den Wetterdaten hinzu
    return weatherData.map(data => {
        const { windSpeed } = data;
        const windSpeedKnoten = kmhToKnoten(windSpeed);
        const bikeWeather = isBikeWeather(data);
        return {
            ...data,
            windSpeedKnoten,
            bikeWeather,
        }
    });
}



export function kmhToKnoten(kmh) {
    // Konvertiert km/h in Knoten (1 Knoten = 1.852 km/h)
    return kmh / 1.852;
}

// Bewertet, ob das Wetter angenehm zum Fahrradfahren ist
export function isBikeWeather(weather) {
    if (!weather) return false;
    const { apparentTemperature, windSpeed, precipitationProbability } = weather;
    // Beispiel-Bewertung: angenehm zwischen 10-28°C, wenig Wind, kein Regen
    return apparentTemperature >= 10 && apparentTemperature <= 28 && windSpeed < 30 && precipitationProbability < 10;
}
