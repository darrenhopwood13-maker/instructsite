import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
  75: "Heavy snow", 80: "Rain showers", 81: "Heavy showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};

async function fetchWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as any;
  const c = j?.current ?? {};
  return {
    temperature_c: c.temperature_2m ?? null,
    apparent_c: c.apparent_temperature ?? null,
    humidity_pct: c.relative_humidity_2m ?? null,
    precip_mm: c.precipitation ?? null,
    wind_kph: c.wind_speed_10m ?? null,
    weather_code: c.weather_code ?? null,
    summary: WMO[c.weather_code] ?? "Unknown",
    raw: j,
  };
}

export const Route = createFileRoute("/api/public/hooks/weather-snapshot")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: projects, error } = await supabase
          .from("projects")
          .select("id, latitude, longitude");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let ok = 0;
        for (const p of projects ?? []) {
          const lat = (p as any).latitude ?? 51.5074;
          const lon = (p as any).longitude ?? -0.1278;
          const w = await fetchWeather(lat, lon);
          if (!w) continue;
          const { error: insErr } = await supabase
            .from("project_weather_readings")
            .insert({
              project_id: (p as any).id,
              source: "open-meteo-cron",
              ...w,
            });
          if (!insErr) ok++;
        }

        return new Response(
          JSON.stringify({ ok, total: (projects ?? []).length, at: new Date().toISOString() }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
