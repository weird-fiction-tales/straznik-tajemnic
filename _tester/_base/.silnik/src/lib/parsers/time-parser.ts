import { TimeUpdate } from './types';

const MONTHS_PL = ['Stycznia', 'Lutego', 'Marca', 'Kwietnia', 'Maja', 'Czerwca',
    'Lipca', 'Sierpnia', 'Września', 'Października', 'Listopada', 'Grudnia'];

const MONTHS_NOMINATIVE_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Parses time updates from the AI's response text.
 * Example format: "AKTUALNY CZAS: 14 Stycznia 1925, 14:45, Środa, Dzień, Faza Księżyca: Rosnący Sierp 🌒"
 * We look for the exact "AKTUALNY CZAS:" or similar indicators.
 */
export function extractTimeUpdate(text: string): TimeUpdate | null {
    // Regex matches patterns like:
    // AKTUALNY CZAS: 14 Stycznia 1925, 14:45
    // Data: 14 Stycznia 1925, Czas: 14:45
    // 14 Stycznia 1925, 14:45

    // Basic regex targeting the standard format (PL & EN day-first)
    // e.g. "AKTUALNY CZAS: 14 Stycznia 1925, 14:45" or "CURRENT TIME: 14 January 1925, 14:45"
    const timePattern = /(?:AKTUALNY CZAS:|CURRENT TIME:|Czas:|Time:)?\s*(\d{1,2})\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s+(\d{4})(?:r\.?)?,\s*(\d{1,2})[.:](\d{2})/i;

    let match = timePattern.exec(text);
    let day = NaN;
    let monthStr = '';
    let year = NaN;
    let hour = NaN;
    let minute = NaN;

    if (match) {
        day = parseInt(match[1]);
        monthStr = match[2];
        year = parseInt(match[3]);
        hour = parseInt(match[4]);
        minute = parseInt(match[5]);
    } else {
        // Also try English Month DD, YYYY format: "CURRENT TIME: January 14, 1925, 14:45"
        const monthFirstPattern = /(?:AKTUALNY CZAS:|CURRENT TIME:|Czas:|Time:)?\s*([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:r\.?)?,\s*(\d{1,2})[.:](\d{2})/i;
        match = monthFirstPattern.exec(text);
        if (match) {
            monthStr = match[1];
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            hour = parseInt(match[4]);
            minute = parseInt(match[5]);
        } else {
            // Backup pattern: look for any date + time combo in text: 14 Stycznia 1925, 14:45
            const backupPattern = /(\d{1,2})\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s+(\d{4}).*?(\d{1,2})[.:](\d{2})/i;
            match = backupPattern.exec(text);
            if (match) {
                day = parseInt(match[1]);
                monthStr = match[2];
                year = parseInt(match[3]);
                hour = parseInt(match[4]);
                minute = parseInt(match[5]);
            }
        }
    }

    if (!isNaN(day) && !isNaN(year) && !isNaN(hour) && !isNaN(minute) && monthStr) {
        let month = 0; // default January
        const normMonthStr = monthStr.toLowerCase();
        for (let i = 0; i < 12; i++) {
            if (
                MONTHS_PL[i].toLowerCase() === normMonthStr || 
                MONTHS_NOMINATIVE_PL[i].toLowerCase() === normMonthStr ||
                MONTHS_PL[i].toLowerCase().startsWith(normMonthStr.substring(0, 3)) ||
                MONTHS_EN[i].toLowerCase() === normMonthStr ||
                MONTHS_EN[i].toLowerCase().startsWith(normMonthStr.substring(0, 3))
            ) {
                month = i;
                break;
            }
        }

        return {
            day,
            month,
            year,
            hour,
            minute
        };
    }

    return null;
}

