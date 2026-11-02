import type { NicheId } from "@/lib/domain/types";

/**
 * Business types for live discovery, mapped to OpenStreetMap tags.
 * Each selector is an Overpass tag filter; results must also have a name.
 */
export const discoveryNiches: { id: NicheId; label: string; osm: string[] }[] = [
  { id: "dental", label: "Dental clinics", osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
  { id: "hvac", label: "HVAC contractors", osm: ['["craft"="hvac"]'] },
  { id: "medspa", label: "Med spas and beauty clinics", osm: ['["leisure"="spa"]', '["amenity"="spa"]', '["shop"="beauty"]'] },
  { id: "physio", label: "Physical therapy clinics", osm: ['["healthcare"="physiotherapist"]', '["healthcare:speciality"="physiotherapy"]'] },
  { id: "roofing", label: "Roofing contractors", osm: ['["craft"="roofer"]'] },
  { id: "law", label: "Law firms", osm: ['["office"="lawyer"]'] },
  { id: "vet", label: "Veterinary clinics", osm: ['["amenity"="veterinary"]'] },
  { id: "landscaping", label: "Landscaping companies", osm: ['["craft"="gardener"]', '["craft"="landscaper"]'] },
];

export function nicheLabel(id: string) {
  return discoveryNiches.find((n) => n.id === id)?.label ?? id;
}
