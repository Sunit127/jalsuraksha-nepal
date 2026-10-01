import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type AppRole = Enums["app_role"];
export type AlertSeverity = Enums["alert_severity"];
export type DataSourceType = Enums["data_source_type"];
export type SosSituation = Enums["sos_situation"];
export type PriorityLevel = Enums["priority_level"];
export type SosStatus = Enums["sos_status"];
export type AssignmentStatus = Enums["assignment_status"];
export type TeamStatus = Enums["team_status"];
export type HazardType = Enums["hazard_type"];
export type HazardSeverity = Enums["hazard_severity"];
export type HazardStatus = Enums["hazard_status"];
export type SafetyStatus = Enums["safety_status"];
export type SupplyStatus = Enums["supply_status"];

export type Profile = Tables["profiles"]["Row"];
export type Alert = Tables["alerts"]["Row"];
export type RiskZone = Tables["risk_zones"]["Row"];
export type Shelter = Tables["shelters"]["Row"];
export type HazardReport = Tables["hazard_reports"]["Row"];
export type RescueTeam = Tables["rescue_teams"]["Row"];
export type SosRequest = Tables["sos_requests"]["Row"];
export type RescueAssignment = Tables["rescue_assignments"]["Row"];
export type IncidentStatusHistory = Tables["incident_status_history"]["Row"];

export type LatLng = { lat: number; lng: number };

/** Hospitals are static reference points in the prototype (not a DB table). */
export type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  phone?: string;
};
