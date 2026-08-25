export type Locale = "en" | "el";

export interface Dictionary {
  nav: {
    today: string;
    map: string;
    forecast: string;
    spots: string;
    settings: string;
    windows: string;
    admin: string;
    conditions: {
      wind: string;
      sea: string;
      pressure: string;
      sky: string;
      sunMoon: string;
    };
  };
  location: {
    changeLocation: string;
    searchPlaceholder: string;
    useMyLocation: string;
    locating: string;
  };
  common: {
    comingSoon: string;
    loading: string;
    notForNavigation: string;
    error: string;
    months: [string, string, string, string, string, string, string, string, string, string, string, string];
  };
  analytics: {
    message: string;
    accept: string;
    decline: string;
  };
  mode: {
    shore: string;
    boat: string;
    spearfishing: string;
  };
  factors: {
    pressure: string;
    wind: string;
    waves: string;
    turbidity: string;
    seaTemp: string;
    light: string;
    precipitation: string;
    solunar: string;
    current: string;
    seasonality: string;
  };
  score: {
    bands: {
      poor: string;
      fair: string;
      good: string;
      veryGood: string;
      excellent: string;
    };
    whyTitle: string;
    activeVetoes: string;
    marineCaveat: string;
  };
  /** Templates for FactorScore.noteKey — apps/web/src/lib/i18n/renderFactorNote.ts
   * interpolates {param} placeholders. Never rendered from FactorScore.note
   * directly (that's an English-only fallback for non-UI consumers). */
  factorNotes: {
    pressure: { noData: string; noHistory: string; risingSharp: string; falling: string; rising: string; stable: string };
    wind: {
      noData: string;
      boat: { calm: string; workable: string; rough: string };
      spear: { flat: string; someChop: string; tooMuchChop: string };
      shore: { speedOnly: string; onshore: string; offshore: string; cross: string; calm: string };
    };
    waves: { noData: string; height: string };
    turbidity: { noData: string; clear: string; some: string; murky: string };
    seaTemp: { noData: string; dropped: string; warming: string; value: string };
    light: { dawn: string; dusk: string; night: string; daytime: string; daytimeOvercast: string; spearMidday: string };
    precipitation: { noData: string; value: string };
    solunar: { phase: string; activeMajor: string; activeMinor: string; alignsWithTwilight: string };
    current: { noData: string; spear: string; default: string };
    seasonality: { value: string };
  };
  /** Templates for VetoInfo.key. */
  vetoes: {
    thunderstorm: string;
    wind: { shore: string; boat: string; spear: string };
    wave: { shore: string; boat: string; spear: string };
  };
  today: {
    nextGoodWindow: string;
    seeForecast: string;
    sunMoonStrip: string;
    topFactors: string;
    topFactorsCaption: string;
    showAllFactors: string;
    showFewerFactors: string;
  };
  forecast: {
    hourly: string;
    bestWindow: string;
    week: string;
  };
  map: {
    closeSheet: string;
    layers: string;
    overlays: string;
    overlayLabels: { bathymetry: string; posidonia: string; seamarks: string };
  };
  wind: {
    speed: string;
    gusts: string;
    direction: string;
    explanation: string;
  };
  sea: {
    waveHeight: string;
    swell: string;
    seaTemp: string;
    current: string;
    clarity: string;
    clarityClear: string;
    clarityModerate: string;
    clarityMurky: string;
    explanation: string;
  };
  pressure: {
    trend: string;
    hpa: string;
    explanation: string;
  };
  sky: {
    cloudCover: string;
    visibility: string;
    precipitation: string;
    explanation: string;
  };
  sunMoon: {
    sunrise: string;
    sunset: string;
    civilTwilight: string;
    nauticalTwilight: string;
    moonrise: string;
    moonset: string;
    illumination: string;
    solunarMajor: string;
    solunarMinor: string;
    offline: string;
    moonPhaseLabel: string;
    phase: {
      new: string;
      waxingCrescent: string;
      firstQuarter: string;
      waxingGibbous: string;
      full: string;
      waningGibbous: string;
      lastQuarter: string;
      waningCrescent: string;
    };
  };
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    confirm: string;
    add: string;
    export: string;
    import: string;
    logout: string;
  };
  windows: {
    title: string;
    subtitle: string;
    empty: string;
    addLocation: string;
    noSavedLocations: string;
  };
  spots: {
    userTitle: string;
    userEmpty: string;
    publicTitle: string;
    publicEmpty: string;
    addCurrentLocation: string;
    name: string;
    notes: string;
    remove: string;
    exportSpots: string;
    importSpots: string;
  };
  settings: {
    language: string;
    languageAuto: string;
    theme: string;
    themeDark: string;
    units: string;
    unitsMetric: string;
    dataExport: string;
    dataExportHint: string;
    notificationsTitle: string;
    notifications: {
      enabled: string;
      watchedLocations: string;
      addCurrentLocation: string;
      threshold: string;
      mode: string;
      lookahead: string;
      lookaheadOptions: { h12: string; h24: string; h48: string; d7: string };
      quietHours: string;
      quietFrom: string;
      quietTo: string;
      maxFrequency: string;
      frequencyOptions: { daily: string; twicePerDay: string; fourPerDay: string };
      alertTypes: string;
      alertGoodWindow: string;
      alertPressureDrop: string;
      alertSafety: string;
      save: string;
      saved: string;
      needsInstallIOS: string;
      permissionDenied: string;
      notSupported: string;
    };
  };
  admin: {
    loginTitle: string;
    passwordLabel: string;
    loginSubmit: string;
    loginError: string;
    tabs: { flags: string; weights: string; spots: string; announcement: string; stats: string };
    flags: {
      title: string;
      description: string;
      state: { off: string; adminOnly: string; rollout: string; on: string };
      rolloutPct: string;
    };
    weights: {
      title: string;
      description: string;
      reset: string;
      overridden: string;
      defaultLabel: string;
    };
    spots: {
      title: string;
      createTitle: string;
      publish: string;
      unpublish: string;
      confirmPublish: string;
      visibilityPublic: string;
      visibilityPrivate: string;
    };
    announcement: {
      title: string;
      description: string;
      message: string;
      active: string;
    };
    stats: {
      title: string;
      weatherCacheRows: string;
      activeSubscriptions: string;
      publicSpots: string;
      privateSpots: string;
      thresholdDistribution: string;
      modeDistribution: string;
    };
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      today: "Today",
      map: "Map",
      forecast: "Forecast",
      spots: "Spots",
      settings: "Settings",
      windows: "Best windows",
      admin: "Admin",
      conditions: {
        wind: "Wind",
        sea: "Sea",
        pressure: "Pressure",
        sky: "Sky",
        sunMoon: "Sun & moon",
      },
    },
    location: {
      changeLocation: "Change location",
      searchPlaceholder: "Search a place, beach, or coordinates",
      useMyLocation: "Use my location",
      locating: "Locating…",
    },
    common: {
      comingSoon: "Coming soon",
      loading: "Loading…",
      notForNavigation: "Not for navigation — conditions data only.",
      error: "Couldn't load conditions. Check your connection and try again.",
      months: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
    },
    analytics: {
      message:
        "We use Google Analytics to understand how the app is used. No accounts, no personal data beyond standard analytics cookies.",
      accept: "Accept",
      decline: "Decline",
    },
    mode: {
      shore: "Shore",
      boat: "Boat",
      spearfishing: "Spearfishing",
    },
    factors: {
      pressure: "Pressure trend",
      wind: "Wind",
      waves: "Waves",
      turbidity: "Water clarity",
      seaTemp: "Sea temperature",
      light: "Time of day",
      precipitation: "Precipitation",
      solunar: "Solunar",
      current: "Current",
      seasonality: "Season",
    },
    score: {
      bands: {
        poor: "Bad",
        fair: "Meh",
        good: "Good",
        veryGood: "Very good",
        excellent: "Excellent",
      },
      whyTitle: "Why this score?",
      activeVetoes: "Active safety warnings",
      marineCaveat: "No marine data near this point — scoring from wind, pressure and sky alone.",
    },
    factorNotes: {
      pressure: {
        noData: "No pressure data available.",
        noHistory: "Not enough history yet — treating pressure as stable.",
        risingSharp: "Rising sharply ({delta} hPa/3h) — classic post-front slump, give it 24-36h.",
        falling: "Falling ({delta} hPa/6h) — front approaching, fish are loading up.",
        rising: "Rising ({delta} hPa/6h) — activity easing off.",
        stable: "Stable ({delta} hPa/6h).",
      },
      wind: {
        noData: "No wind data available.",
        boat: {
          calm: "{speed} km/h — calm, comfortable.",
          workable: "{speed} km/h — workable.",
          rough: "{speed} km/h — getting rough.",
        },
        spear: {
          flat: "{speed} km/h — flat, good visibility conditions.",
          someChop: "{speed} km/h — some chop building.",
          tooMuchChop: "{speed} km/h — too much chop for good visibility.",
        },
        shore: {
          speedOnly: "{speed} km/h. Direction-relative-to-shore scoring needs this spot's coastline aspect.",
          onshore: "{speed} km/h, onshore — pushing bait into the shallows.",
          offshore: "{speed} km/h, offshore — flattens the water.",
          cross: "{speed} km/h, cross-shore.",
          calm: "{speed} km/h, near calm.",
        },
      },
      waves: {
        noData: "No wave data available near this point.",
        height: "{height} m wave height.",
      },
      turbidity: {
        noData: "No data available.",
        clear: "Water likely clear.",
        some: "Some turbidity expected.",
        murky: "Likely murky water.",
      },
      seaTemp: {
        noData: "No sea temperature data available.",
        dropped: "Sea temperature dropped {delta}°C in 48h — bite likely shut down.",
        warming: "Gently warming (+{delta}°C/48h).",
        value: "{sst}°C sea surface temperature.",
      },
      light: {
        dawn: "Dawn window.",
        dusk: "Dusk window.",
        night: "Night.",
        daytime: "Daytime.",
        daytimeOvercast: "Daytime — heavy overcast is extending the low-light advantage across the day.",
        spearMidday: "Midday light for underwater visibility.",
      },
      precipitation: {
        noData: "No precipitation data available.",
        value: "{mm} mm/h.",
      },
      solunar: {
        phase: "Moon {phase}.",
        activeMajor: "Moon {phase}. Active solunar major period.",
        activeMinor: "Moon {phase}. Active solunar minor period.",
        alignsWithTwilight:
          "Moon {phase}. Solunar major period aligns with dawn/dusk right now — the strongest combined signal the app can produce.",
      },
      current: {
        noData: "No current data available.",
        spear: "{knots} kn current — slack water gives the best visibility and easiest diving.",
        default: "{knots} kn current.",
      },
      seasonality: {
        value: "{month} — general Greek coastal fishery activity.",
      },
    },
    vetoes: {
      thunderstorm: "Thunderstorm risk — lightning and open water/carbon rods don't mix. This veto cannot be overridden.",
      wind: {
        shore: "Wind too strong for shore safety ({wind} km/h).",
        boat: "Wind too strong for a boat outing ({wind} km/h).",
        spear: "Wind too strong for safe spearfishing ({wind} km/h).",
      },
      wave: {
        shore: "Waves too high for shore safety ({wave} m).",
        boat: "Waves too high for a safe boat trip ({wave} m).",
        spear: "Waves too high for spearfishing safety/visibility ({wave} m).",
      },
    },
    today: {
      nextGoodWindow: "Next good window",
      seeForecast: "See 7-day forecast",
      sunMoonStrip: "Sun & moon",
      topFactors: "What's driving this",
      topFactorsCaption: "Every factor below is computed for every fishing mode — only the weight changes.",
      showAllFactors: "Show all {count} factors",
      showFewerFactors: "Show fewer",
    },
    forecast: {
      hourly: "Hourly",
      bestWindow: "Best hour",
      week: "This week",
    },
    map: {
      closeSheet: "Close",
      layers: "Layers",
      overlays: "Overlays",
      overlayLabels: {
        bathymetry: "Bathymetry (depth)",
        posidonia: "Posidonia / seabed habitat",
        seamarks: "Seamarks",
      },
    },
    wind: {
      speed: "Wind speed",
      gusts: "Gusts",
      direction: "Direction",
      explanation:
        "Speed matters less than direction relative to the shore: onshore breeze pushes bait fish into the shallows, offshore wind flattens the water. Full direction-relative scoring lands once the coastline pipeline knows this spot's aspect.",
    },
    sea: {
      waveHeight: "Wave height",
      swell: "Swell",
      seaTemp: "Sea temperature",
      current: "Current",
      clarity: "Water clarity (estimated)",
      clarityClear: "Likely clear",
      clarityModerate: "Some turbidity expected",
      clarityMurky: "Likely murky",
      explanation:
        "A little onshore swell disorients bait fish and gives predators cover — often the best shore-fishing condition there is. Moving water beats slack water for current; a sudden sea-temperature drop can shut the bite down.",
    },
    pressure: {
      trend: "Pressure trend",
      hpa: "hPa",
      explanation:
        "Anglers argue about the absolute number, not the trend: a falling pressure ahead of a front is the classic feeding window. A sharp rise just after a front passes is the slowest bite in the folklore — give it a day or two.",
    },
    sky: {
      cloudCover: "Cloud cover",
      visibility: "Visibility",
      precipitation: "Precipitation",
      explanation:
        "Overcast skies extend the low-light advantage across the whole day, so fish spread out and feed longer. Light rain washes food in and drops the light further; a thunderstorm is a hard safety veto, no exceptions.",
    },
    sunMoon: {
      sunrise: "Sunrise",
      sunset: "Sunset",
      civilTwilight: "Civil twilight",
      nauticalTwilight: "Nautical twilight",
      moonrise: "Moonrise",
      moonset: "Moonset",
      illumination: "Illumination",
      solunarMajor: "Major period",
      solunarMinor: "Minor period",
      offline: "Computed locally — works fully offline.",
      moonPhaseLabel: "Moon phase",
      phase: {
        new: "New moon",
        waxingCrescent: "Waxing crescent",
        firstQuarter: "First quarter",
        waxingGibbous: "Waxing gibbous",
        full: "Full moon",
        waningGibbous: "Waning gibbous",
        lastQuarter: "Last quarter",
        waningCrescent: "Waning crescent",
      },
    },
    actions: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      confirm: "Confirm",
      add: "Add",
      export: "Export",
      import: "Import",
      logout: "Log out",
    },
    windows: {
      title: "Best windows",
      subtitle: "Ranked upcoming opportunities across your saved locations.",
      empty: "No good windows in the lookahead period — check back later.",
      addLocation: "Add current location",
      noSavedLocations: "Save a spot or search a location to see its best windows here.",
    },
    spots: {
      userTitle: "My spots",
      userEmpty: "No saved spots yet. Add the current location, or tap a point on the map.",
      publicTitle: "Published spots",
      publicEmpty: "No published spots yet.",
      addCurrentLocation: "Save current location",
      name: "Name",
      notes: "Notes",
      remove: "Remove",
      exportSpots: "Export spots (JSON)",
      importSpots: "Import spots",
    },
    settings: {
      language: "Language",
      languageAuto: "Auto",
      theme: "Theme",
      themeDark: "Dark",
      units: "Units",
      unitsMetric: "Metric (km/h, m, °C)",
      dataExport: "Data export",
      dataExportHint: "Your saved spots live only on this device — export them as a backup.",
      notificationsTitle: "Notifications",
      notifications: {
        enabled: "Enable notifications",
        watchedLocations: "Watched locations (max 5)",
        addCurrentLocation: "Add current location",
        threshold: "Score threshold",
        mode: "Fishing mode",
        lookahead: "Lookahead",
        lookaheadOptions: { h12: "12 hours", h24: "24 hours", h48: "48 hours", d7: "7 days" },
        quietHours: "Quiet hours",
        quietFrom: "From",
        quietTo: "To",
        maxFrequency: "Max frequency per location",
        frequencyOptions: { daily: "1 per day", twicePerDay: "1 per 12h", fourPerDay: "1 per 6h" },
        alertTypes: "Alert types",
        alertGoodWindow: "Good window",
        alertPressureDrop: "Sharp pressure drop",
        alertSafety: "Storm / safety warning",
        save: "Save notification settings",
        saved: "Saved.",
        needsInstallIOS: "On iOS, install this app to your Home Screen first — notifications only work once installed.",
        permissionDenied: "Notification permission was denied in your browser settings.",
        notSupported: "Push notifications aren't supported in this browser.",
      },
    },
    admin: {
      loginTitle: "Admin login",
      passwordLabel: "Password",
      loginSubmit: "Log in",
      loginError: "Incorrect password.",
      tabs: { flags: "Feature flags", weights: "Weights", spots: "Spots", announcement: "Announcement", stats: "Stats" },
      flags: {
        title: "Feature flags",
        description: "Every non-trivial feature ships behind a flag, defaulting to admin-only.",
        state: { off: "Off", adminOnly: "Admin only", rollout: "Rollout %", on: "On" },
        rolloutPct: "Rollout %",
      },
      weights: {
        title: "Live scoring weights",
        description: "Per-mode factor weights. Changes apply immediately to every page and the map.",
        reset: "Reset to defaults",
        overridden: "Overridden",
        defaultLabel: "Default",
      },
      spots: {
        title: "Spots",
        createTitle: "Add a spot",
        publish: "Publish",
        unpublish: "Unpublish",
        confirmPublish: "Publish this spot? It becomes visible to everyone.",
        visibilityPublic: "Public",
        visibilityPrivate: "Private",
      },
      announcement: {
        title: "Announcement banner",
        description: "Shown to every visitor at the top of the app while active.",
        message: "Message",
        active: "Active",
      },
      stats: {
        title: "Usage stats",
        weatherCacheRows: "Weather cache rows",
        activeSubscriptions: "Active push subscriptions",
        publicSpots: "Public spots",
        privateSpots: "Private spots",
        thresholdDistribution: "Threshold distribution",
        modeDistribution: "Mode distribution",
      },
    },
  },
  el: {
    nav: {
      today: "Σήμερα",
      map: "Χάρτης",
      forecast: "Πρόγνωση",
      spots: "Σημεία",
      settings: "Ρυθμίσεις",
      windows: "Καλύτερα παράθυρα",
      admin: "Διαχείριση",
      conditions: {
        wind: "Άνεμος",
        sea: "Θάλασσα",
        pressure: "Πίεση",
        sky: "Ουρανός",
        sunMoon: "Ήλιος & Σελήνη",
      },
    },
    location: {
      changeLocation: "Αλλαγή τοποθεσίας",
      searchPlaceholder: "Αναζήτηση τοποθεσίας, παραλίας ή συντεταγμένων",
      useMyLocation: "Χρήση της τοποθεσίας μου",
      locating: "Εντοπισμός…",
    },
    common: {
      comingSoon: "Σύντομα διαθέσιμο",
      loading: "Φόρτωση…",
      notForNavigation: "Όχι για ναυσιπλοΐα — μόνο δεδομένα συνθηκών.",
      error: "Δεν φορτώθηκαν οι συνθήκες. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
      months: [
        "Ιανουάριος",
        "Φεβρουάριος",
        "Μάρτιος",
        "Απρίλιος",
        "Μάιος",
        "Ιούνιος",
        "Ιούλιος",
        "Αύγουστος",
        "Σεπτέμβριος",
        "Οκτώβριος",
        "Νοέμβριος",
        "Δεκέμβριος",
      ],
    },
    analytics: {
      message:
        "Χρησιμοποιούμε το Google Analytics για να κατανοήσουμε τη χρήση της εφαρμογής. Χωρίς λογαριασμούς, χωρίς προσωπικά δεδομένα πέρα από τα συνήθη cookies ανάλυσης.",
      accept: "Αποδοχή",
      decline: "Απόρριψη",
    },
    mode: {
      shore: "Παραλία",
      boat: "Σκάφος",
      spearfishing: "Ψαροντούφεκο",
    },
    factors: {
      pressure: "Τάση πίεσης",
      wind: "Άνεμος",
      waves: "Κύματα",
      turbidity: "Διαύγεια νερού",
      seaTemp: "Θερμοκρασία θάλασσας",
      light: "Ώρα ημέρας",
      precipitation: "Βροχόπτωση",
      solunar: "Σεληνιακή περίοδος",
      current: "Ρεύμα",
      seasonality: "Εποχή",
    },
    score: {
      bands: {
        poor: "Κακή",
        fair: "Μέτρια",
        good: "Καλή",
        veryGood: "Πολύ καλή",
        excellent: "Εξαιρετική",
      },
      whyTitle: "Γιατί αυτή η βαθμολογία;",
      activeVetoes: "Ενεργές προειδοποιήσεις ασφαλείας",
      marineCaveat: "Δεν υπάρχουν θαλάσσια δεδομένα κοντά σε αυτό το σημείο — βαθμολόγηση μόνο από άνεμο, πίεση και ουρανό.",
    },
    factorNotes: {
      pressure: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα πίεσης.",
        noHistory: "Δεν υπάρχει ακόμα αρκετό ιστορικό — η πίεση θεωρείται σταθερή.",
        risingSharp: "Απότομη άνοδος ({delta} hPa/3ω) — κλασική νωθρή περίοδος μετά το πέρασμα μετώπου, δώστε της 24-36 ώρες.",
        falling: "Πτώση ({delta} hPa/6ω) — πλησιάζει μέτωπο, τα ψάρια «φορτώνουν».",
        rising: "Άνοδος ({delta} hPa/6ω) — η δραστηριότητα μειώνεται.",
        stable: "Σταθερή ({delta} hPa/6ω).",
      },
      wind: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα ανέμου.",
        boat: {
          calm: "{speed} χλμ/ώ — ήρεμος, άνετος.",
          workable: "{speed} χλμ/ώ — διαχειρίσιμος.",
          rough: "{speed} χλμ/ώ — δυσκολεύει.",
        },
        spear: {
          flat: "{speed} χλμ/ώ — λείο νερό, καλή ορατότητα.",
          someChop: "{speed} χλμ/ώ — κάποια φουσκοθαλασσιά.",
          tooMuchChop: "{speed} χλμ/ώ — πολλή φουσκοθαλασσιά για καλή ορατότητα.",
        },
        shore: {
          speedOnly: "{speed} χλμ/ώ. Η βαθμολόγηση ως προς την κατεύθυνση της ακτής χρειάζεται τον προσανατολισμό αυτού του σημείου.",
          onshore: "{speed} χλμ/ώ, από τη θάλασσα προς τη στεριά — σπρώχνει τροφή προς τα ρηχά.",
          offshore: "{speed} χλμ/ώ, από τη στεριά προς τη θάλασσα — ισιώνει το νερό.",
          cross: "{speed} χλμ/ώ, παράλληλα με την ακτή.",
          calm: "{speed} χλμ/ώ, σχεδόν άπνοια.",
        },
      },
      waves: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα κύματος κοντά σε αυτό το σημείο.",
        height: "Ύψος κύματος {height} μ.",
      },
      turbidity: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα.",
        clear: "Πιθανώς καθαρό νερό.",
        some: "Αναμένεται κάποια θολότητα.",
        murky: "Πιθανώς θολό νερό.",
      },
      seaTemp: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα θερμοκρασίας θάλασσας.",
        dropped: "Η θερμοκρασία της θάλασσας έπεσε κατά {delta}°C σε 48 ώρες — το τσίμπημα πιθανώς σταμάτησε.",
        warming: "Ήπια άνοδος (+{delta}°C/48ω).",
        value: "Θερμοκρασία επιφάνειας θάλασσας {sst}°C.",
      },
      light: {
        dawn: "Παράθυρο αυγής.",
        dusk: "Παράθυρο δειλινού.",
        night: "Νύχτα.",
        daytime: "Ημέρα.",
        daytimeOvercast: "Ημέρα — η έντονη συννεφιά επεκτείνει το πλεονέκτημα του χαμηλού φωτισμού σε όλη τη διάρκειά της.",
        spearMidday: "Μεσημεριανό φως για υποβρύχια ορατότητα.",
      },
      precipitation: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα βροχόπτωσης.",
        value: "{mm} χλστ/ώ.",
      },
      solunar: {
        phase: "Σελήνη: {phase}.",
        activeMajor: "Σελήνη: {phase}. Ενεργή κύρια σεληνιακή περίοδος.",
        activeMinor: "Σελήνη: {phase}. Ενεργή δευτερεύουσα σεληνιακή περίοδος.",
        alignsWithTwilight:
          "Σελήνη: {phase}. Η κύρια σεληνιακή περίοδος συμπίπτει τώρα με αυγή/δείλι — το ισχυρότερο συνδυασμένο σήμα που μπορεί να δώσει η εφαρμογή.",
      },
      current: {
        noData: "Δεν υπάρχουν διαθέσιμα δεδομένα ρεύματος.",
        spear: "Ρεύμα {knots} kn — το ήρεμο νερό δίνει την καλύτερη ορατότητα και την ευκολότερη κατάδυση.",
        default: "Ρεύμα {knots} kn.",
      },
      seasonality: {
        value: "{month} — γενική δραστηριότητα ελληνικής παράκτιας αλιείας.",
      },
    },
    vetoes: {
      thunderstorm: "Κίνδυνος καταιγίδας — αστραπές και ανοιχτό νερό/καλάμια δεν συνδυάζονται. Αυτό το βέτο δεν παρακάμπτεται.",
      wind: {
        shore: "Πολύ δυνατός άνεμος για ασφαλές ψάρεμα από ακτή ({wind} χλμ/ώ).",
        boat: "Πολύ δυνατός άνεμος για βαρκάδα ({wind} χλμ/ώ).",
        spear: "Πολύ δυνατός άνεμος για ασφαλές ψαροντούφεκο ({wind} χλμ/ώ).",
      },
      wave: {
        shore: "Πολύ ψηλά κύματα για ασφάλεια από την ακτή ({wave} μ).",
        boat: "Πολύ ψηλά κύματα για ασφαλή βαρκάδα ({wave} μ).",
        spear: "Πολύ ψηλά κύματα για ασφάλεια/ορατότητα ψαροντούφεκου ({wave} μ).",
      },
    },
    today: {
      nextGoodWindow: "Επόμενο καλό παράθυρο",
      seeForecast: "Δείτε την πρόγνωση 7 ημερών",
      sunMoonStrip: "Ήλιος & Σελήνη",
      topFactors: "Τι καθορίζει τη βαθμολογία",
      topFactorsCaption: "Κάθε παράγοντας παρακάτω υπολογίζεται για κάθε τρόπο ψαρέματος — αλλάζει μόνο η βαρύτητά του.",
      showAllFactors: "Εμφάνιση και των {count} παραγόντων",
      showFewerFactors: "Λιγότερα",
    },
    forecast: {
      hourly: "Ανά ώρα",
      bestWindow: "Καλύτερη ώρα",
      week: "Αυτή την εβδομάδα",
    },
    map: {
      closeSheet: "Κλείσιμο",
      layers: "Επίπεδα",
      overlays: "Επικαλύψεις",
      overlayLabels: {
        bathymetry: "Βαθυμετρία (βάθος)",
        posidonia: "Ποσειδωνία / βυθός",
        seamarks: "Ναυτικά σημάδια",
      },
    },
    wind: {
      speed: "Ταχύτητα ανέμου",
      gusts: "Ριπές",
      direction: "Κατεύθυνση",
      explanation:
        "Η κατεύθυνση ως προς την ακτή μετράει περισσότερο από την ταχύτητα: ο άνεμος από τη θάλασσα σπρώχνει τα ψάρια-τροφή προς τα ρηχά, ενώ ο άνεμος από τη στεριά ισιώνει το νερό. Η πλήρης βαθμολόγηση ως προς τον προσανατολισμό της ακτής θα ενεργοποιηθεί όταν προστεθεί η ακτογραμμή.",
    },
    sea: {
      waveHeight: "Ύψος κύματος",
      swell: "Κυματισμός (swell)",
      seaTemp: "Θερμοκρασία θάλασσας",
      current: "Ρεύμα",
      clarity: "Διαύγεια νερού (εκτίμηση)",
      clarityClear: "Πιθανώς καθαρό",
      clarityModerate: "Αναμένεται κάποια θολότητα",
      clarityMurky: "Πιθανώς θολό",
      explanation:
        "Λίγος κυματισμός από τη θάλασσα αποπροσανατολίζει τα ψάρια-τροφή και δίνει κάλυψη στα αρπακτικά — συχνά η καλύτερη συνθήκη για ψάρεμα από ακτή. Το κινούμενο νερό είναι καλύτερο από το ακίνητο· μια απότομη πτώση θερμοκρασίας μπορεί να σταματήσει το τσίμπημα.",
    },
    pressure: {
      trend: "Τάση πίεσης",
      hpa: "hPa",
      explanation:
        "Οι ψαράδες διαφωνούν για την απόλυτη τιμή, όχι για την τάση: η πτώση της πίεσης πριν από μια μετωπική διαταραχή είναι το κλασικό παράθυρο τσιμπήματος. Η απότομη άνοδος αμέσως μετά είναι η πιο αργή περίοδος — δώστε της μια-δυο μέρες.",
    },
    sky: {
      cloudCover: "Νεφοκάλυψη",
      visibility: "Ορατότητα",
      precipitation: "Βροχόπτωση",
      explanation:
        "Η συννεφιά επεκτείνει το πλεονέκτημα του χαμηλού φωτισμού σε όλη τη μέρα, οπότε τα ψάρια απλώνονται και τρέφονται περισσότερη ώρα. Η ελαφριά βροχή φέρνει τροφή και μειώνει το φως ακόμα περισσότερο· η καταιγίδα είναι απόλυτο βέτο ασφαλείας, χωρίς εξαιρέσεις.",
    },
    sunMoon: {
      sunrise: "Ανατολή ηλίου",
      sunset: "Δύση ηλίου",
      civilTwilight: "Αστικό λυκόφως",
      nauticalTwilight: "Ναυτικό λυκόφως",
      moonrise: "Ανατολή σελήνης",
      moonset: "Δύση σελήνης",
      illumination: "Φωτισμός",
      solunarMajor: "Κύρια περίοδος",
      solunarMinor: "Δευτερεύουσα περίοδος",
      offline: "Υπολογίζεται τοπικά — λειτουργεί πλήρως χωρίς σύνδεση.",
      moonPhaseLabel: "Φάση σελήνης",
      phase: {
        new: "Νέα σελήνη",
        waxingCrescent: "Αύξων μηνίσκος",
        firstQuarter: "Πρώτο τέταρτο",
        waxingGibbous: "Αύξον αμφίκυρτη",
        full: "Πανσέληνος",
        waningGibbous: "Φθίνον αμφίκυρτη",
        lastQuarter: "Τελευταίο τέταρτο",
        waningCrescent: "Φθίνων μηνίσκος",
      },
    },
    actions: {
      save: "Αποθήκευση",
      cancel: "Ακύρωση",
      delete: "Διαγραφή",
      edit: "Επεξεργασία",
      close: "Κλείσιμο",
      confirm: "Επιβεβαίωση",
      add: "Προσθήκη",
      export: "Εξαγωγή",
      import: "Εισαγωγή",
      logout: "Αποσύνδεση",
    },
    windows: {
      title: "Καλύτερα παράθυρα",
      subtitle: "Κατάταξη επερχόμενων ευκαιριών στις αποθηκευμένες τοποθεσίες σας.",
      empty: "Δεν υπάρχουν καλά παράθυρα στο διάστημα πρόβλεψης — ελέγξτε ξανά αργότερα.",
      addLocation: "Προσθήκη τρέχουσας τοποθεσίας",
      noSavedLocations: "Αποθηκεύστε ένα σημείο ή αναζητήστε μια τοποθεσία για να δείτε εδώ τα καλύτερα παράθυρά της.",
    },
    spots: {
      userTitle: "Τα σημεία μου",
      userEmpty: "Δεν έχετε αποθηκευμένα σημεία ακόμα. Προσθέστε την τρέχουσα τοποθεσία ή πατήστε ένα σημείο στον χάρτη.",
      publicTitle: "Δημοσιευμένα σημεία",
      publicEmpty: "Δεν υπάρχουν δημοσιευμένα σημεία ακόμα.",
      addCurrentLocation: "Αποθήκευση τρέχουσας τοποθεσίας",
      name: "Όνομα",
      notes: "Σημειώσεις",
      remove: "Αφαίρεση",
      exportSpots: "Εξαγωγή σημείων (JSON)",
      importSpots: "Εισαγωγή σημείων",
    },
    settings: {
      language: "Γλώσσα",
      languageAuto: "Αυτόματη",
      theme: "Θέμα",
      themeDark: "Σκούρο",
      units: "Μονάδες",
      unitsMetric: "Μετρικές (χλμ/ώ, μ, °C)",
      dataExport: "Εξαγωγή δεδομένων",
      dataExportHint: "Τα αποθηκευμένα σημεία σας υπάρχουν μόνο σε αυτή τη συσκευή — εξάγετέ τα ως αντίγραφο ασφαλείας.",
      notificationsTitle: "Ειδοποιήσεις",
      notifications: {
        enabled: "Ενεργοποίηση ειδοποιήσεων",
        watchedLocations: "Παρακολουθούμενες τοποθεσίες (έως 5)",
        addCurrentLocation: "Προσθήκη τρέχουσας τοποθεσίας",
        threshold: "Όριο βαθμολογίας",
        mode: "Τρόπος ψαρέματος",
        lookahead: "Χρονικό παράθυρο",
        lookaheadOptions: { h12: "12 ώρες", h24: "24 ώρες", h48: "48 ώρες", d7: "7 ημέρες" },
        quietHours: "Ώρες ησυχίας",
        quietFrom: "Από",
        quietTo: "Έως",
        maxFrequency: "Μέγιστη συχνότητα ανά τοποθεσία",
        frequencyOptions: { daily: "1 τη μέρα", twicePerDay: "1 ανά 12ω", fourPerDay: "1 ανά 6ω" },
        alertTypes: "Τύποι ειδοποιήσεων",
        alertGoodWindow: "Καλό παράθυρο",
        alertPressureDrop: "Απότομη πτώση πίεσης",
        alertSafety: "Προειδοποίηση καταιγίδας / ασφαλείας",
        save: "Αποθήκευση ρυθμίσεων ειδοποιήσεων",
        saved: "Αποθηκεύτηκε.",
        needsInstallIOS: "Σε iOS, εγκαταστήστε πρώτα την εφαρμογή στην αρχική οθόνη — οι ειδοποιήσεις λειτουργούν μόνο μετά την εγκατάσταση.",
        permissionDenied: "Η άδεια ειδοποιήσεων απορρίφθηκε στις ρυθμίσεις του browser σας.",
        notSupported: "Οι ειδοποιήσεις push δεν υποστηρίζονται σε αυτόν τον browser.",
      },
    },
    admin: {
      loginTitle: "Σύνδεση διαχειριστή",
      passwordLabel: "Κωδικός πρόσβασης",
      loginSubmit: "Σύνδεση",
      loginError: "Λανθασμένος κωδικός.",
      tabs: { flags: "Λειτουργίες", weights: "Βαρύτητες", spots: "Σημεία", announcement: "Ανακοίνωση", stats: "Στατιστικά" },
      flags: {
        title: "Feature flags",
        description: "Κάθε μη τετριμμένη λειτουργία κυκλοφορεί πίσω από ένα flag, με προεπιλογή μόνο για διαχειριστή.",
        state: { off: "Ανενεργό", adminOnly: "Μόνο διαχειριστής", rollout: "Σταδιακή %", on: "Ενεργό" },
        rolloutPct: "Σταδιακή κυκλοφορία %",
      },
      weights: {
        title: "Ζωντανές βαρύτητες βαθμολόγησης",
        description: "Βαρύτητες παραγόντων ανά τρόπο ψαρέματος. Οι αλλαγές εφαρμόζονται άμεσα σε κάθε σελίδα και στον χάρτη.",
        reset: "Επαναφορά προεπιλογών",
        overridden: "Παρακαμφθέν",
        defaultLabel: "Προεπιλογή",
      },
      spots: {
        title: "Σημεία",
        createTitle: "Προσθήκη σημείου",
        publish: "Δημοσίευση",
        unpublish: "Απόσυρση δημοσίευσης",
        confirmPublish: "Δημοσίευση αυτού του σημείου; Θα γίνει ορατό σε όλους.",
        visibilityPublic: "Δημόσιο",
        visibilityPrivate: "Ιδιωτικό",
      },
      announcement: {
        title: "Πανό ανακοίνωσης",
        description: "Εμφανίζεται σε κάθε επισκέπτη στο πάνω μέρος της εφαρμογής όσο είναι ενεργό.",
        message: "Μήνυμα",
        active: "Ενεργό",
      },
      stats: {
        title: "Στατιστικά χρήσης",
        weatherCacheRows: "Γραμμές cache καιρού",
        activeSubscriptions: "Ενεργές συνδρομές ειδοποιήσεων",
        publicSpots: "Δημόσια σημεία",
        privateSpots: "Ιδιωτικά σημεία",
        thresholdDistribution: "Κατανομή ορίου βαθμολογίας",
        modeDistribution: "Κατανομή τρόπου ψαρέματος",
      },
    },
  },
};
