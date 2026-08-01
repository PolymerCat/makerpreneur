import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudentHub USM",
    short_name: "StudentHub",
    description: "Your campus, all in one place.",
    start_url: "/home",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7fb",
    theme_color: "#5a4fcf",
    categories: ["education", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
