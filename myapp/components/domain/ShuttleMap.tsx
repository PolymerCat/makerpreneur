"use client";

import React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, GeoJSON } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import routeData from "@/lib/data/roadmap.json";
import { useTraccarSocket } from "@/app/study/_lib/traccar/use-traccar";

var usmRoute = routeData as unknown as GeoJsonObject;

var USM_CENTER: [number, number] = [5.3571, 100.2936];

var BUS_DEVICE_ID = 101;

var busIcon = L.divIcon({
  className: "shuttle-bus-marker",
  html:
    '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="1.5" y="1.5" width="15" height="15" rx="4.5" fill="#6b21a8" stroke="#1c1917" stroke-width="2.5"/>' +
    '<rect x="4" y="4.5" width="10" height="4" rx="1" fill="#ffffff"/>' +
    '<circle cx="6" cy="13" r="1.8" fill="#1c1917"/>' +
    '<circle cx="12" cy="13" r="1.8" fill="#1c1917"/>' +
    "</svg>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

var customIcon = L.icon({
  iconUrl: "/icons/stop-marker.svg",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export function ShuttleMap() {
  var [busPosition, setBusPosition] = React.useState<[number, number]>([5.355, 100.2979]);

  useTraccarSocket({
    onPosition: function (position) {
      if (position.deviceId !== BUS_DEVICE_ID || !position.valid) {
        return;
      }
      setBusPosition([position.latitude, position.longitude]);
    }
  });

  return (
    <div className="shuttle-map h-[65vh] md:h-[75vh] w-full">
      <MapContainer
        center={USM_CENTER}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={usmRoute}
          filter={function (feature) {
            return (
              feature.geometry.type === "Point" ||
              (feature.geometry.type === "LineString" &&
                feature.geometry.coordinates.length > 5)
            );
          }}
          pointToLayer={function (_feature, latlng) {
            return L.marker(latlng, { icon: customIcon });
          }}
          style={{ color: "red", weight: 4, opacity: 1 }}
        />
        <Marker position={busPosition} icon={busIcon}>
          <Tooltip
            permanent
            direction="bottom"
            offset={[0, 6]}
            className="shuttle-bus-label"
          >
            Bus A
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}
