
// Holt aktuelle Wetterdaten von Open-Meteo für eine bestimmte Koordinate
export async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Wetterdaten: ${response.status}`);
    }
    const data = await response.json();
    return data.current;
}

// Bewertet, ob das Wetter angenehm zum Fahrradfahren ist
export function isBikeWeather(weather) {
    if (!weather) return false;
    const temp = weather.temperature;
    const wind = weather.windspeed;
    const rain = weather.precipitation || 0;
    // Beispiel-Bewertung: angenehm zwischen 10-28°C, wenig Wind, kein Regen
    return temp >= 10 && temp <= 28 && wind < 30 && rain < 1;
}

// Gibt eine Bewertung als Text zurück
export function bikeWeatherText(weather) {
    if (!weather) return "Keine Wetterdaten verfügbar.";
    if (isBikeWeather(weather)) {
        return `Gutes Wetter zum Fahrradfahren: ${weather.temperature}°C, Wind ${weather.windspeed} km/h.`;
    } else {
        return `Nicht optimal zum Fahrradfahren: ${weather.temperature}°C, Wind ${weather.windspeed} km/h.`;
    }
}

