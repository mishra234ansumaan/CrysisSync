/**
 * Real weather corroboration for Fake Detection Layer B.
 *
 * - OpenWeatherMap current conditions when OPENWEATHER_API_KEY is configured.
 * - Open-Meteo current + seven-day precipitation (keyless, real public data).
 *
 * No fabricated weather is returned. If both providers are unreachable the
 * layer becomes neutral rather than lowering a victim's trust score.
 */
export interface WeatherSnapshot {
  condition: string;
  isRainy: boolean;
  tempC: number | null;
  humidity: number | null;
  rainfall7dMm: number | null;
  source: "openweather+open-meteo" | "openweather" | "open-meteo" | "unavailable";
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
  };
  daily?: { precipitation_sum?: Array<number | null> };
}

function wmoCondition(code: number | undefined): string {
  if (code == null) return "unknown";
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}

async function getOpenMeteo(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code",
      daily: "precipitation_sum",
      past_days: "7",
      forecast_days: "1",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as OpenMeteoResponse;
    const rainfall = json.daily?.precipitation_sum?.reduce<number>(
      (sum, value) => sum + (typeof value === "number" ? value : 0),
      0
    );
    const currentRain = (json.current?.rain ?? 0) + (json.current?.precipitation ?? 0);
    const condition = wmoCondition(json.current?.weather_code);
    return {
      condition,
      isRainy: currentRain > 0 || /rain|thunder/i.test(condition),
      tempC: typeof json.current?.temperature_2m === "number" ? json.current.temperature_2m : null,
      humidity:
        typeof json.current?.relative_humidity_2m === "number"
          ? json.current.relative_humidity_2m
          : null,
      rainfall7dMm: typeof rainfall === "number" ? Math.round(rainfall * 10) / 10 : null,
      source: "open-meteo",
    };
  } catch {
    return null;
  }
}

async function getOpenWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      weather?: Array<{ main?: string; description?: string }>;
      main?: { temp?: number; humidity?: number };
      rain?: { "1h"?: number; "3h"?: number };
    };
    const description = json.weather?.[0]?.description ?? "unknown";
    const main = (json.weather?.[0]?.main ?? "").toLowerCase();
    return {
      condition: description,
      isRainy: /rain|drizzle|thunder/.test(main) || Boolean(json.rain),
      tempC: typeof json.main?.temp === "number" ? Math.round(json.main.temp) : null,
      humidity: typeof json.main?.humidity === "number" ? Math.round(json.main.humidity) : null,
      rainfall7dMm: null,
      source: "openweather",
    };
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number): Promise<WeatherSnapshot> {
  const [openWeather, openMeteo] = await Promise.all([
    getOpenWeather(lat, lng),
    getOpenMeteo(lat, lng),
  ]);
  if (openWeather && openMeteo) {
    return {
      ...openWeather,
      rainfall7dMm: openMeteo.rainfall7dMm,
      isRainy: openWeather.isRainy || openMeteo.isRainy,
      source: "openweather+open-meteo",
    };
  }
  if (openWeather) return openWeather;
  if (openMeteo) return openMeteo;
  return {
    condition: "weather providers unavailable",
    isRainy: false,
    tempC: null,
    humidity: null,
    rainfall7dMm: null,
    source: "unavailable",
  };
}

export function weatherConsistency(
  claimType: string,
  weather: WeatherSnapshot
): { verdict: "consistent" | "suspicious" | "neutral"; note: string } {
  if (weather.source === "unavailable") {
    return {
      verdict: "neutral",
      note: "Weather providers were unavailable; no trust penalty was applied.",
    };
  }
  const sevenDay = weather.rainfall7dMm;
  const humidity = weather.humidity == null ? "unknown" : `${weather.humidity}%`;
  if (claimType === "flood") {
    if (!weather.isRainy && sevenDay !== null && sevenDay < 1) {
      return {
        verdict: "suspicious",
        note: `Flood claim conflicts with real weather: ${weather.condition}, ${sevenDay}mm rain over 7 days, humidity ${humidity} [${weather.source}].`,
      };
    }
    if (weather.isRainy || (sevenDay !== null && sevenDay >= 10)) {
      return {
        verdict: "consistent",
        note: `Weather corroborates flood risk: ${weather.condition}, ${sevenDay ?? "unknown"}mm rain over 7 days [${weather.source}].`,
      };
    }
    return {
      verdict: "neutral",
      note: `Weather is inconclusive for flooding: ${weather.condition}, ${sevenDay ?? "unknown"}mm rain over 7 days [${weather.source}].`,
    };
  }
  if (claimType === "fire") {
    const dry = !weather.isRainy && (sevenDay == null || sevenDay < 2);
    return {
      verdict: dry ? "consistent" : "neutral",
      note: dry
        ? `Dry real-world conditions (${weather.tempC ?? "?"}°C, ${sevenDay ?? "?"}mm/7d) are compatible with fire risk [${weather.source}].`
        : `Weather neither confirms nor disproves the fire claim [${weather.source}].`,
    };
  }
  return {
    verdict: "neutral",
    note: `Weather is not a verification factor for ${claimType} incidents [${weather.source}].`,
  };
}
