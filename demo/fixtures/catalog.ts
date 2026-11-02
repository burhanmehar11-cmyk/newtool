import type { NicheId } from "@/lib/domain/types";

/**
 * Static catalog used by the demo fixture generator and the demo query parser.
 * All businesses generated from this catalog are fictional.
 */

export const DEMO_NOW = "2026-10-30T15:00:00.000Z";

export type NicheDef = {
  id: NicheId;
  label: string;
  plural: string;
  /** Words that map a natural-language query to this niche. */
  synonyms: string[];
  suffixes: string[];
  emailPrefixes: string[];
  /** Typical review volume used to shape fixtures. */
  reviewScale: number;
  intakeNoun: string;
  customerNoun: string;
};

export const niches: NicheDef[] = [
  {
    id: "dental",
    label: "Dental clinic",
    plural: "Dental clinics",
    synonyms: ["dental clinic", "dental", "dentist", "dentists", "orthodontist", "orthodontics"],
    suffixes: ["Dental", "Family Dentistry", "Dental Studio", "Smile Co.", "Dental Care"],
    emailPrefixes: ["hello", "frontdesk", "office", "smile"],
    reviewScale: 220,
    intakeNoun: "new-patient forms",
    customerNoun: "patients",
  },
  {
    id: "hvac",
    label: "HVAC contractor",
    plural: "HVAC contractors",
    synonyms: ["hvac", "heating", "air conditioning", "ac repair", "furnace", "cooling"],
    suffixes: ["Heating & Air", "Comfort Systems", "HVAC", "Climate Services"],
    emailPrefixes: ["service", "info", "office", "dispatch"],
    reviewScale: 160,
    intakeNoun: "service request forms",
    customerNoun: "homeowners",
  },
  {
    id: "medspa",
    label: "Med spa",
    plural: "Med spas",
    synonyms: ["med spa", "medspa", "medical spa", "aesthetics", "aesthetic clinic"],
    suffixes: ["Aesthetics", "Med Spa", "Skin Studio", "Wellness Spa"],
    emailPrefixes: ["hello", "concierge", "book", "info"],
    reviewScale: 180,
    intakeNoun: "consultation forms",
    customerNoun: "clients",
  },
  {
    id: "physio",
    label: "Physical therapy clinic",
    plural: "Physical therapy clinics",
    synonyms: ["physical therapy", "physiotherapy", "physio", "physical therapist", "pt clinic"],
    suffixes: ["Physical Therapy", "Sports & Spine", "Rehab Clinic", "Movement Lab"],
    emailPrefixes: ["frontdesk", "hello", "info", "care"],
    reviewScale: 120,
    intakeNoun: "intake forms",
    customerNoun: "patients",
  },
  {
    id: "roofing",
    label: "Roofing contractor",
    plural: "Roofing contractors",
    synonyms: ["roofing", "roofer", "roofers", "roof repair"],
    suffixes: ["Roofing", "Roof & Gutter", "Exteriors", "Roofing Co."],
    emailPrefixes: ["estimates", "info", "office", "hello"],
    reviewScale: 110,
    intakeNoun: "estimate request forms",
    customerNoun: "homeowners",
  },
  {
    id: "law",
    label: "Law firm",
    plural: "Law firms",
    synonyms: ["law firm", "law firms", "lawyer", "lawyers", "attorney", "attorneys", "legal"],
    suffixes: ["Law Group", "Legal", "Law Office", "Counsel"],
    emailPrefixes: ["intake", "info", "office", "contact"],
    reviewScale: 70,
    intakeNoun: "consultation intake forms",
    customerNoun: "clients",
  },
  {
    id: "vet",
    label: "Veterinary clinic",
    plural: "Veterinary clinics",
    synonyms: ["veterinary", "veterinarian", "vet", "vets", "animal hospital", "pet clinic"],
    suffixes: ["Animal Hospital", "Veterinary Clinic", "Pet Care", "Vet Clinic"],
    emailPrefixes: ["frontdesk", "hello", "care", "info"],
    reviewScale: 260,
    intakeNoun: "new-client forms",
    customerNoun: "pet owners",
  },
  {
    id: "landscaping",
    label: "Landscaping company",
    plural: "Landscaping companies",
    synonyms: ["landscaping", "landscaper", "landscapers", "lawn care", "lawn"],
    suffixes: ["Landscapes", "Lawn & Garden", "Outdoor Co.", "Landscaping"],
    emailPrefixes: ["info", "office", "quotes", "hello"],
    reviewScale: 90,
    intakeNoun: "quote request forms",
    customerNoun: "homeowners",
  },
];

export type CityDef = { city: string; region: string; areaCode: string; aliases: string[] };

export const cities: CityDef[] = [
  { city: "Austin", region: "TX", areaCode: "512", aliases: ["austin", "austin tx", "atx"] },
  { city: "Denver", region: "CO", areaCode: "303", aliases: ["denver", "denver co"] },
  { city: "Columbus", region: "OH", areaCode: "614", aliases: ["columbus", "columbus oh"] },
  { city: "Raleigh", region: "NC", areaCode: "919", aliases: ["raleigh", "raleigh nc"] },
  { city: "Portland", region: "OR", areaCode: "503", aliases: ["portland", "portland or"] },
];

export const namePrefixes = [
  "Bluebonnet", "Riverbend", "Lantern", "Northfield", "Harborline", "Juniper", "Stonegate", "Maple Row",
  "Brightwater", "Copperleaf", "Silverlake", "Westbrook", "Ironwood", "Summit Ridge", "Fernhill", "Oak Hollow",
  "Larkspur", "Granite Bay", "Willow Creek", "Kestrel", "Blue Heron", "Tallgrass", "Red Mesa", "Pinecrest",
  "Clearview", "Meridian", "Foxglove", "Sandstone", "Elmstead", "Quarry Lane", "Cobalt", "Hollowell",
];

export const streets = [
  "Larkin Ave", "Pellham St", "Cardell Rd", "Fennimore Blvd", "Haskett Ln", "Orrin Way", "Tessaly Dr",
  "Wexford Ct", "Brannock St", "Calder Pkwy", "Dunmore Ave", "Ellery Rd",
];

export function nicheById(id: string) {
  return niches.find((n) => n.id === id);
}
