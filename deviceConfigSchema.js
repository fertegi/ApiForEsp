// deviceConfigSchema.js
// Zentrale Definition für dynamische Gerätekonfiguration (nur Client)

export const deviceConfigSchema = [
    // --- BASIC ---
    {
        group: 'basic',
        key: 'location.zipCode',
        type: 'text',
        label: 'Postleitzahl',
        placeholder: 'z.B. 10249',
        pattern: '[0-9]{5}',
        maxLength: 5,
    },
    {
        group: 'basic',
        key: 'weather.hourThreshold',
        type: 'number',
        label: 'Stunden-Schwellwert',
        min: 0,
        max: 24,
        placeholder: 'z.B. 20',
    },
    {
        group: 'basic',
        key: 'weather.hoursToForecast[0]',
        type: 'number',
        label: 'Vorhersage 1 (Uhr)',
        min: 0,
        max: 23,
        placeholder: 'z.B. 9',
    },
    {
        group: 'basic',
        key: 'weather.hoursToForecast[1]',
        type: 'number',
        label: 'Vorhersage 2 (Uhr)',
        min: 0,
        max: 23,
        placeholder: 'z.B. 12',
    },
    {
        group: 'basic',
        key: 'weather.hoursToForecast[2]',
        type: 'number',
        label: 'Vorhersage 3 (Uhr)',
        min: 0,
        max: 23,
        placeholder: 'z.B. 18',
    },
    // --- ADVANCED ---
    {
        group: 'advanced',
        key: 'deviceConfiguration.intervals.weather',
        type: 'number',
        label: 'Wetter-Intervall (h)',
        min: 1,
        max: 42,
        step: 1,
        placeholder: 'z.B. 10',
        unit: 'h',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.intervals.offers',
        type: 'number',
        label: 'Angebote-Intervall (h)',
        min: 1,
        max: 42,
        step: 1,
        placeholder: 'z.B. 16',
        unit: 'h',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.intervals.departures',
        type: 'number',
        label: 'Abfahrten-Intervall (s)',
        min: 1,
        max: 600,
        step: 1,
        placeholder: 'z.B. 30',
        unit: 's',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.intervals.quoteOfTheDay',
        type: 'number',
        label: 'Zitat-Intervall (h)',
        min: 1,
        max: 23,
        step: 1,
        placeholder: 'z.B. 20',
        unit: 'h',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.features.weather',
        type: 'checkbox',
        label: 'Wetter anzeigen',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.features.offers',
        type: 'checkbox',
        label: 'Angebote anzeigen',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.features.departures',
        type: 'checkbox',
        label: 'Abfahrten anzeigen',
    },
    {
        group: 'advanced',
        key: 'deviceConfiguration.features.quoteOfTheDay',
        type: 'checkbox',
        label: 'Zitat des Tages anzeigen',
    },
    // --- OFFERS ---
    {
        group: 'advanced',
        key: 'offers.retailers',
        type: 'tags',
        label: 'Händler (Komma-getrennt)',
        placeholder: 'z.B. rewe, aldi-nord, lidl',
    },
    {
        group: 'advanced',
        key: 'offers.searchKeywords',
        type: 'tags',
        label: 'Suchbegriffe (Komma-getrennt)',
        placeholder: 'z.B. chips, cola',
    },
    // --- DEPARTURES ---
    {
        group: 'advanced',
        key: 'departures.resultCount',
        type: 'number',
        label: 'Abfahrten: Anzahl Ergebnisse',
        min: 1,
        max: 10,
        step: 1,
        placeholder: 'z.B. 5',
    },
    {
        group: 'advanced',
        key: 'departures.userLines',
        type: 'tags',
        label: 'Linien (Komma-getrennt)',
        placeholder: 'z.B. U8, M43, S42',
    },

    // --- NEWS OF THE DAY ---
    {
        group: "basic",
        key: "newsOfTheDay.keywords",
        type: "tags",
        label: "Nachrichten-Schlagwörter (Komma-getrennt)",
        placeholder: "z.B. Politik, Sport, Technologie"
    },
    {
        group: "basic",
        key: "newsOfTheDay.languages",
        type: "tags",
        label: "Nachrichten-Sprachen (Komma-getrennt)",
        placeholder: "z.B. de, en, fr"
    }
]
