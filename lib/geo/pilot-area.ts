/**
 * The area this deployment serves. Live river/rain stations, reference data
 * imports and the routing graph are all limited to it. To serve another
 * district, change this file and re-run the imports (see docs/REAL_DATA.md).
 */
export type PilotMunicipality = {
  /** BIPAD / federal municipality code. */
  code: number;
  /** Display name. */
  name: string;
  district: string;
  /** Ward-name prefix used in OpenStreetMap ("Bharatpur-10"). */
  osmPrefix: string;
};

export const PILOT_AREA = {
  name: "Chitwan district & Gaidakot",
  /** [south, west, north, east] — generous, used to pick stations and roads. */
  bbox: [27.35, 84.0, 27.95, 85.0] as const,
  municipalities: [
    { code: 35001, name: "Bharatpur Metropolitan City", district: "Chitwan", osmPrefix: "Bharatpur" },
    { code: 35002, name: "Ichchhakamana Rural Municipality", district: "Chitwan", osmPrefix: "Ichchhakamana" },
    { code: 35003, name: "Kalika Municipality", district: "Chitwan", osmPrefix: "Kalika" },
    { code: 35004, name: "Khairahani Municipality", district: "Chitwan", osmPrefix: "Khairhani" },
    { code: 35005, name: "Madi Municipality", district: "Chitwan", osmPrefix: "Madi" },
    { code: 35006, name: "Rapti Municipality", district: "Chitwan", osmPrefix: "Rapti" },
    { code: 35007, name: "Ratnanagar Municipality", district: "Chitwan", osmPrefix: "Ratnanagar" },
    { code: 76005, name: "Gaidakot Municipality", district: "Nawalpur", osmPrefix: "Gaidakot" },
  ] satisfies PilotMunicipality[],
} as const;

export function inPilotBbox(lat: number, lng: number): boolean {
  const [s, w, n, e] = PILOT_AREA.bbox;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

export function pilotMunicipalityByCode(code: number | null | undefined): PilotMunicipality | undefined {
  return PILOT_AREA.municipalities.find((m) => m.code === code);
}
