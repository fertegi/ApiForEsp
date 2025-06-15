import { config } from "./config.js";

// Holt aktuelle Wetterdaten von Open-Meteo für eine bestimmte Koordinate
export async function fetchWeather(lat, lon) {
    const hoursToForecast = [9, 15, 20];
    // keys to call 
    // temperature_2m, relative_humidity_2m, weather_code,
    // precipitation_probability, precipitation, weather_code,
    // wind_speed_10m, wind_direction_10m, 
    // apparent_temperature
    const url = config.weatherApiUrl(lat, lon);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Wetterdaten: ${response.status}`);
    }
    const data = await response.json();
    const hourlyData = data.hourly;
    const times = hourlyData.time || [];
    const temperatures = hourlyData.temperature_2m || [];
    const windDirections = hourlyData.wind_direction_10m || [];
    const windSpeeds = hourlyData.wind_speed_10m || [];
    const weatherCodes = hourlyData.weather_code || [];
    const precipitation = hourlyData.precipitation || [];
    const precipitationProbability = hourlyData.precipitation_probability || [];
    const humidity = hourlyData.relative_humidity_2m || [];
    const apparentTemperatures = hourlyData.apparent_temperature || [];


    const filteredData = times.map((time, index) => {
        const hour = new Date(time).getHours();
        if (hoursToForecast.includes(hour)) {
            return {
                time: time,
                temperature: temperatures[index],
                windDirection: windDirections[index],
                windSpeed: windSpeeds[index],
                weatherCode: weatherCodes[index],
                precipitation: precipitation[index],
                precipitationProbability: precipitationProbability[index],
                humidity: humidity[index],
                apparentTemperature: apparentTemperatures[index],
            }
        }
        return null;
    }).filter(item => item !== null);

    return enrichWeatherData(filteredData);
}



export function enrichWeatherData(weatherData) {
    // Fügt zusätzliche Informationen zu den Wetterdaten hinzu
    return weatherData.map(data => {
        const { temperature, windSpeed, precipitation, humidity } = data;
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
