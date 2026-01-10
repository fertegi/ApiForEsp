import { apiUrls } from "../apiUrls.js";
import { deviceCached } from "../cacheDecorator.js";

const TTL_QUOTE = 86400; // 24 Stunden Cache


export async function _getQuoteOfTheDay(options = {}) {
    const url = apiUrls.quoteOfTheDayApiUrl(options);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen des Zitats: ${response.status}`);
    }
    return response.json();
}

export const getQuoteOfTheDay = deviceCached(TTL_QUOTE)(_getQuoteOfTheDay);