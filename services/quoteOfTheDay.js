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
    console.log("Zitat des Tages abgerufen:", data);
    if (data[0]["q"].length() > 72) {
        console.log("Zitat zu lang, erneuter Versuch...");
        return _getQuoteOfTheDay(options);
    }
    return data[0];
}

export const getQuoteOfTheDay = deviceCached(TTL_QUOTE)(_getQuoteOfTheDay);