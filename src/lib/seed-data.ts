/**
 * Demo dataset — 20 realistic SOS reports + 8 volunteers around Hyderabad.
 * Used by scripts/seed.ts AND the /demo control panel ("Seed Demo Data").
 */
import { DEMO_CENTER } from "./constants";

function jitter(base: number, amount = 0.02): number {
  return base + (Math.random() - 0.5) * amount;
}

export interface SeedSos {
  transcript: string;
  emergencyType: string;
  severity: number;
  latitude: number;
  longitude: number;
  trustScore: number;
  isVerified: boolean;
  isFake: boolean;
  language: string;
  status: string;
  source: string;
  aiSummary: string;
  minutesAgo: number;
}

const FLOOD_SPOT = { lat: DEMO_CENTER.lat + 0.018, lng: DEMO_CENTER.lng + 0.012 };
const FIRE_SPOT = { lat: DEMO_CENTER.lat - 0.022, lng: DEMO_CENTER.lng + 0.02 };

export function buildSeedReports(): SeedSos[] {
  const floodReports: SeedSos[] = [
    { transcript: "Paani ghar ke andar ghus raha hai, hum chhat par hain!", emergencyType: "flood", severity: 9, language: "hi", aiSummary: "Family trapped on rooftop, water entering home." },
    { transcript: "Street fully submerged, cars floating near the junction", emergencyType: "flood", severity: 8, language: "en", aiSummary: "Severe street flooding, vehicles floating." },
    { transcript: "Water rising fast, need boat rescue for my elderly parents", emergencyType: "flood", severity: 9, language: "en", aiSummary: "Elderly couple needs boat evacuation." },
    { transcript: "Flood water up to first floor now, 6 people trapped", emergencyType: "flood", severity: 10, language: "en", aiSummary: "Six people trapped, first floor submerged." },
    { transcript: "School bus stuck in floodwater with children onboard!", emergencyType: "flood", severity: 10, language: "en", aiSummary: "School bus with children stranded in floodwater." },
    { transcript: "Basement flooding, power still on — electrocution risk", emergencyType: "flood", severity: 8, language: "en", aiSummary: "Basement flood with live electricity hazard." },
  ].map((r, i) => ({
    ...r,
    latitude: jitter(FLOOD_SPOT.lat, 0.004),
    longitude: jitter(FLOOD_SPOT.lng, 0.004),
    trustScore: 96 - i,
    isVerified: true,
    isFake: false,
    status: i < 2 ? "dispatched" : "active",
    source: "voice",
    minutesAgo: 4 + i * 3,
  }));

  const fireReports: SeedSos[] = [
    { transcript: "Fire broke out in the textile warehouse, heavy smoke", emergencyType: "fire", severity: 8, language: "en", aiSummary: "Warehouse fire with heavy smoke." },
    { transcript: "आग लग गई है! दुकान में लोग फंसे हैं", emergencyType: "fire", severity: 9, language: "hi", aiSummary: "Shop fire, people trapped inside." },
    { transcript: "Gas cylinder blast, flames spreading to next building", emergencyType: "fire", severity: 9, language: "en", aiSummary: "Gas explosion, fire spreading to adjacent building." },
  ].map((r, i) => ({
    ...r,
    latitude: jitter(FIRE_SPOT.lat, 0.003),
    longitude: jitter(FIRE_SPOT.lng, 0.003),
    trustScore: 88 - i * 4,
    isVerified: true,
    isFake: false,
    status: "active",
    source: "voice",
    minutesAgo: 8 + i * 5,
  }));

  const medicalReports: SeedSos[] = [
    { transcript: "My father collapsed, not breathing — need CPR help now!", emergencyType: "medical", severity: 10, language: "en", aiSummary: "Cardiac arrest, CPR assistance needed." },
    { transcript: "Road accident near flyover, two injured and bleeding", emergencyType: "medical", severity: 7, language: "en", aiSummary: "Road accident, two bleeding victims." },
    { transcript: "Pregnant woman in labor, ambulance stuck in traffic", emergencyType: "medical", severity: 8, language: "en", aiSummary: "Woman in active labor, ambulance delayed." },
    { transcript: "Worker fell from scaffolding, unconscious", emergencyType: "medical", severity: 8, language: "en", aiSummary: "Fall from height, victim unconscious." },
  ].map((r, i) => ({
    ...r,
    latitude: jitter(DEMO_CENTER.lat, 0.05),
    longitude: jitter(DEMO_CENTER.lng, 0.05),
    trustScore: 46 + i * 6,
    isVerified: i >= 2,
    isFake: false,
    status: "active",
    source: i === 1 ? "sms" : "voice",
    minutesAgo: 12 + i * 9,
  }));

  const misc: SeedSos[] = [
    { transcript: "Building tilted after tremors, cracks on pillars", emergencyType: "earthquake", severity: 7, language: "en", aiSummary: "Structural damage after tremors.", latitude: jitter(DEMO_CENTER.lat, 0.06), longitude: jitter(DEMO_CENTER.lng, 0.06), trustScore: 41, isVerified: false, isFake: false, status: "active", source: "voice", minutesAgo: 22 },
    { transcript: "Old wall collapsed on parked scooters", emergencyType: "other", severity: 4, language: "en", aiSummary: "Wall collapse, property damage only.", latitude: jitter(DEMO_CENTER.lat, 0.06), longitude: jitter(DEMO_CENTER.lng, 0.06), trustScore: 30, isVerified: false, isFake: false, status: "active", source: "voice", minutesAgo: 31 },
    { transcript: "Stray dog is very cute, bringing it home lol", emergencyType: "other", severity: 2, language: "en", aiSummary: "Non-emergency prank report.", latitude: jitter(DEMO_CENTER.lat, 0.07), longitude: jitter(DEMO_CENTER.lng, 0.07), trustScore: 8, isVerified: false, isFake: true, status: "active", source: "voice", minutesAgo: 40 },
    { transcript: "Fire fire fire!! jk testing the app", emergencyType: "fire", severity: 3, language: "en", aiSummary: "Self-admitted test/prank report.", latitude: jitter(FIRE_SPOT.lat, 0.02), longitude: jitter(FIRE_SPOT.lng, 0.02), trustScore: 12, isVerified: false, isFake: true, status: "active", source: "demo", minutesAgo: 55 },
    { transcript: "Is someone there... my phone is dying, battery 3%", emergencyType: "medical", severity: 8, language: "en", aiSummary: "LAST_GASP_BEACON — victim lost power after sending.", latitude: jitter(DEMO_CENTER.lat, 0.03), longitude: jitter(DEMO_CENTER.lng, 0.03), trustScore: 61, isVerified: false, isFake: false, status: "active", source: "beacon", minutesAgo: 15 },
    { transcript: "Tree fell on bike, rider has minor leg injury", emergencyType: "medical", severity: 4, language: "en", aiSummary: "Minor injury, tree fall accident.", latitude: jitter(DEMO_CENTER.lat, 0.05), longitude: jitter(DEMO_CENTER.lng, 0.05), trustScore: 52, isVerified: false, isFake: false, status: "resolved", source: "voice", minutesAgo: 90 },
    { transcript: "Water logging reported, traffic diverted", emergencyType: "flood", severity: 5, language: "en", aiSummary: "Waterlogging, traffic advisory.", latitude: jitter(FLOOD_SPOT.lat, 0.01), longitude: jitter(FLOOD_SPOT.lng, 0.01), trustScore: 74, isVerified: true, isFake: false, status: "resolved", source: "sms", minutesAgo: 120 },
  ];

  return [...floodReports, ...fireReports, ...medicalReports, ...misc];
}

