"use client";

import dynamic from "next/dynamic";

var ShuttleMap = dynamic(
  () => import("./ShuttleMap").then((mod) => mod.ShuttleMap),
  {
    ssr: false,
    loading: () => (
      <div className="shuttle-map-loading h-[65vh] md:h-[75vh] w-full">
        Loading map…
      </div>
    ),
  }
);

export function TransitMap() {
  return <ShuttleMap />;
}
