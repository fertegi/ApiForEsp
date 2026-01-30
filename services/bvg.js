import { parseTime, deltaFromNow } from "../util_time.js";
import { deviceCached } from "../cacheDecorator.js";


export async function fetchDepartures(stopId, duration = 10) {
    const res = await fetch(`https://v6.vbb.transport.rest/stops/${stopId}/departures?duration=${duration}`)
    const data = await res.json();
    return data.departures || [];
}


//  Hilfsfunktionen
// Die Funktion überprüft, ob die Abfahrtslinie in den Benutzereinstellungen enthalten ist
// userLines ist ein Array von Objekten mit möglichen Eigenschaften 'id' und 'name'
function isLineAllowed(departure, userLines) {
    if (!userLines || userLines.length === 0) return true;

    const lineInfo = departure.line || {};
    // const lineId = lineInfo.id || '';
    const name = lineInfo.name || 'No Name';

    return userLines.some(ul =>
        ul === name
    );
}

// Die Funktion erstellt einen Eintrag für eine Abfahrt
function createDepartureEntry(departure) {
    const lineInfo = departure.line || {};
    const name = lineInfo.name || 'No Name';
    const destination = (departure.destination && departure.destination.name) || 'No Destination';
    const when = parseTime(departure.when || '');

    if (!when) {
        console.log(`Could not parse time for departure: ${JSON.stringify(departure.when)}`);
        return null;
    }

    const delta = deltaFromNow(when);
    if (!Array.isArray(delta) || delta.length < 2) return null;

    const [hours, minutes] = delta;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 0) return null;

    return {
        key: `${name}| ${destination} `,
        entry: {
            line: name,
            destination,
            departure_delta: totalMinutes,
            departure_str: hours === 0 ? `${minutes} min` : `${hours}h ${minutes} min`
        }
    };
}

function addMissingUserLines(grouped, userLines) {
    if (!userLines || userLines.length === 0) return;

    for (const ul of userLines) {
        const ulName = ul.name || '?';
        const lineExists = Object.keys(grouped).some(key => key.split('|')[0] === ulName);

        if (!lineExists) {
            const key = `${ulName}| `;
            grouped[key] = {
                line: ulName,
                destination: '',
                departure_delta: 9999,
                departure_str: '--'
            };
        }
    }
}

export function groupDepartures(departures, userLines) {
    const grouped = {};

    for (const departure of departures) {
        if (!isLineAllowed(departure, userLines)) continue;

        const result = createDepartureEntry(departure);
        if (!result) continue;

        const { key, entry } = result;

        // Nur die nächste Abfahrt pro Linie/Ziel behalten
        if (!grouped[key] || entry.departure_delta < grouped[key].departure_delta) {
            grouped[key] = entry;
        }
    }

    addMissingUserLines(grouped, userLines);

    const finalList = Object.values(grouped);
    return finalList;
}

export function postprocessData(data) {
    return data.filter(entry => {
        const delta = entry.departure_delta ?? 9999;
        return delta > 0 && delta <= 59;
    });
}

export async function getStopIdsByLocation(lat, lon, distance = 500) {
    const url = `https://v6.vbb.transport.rest/locations/nearby?latitude=${lat}&longitude=${lon}&distance=${distance}&results=5&poi=false&stops=true`;
    const res = await fetch(url);
    const data = await res.json();
    const stopIds = data.map(stop => stop.id) || [];
    return stopIds;
}



export async function _getAllDepartures(config) {
    const { userLines = [], stopIdDistance = 500 } = config.departures || {};
    const { latitude, longitude } = config.location || {};
    const data = [];
    const stopIds = config.departures.stopIds.map(i => i.id) || [];
    console.log("Configured Stop IDs:", stopIds);
    // Wenn keine StopIDs konfiguriert sind, versuchen, sie basierend auf dem Standort abzurufen
    if ((!stopIds || stopIds.length === 0) && latitude && longitude) {
        console.log("No stop IDs configured, fetching based on location.");
        try {
            const fetchedStopIds = await getStopIdsByLocation(latitude, longitude, stopIdDistance);
            console.log("Fetched Stop IDs based on location:", fetchedStopIds);
            stopIds.push(...fetchedStopIds);
        } catch (e) {
            console.log("Error fetching stop IDs by location:", e);
        }
    }

    for (const stopId of stopIds) {
        if (!stopId) {
            console.log(`StopID missing for location: ${JSON.stringify(stopId)} `);
            continue;
        }
        let departures = [];
        try {
            departures = await fetchDepartures(stopId);
        } catch (e) {
            console.log(`Error fetching departures for stop ${stopId}: ${e} `);
        }

        if (departures && departures.length) {
            const finalList = groupDepartures(departures, userLines);
            data.push(...finalList);
        }
    }
    const postprocessedData = postprocessData(data);

    // Sicherstellen, dass das kombinierte Ergebnis global nach departure_delta sortiert ist
    if (postprocessedData && postprocessedData.length) {
        postprocessedData.sort((a, b) => (a.departure_delta ?? 9999) - (b.departure_delta ?? 9999));
    }

    return postprocessedData.length ? postprocessedData : [];
}
const TTL_DEPARTURES = 30; // 30 Sekunden
export const getAllDepartures = deviceCached(TTL_DEPARTURES)(_getAllDepartures);
