import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JalSuraksha Nepal — Flood Emergency Response",
    short_name: "JalSuraksha",
    description: "Know the Risk. Find Safety. Get Help. Flood alerts, safe routes, shelters and SOS for Nepal.",
    start_url: "/citizen",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f2447",
    categories: ["utilities", "navigation", "weather"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Emergency SOS", url: "/citizen/sos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find safe route", url: "/citizen/route" },
      { name: "Shelters", url: "/citizen/shelters" },
    ],
  };
}
