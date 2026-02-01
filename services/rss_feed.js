import { deviceCached } from "../cacheDecorator.js";
import Parser from 'rss-parser';


// TODO: ermögliche es dem user bei newsOfTheDay eine RSS-Feed quelle anzugeben.
// dafür muss in der DB ein neues Feld für den user angelegt werden, das mache ich.
// momentan ist das hier hardcoded auf einen feed für Formel 1 Nachrichten als beispiel
// der user soll aber in der Lage sein, seinen eigenen feed anzugeben, unter setDeviceConfiguration.ejs
// für deviceConfiguarionSchema muss das URL Feld hinzugefügt werden.
let parser = new Parser();

const rss_url = "https://www.formel1.de/rss/formel-1/feed.xml";

async function fetchRssFeed() {
    const feed = await parser.parseURL(rss_url);
    return feed.items;
}

const data = await fetchRssFeed();
console.log(data[0]);