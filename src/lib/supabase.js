import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Szentendrei és 11-es úti referencia megállók (offline fallback, ha még nincs DB adat)
export const SZENTENDRE_STOPS = [
  { id: 'stop_pismany_top', name: 'Felső-Pismány • Szabadságforrás forduló', lat: 47.6948, lng: 19.0462, hint: 'Felső buszforduló öböl', offsetMin: 4 },
  { id: 'stop_cseresznyes', name: 'Pismány • Cseresznyés út sarok', lat: 47.6902, lng: 19.0558, hint: 'Szabadságforrás - Cseresznyés út torkolat', offsetMin: 6 },
  { id: 'stop_papirgyar', name: '11-es út • Papírgyár / Szabadságforrás', lat: 47.6852, lng: 19.0772, hint: 'Buszöböl a Castrum mellett', offsetMin: 8 },
  { id: 'stop_sztaravoda', name: '11-es út • Sztaravodai kereszteződés', lat: 47.6761, lng: 19.0754, hint: 'ALDI / Lukoil szervizút behajtó', offsetMin: 10 },
  { id: 'stop_bukkos', name: 'Bükkös-part • 11-es út sarok', lat: 47.6701, lng: 19.0748, hint: 'Apor híd lábánál lévő torkolat', offsetMin: 12 },
  { id: 'stop_hev', name: 'HÉV-végállomás (P+R kapu)', lat: 47.6602, lng: 19.0738, hint: 'Állomás tér P+R kanyarodósáv utáni öböl', offsetMin: 14 },
  { id: 'stop_pannonia', name: 'Pannóniatelep HÉV / Szerb kereszt', lat: 47.6512, lng: 19.0715, hint: '11-es út szervizút', offsetMin: 16 },
  { id: 'stop_szarvashegy', name: 'Szarvashegyi elágazás (Buszöböl)', lat: 47.6855, lng: 19.0268, hint: 'Szentlászlói út - Szarvashegyi út buszöböl', offsetMin: 5 },
  { id: 'stop_izbeg', name: 'Izbég • Iskola / Templom', lat: 47.6782, lng: 19.0485, hint: 'Szentlászlói úti parkolósáv', offsetMin: 7 }
];

// PostGIS RPC hívás: megkeresi az útvonalba eső 11-es úti megállókat
export async function fetchStopsAlongRoute(routeWkt) {
  if (!supabase || !routeWkt) return SZENTENDRE_STOPS.slice(0, 6);
  const { data, error } = await supabase.rpc('get_stops_along_route', {
    p_route_wkt: routeWkt
  });
  if (error) {
    console.warn('PostGIS get_stops_along_route fallback:', error.message);
    return SZENTENDRE_STOPS.slice(0, 6);
  }
  return data;
}

// PostGIS RPC hívás: 200m-es folyosó-alapú útvonal párosítás
export async function matchRidesAlongCorridor(pickup, dropoff, radiusMeters = 200) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('match_rides_along_corridor', {
    p_pickup_lng: pickup.lng,
    p_pickup_lat: pickup.lat,
    p_dropoff_lng: dropoff.lng,
    p_dropoff_lat: dropoff.lat,
    p_radius_m: radiusMeters
  });
  if (error) throw error;
  return data || [];
}
