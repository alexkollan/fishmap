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
  };
  analytics: {
    message: string;
    accept: string;
    decline: string;
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
    },
    analytics: {
      message:
        "We use Google Analytics to understand how the app is used. No accounts, no personal data beyond standard analytics cookies.",
      accept: "Accept",
      decline: "Decline",
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
    },
    analytics: {
      message:
        "Χρησιμοποιούμε το Google Analytics για να κατανοήσουμε τη χρήση της εφαρμογής. Χωρίς λογαριασμούς, χωρίς προσωπικά δεδομένα πέρα από τα συνήθη cookies ανάλυσης.",
      accept: "Αποδοχή",
      decline: "Απόρριψη",
    },
  },
};
