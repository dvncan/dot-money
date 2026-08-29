"use client";
import { useEffect, useState } from "react";

interface Spot {
  lat: number;
  lon: number;
  label: string;
}

/**
 * Best-effort merchant locator: geocodes the query via OpenStreetMap's
 * Nominatim (free, no key) and renders an embedded OSM map with a marker.
 * Renders nothing when the query doesn't resolve to a place — many merchant
 * strings (e.g. "AUTOMATIC PAYMENT") simply aren't locations.
 */
export default function GeoMap({ query }: { query: string }) {
  const [spot, setSpot] = useState<Spot | null | "none">(null);

  useEffect(() => {
    let live = true;
    setSpot(null);
    const cleaned = query.replace(/#?\d+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (cleaned.length < 3) {
      setSpot("none");
      return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca,us&q=${encodeURIComponent(cleaned)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (Array.isArray(d) && d[0]?.lat) {
          setSpot({ lat: Number(d[0].lat), lon: Number(d[0].lon), label: d[0].display_name });
        } else {
          setSpot("none");
        }
      })
      .catch(() => live && setSpot("none"));
    return () => {
      live = false;
    };
  }, [query]);

  if (spot === null) return <p className="text-xs text-muted">Looking up location…</p>;
  if (spot === "none") return null;

  const dLon = 0.01, dLat = 0.006;
  const bbox = `${spot.lon - dLon},${spot.lat - dLat},${spot.lon + dLon},${spot.lat + dLat}`;
  return (
    <div className="mt-3">
      <iframe
        title={`Map for ${query}`}
        className="w-full h-48 rounded-lg border border-hairline"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${spot.lat},${spot.lon}`}
      />
      <p className="text-xs text-muted mt-1 truncate">📍 {spot.label}</p>
    </div>
  );
}