export interface SeedVolunteer {
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  resources: string;
  isAvailable: boolean;
}

export function buildSeedVolunteers(): SeedVolunteer[] {
  const v: Array<[string, string, number, number, object]> = [
    ["Arjun Mehta", "+91 98490 11223", 0.004, -0.003, { boat: true, first_aid: true, vehicle: true }],
    ["Sara Khan", "+91 97003 44556", 0.016, 0.014, { boat: true, food: true }],
    ["Vikram Reddy", "+91 90000 77889", -0.021, 0.018, { first_aid: true, vehicle: true, food: true }],
    ["Priya Sharma", "+91 99890 33445", -0.006, 0.007, { first_aid: true, shelter: true }],
    ["Mohammed Faiz", "+91 91009 22110", 0.019, 0.01, { boat: true, vehicle: true }],
    ["Ananya Iyer", "+91 96660 88777", -0.015, -0.01, { food: true, shelter: true }],
    ["Rohit Verma", "+91 95550 66544", 0.008, -0.012, { vehicle: true, first_aid: true }],
    ["Dr. Neha Kulkarni", "+91 94440 12398", -0.002, 0.002, { first_aid: true }],
  ];
  return v.map(([name, _phone, dLat, dLng, res]) => ({
    name,
    // Never send seed/demo alerts to plausible real numbers. Set this to an
    // Harmless placeholder; this build uses free Web Push rather than SMS.
    phone: process.env.DEMO_SMS_PHONE || "+910000000000",
    latitude: DEMO_CENTER.lat + dLat,
    longitude: DEMO_CENTER.lng + dLng,
    resources: JSON.stringify(res),
    isAvailable: true,
  }));
}
