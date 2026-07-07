import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Severe thunderstorm",
};

function describe(code: number | null | undefined): string {
  if (code == null) return "Unknown";
  return WMO[code] ?? `Code ${code}`;
}

async function fetchOpenMeteo(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const json = (await res.json()) as any;
  const c = json?.current ?? {};
  return {
    temperature_c: c.temperature_2m ?? null,
    apparent_c: c.apparent_temperature ?? null,
    humidity_pct: c.relative_humidity_2m ?? null,
    precip_mm: c.precipitation ?? null,
    wind_kph: c.wind_speed_10m ?? null,
    weather_code: c.weather_code ?? null,
    summary: describe(c.weather_code),
    raw: json,
  };
}

export const getProjectWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    // Latest cached reading (may be from cron)
    const { data: latest } = await supabase
      .from("project_weather_readings")
      .select("*")
      .eq("project_id", data.projectId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fresh =
      latest && Date.now() - new Date(latest.captured_at).getTime() < 30 * 60 * 1000;

    if (fresh) return latest;

    // Need coords
    const { data: proj } = await supabase
      .from("projects")
      .select("latitude, longitude")
      .eq("id", data.projectId)
      .maybeSingle();

    const lat = (proj?.latitude as number | null) ?? 51.5074;
    const lon = (proj?.longitude as number | null) ?? -0.1278;

    try {
      const w = await fetchOpenMeteo(lat, lon);
      const { data: inserted } = await supabase
        .from("project_weather_readings")
        .insert({
          project_id: data.projectId,
          source: "open-meteo",
          temperature_c: w.temperature_c,
          apparent_c: w.apparent_c,
          humidity_pct: w.humidity_pct,
          precip_mm: w.precip_mm,
          wind_kph: w.wind_kph,
          weather_code: w.weather_code,
          summary: w.summary,
          raw: w.raw,
        })
        .select("*")
        .single();
      return inserted ?? latest ?? null;
    } catch (e) {
      return latest ?? null;
    }
  });
