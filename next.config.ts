import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Location is needed for SOS and routing; camera for hazard/SOS photos.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev only: without these, `next dev` blocks its own scripts for any host
  // except localhost, so the page never hydrates (no buttons, forms, maps or
  // live updates) when opened at 127.0.0.1 or from a phone on the LAN.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be served stale.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
