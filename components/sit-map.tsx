"use client"

// Carte interactive Mapbox GL (projection globe) de l'onglet "Carte" du
// SIT — remplace l'ancien contour SVG schématique. Chargée uniquement
// côté client (voir dynamic(..., { ssr: false }) dans app/sit/page.tsx) :
// mapbox-gl touche `window`/le DOM dès son import, ce qui casserait la
// génération statique de /sit sinon.
//
// Architecture pour les futures couches SIT (BAN, IGN, cadastre,
// Géorisques, DVF, DPE, servitudes...) : chaque connecteur qui expose déjà
// des coordonnées peut alimenter cette carte en ajoutant une source/couche
// GeoJSON dans un useEffect séparé (map.addSource/map.addLayer), sans
// toucher à l'initialisation ci-dessous. Rien de tel n'est branché pour
// l'instant — seul le marqueur d'adresse réellement sélectionnée (donnée
// BAN déjà chargée ailleurs dans la page) est affiché, jamais de donnée
// fabriquée.
//
// Jeton : NEXT_PUBLIC_MAPBOX_TOKEN (voir .env.example). C'est un jeton
// public Mapbox (restreint par référent sur mapbox.com), pas un secret
// serveur — inliné dans le bundle client au build, donc lu directement
// depuis process.env plutôt que via lib/secrets.ts (AWS Secrets Manager,
// lu au runtime côté serveur uniquement, inatteignable depuis le bundle
// client sans plomberie supplémentaire).

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Vue par défaut : le globe, centré sur l'Atlantique nord de façon à ce
// que l'Europe/France reste visible sans être déjà zoomée dessus.
const GLOBE_VIEW = { center: [2.5, 35] as [number, number], zoom: 1.3 }
const FRANCE_VIEW = { center: [2.5, 46.6] as [number, number], zoom: 5 }

export interface SitMapMarker {
  coordinates: [number, number]
  label: string
}

export default function SitMap({ marker }: { marker?: SitMapMarker }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      center: marker ? marker.coordinates : GLOBE_VIEW.center,
      zoom: marker ? 14 : GLOBE_VIEW.zoom,
    })
    // Attribution requise par les conditions d'utilisation Mapbox — stylée
    // (voir globals.css) mais jamais masquée.
    map.on("style.load", () => map.setFog({}))
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right")
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marqueur réel (adresse sélectionnée via BAN, voir selectedAddress dans
  // app/sit/page.tsx) — survole la carte déjà initialisée plutôt que de
  // recréer l'instance.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    if (marker) {
      markerRef.current = new mapboxgl.Marker({ color: "#1c1c1e" }).setLngLat(marker.coordinates).addTo(map)
      map.flyTo({ center: marker.coordinates, zoom: 15, duration: 900 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker?.coordinates[0], marker?.coordinates[1]])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Carte interactive indisponible — variable d&apos;environnement <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> non
          configurée.
        </p>
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-2 top-2 z-10 flex gap-1">
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo({ ...GLOBE_VIEW, duration: 1200 })}
          className="liquid-glass-btn rounded-lg px-2.5 py-1 text-[0.68rem] font-medium"
        >
          Globe
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo({ ...FRANCE_VIEW, duration: 1200 })}
          className="liquid-glass-btn rounded-lg px-2.5 py-1 text-[0.68rem] font-medium"
        >
          France
        </button>
      </div>
    </>
  )
}
