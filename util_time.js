import { DateTime } from 'luxon';

export function parseTime(whenStr) {
    // Versucht, einen ISO-String oder andere Zeitformate zu parsen
    if (!whenStr) return null;
    try {
        // 1) ISO mit Offset z.B. "2025-09-28T20:58:00+02:00" direkt parsen (Offset bleibt erhalten)
        let dt = DateTime.fromISO(whenStr);
        // 2) Falls fromISO ungültig ist, Fallback auf JS-Date
        if (!dt.isValid) {
            const jsDate = new Date(whenStr);
            if (!isNaN(jsDate)) dt = DateTime.fromJSDate(jsDate);
        }
        // 3) Konvertiere auf Europe/Berlin (so haben wir eine konsistente Zone)
        if (dt && dt.isValid) return dt.setZone('Europe/Berlin');
    } catch (e) {
        console.log(`Error parsing time ${whenStr}: ${e} `);
        // Fehler beim Parsen — still fail null
    }
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
