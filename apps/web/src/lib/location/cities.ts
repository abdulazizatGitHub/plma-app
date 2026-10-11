/**
 * Bundled cities for offline search and for naming a GPS fix (PRAYER_TIMES.md).
 * Coordinates are city centres, rounded to 2 decimals.
 */
export type City = { name: string; country: string; lat: number; lng: number; timezone: string };

const PK = "Asia/Karachi";

export const CITIES: City[] = [
  { name: "Karachi", country: "Pakistan", lat: 24.86, lng: 67.01, timezone: PK },
  { name: "Lahore", country: "Pakistan", lat: 31.55, lng: 74.34, timezone: PK },
  { name: "Islamabad", country: "Pakistan", lat: 33.69, lng: 73.06, timezone: PK },
  { name: "Rawalpindi", country: "Pakistan", lat: 33.6, lng: 73.05, timezone: PK },
  { name: "Faisalabad", country: "Pakistan", lat: 31.42, lng: 73.08, timezone: PK },
  { name: "Multan", country: "Pakistan", lat: 30.2, lng: 71.47, timezone: PK },
  { name: "Peshawar", country: "Pakistan", lat: 34.01, lng: 71.58, timezone: PK },
  { name: "Quetta", country: "Pakistan", lat: 30.18, lng: 67.0, timezone: PK },
  { name: "Hyderabad", country: "Pakistan", lat: 25.4, lng: 68.37, timezone: PK },
  { name: "Gujranwala", country: "Pakistan", lat: 32.16, lng: 74.19, timezone: PK },
  { name: "Sialkot", country: "Pakistan", lat: 32.49, lng: 74.53, timezone: PK },
  { name: "Sargodha", country: "Pakistan", lat: 32.08, lng: 72.67, timezone: PK },
  { name: "Bahawalpur", country: "Pakistan", lat: 29.4, lng: 71.68, timezone: PK },
  { name: "Sukkur", country: "Pakistan", lat: 27.7, lng: 68.86, timezone: PK },
  { name: "Larkana", country: "Pakistan", lat: 27.56, lng: 68.21, timezone: PK },
  { name: "Abbottabad", country: "Pakistan", lat: 34.15, lng: 73.21, timezone: PK },
  { name: "Mardan", country: "Pakistan", lat: 34.2, lng: 72.04, timezone: PK },
  { name: "Mingora (Swat)", country: "Pakistan", lat: 34.78, lng: 72.36, timezone: PK },
  { name: "Gilgit", country: "Pakistan", lat: 35.92, lng: 74.31, timezone: PK },
  { name: "Skardu", country: "Pakistan", lat: 35.3, lng: 75.63, timezone: PK },
  { name: "Muzaffarabad", country: "Pakistan", lat: 34.37, lng: 73.47, timezone: PK },
  { name: "Mirpur (AJK)", country: "Pakistan", lat: 33.15, lng: 73.75, timezone: PK },
  { name: "Gwadar", country: "Pakistan", lat: 25.13, lng: 62.32, timezone: PK },
  { name: "Turbat", country: "Pakistan", lat: 26.0, lng: 63.05, timezone: PK },
  { name: "Dera Ismail Khan", country: "Pakistan", lat: 31.83, lng: 70.9, timezone: PK },
  { name: "Dera Ghazi Khan", country: "Pakistan", lat: 30.05, lng: 70.64, timezone: PK },
  { name: "Rahim Yar Khan", country: "Pakistan", lat: 28.42, lng: 70.3, timezone: PK },
  { name: "Sahiwal", country: "Pakistan", lat: 30.67, lng: 73.11, timezone: PK },
  { name: "Okara", country: "Pakistan", lat: 30.81, lng: 73.45, timezone: PK },
  { name: "Jhang", country: "Pakistan", lat: 31.27, lng: 72.32, timezone: PK },
  { name: "Sheikhupura", country: "Pakistan", lat: 31.71, lng: 73.98, timezone: PK },
  { name: "Gujrat", country: "Pakistan", lat: 32.57, lng: 74.08, timezone: PK },
  { name: "Jhelum", country: "Pakistan", lat: 32.93, lng: 73.73, timezone: PK },
  { name: "Kohat", country: "Pakistan", lat: 33.58, lng: 71.44, timezone: PK },
  { name: "Bannu", country: "Pakistan", lat: 32.99, lng: 70.6, timezone: PK },
  { name: "Nawabshah", country: "Pakistan", lat: 26.24, lng: 68.41, timezone: PK },
  { name: "Mirpur Khas", country: "Pakistan", lat: 25.53, lng: 69.01, timezone: PK },
  { name: "Chitral", country: "Pakistan", lat: 35.85, lng: 71.79, timezone: PK },
  { name: "Makkah", country: "Saudi Arabia", lat: 21.42, lng: 39.83, timezone: "Asia/Riyadh" },
  { name: "Madinah", country: "Saudi Arabia", lat: 24.47, lng: 39.61, timezone: "Asia/Riyadh" },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.71, lng: 46.68, timezone: "Asia/Riyadh" },
  { name: "Jeddah", country: "Saudi Arabia", lat: 21.49, lng: 39.19, timezone: "Asia/Riyadh" },
  { name: "Dubai", country: "UAE", lat: 25.2, lng: 55.27, timezone: "Asia/Dubai" },
  { name: "Abu Dhabi", country: "UAE", lat: 24.45, lng: 54.38, timezone: "Asia/Dubai" },
  { name: "Doha", country: "Qatar", lat: 25.29, lng: 51.53, timezone: "Asia/Qatar" },
  { name: "Kuwait City", country: "Kuwait", lat: 29.38, lng: 47.99, timezone: "Asia/Kuwait" },
  { name: "Muscat", country: "Oman", lat: 23.59, lng: 58.41, timezone: "Asia/Muscat" },
  { name: "Manama", country: "Bahrain", lat: 26.23, lng: 50.59, timezone: "Asia/Bahrain" },
  { name: "Istanbul", country: "Türkiye", lat: 41.01, lng: 28.98, timezone: "Europe/Istanbul" },
  { name: "Cairo", country: "Egypt", lat: 30.04, lng: 31.24, timezone: "Africa/Cairo" },
  { name: "Tehran", country: "Iran", lat: 35.69, lng: 51.39, timezone: "Asia/Tehran" },
  { name: "Kabul", country: "Afghanistan", lat: 34.56, lng: 69.21, timezone: "Asia/Kabul" },
  { name: "Delhi", country: "India", lat: 28.61, lng: 77.21, timezone: "Asia/Kolkata" },
  { name: "Dhaka", country: "Bangladesh", lat: 23.81, lng: 90.41, timezone: "Asia/Dhaka" },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.14, lng: 101.69, timezone: "Asia/Kuala_Lumpur" },
  { name: "Jakarta", country: "Indonesia", lat: -6.21, lng: 106.85, timezone: "Asia/Jakarta" },
  { name: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82, timezone: "Asia/Singapore" },
  { name: "London", country: "United Kingdom", lat: 51.51, lng: -0.13, timezone: "Europe/London" },
  { name: "Birmingham", country: "United Kingdom", lat: 52.49, lng: -1.89, timezone: "Europe/London" },
  { name: "Manchester", country: "United Kingdom", lat: 53.48, lng: -2.24, timezone: "Europe/London" },
  { name: "Paris", country: "France", lat: 48.86, lng: 2.35, timezone: "Europe/Paris" },
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.41, timezone: "Europe/Berlin" },
  { name: "New York", country: "United States", lat: 40.71, lng: -74.01, timezone: "America/New_York" },
  { name: "Chicago", country: "United States", lat: 41.88, lng: -87.63, timezone: "America/Chicago" },
  { name: "Houston", country: "United States", lat: 29.76, lng: -95.37, timezone: "America/Chicago" },
  { name: "Los Angeles", country: "United States", lat: 34.05, lng: -118.24, timezone: "America/Los_Angeles" },
  { name: "Toronto", country: "Canada", lat: 43.65, lng: -79.38, timezone: "America/Toronto" },
  { name: "Sydney", country: "Australia", lat: -33.87, lng: 151.21, timezone: "Australia/Sydney" },
];

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The bundled city nearest a point, with its distance. */
export function nearestCity(p: { lat: number; lng: number }): { city: City; km: number } {
  let best = { city: CITIES[0], km: Infinity };
  for (const city of CITIES) {
    const km = distanceKm(p, city);
    if (km < best.km) best = { city, km };
  }
  return best;
}

/** A label for a GPS fix: the city if close, otherwise "Near <city>". */
export function labelFor(p: { lat: number; lng: number }): string {
  const { city, km } = nearestCity(p);
  return km <= 40 ? city.name : `Near ${city.name}`;
}

export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);
  return CITIES.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)).slice(0, limit);
}
