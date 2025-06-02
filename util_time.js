import { DateTime } from 'luxon';

export function parseTime(whenStr) {
    // Versucht, einen ISO-String oder andere Zeitformate zu parsen
    if (!whenStr) return null;
    try {
        // Luxon erwartet ISO 8601, sonst versuchen wir es als Date
        const dt = DateTime.fromISO(whenStr, { zone: 'Europe/Berlin' });
        if (dt.isValid) return dt;
        // Fallback: Date-Objekt
        const jsDate = new Date(whenStr);
        if (!isNaN(jsDate)) return DateTime.fromJSDate(jsDate, { zone: 'Europe/Berlin' });
    } catch (e) {
        // Fehler beim Parsen
    }
    return null;
}

export function deltaFromNow(dt) {
    // Gibt [hours, minutes, seconds] bis zur Abfahrt zurück
    if (!dt || !dt.isValid) return null;
    const now = DateTime.now().setZone('Europe/Berlin');
    const diff = dt.diff(now, ['hours', 'minutes', 'seconds']).toObject();
    const hours = Math.floor(diff.hours || 0);
    const minutes = Math.floor(diff.minutes || 0);
    const seconds = Math.floor(diff.seconds || 0);
    return [hours, minutes, seconds];
}
