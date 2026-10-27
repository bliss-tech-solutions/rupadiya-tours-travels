'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ne', label: 'Nepali', native: 'नेपाली', flag: '🇳🇵' }
];

const TRANSLATIONS = {
  en: {
    // Navigation
    bookBus: 'Book a bus',
    discoverTours: 'Discover tours',
    myCalendar: 'My Calendar',
    myTrips: 'My Trips',
    signIn: 'Sign in',
    signOut: 'Sign out',
    profile: 'Profile',
    selectLanguage: 'Language',

    // Hero & Search
    heroTitlePrefix: 'The journey is just as ',
    heroTitleHighlight: 'beautiful',
    heroTitleSuffix: ' as the destination.',
    heroSubtitle: 'Book comfortable bus rides and discover handpicked tours across India, all in one place.',
    trustedOperators: 'Trusted operators',
    easyBooking: 'Easy booking',
    chooseBusRoute: 'Choose your bus route',
    corridorNote: 'Rupadiya ↔ Ahmedabad · Surat · Vadodara · Bengaluru · Hyderabad · Mumbai',
    from: 'From',
    to: 'To',
    departureDate: 'Departure Date',
    searchBuses: 'Search buses',
    whereToGo: 'Where would you want to go?',
    welcomeBack: 'Welcome Back!',
    hiTraveler: 'Hi, Traveler',
    oneWayNote: 'One-way booking · No return date required',
    popularDestinations: 'Popular destinations',
    toursWorthTravelling: 'Tours worth travelling for',
    startingFrom: 'Starting from',
    person: '/person',

    // Search filters
    availableBuses: 'Available Bus List',
    allBuses: 'All Buses',
    acSleeper: 'AC Sleeper',
    nonAcSleeper: 'Non-AC Sleeper',
    acSeater: 'AC Seater',
    nonAcSeater: 'Non-AC Seater',
    farePerSeat: 'Fare per seat',
    viewSeats: 'View Seats',
    seatsLeft: 'seats left',
    noDepartures: 'No departures on this date',
    changeSearch: 'Change Search',

    // Bookings & History
    travelDashboard: 'Travel Dashboard',
    myTripsTitle: 'My Trips & Reservations',
    intercityTickets: 'Intercity Bus Tickets',
    tourEscapes: 'Tour Escapes',
    viewPass: 'View Pass',
    confirmed: 'CONFIRMED',
    seatsLabel: 'Seats',
    noTripsFound: 'No bus journeys booked yet',

    // Calendar
    myCalendarTitle: 'My Travel Calendar',
    calendarSubtitle: 'Your personalized journey schedule & booking dates',
    travelItinerary: 'Travel Itinerary',
    journeysOn: 'Journeys on',
    trip: 'Trip',
    trips: 'Trips',
    viewBoardingPass: 'View Boarding Pass',
    noJourneysOnDate: 'No journeys on this date',

    // Ticket & Boarding Pass
    busBoardingPass: 'Bus Boarding Pass',
    downloadPdf: 'Download PDF',
    print: 'Print',
    confirmedBoardingPass: 'Confirmed Boarding Pass',
    boardingPoint: 'Boarding Point',
    droppingPoint: 'Dropping Point',
    passengerDetails: 'Passenger & Seat Allocations',
    fareBreakdown: 'Fare Breakdown',
    totalPaid: 'Total Amount Paid',
    nextTripCashback: 'Next Trip Cashback',
    copy: 'Copy',
    copied: 'Copied'
  },
  hi: {
    // Navigation
    bookBus: 'बस बुक करें',
    discoverTours: 'टूर खोजें',
    myCalendar: 'मेरा कैलेंडर',
    myTrips: 'मेरी यात्राएं',
    signIn: 'साइन इन करें',
    signOut: 'साइन आउट',
    profile: 'प्रोफ़ाइल',
    selectLanguage: 'भाषा',

    // Hero & Search
    heroTitlePrefix: 'सफ़र भी मंजिल की तरह ',
    heroTitleHighlight: 'खूबसूरत',
    heroTitleSuffix: ' होता है।',
    heroSubtitle: 'आरामदायक बस यात्रा और पूरे भारत में शानदार टूर एक ही स्थान पर बुक करें।',
    trustedOperators: 'विश्वसनीय ऑपरेटर',
    easyBooking: 'आसान बुकिंग',
    chooseBusRoute: 'अपना बस रूट चुनें',
    corridorNote: 'रुपईडीहा ↔ अहमदाबाद · सूरत · वडोदरा · बेंगलुरु · हैदराबाद · मुंबई',
    from: 'कहाँ से',
    to: 'कहाँ तक',
    departureDate: 'यात्रा की तारीख',
    searchBuses: 'बसें खोजें',
    whereToGo: 'आप कहाँ जाना चाहते हैं?',
    welcomeBack: 'वापसी पर स्वागत है!',
    hiTraveler: 'नमस्ते, यात्री',
    oneWayNote: 'एक तरफा बुकिंग · वापसी की तारीख आवश्यक नहीं',
    popularDestinations: 'लोकप्रिय गंतव्य',
    toursWorthTravelling: 'घूमने लायक खास टूर',
    startingFrom: 'शुरुआती किराया',
    person: '/व्यक्ति',

    // Search filters
    availableBuses: 'उपलब्ध बसों की सूची',
    allBuses: 'सभी बसें',
    acSleeper: 'एसी स्लीपर',
    nonAcSleeper: 'नॉन-एसी स्लीपर',
    acSeater: 'एसी सीटर',
    nonAcSeater: 'नॉन-एसी सीटर',
    farePerSeat: 'प्रति सीट किराया',
    viewSeats: 'सीटें देखें',
    seatsLeft: 'सीटें बची हैं',
    noDepartures: 'इस तारीख पर कोई बस उपलब्ध नहीं है',
    changeSearch: 'खोज बदलें',

    // Bookings & History
    travelDashboard: 'यात्रा डैशबोर्ड',
    myTripsTitle: 'मेरी यात्राएं और आरक्षण',
    intercityTickets: 'इंटरसिटी बस टिकट',
    tourEscapes: 'टूर पैकेज',
    viewPass: 'पास देखें',
    confirmed: 'कन्फर्म',
    seatsLabel: 'सीटें',
    noTripsFound: 'अभी तक कोई बस बुक नहीं की गई है',

    // Calendar
    myCalendarTitle: 'मेरा यात्रा कैलेंडर',
    calendarSubtitle: 'आपकी व्यक्तिगत यात्रा कार्यक्रम और तारीखें',
    travelItinerary: 'यात्रा कार्यक्रम',
    journeysOn: 'तारीख पर यात्राएं',
    trip: 'यात्रा',
    trips: 'यात्राएं',
    viewBoardingPass: 'बोर्डिंग पास देखें',
    noJourneysOnDate: 'इस तारीख को कोई यात्रा नहीं है',

    // Ticket & Boarding Pass
    busBoardingPass: 'बस बोर्डिंग पास',
    downloadPdf: 'पीडीएफ डाउनलोड करें',
    print: 'प्रिंट करें',
    confirmedBoardingPass: 'कन्फर्म बोर्डिंग पास',
    boardingPoint: 'बोर्डिंग पॉइंट',
    droppingPoint: 'ड्रॉपिंग पॉइंट',
    passengerDetails: 'यात्री और सीट विवरण',
    fareBreakdown: 'किराया विवरण',
    totalPaid: 'कुल भुगतान राशि',
    nextTripCashback: 'अगली यात्रा पर कैशबैक',
    copy: 'कॉपी करें',
    copied: 'कॉपी हो गया'
  },
  gu: {
    // Navigation
    bookBus: 'બસ બુક કરો',
    discoverTours: 'ટૂર શોધો',
    myCalendar: 'મારું કૅલેન્ડર',
    myTrips: 'મારી યાત્રાઓ',
    signIn: 'સાઇન ઇન',
    signOut: 'સાઇન આઉટ',
    profile: 'પ્રોફાઇલ',
    selectLanguage: 'ભાષા',

    // Hero & Search
    heroTitlePrefix: 'મુસાફરી પણ મુકામ જેટલી જ ',
    heroTitleHighlight: 'સુંદર',
    heroTitleSuffix: ' હોય છે.',
    heroSubtitle: 'આરામદાયક બસ સવારી અને સમગ્ર ભારતમાં પસંદગીના પ્રવાસો એક જ જગ્યાએ બુક કરો.',
    trustedOperators: 'વિશ્વસનીય ઓપરેટરો',
    easyBooking: 'સરળ બુકિંગ',
    chooseBusRoute: 'તમારો બસ રૂટ પસંદ કરો',
    corridorNote: 'રૂપૈડીહા ↔ અમદાવાદ · સુરત · વડોદરા · બેંગલુરુ · હૈદરાબાદ · મુંબઈ',
    from: 'ક્યાંથી',
    to: 'ક્યાં સુધી',
    departureDate: 'પ્રસ્થાન તારીખ',
    searchBuses: 'બસ શોધો',
    whereToGo: 'તમે ક્યાં જવા માંગો છો?',
    welcomeBack: 'પાછા આવવા પર સ્વાગત છે!',
    hiTraveler: 'નમસ્તે, મુસાફર',
    oneWayNote: 'વન-વે બુકિંગ · રીટર્ન તારીખ જરૂરી નથી',
    popularDestinations: 'લોકપ્રિય સ્થળો',
    toursWorthTravelling: 'મુલાકાત લેવા યોગ્ય પ્રવાસો',
    startingFrom: 'પ્રારંભિક ભાડું',
    person: '/વ્યક્તિ',

    // Search filters
    availableBuses: 'ઉપલબ્ધ બસોની યાદી',
    allBuses: 'બધી બસો',
    acSleeper: 'એસી સ્લીપર',
    nonAcSleeper: 'નોન-એસી સ્લીપર',
    acSeater: 'એસી સીટર',
    nonAcSeater: 'નોન-એસી સીટર',
    farePerSeat: 'સીટ દીઠ ભાડું',
    viewSeats: 'સીટો જુઓ',
    seatsLeft: 'સીટો બાકી',
    noDepartures: 'આ તારીખે કોઈ બસ ઉપલબ્ધ નથી',
    changeSearch: 'શોધ બદલો',

    // Bookings & History
    travelDashboard: 'યાત્રા ડેશબોર્ડ',
    myTripsTitle: 'મારી યાત્રાઓ અને ટિકિટો',
    intercityTickets: 'ઇન્ટરસિટી બસ ટિકિટ',
    tourEscapes: 'ટૂર પેકેજ',
    viewPass: 'પાસ જુઓ',
    confirmed: 'કન્ફર્મ',
    seatsLabel: 'સીટો',
    noTripsFound: 'હજી સુધી કોઈ બસ બુક કરાઈ નથી',

    // Calendar
    myCalendarTitle: 'મારું યાત્રા કૅલેન્ડર',
    calendarSubtitle: 'તમારો વ્યક્તિગત યાત્રા કાર્યક્રમ અને તારીખો',
    travelItinerary: 'યાત્રા કાર્યક્રમ',
    journeysOn: 'તારીખે યાત્રા',
    trip: 'યાત્રા',
    trips: 'યાત્રાઓ',
    viewBoardingPass: 'બોર્ડિંગ પાસ જુઓ',
    noJourneysOnDate: 'આ તારીખે કોઈ યાત્રા નથી',

    // Ticket & Boarding Pass
    busBoardingPass: 'બસ બોર્ડિંગ પાસ',
    downloadPdf: 'પીડીએફ ડાઉનલોડ કરો',
    print: 'પ્રિન્ટ કરો',
    confirmedBoardingPass: 'કન્ફર્મ બોર્ડિંગ પાસ',
    boardingPoint: 'બોર્ડિંગ પોઇન્ટ',
    droppingPoint: 'ડ્રોપિંગ પોઇન્ટ',
    passengerDetails: 'મુસાફર અને સીટ વિગતો',
    fareBreakdown: 'ભાડું વિગત',
    totalPaid: 'કુલ ચૂકવેલ રકમ',
    nextTripCashback: 'આગલી યાત્રા પર કૅશબેક',
    copy: 'કૉપિ કરો',
    copied: 'કૉપિ થઈ ગયું'
  },
  ne: {
    // Navigation
    bookBus: 'बस बुक गर्नुहोस्',
    discoverTours: 'टूर खोज्नुहोस्',
    myCalendar: 'मेरो क्यालेन्डर',
    myTrips: 'मेरो यात्राहरू',
    signIn: 'साइन इन',
    signOut: 'साइन आउट',
    profile: 'प्रोफाइल',
    selectLanguage: 'भाषा',

    // Hero & Search
    heroTitlePrefix: 'यात्रा पनि गन्तव्य जत्तिकै ',
    heroTitleHighlight: 'सुन्दर',
    heroTitleSuffix: ' हुन्छ।',
    heroSubtitle: 'आरामदायी बस यात्रा र भारतभरिका उत्कृष्ट भ्रमणहरू एकै ठाउँमा बुक गर्नुहोस्।',
    trustedOperators: 'विश्वसनीय अपरेटरहरू',
    easyBooking: 'सजिलो बुकिङ',
    chooseBusRoute: 'आफ्नो बस रुट छान्नुहोस्',
    corridorNote: 'रुपैडिहा ↔ अहमदाबाद · सुरत · वडोदरा · बेङ्गलोर · हैदराबाद · मुम्बई',
    from: 'कहाँबाट',
    to: 'कहाँसम्म',
    departureDate: 'यात्रा मिति',
    searchBuses: 'बसहरू खोज्नुहोस्',
    whereToGo: 'तपाईं कहाँ जान चाहनुहुन्छ?',
    welcomeBack: 'पुनः स्वागत छ!',
    hiTraveler: 'नमस्ते, यात्री',
    oneWayNote: 'एकतर्फी बुकिङ · फिर्ता मिति आवश्यक छैन',
    popularDestinations: 'लोकप्रिय गन्तव्यहरू',
    toursWorthTravelling: 'घुम्न लायक विशेष भ्रमणहरू',
    startingFrom: 'सुरुवाती भाडा',
    person: '/व्यक्ति',

    // Search filters
    availableBuses: 'उपलब्ध बसहरूको सूची',
    allBuses: 'सबै बसहरू',
    acSleeper: 'एसी स्लीपर',
    nonAcSleeper: 'नन-एसी स्लीपर',
    acSeater: 'एसी सीटर',
    nonAcSeater: 'नन-एसी सीटर',
    farePerSeat: 'प्रति सीट भाडा',
    viewSeats: 'सीटहरू हेर्नुहोस्',
    seatsLeft: 'सीटहरू बाँकी',
    noDepartures: 'यस मितिमा कुनै बस उपलब्ध छैन',
    changeSearch: 'खोज परिवर्तन गर्नुहोस्',

    // Bookings & History
    travelDashboard: 'यात्रा ड्यासबोर्ड',
    myTripsTitle: 'मेरो यात्राहरू र आरक्षण',
    intercityTickets: 'इन्टरसिटी बस टिकट',
    tourEscapes: 'टूर प्याकेज',
    viewPass: 'पास हेर्नुहोस्',
    confirmed: 'पुष्टि भयो',
    seatsLabel: 'सीटहरू',
    noTripsFound: 'अहिलेसम्म कुनै बस बुक गरिएको छैन',

    // Calendar
    myCalendarTitle: 'मेरो यात्रा क्यालेन्डर',
    calendarSubtitle: 'तपाईंको व्यक्तिगत यात्रा तालिका र मितिहरू',
    travelItinerary: 'यात्रा कार्यक्रम',
    journeysOn: 'मितिमा यात्राहरू',
    trip: 'यात्रा',
    trips: 'यात्राहरू',
    viewBoardingPass: 'बोर्डिङ पास हेर्नुहोस्',
    noJourneysOnDate: 'यस मितिमा कुनै यात्रा छैन',

    // Ticket & Boarding Pass
    busBoardingPass: 'बस बोर्डिङ पास',
    downloadPdf: 'पीडीएफ डाउनलोड गर्नुहोस्',
    print: 'प्रिन्ट गर्नुहोस्',
    confirmedBoardingPass: 'पुष्टि गरिएको बोर्डिङ पास',
    boardingPoint: 'बोर्डिङ पोइन्ट',
    droppingPoint: 'ड्रपिङ पोइन्ट',
    passengerDetails: 'यात्री र सीट विवरण',
    fareBreakdown: 'भाडा विवरण',
    totalPaid: 'कुल भुक्तानी रकम',
    nextTripCashback: 'अर्को यात्रामा क्यासब्याक',
    copy: 'कपी गर्नुहोस्',
    copied: 'कपी गरियो'
  }
};

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  languages: LANGUAGES
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ntt_lang') : null;
    if (saved && TRANSLATIONS[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (code) => {
    if (TRANSLATIONS[code]) {
      setLanguageState(code);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ntt_lang', code);
      }
    }
  };

  const t = (key) => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

