import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meetspace",
    short_name: "Meetspace",
    description: "Secure video meetings with screen sharing, whiteboard and encrypted chat.",
    start_url: "/meetings",
    display: "standalone",
    background_color: "#16141f",
    theme_color: "#16141f",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
