import { FlaskConical } from "lucide-react";

/**
 * Shown on every citizen and staff screen while the system runs the demo
 * scenario instead of live DHM readings, so nobody mistakes it for reality.
 */
export function SimulationBanner({ staff = false }: { staff?: boolean }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-high-strong px-4 py-1.5 text-center text-xs font-semibold text-white">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        SIMULATION MODE — river levels and risk are a demo scenario, not real readings.
        {staff ? " Switch back to live data in Presentation mode." : " Follow official instructions."}
      </span>
    </div>
  );
}
