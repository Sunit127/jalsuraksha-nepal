import { NextResponse } from "next/server";
import { EMERGENCY_CONTACTS, SAFETY_INSTRUCTIONS } from "@/lib/demo/scenario";
import { getPublicSnapshot } from "@/lib/supabase/queries";

/**
 * Public situational snapshot for offline use (cached by the service worker
 * and in localStorage): active alerts, open shelters, emergency contacts and
 * safety instructions. Contains no personal data.
 */
export async function GET() {
  const snapshot = await getPublicSnapshot();
  return NextResponse.json(
    {
      fetchedAt: snapshot.fetchedAt,
      ok: snapshot.ok,
      alerts: snapshot.alerts,
      shelters: snapshot.shelters.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        capacity: s.capacity,
        current_occupancy: s.current_occupancy,
        remaining_capacity: s.remaining_capacity,
        food_status: s.food_status,
        water_status: s.water_status,
        medical_assistance: s.medical_assistance,
        contact_phone: s.contact_phone,
      })),
      emergencyContacts: EMERGENCY_CONTACTS,
      safetyInstructions: SAFETY_INSTRUCTIONS,
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}
