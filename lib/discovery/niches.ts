import type { NicheId } from "@/lib/domain/types";

/**
 * Business types for live discovery, mapped to OpenStreetMap tags.
 * Each selector is an Overpass tag filter; results must also have a name.
 */
export type NicheWords = { singular: string; plural: string; customerNoun: string; intakeNoun: string };

export const discoveryNiches: ({ id: NicheId; label: string; osm: string[] } & NicheWords)[] = [
  { id: "dental", label: "Dental clinics", singular: "Dental clinic", plural: "Dental clinics", customerNoun: "patients", intakeNoun: "new-patient forms", osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
  { id: "hvac", label: "HVAC contractors", singular: "HVAC contractor", plural: "HVAC contractors", customerNoun: "homeowners", intakeNoun: "service request forms", osm: ['["craft"="hvac"]'] },
  { id: "medspa", label: "Med spas and beauty clinics", singular: "Med spa", plural: "Med spas", customerNoun: "clients", intakeNoun: "consultation forms", osm: ['["leisure"="spa"]', '["amenity"="spa"]', '["shop"="beauty"]'] },
  { id: "physio", label: "Physical therapy clinics", singular: "Physical therapy clinic", plural: "Physical therapy clinics", customerNoun: "patients", intakeNoun: "intake forms", osm: ['["healthcare"="physiotherapist"]', '["healthcare:speciality"="physiotherapy"]'] },
  { id: "roofing", label: "Roofing contractors", singular: "Roofing contractor", plural: "Roofing contractors", customerNoun: "homeowners", intakeNoun: "estimate request forms", osm: ['["craft"="roofer"]'] },
  { id: "law", label: "Law firms", singular: "Law firm", plural: "Law firms", customerNoun: "clients", intakeNoun: "consultation intake forms", osm: ['["office"="lawyer"]'] },
  { id: "vet", label: "Veterinary clinics", singular: "Veterinary clinic", plural: "Veterinary clinics", customerNoun: "pet owners", intakeNoun: "new-client forms", osm: ['["amenity"="veterinary"]'] },
  { id: "landscaping", label: "Landscaping companies", singular: "Landscaping company", plural: "Landscaping companies", customerNoun: "homeowners", intakeNoun: "quote request forms", osm: ['["craft"="gardener"]', '["craft"="landscaper"]'] },
];

const GENERIC: NicheWords = { singular: "Business", plural: "Businesses", customerNoun: "customers", intakeNoun: "intake forms" };

/** Words used in briefs and drafts. Unknown or missing types get neutral wording. */
export function nicheWords(id: string | null | undefined): NicheWords {
  return discoveryNiches.find((n) => n.id === id) ?? GENERIC;
}

export function nicheLabel(id: string) {
  return discoveryNiches.find((n) => n.id === id)?.label ?? id;
}
