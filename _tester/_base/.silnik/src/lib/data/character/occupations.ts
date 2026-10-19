/**
 * Pełna lista zawodów z podręcznika Call of Cthulhu 7e + opisy dla tooltipów.
 *
 * IND-123 (sesja 90) - wyodrębnione z character-wizard.tsx Faza 1.
 * Zaktualizowane w ramach Issue #210 (Podręcznik Badacza CoC 7ed RAW: 94 profesje).
 */

export interface Occupation {
  id: string;
  name: string;
  nameEn?: string;
  formula: string;
  skills: string[];
  creditMin: number;
  creditMax: number;
}

export const OCCUPATIONS: Occupation[] = [
  {
    "id": "antiquarian",
    "name": "Antykwariusz",
    "nameEn": "Antiquarian",
    "formula": "WYK × 4",
    "skills": [
      "Wycena",
      "Historia",
      "Biblioteka",
      "Język Obcy",
      "Język Obcy (2)",
      "Spostrzegawczość",
      "Perswazja",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 70
  },
  {
    "id": "artist",
    "name": "Artysta",
    "nameEn": "Artist",
    "formula": "WYK × 2 + (MOC × 2 lub ZR × 2)",
    "skills": [
      "Sztuka/Rzemiosło",
      "Historia",
      "Język Obcy",
      "Psychologia",
      "Spostrzegawczość",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 50
  },
  {
    "id": "athlete",
    "name": "Atleta",
    "nameEn": "Athlete",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Skok",
      "Rzucanie",
      "Pływanie",
      "Walka Wręcz",
      "Unik",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 70
  },
  {
    "id": "author",
    "name": "Autor",
    "nameEn": "Author",
    "formula": "WYK × 4",
    "skills": [
      "Historia",
      "Biblioteka",
      "Język Ojczysty",
      "Psychologia",
      "Dowolna",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "clergy",
    "name": "Duchowny",
    "nameEn": "Clergy",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Historia",
      "Biblioteka",
      "Nasłuchiwanie",
      "Język Obcy",
      "Psychologia",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 60
  },
  {
    "id": "criminal",
    "name": "Przestępca",
    "nameEn": "Criminal",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Ukrywanie",
      "Skradanie",
      "Zastraszanie",
      "Psychologia",
      "Spostrzegawczość",
      "Walka Wręcz",
      "Ślusarstwo",
      "Broń Palna"
    ],
    "creditMin": 5,
    "creditMax": 65
  },
  {
    "id": "dilettante",
    "name": "Diletant",
    "nameEn": "Dilettante",
    "formula": "WYK × 2 + WYG × 2",
    "skills": [
      "Urok Osobisty",
      "Sztuka/Rzemiosło",
      "Historia",
      "Język Obcy",
      "Jeździectwo",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 50,
    "creditMax": 99
  },
  {
    "id": "doctor",
    "name": "Lekarz",
    "nameEn": "Doctor of Medicine",
    "formula": "WYK × 4",
    "skills": [
      "Pierwsza Pomoc",
      "Język Obcy (łacina)",
      "Medycyna",
      "Psychologia",
      "Nauka (Biologia)",
      "Nauka (Farmakologia)",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 80
  },
  {
    "id": "drifter",
    "name": "Włóczęga",
    "nameEn": "Drifter",
    "formula": "WYK × 2 + (WYG × 2 lub ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Skok",
      "Ukrywanie",
      "Nasłuchiwanie",
      "Orientacja",
      "Skradanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 0,
    "creditMax": 5
  },
  {
    "id": "engineer",
    "name": "Inżynier",
    "nameEn": "Engineer",
    "formula": "WYK × 4",
    "skills": [
      "Sztuka/Rzemiosło",
      "Elektryka",
      "Biblioteka",
      "Mechanika",
      "Nauka (Fizyka)",
      "Nauka (Geologia)",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 60
  },
  {
    "id": "entertainer",
    "name": "Artysta Estradowy",
    "nameEn": "Entertainer",
    "formula": "WYK × 2 + WYG × 2",
    "skills": [
      "Urok Osobisty",
      "Przebranie",
      "Sztuka/Rzemiosło",
      "Nasłuchiwanie",
      "Psychologia",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 70
  },
  {
    "id": "farmer",
    "name": "Farmer",
    "nameEn": "Farmer",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Sztuka/Rzemiosło",
      "Obsługa Ciężkiego Sprzętu",
      "Mechanika",
      "Orientacja",
      "Nauka (Biologia)",
      "Tropienie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "hacker",
    "name": "Haker/Programista",
    "nameEn": "Hacker / Computer Programmer",
    "formula": "WYK × 4",
    "skills": [
      "Komputery",
      "Elektryka",
      "Biblioteka",
      "Spostrzegawczość",
      "Dowolna",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 70
  },
  {
    "id": "journalist",
    "name": "Dziennikarz",
    "nameEn": "Journalist",
    "formula": "WYK × 4",
    "skills": [
      "Historia",
      "Biblioteka",
      "Język Ojczysty",
      "Perswazja",
      "Psychologia",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "lawyer",
    "name": "Prawnik",
    "nameEn": "Lawyer",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Biblioteka",
      "Perswazja",
      "Prawo",
      "Psychologia",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 80
  },
  {
    "id": "librarian",
    "name": "Bibliotekarz",
    "nameEn": "Librarian",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Historia",
      "Biblioteka",
      "Język Obcy",
      "Język Ojczysty",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 35
  },
  {
    "id": "military",
    "name": "Wojskowy",
    "nameEn": "Military Serviceman",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Walka Wręcz",
      "Broń Palna",
      "Pierwsza Pomoc",
      "Mechanika",
      "Skradanie",
      "Pływanie",
      "Przetrwanie"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "nurse",
    "name": "Pielęgniarz/Pielęgniarka",
    "nameEn": "Nurse",
    "formula": "WYK × 4",
    "skills": [
      "Pierwsza Pomoc",
      "Nasłuchiwanie",
      "Medycyna",
      "Język Obcy (łacina)",
      "Psychologia",
      "Nauka (Biologia)",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "parapsychologist",
    "name": "Parapsycholog",
    "nameEn": "Parapsychologist",
    "formula": "WYK × 4",
    "skills": [
      "Antropologia",
      "Historia",
      "Biblioteka",
      "Okultyzm",
      "Język Obcy",
      "Psychologia",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "pilot",
    "name": "Pilot",
    "nameEn": "Pilot",
    "formula": "WYK × 2 + ZR × 2",
    "skills": [
      "Elektryka",
      "Mechanika",
      "Orientacja",
      "Pilotowanie",
      "Nauka (Astronomia)",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 70
  },
  {
    "id": "police_detective",
    "name": "Detektyw Policyjny",
    "nameEn": "Police Detective",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Prawo",
      "Nasłuchiwanie",
      "Psychologia",
      "Spostrzegawczość",
      "Perswazja",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 50
  },
  {
    "id": "police_officer",
    "name": "Policjant",
    "nameEn": "Police Officer",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Walka Wręcz",
      "Broń Palna",
      "Pierwsza Pomoc",
      "Prawo",
      "Psychologia",
      "Spostrzegawczość",
      "Prowadzenie Samochodu",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "private_investigator",
    "name": "Prywatny Detektyw",
    "nameEn": "Private Investigator",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Biblioteka",
      "Prawo",
      "Ukrywanie",
      "Psychologia",
      "Perswazja",
      "Spostrzegawczość",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "professor",
    "name": "Profesor",
    "nameEn": "Professor",
    "formula": "WYK × 4",
    "skills": [
      "Biblioteka",
      "Język Obcy",
      "Język Ojczysty",
      "Psychologia",
      "Dowolna",
      "Dowolna",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 70
  },
  {
    "id": "sailor",
    "name": "Marynarz",
    "nameEn": "Sailor",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Mechanika",
      "Orientacja",
      "Pilotowanie (Łódź)",
      "Pływanie",
      "Walka Wręcz",
      "Rzucanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "scientist",
    "name": "Naukowiec",
    "nameEn": "Scientist",
    "formula": "WYK × 4",
    "skills": [
      "Komputery",
      "Biblioteka",
      "Język Obcy",
      "Język Ojczysty",
      "Nauka (Specjalizacja)",
      "Nauka (Druga)",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 50
  },
  {
    "id": "soldier",
    "name": "Żołnierz",
    "nameEn": "Soldier",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Walka Wręcz",
      "Broń Palna (Karabin)",
      "Unik",
      "Pierwsza Pomoc",
      "Skradanie",
      "Przetrwanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "spy",
    "name": "Szpieg",
    "nameEn": "Spy",
    "formula": "WYK × 2 + (WYG × 2 lub ZR × 2)",
    "skills": [
      "Przebranie",
      "Ukrywanie",
      "Nasłuchiwanie",
      "Język Obcy",
      "Psychologia",
      "Skradanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 60
  },
  {
    "id": "tribe_member",
    "name": "Członek Plemienia",
    "nameEn": "Tribe Member",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Nasłuchiwanie",
      "Orientacja",
      "Okultyzm",
      "Pływanie",
      "Przetrwanie",
      "Rzucanie",
      "Tropienie"
    ],
    "creditMin": 0,
    "creditMax": 15
  },
  {
    "id": "federal_agent",
    "name": "Agent Federalny",
    "nameEn": "Federal Agent",
    "formula": "WYK × 4",
    "skills": [
      "Broń Palna",
      "Perswazja",
      "Prawo",
      "Prowadzenie Samochodu",
      "Spostrzegawczość",
      "Ukrywanie",
      "Walka Wręcz",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 40
  },
  {
    "id": "acrobat",
    "name": "Akrobata",
    "nameEn": "Acrobat",
    "formula": "WYK × 2 + ZR × 2",
    "skills": [
      "Pływanie",
      "Rzucanie",
      "Skok",
      "Spostrzegawczość",
      "Unik",
      "Wspinaczka",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 20
  },
  {
    "id": "actor",
    "name": "Aktor",
    "nameEn": "Actor",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Przebranie",
      "Historia",
      "Psychologia",
      "Sztuka/Rzemiosło",
      "Walka Wręcz",
      "Perswazja",
      "Urok Osobisty",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 40
  },
  {
    "id": "alienist",
    "name": "Alienista",
    "nameEn": "Alienist",
    "formula": "WYK × 4",
    "skills": [
      "Język Obcy",
      "Medycyna",
      "Nauka (Biologia)",
      "Nauka (Chemia)",
      "Nasłuchiwanie",
      "Prawo",
      "Psychoanaliza",
      "Psychologia"
    ],
    "creditMin": 10,
    "creditMax": 60
  },
  {
    "id": "archaeologist",
    "name": "Archeolog",
    "nameEn": "Archaeologist",
    "formula": "WYK × 4",
    "skills": [
      "Archeologia",
      "Historia",
      "Język Obcy",
      "Biblioteka",
      "Mechanika",
      "Orientacja",
      "Spostrzegawczość",
      "Wycena"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "architect",
    "name": "Architekt",
    "nameEn": "Architect",
    "formula": "WYK × 4",
    "skills": [
      "Język Ojczysty",
      "Biblioteka",
      "Księgowość",
      "Nauka (Matematyka)",
      "Perswazja",
      "Prawo",
      "Psychologia",
      "Sztuka/Rzemiosło"
    ],
    "creditMin": 30,
    "creditMax": 70
  },
  {
    "id": "bartender",
    "name": "Barman",
    "nameEn": "Bartender",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Księgowość",
      "Nasłuchiwanie",
      "Psychologia",
      "Spostrzegawczość",
      "Walka Wręcz",
      "Gadanina",
      "Perswazja",
      "Dowolna"
    ],
    "creditMin": 8,
    "creditMax": 25
  },
  {
    "id": "wealthy_hobbyist",
    "name": "Bogaty Hobbysta",
    "nameEn": "Wealthy Hobbyist",
    "formula": "WYK × 2 + (APP × 2 lub ZR × 2)",
    "skills": [
      "Broń Palna",
      "Jeździectwo",
      "Język Obcy",
      "Sztuka/Rzemiosło",
      "Urok Osobisty",
      "Perswazja",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 50,
    "creditMax": 99
  },
  {
    "id": "boxer",
    "name": "Bokser / Zapaśnik",
    "nameEn": "Boxer / Wrestler",
    "formula": "WYK × 2 + S × 2",
    "skills": [
      "Psychologia",
      "Skok",
      "Spostrzegawczość",
      "Unik",
      "Walka Wręcz (Bijatyka)",
      "Zastraszanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 60
  },
  {
    "id": "deprogrammer",
    "name": "Deprogramator",
    "nameEn": "Deprogrammer",
    "formula": "WYK × 4",
    "skills": [
      "Gadanina",
      "Perswazja",
      "Psychoanaliza",
      "Psychologia",
      "Prowadzenie Samochodu",
      "Ukrywanie",
      "Zastraszanie",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 50
  },
  {
    "id": "agency_detective",
    "name": "Detektyw Agencji",
    "nameEn": "Agency Detective",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Biblioteka",
      "Prawo",
      "Psychologia",
      "Spostrzegawczość",
      "Ślusarstwo",
      "Ukrywanie",
      "Walka Wręcz"
    ],
    "creditMin": 20,
    "creditMax": 45
  },
  {
    "id": "union_organizer",
    "name": "Działacz Związkowy",
    "nameEn": "Union Organizer",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Prawo",
      "Nasłuchiwanie",
      "Perswazja",
      "Psychologia",
      "Zastraszanie",
      "Walka Wręcz",
      "Dowolna"
    ],
    "creditMin": 5,
    "creditMax": 30
  },
  {
    "id": "gentleman_lady",
    "name": "Dżentelmen / Dama",
    "nameEn": "Gentleman / Lady",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Sztuka/Rzemiosło",
      "Urok Osobisty",
      "Historia",
      "Język Obcy",
      "Jeździectwo",
      "Prawo",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 40,
    "creditMax": 90
  },
  {
    "id": "fanatic",
    "name": "Fanatyk",
    "nameEn": "Fanatic",
    "formula": "WYK × 2 + (APP × 2 lub MOC × 2)",
    "skills": [
      "Historia",
      "Perswazja",
      "Psychologia",
      "Ukrywanie",
      "Zastraszanie",
      "Gadanina",
      "Walka Wręcz",
      "Dowolna"
    ],
    "creditMin": 0,
    "creditMax": 30
  },
  {
    "id": "pharmacist",
    "name": "Farmaceuta",
    "nameEn": "Pharmacist",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Pierwsza Pomoc",
      "Język Obcy (łacina)",
      "Nauka (Biologia)",
      "Nauka (Chemia)",
      "Nauka (Farmacja)",
      "Perswazja",
      "Psychologia"
    ],
    "creditMin": 35,
    "creditMax": 75
  },
  {
    "id": "photographer",
    "name": "Fotograf / Fotoreporter",
    "nameEn": "Photographer",
    "formula": "WYK × 4",
    "skills": [
      "Sztuka/Rzemiosło (Fotografia)",
      "Nauka (Chemia)",
      "Spostrzegawczość",
      "Psychologia",
      "Gadanina",
      "Ukrywanie",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "public_official",
    "name": "Funkcjonariusz Publiczny",
    "nameEn": "Public Official",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Księgowość",
      "Historia",
      "Prawo",
      "Nasłuchiwanie",
      "Perswazja",
      "Psychologia",
      "Urok Osobisty",
      "Zastraszanie"
    ],
    "creditMin": 50,
    "creditMax": 90
  },
  {
    "id": "gangster",
    "name": "Gangster",
    "nameEn": "Gangster",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Walka Wręcz",
      "Zastraszanie",
      "Psychologia",
      "Spostrzegawczość",
      "Prowadzenie Samochodu",
      "Prawo",
      "Gadanina"
    ],
    "creditMin": 20,
    "creditMax": 80
  },
  {
    "id": "antique_dealer",
    "name": "Handlarz Antykami",
    "nameEn": "Antique Dealer",
    "formula": "WYK × 4",
    "skills": [
      "Wycena",
      "Historia",
      "Biblioteka",
      "Język Obcy",
      "Spostrzegawczość",
      "Perswazja",
      "Prowadzenie Samochodu",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 70
  },
  {
    "id": "gambler",
    "name": "Hazardzista",
    "nameEn": "Gambler",
    "formula": "WYK × 2 + (APP × 2 lub ZR × 2)",
    "skills": [
      "Księgowość",
      "Gadanina",
      "Psychologia",
      "Zręczne Palce",
      "Spostrzegawczość",
      "Ukrywanie",
      "Perswazja",
      "Dowolna"
    ],
    "creditMin": 8,
    "creditMax": 60
  },
  {
    "id": "butler",
    "name": "Kamerdyner / Lokaj",
    "nameEn": "Butler / Valet",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Sztuka/Rzemiosło",
      "Pierwsza Pomoc",
      "Nasłuchiwanie",
      "Psychologia",
      "Urok Osobisty",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 20
  },
  {
    "id": "stuntman",
    "name": "Kaskader",
    "nameEn": "Stuntman",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Skok",
      "Wspinaczka",
      "Pływanie",
      "Unik",
      "Prowadzenie Samochodu",
      "Obsługa Ciężkiego Sprzętu",
      "Pierwsza Pomoc",
      "Walka Wręcz"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "waiter",
    "name": "Kelner",
    "nameEn": "Waiter / Waitress",
    "formula": "WYK × 2 + (APP × 2 lub ZR × 2)",
    "skills": [
      "Księgowość",
      "Nasłuchiwanie",
      "Psychologia",
      "Spostrzegawczość",
      "Urok Osobisty",
      "Gadanina",
      "Unik",
      "Dowolna"
    ],
    "creditMin": 5,
    "creditMax": 20
  },
  {
    "id": "driver",
    "name": "Kierowca / Taksówkarz",
    "nameEn": "Chauffeur / Driver",
    "formula": "WYK × 2 + ZR × 2",
    "skills": [
      "Prowadzenie Samochodu",
      "Mechanika",
      "Elektryka",
      "Orientacja",
      "Nasłuchiwanie",
      "Spostrzegawczość",
      "Gadanina",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "salesman",
    "name": "Komiwojażer",
    "nameEn": "Traveling Salesman",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Gadanina",
      "Perswazja",
      "Psychologia",
      "Prowadzenie Samochodu",
      "Księgowość",
      "Nasłuchiwanie",
      "Urok Osobisty",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 40
  },
  {
    "id": "foreign_correspondent",
    "name": "Korespondent Zagraniczny",
    "nameEn": "Foreign Correspondent",
    "formula": "WYK × 4",
    "skills": [
      "Historia",
      "Język Obcy",
      "Język Ojczysty",
      "Nasłuchiwanie",
      "Perswazja",
      "Psychologia",
      "Prowadzenie Samochodu",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "cowboy",
    "name": "Kowboj",
    "nameEn": "Cowboy",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Jeździectwo",
      "Rzucanie",
      "Skok",
      "Pierwsza Pomoc",
      "Przetrwanie",
      "Tropienie",
      "Walka Wręcz"
    ],
    "creditMin": 9,
    "creditMax": 20
  },
  {
    "id": "bookseller",
    "name": "Księgarz",
    "nameEn": "Bookseller",
    "formula": "WYK × 4",
    "skills": [
      "Biblioteka",
      "Księgowość",
      "Historia",
      "Język Obcy",
      "Język Ojczysty",
      "Wycena",
      "Psychologia",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 40
  },
  {
    "id": "accountant",
    "name": "Księgowy",
    "nameEn": "Accountant",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Prawo",
      "Biblioteka",
      "Nauka (Matematyka)",
      "Perswazja",
      "Spostrzegawczość",
      "Psychologia",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 70
  },
  {
    "id": "curator",
    "name": "Kustosz",
    "nameEn": "Museum Curator",
    "formula": "WYK × 4",
    "skills": [
      "Historia",
      "Archeologia",
      "Biblioteka",
      "Język Obcy",
      "Wycena",
      "Sztuka/Rzemiosło",
      "Psychologia",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 30
  },
  {
    "id": "lab_assistant",
    "name": "Laborant",
    "nameEn": "Laboratory Assistant",
    "formula": "WYK × 4",
    "skills": [
      "Nauka (Chemia)",
      "Nauka (Biologia)",
      "Medycyna",
      "Mechanika",
      "Elektryka",
      "Biblioteka",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 30
  },
  {
    "id": "forensic_specialist",
    "name": "Lekarz Medycyny Sądowej",
    "nameEn": "Forensic Specialist",
    "formula": "WYK × 4",
    "skills": [
      "Medycyna",
      "Nauka (Biologia)",
      "Nauka (Chemia)",
      "Nauka (Farmacja)",
      "Prawo",
      "Spostrzegawczość",
      "Biblioteka",
      "Pierwsza Pomoc"
    ],
    "creditMin": 30,
    "creditMax": 60
  },
  {
    "id": "big_game_hunter",
    "name": "Łowca Grubego Zwierza",
    "nameEn": "Big Game Hunter",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna (Karabin)",
      "Przetrwanie",
      "Tropienie",
      "Ukrywanie",
      "Nasłuchiwanie",
      "Spostrzegawczość",
      "Wiedza o Naturze",
      "Pierwsza Pomoc"
    ],
    "creditMin": 20,
    "creditMax": 50
  },
  {
    "id": "bounty_hunter",
    "name": "Łowca Nagród",
    "nameEn": "Bounty Hunter",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Walka Wręcz",
      "Prawo",
      "Spostrzegawczość",
      "Tropienie",
      "Ukrywanie",
      "Zastraszanie",
      "Prowadzenie Samochodu"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "mechanic",
    "name": "Mechanik",
    "nameEn": "Mechanic",
    "formula": "WYK × 4",
    "skills": [
      "Mechanika",
      "Elektryka",
      "Obsługa Ciężkiego Sprzętu",
      "Prowadzenie Samochodu",
      "Sztuka/Rzemiosło",
      "Spostrzegawczość",
      "Walka Wręcz",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 40
  },
  {
    "id": "missionary",
    "name": "Misjonarz",
    "nameEn": "Missionary",
    "formula": "WYK × 4",
    "skills": [
      "Sztuka/Rzemiosło",
      "Pierwsza Pomoc",
      "Historia",
      "Język Obcy",
      "Perswazja",
      "Przetrwanie",
      "Wiedza o Naturze",
      "Dowolna"
    ],
    "creditMin": 0,
    "creditMax": 10
  },
  {
    "id": "musician",
    "name": "Muzyk",
    "nameEn": "Musician",
    "formula": "WYK × 2 + (APP × 2 lub ZR × 2)",
    "skills": [
      "Sztuka/Rzemiosło (Muzyka)",
      "Nasłuchiwanie",
      "Psychologia",
      "Perswazja",
      "Urok Osobisty",
      "Gadanina",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "diver",
    "name": "Nurek",
    "nameEn": "Diver",
    "formula": "WYK × 2 + ZR × 2",
    "skills": [
      "Pływanie",
      "Mechanika",
      "Pierwsza Pomoc",
      "Spostrzegawczość",
      "Nauka (Biologia)",
      "Nauka (Fizyka)",
      "Obsługa Ciężkiego Sprzętu",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "explorer",
    "name": "Odkrywca",
    "nameEn": "Explorer",
    "formula": "WYK × 2 + (APP × 2 lub S × 2)",
    "skills": [
      "Historia",
      "Język Obcy",
      "Orientacja",
      "Przetrwanie",
      "Wspinaczka",
      "Pływanie",
      "Pierwsza Pomoc",
      "Broń Palna"
    ],
    "creditMin": 0,
    "creditMax": 45
  },
  {
    "id": "military_officer",
    "name": "Oficer Wojskowy",
    "nameEn": "Military Officer",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna",
      "Walka Wręcz",
      "Orientacja",
      "Pierwsza Pomoc",
      "Przetrwanie",
      "Psychologia",
      "Perswazja",
      "Zastraszanie"
    ],
    "creditMin": 20,
    "creditMax": 70
  },
  {
    "id": "occultist",
    "name": "Okultysta",
    "nameEn": "Occultist",
    "formula": "WYK × 4",
    "skills": [
      "Okultyzm",
      "Historia",
      "Biblioteka",
      "Język Obcy",
      "Nauka (Astronomia)",
      "Spostrzegawczość",
      "Gadanina",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 65
  },
  {
    "id": "zookeeper",
    "name": "Opiekun Zwierząt w Zoo",
    "nameEn": "Zookeeper",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Pierwsza Pomoc",
      "Nauka (Zoologia)",
      "Wiedza o Naturze",
      "Spostrzegawczość",
      "Unik",
      "Walka Wręcz",
      "Obsługa Ciężkiego Sprzętu",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 20
  },
  {
    "id": "prospector",
    "name": "Poszukiwacz",
    "nameEn": "Prospector",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Nauka (Geologia)",
      "Historia",
      "Orientacja",
      "Przetrwanie",
      "Spostrzegawczość",
      "Pierwsza Pomoc",
      "Walka Wręcz"
    ],
    "creditMin": 0,
    "creditMax": 10
  },
  {
    "id": "laborer",
    "name": "Pracownik Fizyczny",
    "nameEn": "Laborer",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Obsługa Ciężkiego Sprzętu",
      "Mechanika",
      "Pierwsza Pomoc",
      "Rzucanie",
      "Skok",
      "Walka Wręcz",
      "Wspinaczka",
      "Dowolna"
    ],
    "creditMin": 5,
    "creditMax": 30
  },
  {
    "id": "academic",
    "name": "Pracownik Naukowy",
    "nameEn": "Academic",
    "formula": "WYK × 4",
    "skills": [
      "Biblioteka",
      "Język Obcy",
      "Język Ojczysty",
      "Psychologia",
      "Nauka (Biologia)",
      "Nauka (Chemia)",
      "Nauka (Fizyka)",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 30
  },
  {
    "id": "clerk",
    "name": "Pracownik Umysłowy",
    "nameEn": "Clerk",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Prawo",
      "Biblioteka",
      "Język Ojczysty",
      "Perswazja",
      "Spostrzegawczość",
      "Psychologia",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 20
  },
  {
    "id": "designer",
    "name": "Projektant",
    "nameEn": "Designer",
    "formula": "WYK × 4",
    "skills": [
      "Sztuka/Rzemiosło",
      "Mechanika",
      "Psychologia",
      "Spostrzegawczość",
      "Księgowość",
      "Perswazja",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 20,
    "creditMax": 60
  },
  {
    "id": "sex_worker",
    "name": "Prostytutka",
    "nameEn": "Sex Worker",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Sztuka/Rzemiosło",
      "Urok Osobisty",
      "Przebranie",
      "Nasłuchiwanie",
      "Psychologia",
      "Spostrzegawczość",
      "Unik",
      "Walka Wręcz"
    ],
    "creditMin": 5,
    "creditMax": 50
  },
  {
    "id": "undertaker",
    "name": "Przedsiębiorca Pogrzebowy",
    "nameEn": "Undertaker",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Historia",
      "Medycyna",
      "Okultyzm",
      "Perswazja",
      "Psychologia",
      "Nauka (Chemia)",
      "Sztuka/Rzemiosło"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "cult_leader",
    "name": "Przywódca Kultu",
    "nameEn": "Cult Leader",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Księgowość",
      "Gadanina",
      "Historia",
      "Okultyzm",
      "Perswazja",
      "Psychologia",
      "Urok Osobisty",
      "Zastraszanie"
    ],
    "creditMin": 30,
    "creditMax": 60
  },
  {
    "id": "psychiatrist",
    "name": "Psychiatra",
    "nameEn": "Psychiatrist",
    "formula": "WYK × 4",
    "skills": [
      "Medycyna",
      "Psychoanaliza",
      "Psychologia",
      "Język Obcy (łacina)",
      "Nauka (Biologia)",
      "Nauka (Chemia)",
      "Perswazja",
      "Dowolna"
    ],
    "creditMin": 30,
    "creditMax": 80
  },
  {
    "id": "psychologist",
    "name": "Psycholog / Psychoanalityk",
    "nameEn": "Psychologist",
    "formula": "WYK × 4",
    "skills": [
      "Psychoanaliza",
      "Psychologia",
      "Biblioteka",
      "Język Obcy",
      "Nauka (Biologia)",
      "Perswazja",
      "Historia",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "editor",
    "name": "Redaktor",
    "nameEn": "Editor",
    "formula": "WYK × 4",
    "skills": [
      "Księgowość",
      "Historia",
      "Język Ojczysty",
      "Język Obcy",
      "Biblioteka",
      "Perswazja",
      "Psychologia",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 30
  },
  {
    "id": "artisan",
    "name": "Rękodzielnik",
    "nameEn": "Artisan / Craftsman",
    "formula": "WYK × 2 + ZR × 2",
    "skills": [
      "Sztuka/Rzemiosło",
      "Mechanika",
      "Wycena",
      "Księgowość",
      "Spostrzegawczość",
      "Psychologia",
      "Dowolna",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "hospital_orderly",
    "name": "Salowy",
    "nameEn": "Hospital Orderly",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Pierwsza Pomoc",
      "Nasłuchiwanie",
      "Spostrzegawczość",
      "Psychologia",
      "Ukrywanie",
      "Walka Wręcz",
      "Mechanika",
      "Dowolna"
    ],
    "creditMin": 6,
    "creditMax": 15
  },
  {
    "id": "asylum_attendant",
    "name": "Sanitariusz Psychiatryczny",
    "nameEn": "Asylum Attendant",
    "formula": "WYK × 2 + S × 2",
    "skills": [
      "Pierwsza Pomoc",
      "Psychologia",
      "Unik",
      "Walka Wręcz",
      "Zastraszanie",
      "Spostrzegawczość",
      "Nasłuchiwanie",
      "Ukrywanie"
    ],
    "creditMin": 6,
    "creditMax": 15
  },
  {
    "id": "secretary",
    "name": "Sekretarz / Sekretarka",
    "nameEn": "Secretary",
    "formula": "WYK × 2 + APP × 2",
    "skills": [
      "Księgowość",
      "Biblioteka",
      "Język Ojczysty",
      "Sztuka/Rzemiosło",
      "Psychologia",
      "Urok Osobisty",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "judge",
    "name": "Sędzia",
    "nameEn": "Judge",
    "formula": "WYK × 4",
    "skills": [
      "Prawo",
      "Historia",
      "Biblioteka",
      "Psychologia",
      "Perswazja",
      "Zastraszanie",
      "Nasłuchiwanie",
      "Język Ojczysty"
    ],
    "creditMin": 50,
    "creditMax": 90
  },
  {
    "id": "shopkeeper",
    "name": "Sklepikarz",
    "nameEn": "Shopkeeper",
    "formula": "WYK × 2 + (APP × 2 lub ZR × 2)",
    "skills": [
      "Księgowość",
      "Perswazja",
      "Psychologia",
      "Spostrzegawczość",
      "Nasłuchiwanie",
      "Elektryka",
      "Mechanika",
      "Gadanina"
    ],
    "creditMin": 20,
    "creditMax": 40
  },
  {
    "id": "firefighter",
    "name": "Strażak",
    "nameEn": "Firefighter",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Mechanika",
      "Obsługa Ciężkiego Sprzętu",
      "Pierwsza Pomoc",
      "Prowadzenie Samochodu",
      "Rzucanie",
      "Skok",
      "Unik",
      "Wspinaczka"
    ],
    "creditMin": 9,
    "creditMax": 30
  },
  {
    "id": "student",
    "name": "Student / Stażysta",
    "nameEn": "Student / Intern",
    "formula": "WYK × 4",
    "skills": [
      "Biblioteka",
      "Język Obcy",
      "Język Ojczysty",
      "Nasłuchiwanie",
      "Nauka",
      "Nauka (Druga)",
      "Spostrzegawczość",
      "Dowolna"
    ],
    "creditMin": 5,
    "creditMax": 10
  },
  {
    "id": "hobo",
    "name": "Tramp",
    "nameEn": "Hobo",
    "formula": "WYK × 2 + (ZR × 2 lub APP × 2)",
    "skills": [
      "Sztuka/Rzemiosło",
      "Skok",
      "Nasłuchiwanie",
      "Orientacja",
      "Ślusarstwo",
      "Ukrywanie",
      "Gadanina",
      "Przetrwanie"
    ],
    "creditMin": 0,
    "creditMax": 5
  },
  {
    "id": "trapper",
    "name": "Traper",
    "nameEn": "Trapper",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Broń Palna (Karabin)",
      "Przetrwanie",
      "Tropienie",
      "Wiedza o Naturze",
      "Pierwsza Pomoc",
      "Nasłuchiwanie",
      "Spostrzegawczość",
      "Skradanie"
    ],
    "creditMin": 0,
    "creditMax": 20
  },
  {
    "id": "animal_trainer",
    "name": "Treser",
    "nameEn": "Animal Trainer",
    "formula": "WYK × 2 + (APP × 2 lub MOC × 2)",
    "skills": [
      "Wiedza o Naturze",
      "Psychologia",
      "Nauka (Zoologia)",
      "Spostrzegawczość",
      "Tropienie",
      "Ukrywanie",
      "Skok",
      "Dowolna"
    ],
    "creditMin": 10,
    "creditMax": 40
  },
  {
    "id": "mountain_climber",
    "name": "Wspinacz Wysokogórski",
    "nameEn": "Mountain Climber",
    "formula": "WYK × 2 + (ZR × 2 lub S × 2)",
    "skills": [
      "Wspinaczka",
      "Skok",
      "Przetrwanie",
      "Orientacja",
      "Pierwsza Pomoc",
      "Nasłuchiwanie",
      "Spostrzegawczość",
      "Język Obcy"
    ],
    "creditMin": 30,
    "creditMax": 60
  }
];

export const OCCUPATION_DESCRIPTIONS: Record<string, string> = {
  "antiquarian": "Handlarz starociami i artefaktami. Posiada rozległą wiedzę o przedmiotach historycznych i często natrafia na tajemnicze przedmioty.",
  "artist": "Twórca dzieł sztuki - malarz, rzeźbiarz, muzyk. Wrażliwy na piękno, ale i na ciemne strony świata.",
  "athlete": "Zawodowy sportowiec. Doskonała forma fizyczna, ale ograniczone umiejętności intelektualne.",
  "author": "Pisarz książek lub artykułów. Bystry obserwator ludzkiej natury z bogatą wyobraźnią.",
  "clergy": "Duchowny religijny. Głęboka wiara może być zarówno tarczą jak i słabością wobec kosmicznej grozy.",
  "criminal": "Przestępca - złodziej, gangster, oszust. Posiada cenne umiejętności, ale żyje na marginesie społeczeństwa.",
  "dilettante": "Bogaty amator wielu dziedzin. Ma pieniądze i czas wolny, ale brak mu głębokiej wiedzy.",
  "doctor": "Lekarz medycyny. Może leczyć rany i choroby, ceniony w każdej grupie.",
  "drifter": "Włóczęga, bezdomny. Zna życie na ulicy i potrafi przetrwać w trudnych warunkach.",
  "engineer": "Inżynier - budowniczy maszyn i konstrukcji. Praktyczny umysł rozwiązujący techniczne problemy.",
  "entertainer": "Artysta estradowy - aktor, komik, piosenkarz. Potrafi przyciągnąć uwagę i manipulować emocjami.",
  "farmer": "Rolnik pracujący na roli. Silny, praktyczny, związany z ziemią.",
  "hacker": "Programista komputerowy (era współczesna). Ekspert od technologii i informacji.",
  "journalist": "Dziennikarz śledczy. Dociekliwy, szukający prawdy za wszelką cenę.",
  "lawyer": "Prawnik i adwokat. Zna prawo i potrafi przekonywać argumentami.",
  "librarian": "Bibliotekarz strażnik wiedzy. Doskonały w badaniach i znajdowaniu informacji.",
  "military": "Żołnierz lub oficer wojskowy. Zdyscyplinowany i wyszkolony do walki.",
  "nurse": "Pielęgniarz/Pielęgniarka. Opiekun chorych z praktyczną wiedzą medyczną.",
  "parapsychologist": "Badacz zjawisk nadprzyrodzonych. Balansuje między nauką a okultyzmem.",
  "pilot": "Pilot samolotów lub innych pojazdów. Odważny i precyzyjny.",
  "police_detective": "Detektyw policyjny. Śledzi przestępców i rozwiązuje zagadki kryminalne.",
  "police_officer": "Funkcjonariusz policji. Stoi na straży prawa i porządku.",
  "private_investigator": "Prywatny detektyw. Pracuje poza systemem, rozwiązując sprawy za pieniądze.",
  "professor": "Profesor uniwersytecki. Autorytet w swojej dziedzinie z dostępem do akademickich zasobów.",
  "sailor": "Marynarz na statkach. Zahartowany przez morze i podróże.",
  "scientist": "Naukowiec badawczy. Szuka odpowiedzi metodami naukowymi.",
  "soldier": "Żołnierz walczący na froncie. Weteran bitew z traumą wojenną.",
  "spy": "Szpieg lub agent wywiadu. Mistrz kamuflażu i zdobywania informacji.",
  "tribe_member": "Członek plemienia. Związany z naturą i tradycyjnymi wierzeniami.",
  "federal_agent": "Funkcjonariusz federalnych organów ścigania (BOI/FBI, Secret Service, US Marshals). Prowadzi śledztwa w sprawach przestępstw międzystanowych i przeciwko rządowi.",
  "acrobat": "Gimnastyk lub cyrkowiec prezentujący niezwykłą sprawność fizyczną, zmysł równowagi i elastyczność podczas występów publicznych.",
  "actor": "Aktor teatralny lub gwiazda filmowa kina niemego i dźwiękowego. Potrafi wcielać się w różnorodne role, modulować głos i panować nad emocjami.",
  "alienist": "Wczesny psychiatra z lat 20. XX wieku badający i diagnozujący zaburzenia psychiczne, obłęd oraz anomalie zachowania ludzkiego umysłu.",
  "archaeologist": "Naukowiec badający przeszłość ludzkości poprzez wykopaliska, inskrypcje i odnalezione artefakty pradawnych cywilizacji.",
  "architect": "Projektant budynków, założeń miejskich i wielkich konstrukcji. Zna wytrzymałość materiałów, plany architektoniczne i tajniki budowlane.",
  "bartender": "Pracownik wyszynku, w latach 20. często zatrudniony w nielegalnych lokalach (speakeasies). Powiernik sekretów i bystry obserwator ludzkiej natury.",
  "wealthy_hobbyist": "Zamożny rentier lub mecenas poświęcający czas i majątek na osobliwe pasje, kolekcje rzadkości lub kosztowne wyprawy.",
  "boxer": "Zawodnik sportów walki na ringu lub w nielegalnych pojedynkach na gołe pięści. Cechuje się żelazną kondycją i odpornością na ból.",
  "deprogrammer": "Specjalista uwalniający ludzi spod wpływu destrukcyjnych kultów, sekt i manipulacji psychologicznej.",
  "agency_detective": "Śledczy prywatnej agencji detektywistycznej (np. Pinkertona). Doświadczony w inwigilacji, ochronie mienia i konfrontacjach.",
  "union_organizer": "Lider i organizator ruchu robotniczego walczący o prawa pracowników w fabrykach, kopalniach i dokach.",
  "gentleman_lady": "Przedstawiciel socjety żyjący z majątku rodowego lub renty. Cieszy się nienagannymi manierami i pozycją towarzyską.",
  "fanatic": "Jednostka owładnięta bezwzględnym oddaniem idei politycznej, religijnej lub ezoterycznej, gotowa poświęcić wszystko dla celu.",
  "pharmacist": "Aptekarz i specjalista od leków, trucizn i związków chemicznych. Prowadzi miejską aptekę lub laboratorium farmaceutyczne.",
  "photographer": "Fotograf prasowy lub portretowy dokumentujący wydarzenia epoki, zbrodnie lub niezwykłe zjawiska za pomocą aparatu skrzynkowego.",
  "public_official": "Polityk, burmistrz, radny miejski lub wysoki urzędnik państwowy posiadający wpływy i władzę administracyjną.",
  "gangster": "Członek zorganizowanej grupy przestępczej kontrolujący nielegalny handel alkoholem, hazard lub haracze.",
  "antique_dealer": "Właściciel sklepu ze starociami skupujący i sprzedający zabytkowe meble, dzieła sztuki, białe kruki i pamiątki przeszłości.",
  "gambler": "Gracz żyjący z kart, ruletki i zakładów. Mistrz blefu, liczenia prawdopodobieństwa i manipulacji żetonami.",
  "butler": "Dyskretny zarządca rezydencji dbający o domostwo, gości i tajemnice arystokratycznego pracodawcy.",
  "stuntman": "Odważny dubler filmowy wykonujący niebezpieczne ewolucje, skoki z wysokości i pościgi automobilowe.",
  "waiter": "Pracownik kawiarni, restauracji lub eleganckiego hotelu. Słyszy rozmowy przy stolikach i doskonale czyta nastroje gości.",
  "driver": "Szofer prywatny, taksówkarz lub kierowca ciężarówki. Zna plan miasta na pamięć i potrafi wyciągnąć maszynę z każdej opresji.",
  "salesman": "Obwoźny sprzedawca podróżujący pociągami i automobilem z walizką próbek towarów. Potrafi przekonać każdego do zakupu.",
  "foreign_correspondent": "Dziennikarz pracujący za granicą, nadający relacje z wojen, rewolucji i egzotycznych zakątków świata.",
  "cowboy": "Pasterz bydła i koniarz z prerii Dzikiego Zachodu, przyzwyczajony do surowego życia w siodle i pod gołym niebem.",
  "bookseller": "Właściciel księgarni oferujący powieści, naukowe traktaty oraz rzadkie tomy z prywatnych księgozbiorów.",
  "accountant": "Rewident finansowy i skarbnik analizujący bilanse firmowe, rachunki bankowe i wykrywający fałszerstwa podatkowe.",
  "curator": "Opiekun zbiorów muzealnych lub uniwersyteckich odpowiedzialny za konserwację, wystawy i katalogowanie skarbów przeszłości.",
  "lab_assistant": "Technik laboratoryjny asystujący przy eksperymentach medycznych, chemicznych lub fizycznych na uczelni.",
  "forensic_specialist": "Biegły sądowy badający ciała ofiar, przyczyny zgonów, rany postrzałowe i ślady trucizn na potrzeby policji.",
  "big_game_hunter": "Myśliwy organizujący polowania na drapieżniki w Afryce, Azji lub na amerykańskim pograniczu.",
  "bounty_hunter": "Prywatny egzekutor prawa ścigający zbiegłych przestępców i osoby poszukiwane listami gończymi za nagrodę.",
  "mechanic": "Wykwalifikowany rzemieślnik naprawiający silniki spalinowe, maszyny przemysłowe, kotły i instalacje fabryczne.",
  "missionary": "Duchowny niosący wiarę i pomoc humanitarną do odległych zakątków świata, misji i plemion tubylczych.",
  "musician": "Kompozytor, instrumentalista lub wokalista występujący w klubach jazzowych, orkiestrach symfonicznych lub wodewilach.",
  "diver": "Specjalista od prac podwodnych w ciężkim skafandrze mosiężnym, naprawy kadłubów statków i wydobywania wraków.",
  "explorer": "Podróżnik i kartograf przemierzający nieznane dotąd lądy, dżungle, bieguny i pustynie świata.",
  "military_officer": "Dowódca kompanii lub pułku wojskowego odpowiedzialny za taktykę, dyscyplinę podwładnych i powodzenie operacji bojowych.",
  "occultist": "Badacz wiedzy tajemnej, magii rytualnej, hermetyzmu, alchemii i seansów spirytystycznych.",
  "zookeeper": "Pracownik ogrodu zoologicznego opiekujący się drapieżnikami, egzotycznymi ssakami i gadami.",
  "prospector": "Poszukiwacz złota, minerałów i cennych rud przemierzający bezdroża i górskie kaniony.",
  "laborer": "Robotnik budowlany, górnik, doker lub pracownik huty wykonujący ciężką pracę fizyczną w przemyśle.",
  "academic": "Badacz akademicki, asystent uniwersytecki lub stypendysta prowadzący badania w archiwach i laboratoriach.",
  "clerk": "Urzędnik magistratu, pracownik biurowy lub kancelista zajmujący się rejestrami, dokumentacją i korespondencją.",
  "designer": "Projektant mody, wzornictwa przemysłowego lub wnętrz tworzący nowatorskie linie i użytkowe dzieła sztuki.",
  "sex_worker": "Osoba pracująca w półświatku, domach schadzek lub salonach nocnych; zna tajemnice i słabości swoich klientów.",
  "undertaker": "Właściciel zakładu pogrzebowego zajmujący się balsamowaniem, pochówkami i opieką nad cmentarzami.",
  "cult_leader": "Charyzmatyczny mistrz sekty lub bractwa mistycznego manipulujący wyznawcami i gromadzący tajemną władzę.",
  "psychiatrist": "Lekarz specjalista leczenia zaburzeń psychicznych prowadzący prywatną praktykę lub pracujący w sanatorium.",
  "psychologist": "Naukowiec badający mechanizmy ludzkiej psychiki, pamięci i podświadomości na podstawie teorii behawioralnych lub freudowskich.",
  "editor": "Redaktor naczelny lub adiustator w wydawnictwie lub gazecie codziennej; decyduje o doborze artykułów i publikacji.",
  "artisan": "Mistrz rzemiosła artystycznego - stolarz meblowy, jubiler, szewc, zegarmistrz lub garncarz.",
  "hospital_orderly": "Pracownik pomocniczy szpitala lub kliniki dbający o transport pacjentów, czystość sal i asystę medyczną.",
  "asylum_attendant": "Opiekun w szpitalu dla psychicznie chorych szkolony w obezwładnianiu agresywnych pacjentów i zabezpieczaniu sal izolacyjnych.",
  "secretary": "Osobisty asystent dyrektora, polityka lub kancelarii prawnej zarządzający kalendarzem, korespondencją i archiwum.",
  "judge": "Magistrat orzekający wyroki w sądzie rejonowym, apelacyjnym lub federalnym; niezawisły autorytet prawny.",
  "shopkeeper": "Właściciel sklepu kolonialnego, spożywczego lub pasmanterii będący sercem lokalnej społeczności sąsiedzkiej.",
  "firefighter": "Funkcjonariusz miejskiej straży pożarnej ratujący ludzi z pożarów, zawalonych kamienic i katastrof przemysłowych.",
  "student": "Żak uniwersytecki lub praktykant zdobywający wykształcenie i szukający własnej ścieżki w akademickim świecie.",
  "hobo": "Wędrowny pracownik podróżujący pociągami towarowymi po całym kraju w poszukiwaniu dorywczego zarobku.",
  "trapper": "Myśliwy i traper polujący na zwierzynę futerkową w głębokiej tajdze, lasach północy lub pasmach górskich.",
  "animal_trainer": "Specjalista od tresury psów służbowych, koni lub dzikich drapieżników w cyrkach i ośrodkach hodowlanych.",
  "mountain_climber": "Alpinista i zdobywca szczytów eksplorujący najwyższe granie, lodowce i niezdobyte ściany skalne."
};

export const OCCUPATION_DESCRIPTIONS_EN: Record<string, string> = {
  "antiquarian": "A dealer in antiquities and relics. Possesses deep knowledge of historic artifacts and often stumbles upon mysterious items.",
  "artist": "A creator of fine arts - painter, sculptor, or musician. Sensitive to beauty, yet attuned to the darker corners of reality.",
  "athlete": "A professional sportsman with peak physical conditioning, speed, and athletic prowess.",
  "author": "A writer of books or essays. A keen observer of human nature blessed with an active imagination.",
  "clergy": "An ordained member of the clergy. Deep faith can serve as both a spiritual shield and a vulnerability before cosmic dread.",
  "criminal": "A seasoned lawbreaker - burglar, gangster, or con artist. Possesses specialized illicit skills on society fringes.",
  "dilettante": "A wealthy amateur of varied pursuits. Armed with disposable fortune and leisure, seeking out peculiar diversions.",
  "doctor": "A medical doctor capable of treating injuries, diseases, and trauma, invaluable in any expedition.",
  "drifter": "A wanderer without a permanent address. Knows street life intimately and how to survive harsh conditions.",
  "engineer": "A builder of machines and structures. A practical mind accustomed to solving complex technical problems.",
  "entertainer": "A stage performer - actor, singer, or comedian. Adept at holding an audience attention and swaying emotions.",
  "farmer": "An agrarian worker tied to the soil. Resilient, practical, and grounded in hard physical labor.",
  "hacker": "A computer programmer and systems technician. Expert in information retrieval and modern network technologies.",
  "journalist": "An investigative reporter. Inquisitive, relentless, pursuing the truth wherever it leads.",
  "lawyer": "An attorney and counselor-at-law. Master of courtroom procedure, contracts, and persuasive rhetoric.",
  "librarian": "A custodian of catalogued knowledge. Exceptional at archival research and uncovering forgotten lore.",
  "military": "A trained soldier or serviceman. Disciplined, combat-hardened, and skilled in tactical survival.",
  "nurse": "A dedicated healthcare provider with hands-on medical training and crisis patient care.",
  "parapsychologist": "A researcher of supernatural phenomena, treading the precarious boundary between science and the occult.",
  "pilot": "An aviator skilled in navigating aircraft through storms and hazardous skies.",
  "police_detective": "A sworn department detective investigating homicides and complex criminal networks.",
  "police_officer": "A uniformed patrol officer upholding law and order on the city streets.",
  "private_investigator": "An independent investigator operating outside institutional bureaucracy, solving cases for paying clients.",
  "professor": "A tenured university academic with deep domain expertise and access to institutional archives.",
  "sailor": "A merchant mariner or naval deckhand hardened by long voyages across tempestuous seas.",
  "scientist": "A research scientist dedicated to unraveling natural phenomena through empirical inquiry.",
  "soldier": "A combat veteran of frontline infantry engagements, accustomed to danger and battlefield trauma.",
  "spy": "An intelligence operative trained in clandestine tradecraft, disguise, and confidential reconnaissance.",
  "tribe_member": "A member of a traditional indigenous community, grounded in survival skills and ancestral wisdom.",
  "federal_agent": "An investigator of federal law enforcement agencies probing interstate crime and federal offenses.",
  "acrobat": "A circus gymnast performing astonishing feats of balance, agility, and aerial dexterity.",
  "actor": "A stage performer or silver screen star capable of adopting diverse personas and controlling public emotions.",
  "alienist": "An early 20th-century psychiatrist studying madness, psychological deviance, and afflictions of the human mind.",
  "archaeologist": "A scientist excavating forgotten ruins, deciphering inscriptions, and unearthing relics of lost civilizations.",
  "architect": "A designer of grand edifices and urban infrastructure with an eye for structural blueprints and construction secrets.",
  "bartender": "A keeper of taverns or illicit speakeasies, acting as a discreet confidant and keen observer of nocturnal vices.",
  "wealthy_hobbyist": "A monied rentier dedicating fortunes and leisure to eccentric pursuits, exotic collections, and lavish voyages.",
  "boxer": "A prize fighter or wrestler inside the squared circle or underground bouts, defined by iron stamina.",
  "deprogrammer": "A specialist in freeing individuals from destructive cults, psychological conditioning, and esoteric brainwashing.",
  "agency_detective": "An operative of a private firm seasoned in industrial security, surveillance, and armed confrontations.",
  "union_organizer": "A labor movement leader fighting for workers rights across factories, rail depots, and shipping docks.",
  "gentleman_lady": "A high-society aristocrat living on inherited estate revenue, distinguished by refined manners and social influence.",
  "fanatic": "An individual zealously devoted to an ideological, political, or religious cause, willing to sacrifice all.",
  "pharmacist": "An apothecary compounding prescriptions, medicinal formulas, and chemical compounds in a city dispensary.",
  "photographer": "A press or studio photographer capturing historical events, crime scenes, and extraordinary occurrences.",
  "public_official": "A civil administrator, magistrate, or city councilor wielding regulatory authority and bureaucratic leverage.",
  "gangster": "An organized crime operative involved in bootlegging, extortion rackets, and mob syndicates.",
  "antique_dealer": "A merchant trading in vintage furniture, curio pieces, rare books, and relics of centuries past.",
  "gambler": "A high-stakes wagerer living on cards, dice, and roulette, skilled in bluffing and odds calculation.",
  "butler": "A discreet estate manager attending to household protocol, aristocratic guests, and guarded family secrets.",
  "stuntman": "A daring motion picture stand-in executing hazardous falls, high-speed vehicle crashes, and aerial acrobatics.",
  "waiter": "A server in bustling diners, cafes, or grand dining halls, overhearing intimate conversations and observing subtle behaviors.",
  "driver": "A private chauffeur, cabbie, or truck driver knowing every alley, shortcut, and engine quirk in town.",
  "salesman": "A traveling representative riding trains with sample cases, possessing an infectious pitch and keen social instincts.",
  "foreign_correspondent": "An international journalist reporting from war zones, overseas revolutions, and distant outposts of civilization.",
  "cowboy": "A frontiersman and livestock wrangler accustomed to long saddle drives, harsh wilderness, and rugged survival.",
  "bookseller": "A proprietor of a literary shop curating rare first editions, scholarly treatises, and forgotten antiquarian texts.",
  "accountant": "A meticulous auditor deciphering corporate ledgers, bank transactions, and uncovering fraudulent balance sheets.",
  "curator": "A custodian of museum collections overseeing the cataloguing, preservation, and exhibition of historic treasures.",
  "lab_assistant": "A technical assistant preparing chemical compounds, maintaining experimental apparatus, and recording empirical data.",
  "forensic_specialist": "A medical examiner investigating post-mortem pathologies, cause of death, ballistics, and toxicological clues.",
  "big_game_hunter": "A safari hunter and tracker pursuing apex predators across uncharted savannas, jungles, and frontiers.",
  "bounty_hunter": "A private fugitive recovery agent tracking bail jumpers and wanted criminals across jurisdictional borders.",
  "mechanic": "A skilled tradesman repairing combustion engines, machinery, boilers, and industrial equipment.",
  "missionary": "A dedicated minister bringing faith, education, and medical aid to remote frontiers and native settlements.",
  "musician": "A performer or composer illuminating jazz cellars, orchestral halls, or vaudeville stages with evocative harmonies.",
  "diver": "A deep-sea salvage technician descending in brass helmets to explore shipwrecks and submerged structures.",
  "explorer": "A trailblazer charting unmapped peaks, dense jungles, and arctic wastes at the edge of the known world.",
  "military_officer": "A commissioned commander experienced in tactical leadership, unit discipline, and strategic combat operations.",
  "occultist": "A dedicated scholar of the arcane, ritual magic, hermetic traditions, and esoteric grimoires.",
  "zookeeper": "A handler caring for exotic beasts, dangerous predators, and reptilian specimens in zoological gardens.",
  "prospector": "A rugged seeker of gold, precious ores, and mineral veins across mountain canyons and arid badlands.",
  "laborer": "A resilient industrial or agricultural laborer performing demanding physical tasks in docks, mines, or mills.",
  "academic": "A university scholar or researcher pursuing specialized intellectual inquiry across faculty archives.",
  "clerk": "A municipal or corporate white-collar employee managing official documentation, files, and correspondences.",
  "designer": "An industrial or fashion designer drafting modern aesthetic forms, interior furnishings, and stylish decor.",
  "sex_worker": "An operative of the twilight entertainment demimonde, holding intimate confidences of high-society patrons.",
  "undertaker": "A funeral director skilled in embalming rites, mortuary science, and solemn cemetery ceremonies.",
  "cult_leader": "A charismatic figurehead binding devoted disciples through hypnotic persuasion and esoteric dogma.",
  "psychiatrist": "A physician specialized in institutional asylum care, mental pathologies, and clinical therapies.",
  "psychologist": "A psychological theorist examining unconscious drives, trauma complexes, and human behavioral tendencies.",
  "editor": "A publishing house or periodical editor shaping print journalism, manuscript vetting, and investigative stories.",
  "artisan": "A master craftsperson creating bespoke woodwork, fine jewelry, timepieces, or glass creations.",
  "hospital_orderly": "A hospital attendant handling patient transfers, sanitizing wards, and assisting during medical crises.",
  "asylum_attendant": "A sanitarium warden trained to restrain violent patients and secure high-risk padded isolation cells.",
  "secretary": "A confidential executive secretary managing schedules, sensitive correspondence, and organizational dossiers.",
  "judge": "A judicial magistrate presiding over legal trials, interpreting statutes, and issuing binding verdicts.",
  "shopkeeper": "A neighborhood retail merchant operating general dry goods or grocery stores at the heart of community life.",
  "firefighter": "A municipal firefighter rescuing trapped citizens from blazing structures, chemical fires, and structural collapses.",
  "student": "An ambitious collegiate scholar absorbing advanced sciences, arts, or law on the threshold of adulthood.",
  "hobo": "An itinerant boxcar wanderer journeying across rail lines, surviving on wits and transient labor.",
  "trapper": "A backcountry hunter harvesting pelt bearing wildlife in primeval northern woods and frozen ridges.",
  "animal_trainer": "A specialist conditioning guard dogs, equestrian thoroughbreds, or circus carnivores.",
  "mountain_climber": "A high-altitude mountaineer ascending glacial ridges, vertical crags, and uncharted summits."
};

/**
 * Normalizuje ciag tekstowy do celow dopasowywania kluczy (male litery, trim).
 */
function normalizeKey(str: string): string {
  return str.trim().toLowerCase();
}

/**
 * Podstawowa mapa aliasow i wariantow jezykowych PL <-> EN dla profesji CoC 7e RAW.
 */
const OCCUPATION_ALIASES_PL_TO_EN: Record<string, string> = {
  'detektyw': 'Private Investigator',
  'prywatny detektyw': 'Private Investigator',
  'doktor': 'Doctor of Medicine',
  'lekarz': 'Doctor of Medicine',
  'profesor': 'Professor',
  'dziennikarz': 'Journalist',
  'antykwariusz': 'Antiquarian',
  'policjant': 'Police Officer',
  'żołnierz': 'Soldier',
  'zolnierz': 'Soldier',
  'wojskowy': 'Military Serviceman',
  'oficer wojskowy': 'Military Officer',
  'naukowiec': 'Scientist',
  'marynarz': 'Sailor',
  'szpieg': 'Spy'
};

const OCCUPATION_ALIASES_EN_TO_PL: Record<string, string> = {
  'private investigator': 'Prywatny Detektyw',
  'private detective': 'Prywatny Detektyw',
  'detective': 'Prywatny Detektyw',
  'doctor': 'Lekarz',
  'doctor of medicine': 'Lekarz',
  'physician': 'Lekarz',
  'professor': 'Profesor',
  'journalist': 'Dziennikarz',
  'antiquarian': 'Antykwariusz',
  'police officer': 'Policjant',
  'cop': 'Policjant',
  'soldier': 'Żołnierz',
  'military serviceman': 'Wojskowy',
  'military': 'Wojskowy',
  'military officer': 'Oficer Wojskowy',
  'scientist': 'Naukowiec',
  'sailor': 'Marynarz',
  'spy': 'Szpieg'
};

/**
 * Zwraca zlokalizowana nazwe zawodu w zadanym jezyku ('pl' lub 'en').
 * Obsluguje obiekty Occupation, identyfikatory techniczne (np. 'private_investigator')
 * oraz polskie i angielskie nazwy kanoniczne (np. 'Prywatny Detektyw' <-> 'Private Investigator').
 */
export function getLocalizedOccupationName(
  occOrNameOrId: string | Occupation | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!occOrNameOrId) return '';

  if (typeof occOrNameOrId === 'object') {
    if (locale === 'en') {
      return occOrNameOrId.nameEn || occOrNameOrId.name || '';
    }
    return occOrNameOrId.name || occOrNameOrId.nameEn || '';
  }

  const raw = occOrNameOrId.trim();
  if (!raw) return '';

  const norm = normalizeKey(raw);
  const isEn = locale === 'en';

  // 1. Dopasowanie po technicznym ID
  const byId = OCCUPATIONS.find((o) => o.id.toLowerCase() === norm);
  if (byId) {
    return isEn ? (byId.nameEn || byId.name) : byId.name;
  }

  // 2. Dopasowanie po nazwie polskiej
  const byPlName = OCCUPATIONS.find((o) => o.name.toLowerCase() === norm);
  if (byPlName) {
    return isEn ? (byPlName.nameEn || byPlName.name) : byPlName.name;
  }

  // 3. Dopasowanie po nazwie angielskiej
  const byEnName = OCCUPATIONS.find((o) => o.nameEn && o.nameEn.toLowerCase() === norm);
  if (byEnName) {
    return isEn ? (byEnName.nameEn || byEnName.name) : byEnName.name;
  }

  // 4. Dopasowanie po mapie aliasow
  if (isEn && OCCUPATION_ALIASES_PL_TO_EN[norm]) {
    return OCCUPATION_ALIASES_PL_TO_EN[norm];
  }
  if (!isEn && OCCUPATION_ALIASES_EN_TO_PL[norm]) {
    return OCCUPATION_ALIASES_EN_TO_PL[norm];
  }

  // 5. Fallback: zwroc oryginalny ciag znakow
  return raw;
}

/**
 * Zwraca zlokalizowany opis zawodu (np. do tooltipow lub podsumowania w kreatorze).
 */
export function getLocalizedOccupationDescription(
  occupationIdOrOcc: string | Occupation | null | undefined,
  locale: 'pl' | 'en' | string = 'pl'
): string {
  if (!occupationIdOrOcc) return '';

  let id: string;
  if (typeof occupationIdOrOcc === 'object') {
    id = occupationIdOrOcc.id;
  } else {
    const raw = occupationIdOrOcc.trim();
    const norm = normalizeKey(raw);
    const matched = OCCUPATIONS.find(
      (o) =>
        o.id.toLowerCase() === norm ||
        o.name.toLowerCase() === norm ||
        (o.nameEn && o.nameEn.toLowerCase() === norm)
    );
    id = matched ? matched.id : raw;
  }

  if (locale === 'en') {
    return OCCUPATION_DESCRIPTIONS_EN[id] || OCCUPATION_DESCRIPTIONS[id] || '';
  }
  return OCCUPATION_DESCRIPTIONS[id] || OCCUPATION_DESCRIPTIONS_EN[id] || '';
}
