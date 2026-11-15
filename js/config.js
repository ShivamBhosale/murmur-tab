// Personal configuration.

// Google Calendar: paste your OAuth client ID here (a "Web application" client from
// Google Cloud Console). See README → "Google Calendar setup". Leave empty to disable.
export const GOOGLE_CLIENT_ID = '190011803601-748jfpsqf5tujkhgc09oc4abd3oetl3c.apps.googleusercontent.com';

// How far ahead the "Up next" card looks, and how many events it shows.
export const CALENDAR_DAYS_AHEAD = 2;   // today + tomorrow
export const CALENDAR_MAX_EVENTS = 5;
export const CALENDAR_REFRESH_MIN = 5;  // minutes between refreshes while the tab is open
