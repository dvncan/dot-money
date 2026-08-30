"use client";
import { useEffect, useState } from "react";

interface Spot {
  lat: number;
  lon: number;
  label: string;
}

/**
 * Maps a merchant's *actual* address — the structured location Plaid attaches
 * to a transaction, or an address the user typed on the merchant record.
 *
 * It deliberately does NOT geocode a bare merchant name. Nominatim always
 * returns its best guess, so "ATM Withdrawal" resolves to a real ATM in Dallas
 * and "Tim Hortons" to an arbitrary store in Surrey — confident, wrong pins.
 * No address means no map.
 */
export default function GeoMap({ address }: { address?: string }) {
  const [spot, setSpot] = useState<Spot | null | "none">(null);

  useEffect(() => {
    let live = true;
    setSpot(null);
    const query = (address ?? "").trim();
    // needs to look like a place: a street number or a "city, region" pair
    const looksLikeAddress = query.length >= 6 && (/\d/.test(query) || query.includes(","));
    if (!looksLikeAddress) {
      setSpot("none");
      return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca,us&q=${encodeURIComponent(query)}`)
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
  }, [address]);

  if (spot === null) return <p className="text-xs text-muted">Looking up location…</p>;
  if (spot === "none") return null;

  const dLon = 0.01, dLat = 0.006;
  const bbox = `${spot.lon - dLon},${spot.lat - dLat},${spot.lon + dLon},${spot.lat + dLat}`;
  return (
    <div className="mt-3">
      <iframe
        title={`Map for ${address}`}
        className="w-full h-48 rounded-lg border border-hairline"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${spot.lat},${spot.lon}`}
      />
      <p className="text-xs text-muted mt-1 truncate">📍 {spot.label}</p>
    </div>
  );
}
