import { OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from "@/lib/discovery/osm";

/** Required attribution wherever OpenStreetMap data is shown (ODbL). */
export function OsmCredit() {
  return (
    <p className="text-xs text-slate">
      Business data{" "}
      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-green hover:underline">
        {OSM_ATTRIBUTION}
      </a>
      , available under the Open Database License. Listings can be incomplete or out of date. Check before relying on them.
    </p>
  );
}
