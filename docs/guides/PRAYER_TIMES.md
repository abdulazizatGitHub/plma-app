# Prayer times: how they're synced to Pakistan (or any location)

**Owner decision (2026-10-08):** the default is the **Karachi method** (University of Islamic Sciences, Karachi) with **Hanafi Asr**, synced to the user's location. This guide is implemented in v2 Phase 4 (requirement PRY-10).

## Short answer: no API key or paid service is needed

Prayer times are **astronomical calculations**: the sun's position for a date, latitude, and longitude. The app computes them **on the device** with the open-source library **adhan-js** (MIT, high-precision formulas from Jean Meeus' *Astronomical Algorithms*). This means:

- They work **offline**. Nothing calls a server each day.
- They follow the user's **current location**, so Karachi, Lahore, Peshawar, or anywhere abroad each get correct local times.
- There is no account, API key, quota, or billing.

An optional online check against **AlAdhan** (free, no key) is described below. It is only for verification or as a fallback for users who refuse location access and want to type a city instead.

## Default settings

| Setting | Default | Why |
|---------|---------|-----|
| Calculation method | `Karachi`: Fajr 18°, Isha 18° | Standard for Pakistan |
| Asr (madhab) | `Hanafi` (shadow = 2× object length) | Majority practice in Pakistan |
| Location | Device GPS, or city search, or Karachi as the fallback | |
| Per-prayer offset | 0 min each, editable | To match the local mosque's jamaat or adhan |
| Time zone | The device's IANA zone (e.g. `Asia/Karachi`) | Displayed times are local |

All of these are editable in **Profile → Prayer settings**.

## How the app gets the user's location

1. On first opening Spiritual (or in onboarding), the app asks: *"Use your location for accurate prayer times?"*
2. **Allow:** the browser Geolocation API (`navigator.geolocation.getCurrentPosition`) returns latitude and longitude.
   - Coordinates are rounded to 2 decimals (~1 km). That's precise enough for prayer times and better for privacy.
   - They're saved in `user_settings` (lat, lng, a label such as "Karachi") and synced, so all the user's devices agree.
3. **Deny:** the user picks a city from a list of major Pakistani cities with coordinates (bundled, offline), or types any city to look it up online (optional, below).
4. **Moving cities:** if a new GPS fix is more than 25 km from the saved one, a banner offers *"Update prayer location to Lahore?"*. It never changes silently.

## How the times are computed (developer reference)

```ts
import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from "adhan";

const params = CalculationMethod.Karachi();
params.madhab = Madhab.Hanafi;
params.adjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }; // per-prayer minute offsets from settings
const times = new PrayerTimes(new Coordinates(24.86, 67.01), date, params); // Karachi
// times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha → JS Dates (instants)
// format in the user's timezone, e.g. Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", timeStyle: "short" })
```

This lives in `packages/shared` as `PrayerTimes`, so the server can use the same code later for prayer-relative reminders (Phase 6).

## Optional: verify against AlAdhan (free, no key)

AlAdhan is a free public REST API, run by Islamic Network, that computes the same times. Use it to cross-check our numbers, or to look up a typed city.

```
# by coordinates (method 1 = University of Islamic Sciences, Karachi; school 1 = Hanafi)
GET https://api.aladhan.com/v1/timings/09-10-2026?latitude=24.86&longitude=67.01&method=1&school=1

# by city
GET https://api.aladhan.com/v1/timingsByCity?city=Karachi&country=Pakistan&method=1&school=1

# optional minute tuning (Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight)
&tune=0,0,0,0,0,0,0,0,0
```

Steps to verify by hand:

1. Open the URL above in a browser (change the date to today).
2. Compare `data.timings` with the app's Prayer settings → "Today's times".
3. Times should match within **1 minute**. Phase 4 has an automated test for this, using a fixed Karachi date.

**Rule:** the app must never depend on this API to show times. If it's down, nothing breaks.

## Matching your local mosque

Calculated times are the astronomical *start* of each prayer. Mosques often add a few minutes for adhan or jamaat. In **Prayer settings → Adjust**, each prayer has −30…+30 minute steppers (e.g. Maghrib +3). The adjustments are stored in `user_settings` and applied as `params.adjustments`.

## Checklist for Phase 4

- [x] Add `adhan` (npm) to `packages/shared`.
- [x] `user_settings` columns: `lat`, `lng`, `location_label`, `calc_method` (default `karachi`), `madhab` (default `hanafi`), `prayer_offsets` (jsonb).
- [x] Settings UI: location (GPS / city list), method, madhab, offsets, and today's times preview.
- [x] Test: Karachi on a fixed date matches AlAdhan `method=1&school=1` within 1 minute.

**Implemented 2026-10-11** (v2 Phase 4). Location is asked just in time via the app's own sheet (Always needs the phone app; While using; Choose a city; Never). Settings live at Profile → Prayer settings (`/settings/prayer`).
