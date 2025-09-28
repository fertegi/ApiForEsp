import { parseTime, deltaFromNow } from "./util_time.js";
import { config } from "./config.js";
import { createClient } from 'hafas-client'
import { profile as bvgProfile } from 'hafas-client/p/bvg/index.js'


export async function fetchDepartures(stopId, duration = 10) {
    const userAgent = "bumaye@zoho.eu"
    const client = createClient(bvgProfile, userAgent)
    const res = await client.departures(stopId, { when: new Date(), duration: duration })

    return res.departures || [];
}

export function groupDepartures(departures, userLines) {
    const grouped = {};
    for (const departure of departures) {
        const lineInfo = departure.line || {};
        const lineId = lineInfo.id || '';
        const name = lineInfo.name || 'No Name';
        if (userLines && userLines.length > 0) {
            const found = userLines.some(ul =>
                (ul.id && ul.id === lineId) || (ul.name && ul.name === name)
            );
            if (!found) continue;
        }
        const destination = (departure.destination && departure.destination.name) || 'No Destination';
        const when = parseTime(departure.when || '');
        if (when) {
            const delta = deltaFromNow(when);
            if (Array.isArray(delta) && delta.length >= 2) {
                const [hours, minutes] = delta;
                const totalMinutes = hours * 60 + minutes;
                if (totalMinutes >= 0) {
                    const key = `${name}| ${destination} `;
                    const entry = {
                        line: name,
                        destination,
                        departure_delta: totalMinutes,
                        departure_str: hours === 0 ? `${minutes} min` : `${hours}h ${minutes} min`
                    };
                    if (grouped[key]) {
                        if (totalMinutes < grouped[key].departure_delta) {
                            grouped[key] = entry;
                        }
                    } else {
                        grouped[key] = entry;
                    }
                }
            }
        } else {
            console.log(`Could not parse time for departure: ${JSON.stringify(departure.when)} `);
        }
    }
    // Sicherstellen, dass jede konfigurierte user_line vertreten ist
    if (userLines && userLines.length > 0) {
        for (const ul of userLines) {
            const ulName = ul.name || '?';
            if (!Object.keys(grouped).some(key => key.split('|')[0] === ulName)) {
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
    const finalList = Object.values(grouped);
    finalList.sort((a, b) => a.departure_delta - b.departure_delta);
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

    return postprocessedData.length ? postprocessedData : [];
}