import { parseTime, deltaFromNow } from "./util_time.js";
import { config } from "./config.js";

export async function fetchDepartures(stopId, resultCount = 5) {
    const baseUrl = config.bvgApiUrl(stopId, resultCount);

    if (!baseUrl) {
        console.log('Base URL not configured in config.json');
        return [];
    }
    const url = baseUrl.replace('{id}', stopId).replace('{result_count}', resultCount);
    let response;
    try {
        response = await fetch(url, { timeout: 5000 });
        if (response.ok) {
            const json = await response.json();
            return json.departures || [];
        } else {
            console.log(`Failed to fetch departures for stop ${stopId}, status code: ${response.status} `);
        }
    } catch (e) {
        let text = response ? await response.text() : 'None';
        console.log(`Error fetching data for stop ${stopId}: ${e} - response was ${text} `);
    }
    return [];
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
            console.log(`Invalid time format for departure: ${departure.when} `);
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
    console.log(`Processing ${locs.length} locations...`);
    for (const loc of locs) {
        const userLines = loc.lines || [];
        const stopId = loc.id;
        if (!stopId) {
            console.log(`StopID missing for location: ${JSON.stringify(loc)} `);
            continue;
        }
        console.log(`Fetching departures for stop ID: ${stopId} with user lines: ${JSON.stringify(userLines)} `);
        let departures = [];
        try {
            departures = await fetchDepartures(stopId);
        } catch (e) {
            console.log(`Error fetching departures for stop ${stopId}: ${e} `);
        }
        console.log('Finished Fetching');
        if (departures && departures.length) {
            const finalList = groupDepartures(departures, userLines);
            data.push(...finalList);
        }
    }
    const postprocessedData = postprocessData(data);
    return postprocessedData.length ? postprocessedData : [];
}