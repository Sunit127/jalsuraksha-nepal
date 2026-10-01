
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"district": string | null,"expires_at": string | null,"id": string,"is_active": boolean,"municipality": string | null,"river_basin": string | null,"severity": Database["public"]['Enums']["alert_severity"],"source": string,"source_type": Database["public"]['Enums']["data_source_type"],"station_id": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description": string,"district"?: string | null,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"municipality"?: string | null,"river_basin"?: string | null,"severity": Database["public"]['Enums']["alert_severity"],"source": string,"source_type"?: Database["public"]['Enums']["data_source_type"],"station_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"district"?: string | null,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"municipality"?: string | null,"river_basin"?: string | null,"severity"?: Database["public"]['Enums']["alert_severity"],"source"?: string,"source_type"?: Database["public"]['Enums']["data_source_type"],"station_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "hydromet_stations"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"facilities": {
                  Row: {
                    "created_at": string,"data_source": string,"district": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["facility_kind"],"latitude": number,"longitude": number,"municipality": string | null,"name": string,"phone": string | null,"source_ref": string,"updated_at": string,"ward": number | null
                  }
                  Insert: {
                    "created_at"?: string,"data_source": string,"district"?: string | null,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["facility_kind"],"latitude": number,"longitude": number,"municipality"?: string | null,"name": string,"phone"?: string | null,"source_ref": string,"updated_at"?: string,"ward"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"data_source"?: string,"district"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["facility_kind"],"latitude"?: number,"longitude"?: number,"municipality"?: string | null,"name"?: string,"phone"?: string | null,"source_ref"?: string,"updated_at"?: string,"ward"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"hazard_confirmations": {
                  Row: {
                    "created_at": string,"id": string,"report_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"report_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"report_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hazard_confirmations_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "hazard_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hazard_confirmations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hazard_reports": {
                  Row: {
                    "confirmation_count": number,"created_at": string,"description": string | null,"duplicate_of": string | null,"id": string,"latitude": number,"location_name": string | null,"longitude": number,"photo_url": string | null,"reporter_id": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"severity": Database["public"]['Enums']["hazard_severity"],"source_type": Database["public"]['Enums']["data_source_type"],"status": Database["public"]['Enums']["hazard_status"],"type": Database["public"]['Enums']["hazard_type"],"updated_at": string
                  }
                  Insert: {
                    "confirmation_count"?: number,"created_at"?: string,"description"?: string | null,"duplicate_of"?: string | null,"id"?: string,"latitude": number,"location_name"?: string | null,"longitude": number,"photo_url"?: string | null,"reporter_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: Database["public"]['Enums']["hazard_severity"],"source_type"?: Database["public"]['Enums']["data_source_type"],"status"?: Database["public"]['Enums']["hazard_status"],"type": Database["public"]['Enums']["hazard_type"],"updated_at"?: string
                  }
                  Update: {
                    "confirmation_count"?: number,"created_at"?: string,"description"?: string | null,"duplicate_of"?: string | null,"id"?: string,"latitude"?: number,"location_name"?: string | null,"longitude"?: number,"photo_url"?: string | null,"reporter_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: Database["public"]['Enums']["hazard_severity"],"source_type"?: Database["public"]['Enums']["data_source_type"],"status"?: Database["public"]['Enums']["hazard_status"],"type"?: Database["public"]['Enums']["hazard_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hazard_reports_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "hazard_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hazard_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hazard_reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hydromet_readings": {
                  Row: {
                    "observed_at": string,"rain_1h_mm": number | null,"rain_24h_mm": number | null,"station_id": string,"water_level_m": number | null
                  }
                  Insert: {
                    "observed_at": string,"rain_1h_mm"?: number | null,"rain_24h_mm"?: number | null,"station_id": string,"water_level_m"?: number | null
                  }
                  Update: {
                    "observed_at"?: string,"rain_1h_mm"?: number | null,"rain_24h_mm"?: number | null,"station_id"?: string,"water_level_m"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hydromet_readings_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "hydromet_stations"
      referencedColumns: ["id"]
    }
                  ]
                },"hydromet_stations": {
                  Row: {
                    "basin": string | null,"danger_level_m": number | null,"data_source": string,"district_code": number | null,"fetched_at": string,"id": string,"kind": Database["public"]['Enums']["hydromet_kind"],"latitude": number,"longitude": number,"municipality_code": number | null,"name": string,"observed_at": string | null,"official_status": string | null,"rain_12h_mm": number | null,"rain_1h_mm": number | null,"rain_24h_mm": number | null,"rain_3h_mm": number | null,"rain_6h_mm": number | null,"source_url": string | null,"trend": string | null,"updated_at": string,"warning_level_m": number | null,"water_level_m": number | null
                  }
                  Insert: {
                    "basin"?: string | null,"danger_level_m"?: number | null,"data_source"?: string,"district_code"?: number | null,"fetched_at"?: string,"id": string,"kind": Database["public"]['Enums']["hydromet_kind"],"latitude": number,"longitude": number,"municipality_code"?: number | null,"name": string,"observed_at"?: string | null,"official_status"?: string | null,"rain_12h_mm"?: number | null,"rain_1h_mm"?: number | null,"rain_24h_mm"?: number | null,"rain_3h_mm"?: number | null,"rain_6h_mm"?: number | null,"source_url"?: string | null,"trend"?: string | null,"updated_at"?: string,"warning_level_m"?: number | null,"water_level_m"?: number | null
                  }
                  Update: {
                    "basin"?: string | null,"danger_level_m"?: number | null,"data_source"?: string,"district_code"?: number | null,"fetched_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["hydromet_kind"],"latitude"?: number,"longitude"?: number,"municipality_code"?: number | null,"name"?: string,"observed_at"?: string | null,"official_status"?: string | null,"rain_12h_mm"?: number | null,"rain_1h_mm"?: number | null,"rain_24h_mm"?: number | null,"rain_3h_mm"?: number | null,"rain_6h_mm"?: number | null,"source_url"?: string | null,"trend"?: string | null,"updated_at"?: string,"warning_level_m"?: number | null,"water_level_m"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"incident_status_history": {
                  Row: {
                    "actor_role": string,"changed_by": string | null,"created_at": string,"from_status": Database["public"]['Enums']["sos_status"] | null,"id": string,"note": string | null,"sos_id": string,"to_status": Database["public"]['Enums']["sos_status"]
                  }
                  Insert: {
                    "actor_role"?: string,"changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["sos_status"] | null,"id"?: string,"note"?: string | null,"sos_id": string,"to_status": Database["public"]['Enums']["sos_status"]
                  }
                  Update: {
                    "actor_role"?: string,"changed_by"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["sos_status"] | null,"id"?: string,"note"?: string | null,"sos_id"?: string,"to_status"?: Database["public"]['Enums']["sos_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_status_history_sos_id_fkey"
      columns: ["sos_id"]
isOneToOne: false
      referencedRelation: "sos_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"district": string | null,"emergency_contact": string | null,"full_name": string | null,"id": string,"municipality": string | null,"phone": string | null,"rescue_team_id": string | null,"role": Database["public"]['Enums']["app_role"],"safety_status": Database["public"]['Enums']["safety_status"],"safety_updated_at": string | null,"updated_at": string,"ward": number | null
                  }
                  Insert: {
                    "created_at"?: string,"district"?: string | null,"emergency_contact"?: string | null,"full_name"?: string | null,"id": string,"municipality"?: string | null,"phone"?: string | null,"rescue_team_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"safety_status"?: Database["public"]['Enums']["safety_status"],"safety_updated_at"?: string | null,"updated_at"?: string,"ward"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"district"?: string | null,"emergency_contact"?: string | null,"full_name"?: string | null,"id"?: string,"municipality"?: string | null,"phone"?: string | null,"rescue_team_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"safety_status"?: Database["public"]['Enums']["safety_status"],"safety_updated_at"?: string | null,"updated_at"?: string,"ward"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_rescue_team_id_fkey"
      columns: ["rescue_team_id"]
isOneToOne: false
      referencedRelation: "rescue_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_sent_at": string | null,"p256dh": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_sent_at"?: string | null,"p256dh": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_sent_at"?: string | null,"p256dh"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"rescue_assignments": {
                  Row: {
                    "accepted_at": string | null,"arrived_at": string | null,"assigned_at": string,"assigned_by": string | null,"completed_at": string | null,"created_at": string,"en_route_at": string | null,"id": string,"notes": string | null,"rescue_team_id": string,"sos_id": string,"status": Database["public"]['Enums']["assignment_status"],"updated_at": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"arrived_at"?: string | null,"assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"en_route_at"?: string | null,"id"?: string,"notes"?: string | null,"rescue_team_id": string,"sos_id": string,"status"?: Database["public"]['Enums']["assignment_status"],"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"arrived_at"?: string | null,"assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"en_route_at"?: string | null,"id"?: string,"notes"?: string | null,"rescue_team_id"?: string,"sos_id"?: string,"status"?: Database["public"]['Enums']["assignment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rescue_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_assignments_rescue_team_id_fkey"
      columns: ["rescue_team_id"]
isOneToOne: false
      referencedRelation: "rescue_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_assignments_sos_id_fkey"
      columns: ["sos_id"]
isOneToOne: false
      referencedRelation: "sos_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"rescue_teams": {
                  Row: {
                    "base_location": string | null,"call_sign": string,"contact_phone": string | null,"created_at": string,"data_source": string | null,"district": string,"equipment": (string)[],"id": string,"is_demo": boolean,"latitude": number,"longitude": number,"name": string,"personnel_count": number,"status": Database["public"]['Enums']["team_status"],"updated_at": string
                  }
                  Insert: {
                    "base_location"?: string | null,"call_sign": string,"contact_phone"?: string | null,"created_at"?: string,"data_source"?: string | null,"district"?: string,"equipment"?: (string)[],"id"?: string,"is_demo"?: boolean,"latitude": number,"longitude": number,"name": string,"personnel_count"?: number,"status"?: Database["public"]['Enums']["team_status"],"updated_at"?: string
                  }
                  Update: {
                    "base_location"?: string | null,"call_sign"?: string,"contact_phone"?: string | null,"created_at"?: string,"data_source"?: string | null,"district"?: string,"equipment"?: (string)[],"id"?: string,"is_demo"?: boolean,"latitude"?: number,"longitude"?: number,"name"?: string,"personnel_count"?: number,"status"?: Database["public"]['Enums']["team_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"risk_zones": {
                  Row: {
                    "center_latitude": number,"center_longitude": number,"created_at": string,"danger_level_m": number,"distance_to_river_m": number,"district": string,"elevation_vulnerability": number,"id": string,"municipality": string | null,"name": string,"observed_at": string,"polygon": NonNullable<Json>,"radius_m": number,"rain_station_id": string | null,"rainfall_mm_24h": number,"river_basin": string,"river_level_m": number,"river_name": string | null,"river_station_id": string | null,"road_access_reduction": number,"source_type": Database["public"]['Enums']["data_source_type"],"updated_at": string,"warning_level_m": number
                  }
                  Insert: {
                    "center_latitude": number,"center_longitude": number,"created_at"?: string,"danger_level_m": number,"distance_to_river_m"?: number,"district": string,"elevation_vulnerability"?: number,"id"?: string,"municipality"?: string | null,"name": string,"observed_at"?: string,"polygon": NonNullable<Json>,"radius_m"?: number,"rain_station_id"?: string | null,"rainfall_mm_24h"?: number,"river_basin": string,"river_level_m": number,"river_name"?: string | null,"river_station_id"?: string | null,"road_access_reduction"?: number,"source_type"?: Database["public"]['Enums']["data_source_type"],"updated_at"?: string,"warning_level_m": number
                  }
                  Update: {
                    "center_latitude"?: number,"center_longitude"?: number,"created_at"?: string,"danger_level_m"?: number,"distance_to_river_m"?: number,"district"?: string,"elevation_vulnerability"?: number,"id"?: string,"municipality"?: string | null,"name"?: string,"observed_at"?: string,"polygon"?: NonNullable<Json>,"radius_m"?: number,"rain_station_id"?: string | null,"rainfall_mm_24h"?: number,"river_basin"?: string,"river_level_m"?: number,"river_name"?: string | null,"river_station_id"?: string | null,"road_access_reduction"?: number,"source_type"?: Database["public"]['Enums']["data_source_type"],"updated_at"?: string,"warning_level_m"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "risk_zones_rain_station_id_fkey"
      columns: ["rain_station_id"]
isOneToOne: false
      referencedRelation: "hydromet_stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "risk_zones_river_station_id_fkey"
      columns: ["river_station_id"]
isOneToOne: false
      referencedRelation: "hydromet_stations"
      referencedColumns: ["id"]
    }
                  ]
                },"shelters": {
                  Row: {
                    "address": string,"capacity": number,"contact_phone": string | null,"created_at": string,"current_occupancy": number,"data_source": string | null,"district": string,"food_status": Database["public"]['Enums']["supply_status"],"id": string,"is_active": boolean,"is_demo": boolean,"kind": string,"latitude": number,"longitude": number,"medical_assistance": boolean,"municipality": string,"name": string,"remaining_capacity": number | null,"source_ref": string | null,"updated_at": string,"verification": Database["public"]['Enums']["verification_status"],"ward": number | null,"water_status": Database["public"]['Enums']["supply_status"]
                  }
                  Insert: {
                    "address": string,"capacity": number,"contact_phone"?: string | null,"created_at"?: string,"current_occupancy"?: number,"data_source"?: string | null,"district": string,"food_status"?: Database["public"]['Enums']["supply_status"],"id"?: string,"is_active"?: boolean,"is_demo"?: boolean,"kind"?: string,"latitude": number,"longitude": number,"medical_assistance"?: boolean,"municipality": string,"name": string,"remaining_capacity"?: never,"source_ref"?: string | null,"updated_at"?: string,"verification"?: Database["public"]['Enums']["verification_status"],"ward"?: number | null,"water_status"?: Database["public"]['Enums']["supply_status"]
                  }
                  Update: {
                    "address"?: string,"capacity"?: number,"contact_phone"?: string | null,"created_at"?: string,"current_occupancy"?: number,"data_source"?: string | null,"district"?: string,"food_status"?: Database["public"]['Enums']["supply_status"],"id"?: string,"is_active"?: boolean,"is_demo"?: boolean,"kind"?: string,"latitude"?: number,"longitude"?: number,"medical_assistance"?: boolean,"municipality"?: string,"name"?: string,"remaining_capacity"?: never,"source_ref"?: string | null,"updated_at"?: string,"verification"?: Database["public"]['Enums']["verification_status"],"ward"?: number | null,"water_status"?: Database["public"]['Enums']["supply_status"]
                  }
                  Relationships: [
                    
                  ]
                },"sos_requests": {
                  Row: {
                    "acknowledged_at": string | null,"assigned_team_id": string | null,"children_count": number,"created_at": string,"description": string | null,"effective_priority": Database["public"]['Enums']["priority_level"] | null,"elderly_count": number,"id": string,"injured": boolean,"is_demo": boolean,"latitude": number,"location_accuracy_m": number | null,"location_name": string | null,"location_updated_at": string | null,"longitude": number,"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,"people_count": number,"phone": string,"photo_path": string | null,"priority_factors": NonNullable<Json>,"priority_level": Database["public"]['Enums']["priority_level"],"priority_override_note": string | null,"priority_score": number,"reference_code": string,"resolved_at": string | null,"situation": Database["public"]['Enums']["sos_situation"],"source": string,"status": Database["public"]['Enums']["sos_status"],"tracking_token": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "acknowledged_at"?: string | null,"assigned_team_id"?: string | null,"children_count"?: number,"created_at"?: string,"description"?: string | null,"effective_priority"?: never,"elderly_count"?: number,"id"?: string,"injured"?: boolean,"is_demo"?: boolean,"latitude": number,"location_accuracy_m"?: number | null,"location_name"?: string | null,"location_updated_at"?: string | null,"longitude": number,"operator_priority_override"?: Database["public"]['Enums']["priority_level"] | null,"people_count"?: number,"phone": string,"photo_path"?: string | null,"priority_factors"?: NonNullable<Json>,"priority_level"?: Database["public"]['Enums']["priority_level"],"priority_override_note"?: string | null,"priority_score"?: number,"reference_code"?: string,"resolved_at"?: string | null,"situation": Database["public"]['Enums']["sos_situation"],"source"?: string,"status"?: Database["public"]['Enums']["sos_status"],"tracking_token"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"assigned_team_id"?: string | null,"children_count"?: number,"created_at"?: string,"description"?: string | null,"effective_priority"?: never,"elderly_count"?: number,"id"?: string,"injured"?: boolean,"is_demo"?: boolean,"latitude"?: number,"location_accuracy_m"?: number | null,"location_name"?: string | null,"location_updated_at"?: string | null,"longitude"?: number,"operator_priority_override"?: Database["public"]['Enums']["priority_level"] | null,"people_count"?: number,"phone"?: string,"photo_path"?: string | null,"priority_factors"?: NonNullable<Json>,"priority_level"?: Database["public"]['Enums']["priority_level"],"priority_override_note"?: string | null,"priority_score"?: number,"reference_code"?: string,"resolved_at"?: string | null,"situation"?: Database["public"]['Enums']["sos_situation"],"source"?: string,"status"?: Database["public"]['Enums']["sos_status"],"tracking_token"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sos_requests_assigned_team_id_fkey"
      columns: ["assigned_team_id"]
isOneToOne: false
      referencedRelation: "rescue_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_locations": {
                  Row: {
                    "accuracy_m": number | null,"heading_deg": number | null,"latitude": number,"longitude": number,"speed_mps": number | null,"team_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"heading_deg"?: number | null,"latitude": number,"longitude": number,"speed_mps"?: number | null,"team_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "accuracy_m"?: number | null,"heading_deg"?: number | null,"latitude"?: number,"longitude"?: number,"speed_mps"?: number | null,"team_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_locations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "rescue_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"wards": {
                  Row: {
                    "center_latitude": number,"center_longitude": number,"data_source": string,"district": string,"id": string,"municipality": string,"name": string,"polygon": NonNullable<Json>,"source_ref": string | null,"updated_at": string,"ward_no": number
                  }
                  Insert: {
                    "center_latitude": number,"center_longitude": number,"data_source": string,"district": string,"id": string,"municipality": string,"name": string,"polygon": NonNullable<Json>,"source_ref"?: string | null,"updated_at"?: string,"ward_no": number
                  }
                  Update: {
                    "center_latitude"?: number,"center_longitude"?: number,"data_source"?: string,"district"?: string,"id"?: string,"municipality"?: string,"name"?: string,"polygon"?: NonNullable<Json>,"source_ref"?: string | null,"updated_at"?: string,"ward_no"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_close_active_assignment":
{ Args: { "p_final": Database["public"]['Enums']["assignment_status"],"p_sos_id": string }; Returns: undefined
                           },
"_set_sos_status":
{ Args: { "p_actor_role": string,"p_note": string,"p_sos": Database["public"]['Tables']["sos_requests"]['Row'],"p_to": Database["public"]['Enums']["sos_status"] }; Returns: undefined
                           },
"acknowledge_sos":
{ Args: { "p_sos_id": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"assign_rescue_team":
{ Args: { "p_expected_team_id"?: string,"p_note"?: string,"p_sos_id": string,"p_team_id": string }; Returns: {
              "accepted_at": string | null,
"arrived_at": string | null,
"assigned_at": string,
"assigned_by": string | null,
"completed_at": string | null,
"created_at": string,
"en_route_at": string | null,
"id": string,
"notes": string | null,
"rescue_team_id": string,
"sos_id": string,
"status": Database["public"]['Enums']["assignment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "rescue_assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"assignment_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["assignment_status"],"p_to": Database["public"]['Enums']["assignment_status"] }; Returns: boolean
                           },
"cancel_own_sos":
{ Args: { "p_sos_id": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_sos_with_token":
{ Args: { "p_reference": string,"p_token": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_rescue_team_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_permanent_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"resolve_sos":
{ Args: { "p_note"?: string,"p_sos_id": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_own_team_availability":
{ Args: { "p_available": boolean }; Returns: {
              "base_location": string | null,
"call_sign": string,
"contact_phone": string | null,
"created_at": string,
"data_source": string | null,
"district": string,
"equipment": (string)[],
"id": string,
"is_demo": boolean,
"latitude": number,
"longitude": number,
"name": string,
"personnel_count": number,
"status": Database["public"]['Enums']["team_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "rescue_teams"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_sos_priority_override":
{ Args: { "p_level": Database["public"]['Enums']["priority_level"],"p_note"?: string,"p_sos_id": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"sos_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["sos_status"],"p_to": Database["public"]['Enums']["sos_status"] }; Returns: boolean
                           },
"update_assignment_status":
{ Args: { "p_assignment_id": string,"p_note"?: string,"p_status": Database["public"]['Enums']["assignment_status"] }; Returns: {
              "accepted_at": string | null,
"arrived_at": string | null,
"assigned_at": string,
"assigned_by": string | null,
"completed_at": string | null,
"created_at": string,
"en_route_at": string | null,
"id": string,
"notes": string | null,
"rescue_team_id": string,
"sos_id": string,
"status": Database["public"]['Enums']["assignment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "rescue_assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_sos_location_with_token":
{ Args: { "p_accuracy_m": number,"p_latitude": number,"p_longitude": number,"p_reference": string,"p_token": string }; Returns: {
              "acknowledged_at": string | null,
"assigned_team_id": string | null,
"children_count": number,
"created_at": string,
"description": string | null,
"effective_priority": Database["public"]['Enums']["priority_level"] | null,
"elderly_count": number,
"id": string,
"injured": boolean,
"is_demo": boolean,
"latitude": number,
"location_accuracy_m": number | null,
"location_name": string | null,
"location_updated_at": string | null,
"longitude": number,
"operator_priority_override": Database["public"]['Enums']["priority_level"] | null,
"people_count": number,
"phone": string,
"photo_path": string | null,
"priority_factors": NonNullable<Json>,
"priority_level": Database["public"]['Enums']["priority_level"],
"priority_override_note": string | null,
"priority_score": number,
"reference_code": string,
"resolved_at": string | null,
"situation": Database["public"]['Enums']["sos_situation"],
"source": string,
"status": Database["public"]['Enums']["sos_status"],
"tracking_token": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sos_requests"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "alert_severity": "info"|"watch"|"high"|"danger","app_role": "citizen"|"operator"|"rescue"|"admin","assignment_status": "assigned"|"accepted"|"en_route"|"arrived"|"in_progress"|"completed"|"cancelled","data_source_type": "official"|"community"|"simulated","facility_kind": "hospital"|"health_facility"|"helipad"|"fire_station"|"police"|"government","hazard_severity": "low"|"medium"|"high"|"critical","hazard_status": "open"|"verified"|"resolved"|"rejected","hazard_type": "flooded_road"|"landslide"|"blocked_bridge"|"waterlogging"|"damaged_infrastructure"|"stranded_people"|"other","hydromet_kind": "river"|"rain","priority_level": "low"|"moderate"|"high"|"critical","safety_status": "unknown"|"safe"|"evacuated"|"need_help","sos_situation": "safe_temporarily"|"water_entering"|"water_rising"|"trapped"|"medical"|"other","sos_status": "received"|"acknowledged"|"assigned"|"accepted"|"en_route"|"arrived"|"in_progress"|"resolved"|"cancelled","supply_status": "available"|"limited"|"unavailable","team_status": "available"|"assigned"|"busy"|"offline","verification_status": "verified"|"unverified"|"demo"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "alert_severity": ["info", "watch", "high", "danger"],"app_role": ["citizen", "operator", "rescue", "admin"],"assignment_status": ["assigned", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"],"data_source_type": ["official", "community", "simulated"],"facility_kind": ["hospital", "health_facility", "helipad", "fire_station", "police", "government"],"hazard_severity": ["low", "medium", "high", "critical"],"hazard_status": ["open", "verified", "resolved", "rejected"],"hazard_type": ["flooded_road", "landslide", "blocked_bridge", "waterlogging", "damaged_infrastructure", "stranded_people", "other"],"hydromet_kind": ["river", "rain"],"priority_level": ["low", "moderate", "high", "critical"],"safety_status": ["unknown", "safe", "evacuated", "need_help"],"sos_situation": ["safe_temporarily", "water_entering", "water_rising", "trapped", "medical", "other"],"sos_status": ["received", "acknowledged", "assigned", "accepted", "en_route", "arrived", "in_progress", "resolved", "cancelled"],"supply_status": ["available", "limited", "unavailable"],"team_status": ["available", "assigned", "busy", "offline"],"verification_status": ["verified", "unverified", "demo"]
          }
        }
} as const

