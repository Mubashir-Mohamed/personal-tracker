import { getRawMeta, setRawMeta, getSetting } from './db'
import type { WeatherSnapshot } from '../shared/types'

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ hail',
  99: 'Thunderstorm w/ hail'
}

function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? 'Unknown'
}

/** Location is a Settings field (Profile & Weather), defaulting to Kochi, India — swap it for
 *  your own city's lat/lon there. */
export async function fetchWeather(): Promise<WeatherSnapshot | null> {
  const lat = getSetting('weatherLat')
  const lon = getSetting('weatherLon')
  const locationLabel = getSetting('weatherLocationLabel')

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()

    const snapshot: WeatherSnapshot = {
      locationLabel,
      tempC: Math.round(data.current.temperature_2m),
      condition: describeWeatherCode(data.current.weather_code),
      isDay: data.current.is_day === 1,
      highC: Math.round(data.daily.temperature_2m_max[0]),
      lowC: Math.round(data.daily.temperature_2m_min[0]),
      precipChancePct: Math.round(data.daily.precipitation_probability_max[0] ?? 0),
      fetchedAt: new Date().toISOString()
    }
    setRawMeta('weatherCache', JSON.stringify(snapshot))
    return snapshot
  } catch (err) {
    console.error('weather fetch failed', err)
    return null
  }
}

export function getCachedWeather(): WeatherSnapshot | null {
  const raw = getRawMeta('weatherCache')
  if (!raw) return null
  try {
    return JSON.parse(raw) as WeatherSnapshot
  } catch {
    return null
  }
}

export function startWeatherRefresh(): void {
  void fetchWeather()
  setInterval(() => void fetchWeather(), 30 * 60_000)
}
