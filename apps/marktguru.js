import { apiUrls } from "../apiUrls.js";
import { cached } from '../cacheDecorator.js';
const re = /<script\stype="application\/json">([\s\S]*?)<\/script>/g;


async function getKeys() {
    try {
        const resp = await fetch(apiUrls.marktGuruBaseUrl);
        const text = await resp.text();
        const matches = [...text.matchAll(re)];
        const configStr = matches.length ? matches[matches.length - 1][1] : '';
        if (configStr) {
            const marktguruConfig = JSON.parse(configStr);
            const config = marktguruConfig.config || {};
            const apiKey = config.apiKey;
            const clientKey = config.clientKey;
            if (apiKey && clientKey) {
                return { apiKey, clientKey };
            } else {
                throw new Error('Could not parse remote data');
            }
        } else {
            throw new Error('No remote data');
        }
    } catch (error) {
        throw new Error('Fehler beim Abrufen oder Parsen: ' + error.message);
    }
}

async function getClient() {
    const keys = await getKeys();
    const headers = {
        'x-apikey': keys.apiKey,
        'x-clientkey': keys.clientKey
    };
    const baseUrl = apiUrls.marktGuruApiUrl;
    // Gibt ein Objekt zurück, das für API-Requests genutzt werden kann
    return {
        baseUrl,
        headers
    };
}

async function search(query = '', options = {}) {
    const defaultOptions = {
        limit: 1000,
        offset: 0,
        zipCode: 60487
    };
    const opts = { ...defaultOptions, ...options };
    const client = await getClient();
    const params = new URLSearchParams({
        as: 'web',
        q: query,
        ...opts
    });
    const url = apiUrls.marktGuruSearchUrl(params.toString());;
    const response = await fetch(url, {
        method: 'GET',
        headers: client.headers,
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    let offers = data.results || [];
    const allowedRetailers = opts.allowedRetailers;
    if (allowedRetailers) {
        offers = offers.filter(offer => {
            const advertisers = offer.advertisers || [];
            return advertisers.some(ad => allowedRetailers.includes(ad.uniqueName));
        });
    }
    return offers;
}

export async function searchByConfig(config) {
    const query = config.keyWord || 'coca-cola';
    const zipCode = config.zipCode || '60487';
    let retailers = config.retailers;
    if (typeof retailers === 'string') retailers = [retailers];
    if (!Array.isArray(retailers)) retailers = [];
    const options = {
        zipCode,
        allowedRetailers: retailers.length > 0 ? retailers : undefined
    };
    const results = await search(query, options);

    const response = [];
    const seenKeys = new Set();
    for (const result of results) {
        const name = `${result.product?.name} - ${result.brand?.name}` || 'Unbekannt';
        const price = result.price || 0.0;
        const retailer = result.advertisers?.[0]?.name || 'Unbekannt';
        const description = result.description || '';
        const key = `${name}|${price}|${retailer}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            response.push({
                name,
                price,
                retailer,
                description,
                keyword: query,
                url: `${apiUrls.marktGuruBaseUrl}/offers/${result.id}`
            });
        }
    }
    return response;
}



export function mapByRetailers(offers) {
    const grouped = {};
    for (const offer of offers) {
        // INFO we shorten the retailer name to avoid too long keys
        // in general, we can split by space and take the first part as it is usually the most relevant
        const retailer = offer.retailer.split(" ")[0] || 'Unbekannt';
        if (!grouped[retailer]) {
            grouped[retailer] = [];
        }
        grouped[retailer].push(offer);
    }

    for (const retailer in grouped) {
        grouped[retailer].sort((a, b) => {
            a.keyword.localeCompare(b.keyword)
        })
    }


    Object.keys(grouped).forEach(retailer => {
        grouped[retailer] = removeDuplicates(grouped[retailer]);
    });
    return grouped;
}

function removeDuplicates(offers) {
    const uniqueOffers = {};
    offers.forEach(offer => {
        const key = offer.name;
        if (!uniqueOffers[key] || offer.price < uniqueOffers[key].price) {
            uniqueOffers[key] = offer;
        }
    });
    return Object.values(uniqueOffers);
}

async function _getOffersFromConfig(config) {
    const { offers: options = {} } = config;
    const { searchKeywords: keyWords = [], retailers = [] } = options;
    const zipCode = (config.location && config.location.zipCode) || '60487';

    let offersResults = await Promise.all(keyWords.map(async keyWord => {
        const offers = await searchByConfig({ keyWord, retailers, zipCode });
        return offers;
    }));

    offersResults = mapByRetailers(offersResults.flat());
    return offersResults;
}


export const getOffersFromConfig = cached(6000)(_getOffersFromConfig);