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
        poor: "Poor",
        fair: "Fair",
        good: "Good",
        veryGood: "Very good",
        excellent: "Excellent",
      },
      whyTitle: "Why this score?",
      activeVetoes: "Active safety warnings",
      marineCaveat: "No marine data near this point — scoring from wind, pressure and sky alone.",
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
  },
};
