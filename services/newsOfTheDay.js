import { apiUrls } from "../apiUrls.js";
import { deviceCached } from '../cacheDecorator.js';
import { fetchRssFeed } from './rss_feed.js';


const TTL_NEWS = 3600; // 1 Stunde Cache
const LANGUAGES = ['de', 'en'];
const PAGE_SIZE = 5;


async function fetchNewsFromApi(keywords = [], languages = LANGUAGES, pageSize = PAGE_SIZE) {

    let url = apiUrls.newsOftheDayApiUrl();
    if (keywords.length > 0) {
        const params = new URLSearchParams();
        params.append('q', keywords.join(' OR '));
        params.append('language', languages.join(','));
        params.append('size', pageSize.toString());
        url += '&' + params.toString();
    }
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


async function _getNewsOfTheDay(config) {
    // Check if user provided a custom RSS feed URL
    if (config.rssFeedUrl) {
        // Use RSS feed instead of the news API
        return await fetchRssFeed(config.rssFeedUrl);
    }
    
    // Otherwise, use the default news API
    const keywords = config.keywords || [];
    const languages = config.languages || LANGUAGES;
    const pageSize = config.pageSize || PAGE_SIZE;
    return await fetchNewsFromApi(keywords, languages, pageSize);
}

export const getNewsOfTheDay = deviceCached(TTL_NEWS)(_getNewsOfTheDay);