import { apiUrls } from "../apiUrls.js";
import { deviceCached } from '../cacheDecorator.js';
import { fetchRssFeed } from './rss_feed.js';


const TTL_NEWS = 3600; // 1 Stunde Cache
const LANGUAGES = ['de', 'en'];
const PAGE_SIZE = 10;


async function fetchNewsFromApi(keywords = [], languages = LANGUAGES, pageSize = PAGE_SIZE) {

    const params = new URLSearchParams();
    if (keywords.length > 0) {
        params.append('q', keywords.join(' OR '));
    }
    params.append('language', languages.join(','));
    params.append('size', pageSize.toString());
    const url = `${apiUrls.newsOfTheDayApiUrl()}&${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Nachrichten: ${response.status}`);
    }
    const data = await response.json();

    if (!data || !data.results || !Array.isArray(data.results)) {
        console.log("Ungültige Antwort von der News-API:", data);
        throw new Error("Ungültige Antwort von der News-API");
    }

    const items = data.results.map(item => ({
        title: item.title,
        link: item.link,
        creator: item.source_name,
        pubDate: item.pubDate,
        description: item.description
    }));
    return items;
}


async function _getNewsOfTheDay(config = {}) {
    const newsConfig = config?.newsOfTheDay || config;

    // Check if user provided a custom RSS feed URL
    if (newsConfig.rssFeedUrl) {
        // Use RSS feed instead of the news API
        return await fetchRssFeed(newsConfig.rssFeedUrl);
    }
    
    // Otherwise, use the default news API
    const keywords = Array.isArray(newsConfig.keywords) ? newsConfig.keywords : [];
    const languages = Array.isArray(newsConfig.languages) && newsConfig.languages.length > 0
        ? newsConfig.languages
        : LANGUAGES;
    const pageSize = newsConfig.pageSize || PAGE_SIZE;
    return await fetchNewsFromApi(keywords, languages, pageSize);
}

export const getNewsOfTheDay = deviceCached(TTL_NEWS)(_getNewsOfTheDay);