export const apiUrls = {
    mongoDBUri: "mongodb+srv://admin:YKfELCixHXXyYRTR@cluster0.oy8azgp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    weatherApiUrl: (lat, lon) => { return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature&forecast_days=1`; },
    marktGuruBaseUrl: "http://marktguru.de",
    marktGuruApiUrl: "https://api.marktguru.de/api/v1",
    marktGuruSearchUrl: function (params) {
        return `${this.marktGuruApiUrl}/offers/search/?${params.toString()}`
    }
}