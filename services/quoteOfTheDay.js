import { apiUrls } from "../apiUrls.js";
import { deviceCached } from "../cacheDecorator.js";
import { getQuotesFromCache, saveQuotesToCache } from "../clients/mongoClient.js";

const TTL_QUOTE = 86400; // 24 Stunden Cache
const CHAR_LIMIT_QUOTE = 72;

const FALLBACK_QUOTE = {
    q: "Do what you can, with what you have.",
    a: "Theodore Roosevelt"
}
async function refreshQuoteCache() {
    const url = apiUrls.quoteOfTheDayApiUrl();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen des Zitats: ${response.status}`);
    }
    const data = await response.json();

    if (!data || !Array.isArray(data)) {
        console.log("Ungültige Antwort vom Zitat-API:", data);
        throw new Error("Ungültige Antwort vom Zitat-API");
    }

    const shortQuotes = data.filter(quoteObj => quoteObj["q"] && quoteObj["c"] <= CHAR_LIMIT_QUOTE);
    if (shortQuotes.length === 0) {
        throw new Error("Kein kurzes Zitat im Antwortsatz gefunden");
    }

    await saveQuotesToCache(shortQuotes, TTL_QUOTE);

    return shortQuotes;
}

function selectDailyQuote(quotes) {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const index = dayOfYear % quotes.length;
    return [quotes[index]];
}


export async function getQuoteOfTheDay() {
    try {
        const cache = await getQuotesFromCache();
        const now = new Date();
        const needsRefresh = !cache || !cache.quotes || cache.quotes.length === 0 ||
            new Date(cache.expiresAt) < now;

        let quotes;

        if (needsRefresh) {
            console.log("Zitat-Cache wird aktualisiert...");
            try {
                quotes = await refreshQuoteCache();
            } catch (error) {
                console.error("Fehler beim Aktualisieren des Zitat-Caches:", error);
                if (cache?.quotes?.length > 0) {
                    console.log("Verwende alten Cache trotz Fehler beim Aktualisieren.");
                    quotes = cache.quotes;
                } else {
                    // Wenn kein Cache vorhanden ist, fallback zum Standardzitat
                    console.log("Kein Cache vorhanden, verwende Fallback-Zitat.");
                    return FALLBACK_QUOTE;
                }
            }
        } else {
            quotes = cache.quotes;
        }
        return selectDailyQuote(quotes);
    } catch (error) {
        console.error("Unbehandelter Fehler beim Abrufen des Zitats:", error);
        return FALLBACK_QUOTE;
    }
}
