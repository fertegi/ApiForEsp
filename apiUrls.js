import { configDotenv } from 'dotenv';

configDotenv();

export const apiUrls = {
    mongoDBUri: process.env.MONGODB_URI || null,
    weatherApiUrl: (lat, lon, options = {}) => {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            hourly: 'temperature_2m,relative_humidity_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,apparent_temperature',
            current: 'temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m,wind_direction_10m,apparent_temperature',
            forecast_days: options.forecastDays || 2,
            timezone: 'Europe/Berlin'
        });
        if (options.startDate) params.append('start_date', options.startDate);
        if (options.endDate) params.append('end_date', options.endDate);
        return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    },
    marktGuruBaseUrl: "http://marktguru.de",
    marktGuruApiUrl: "https://api.marktguru.de/api/v1",
    marktGuruSearchUrl: function (params) {
        return `${this.marktGuruApiUrl}/offers/search/?${params.toString()}`
    },
    quoteOfTheDayApiUrl: (options = {}) => {
        return "https://zenquotes.io/api/quotes";
    },
    newsOftheDayApiUrl: (options = {}) => {
        return "https://newsdata.io/api/1/latest?apikey=" + (process.env.NEWS_API_KEY || '');
    }
}