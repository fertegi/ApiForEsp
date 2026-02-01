import { deviceCached } from "../cacheDecorator.js";
import Parser from 'rss-parser';

const TTL_RSS = 3600; // 1 Stunde Cache
const parser = new Parser();

/**
 * Fetches and parses an RSS feed from the given URL
 * @param {string} rssFeedUrl - The URL of the RSS feed to fetch
 * @returns {Promise<Array>} Array of feed items with normalized structure
 */
async function _fetchRssFeed(rssFeedUrl) {
    if (!rssFeedUrl) {
        throw new Error("RSS Feed URL ist erforderlich");
    }
    
    try {
        const feed = await parser.parseURL(rssFeedUrl);
        
        // Normalize the RSS feed items to match the news structure
        return feed.items.map(item => ({
            title: item.title || '',
            link: item.link || '',
            creator: item.creator || item.author || feed.title || 'Unbekannt',
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            description: item.contentSnippet || item.content || item.description || ''
        }));
    } catch (error) {
        console.error(`Fehler beim Abrufen des RSS-Feeds von ${rssFeedUrl}:`, error);
        throw new Error(`Fehler beim Abrufen des RSS-Feeds: ${error.message}`);
    }
}

export const fetchRssFeed = deviceCached(TTL_RSS)(_fetchRssFeed);