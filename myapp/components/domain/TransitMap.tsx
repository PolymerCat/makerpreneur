"use client";

import dynamic from "next/dynamic";

var ShuttleMap = dynamic(
  () => import("./ShuttleMap").then((mod) => mod.ShuttleMap),
  {
    ssr: false,
    loading: () => <div className="shuttle-map-loading">Loading map…</div>,
  }
);

export function TransitMap() {
  return <ShuttleMap />;
}
