import { apiUrls } from "../apiUrls.js";
import { deviceCached } from "../cacheDecorator.js";

const TTL_QUOTE = 86400; // 24 Stunden Cache


export async function _getQuoteOfTheDay(options = {}) {
    const url = apiUrls.quoteOfTheDayApiUrl(options);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen des Zitats: ${response.status}`);
    }
    const data = await response.json();
    console.log("Daten abgerufen:", data);
    if (!data || !Array.isArray(data) || data.length === 0 || !data[0]["q"]) {
        console.log("Ungültige Antwort vom Zitat-API:", data);
        throw new Error("Ungültige Antwort vom Zitat-API");
    }
    const quoteOfTheDay = data[0];
    const quote = quoteOfTheDay["q"];

    if (quote.length > 72) {
        console.log("Zitat zu lang, erneuter Versuch...");
        return _getQuoteOfTheDay(options);
    }
    return quoteOfTheDay;
}

export const getQuoteOfTheDay = deviceCached(TTL_QUOTE)(_getQuoteOfTheDay);