import { parseTime, deltaFromNow } from "../util_time.js";
import { createClient } from 'hafas-client'
import { profile as bvgProfile } from 'hafas-client/p/bvg/index.js'


export async function fetchDepartures(stopId, duration = 10) {
    const userAgent = "bumaye@zoho.eu"
    const client = createClient(bvgProfile, userAgent)
    const res = await client.departures(stopId, { when: new Date(), duration: duration })

    return res.departures || [];
}

function isLineAllowed(departure, userLines) {
    if (!userLines || userLines.length === 0) return true;

    const lineInfo = departure.line || {};
    const lineId = lineInfo.id || '';
    const name = lineInfo.name || 'No Name';

    return userLines.some(ul =>
        (ul.id && ul.id === lineId) || (ul.name && ul.name === name)
    );
}

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

export async function getAllDepartures(stops) {
    const data = [];
    const locs = stops || [];
    if (!locs.length) {
        console.log('No locations found in config.json');
        return data;
    }
    for (const loc of locs) {
        const userLines = loc.lines || [];
        const stopId = loc.id;
        if (!stopId) {
            console.log(`StopID missing for location: ${JSON.stringify(loc)} `);
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