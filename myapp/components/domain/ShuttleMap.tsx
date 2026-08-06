"use client";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";

var USM_CENTER: [number, number] = [5.3571, 100.2936];

var SHUTTLE_ROUTE: [number, number][] = [
  [5.3525, 100.299],
  [5.355, 100.295],
  [5.3571, 100.2936],
  [5.359, 100.2915],
  [5.3615, 100.2895],
];

var BUS_STOPS: [number, number][] = [
  [5.355, 100.295],
  [5.359, 100.2915],
];

var busIcon = L.divIcon({
  className: "shuttle-bus-marker",
  html: '<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="3" y="3" width="28" height="19" rx="4.5" fill="#6b21a8" stroke="#ffffff" stroke-width="1.5"/>' +
    '<rect x="7" y="9" width="20" height="8" rx="2" fill="#ffffff"/>' +
    '<circle cx="11" cy="25" r="3" fill="#1c1917" stroke="#ffffff" stroke-width="1"/>' +
    '<circle cx="23" cy="25" r="3" fill="#1c1917" stroke="#ffffff" stroke-width="1"/>' +
    "</svg>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

var BUS_LABELS = ["Bus 1 · Main Gate", "Bus 2 · Library Loop"];

export function ShuttleMap() {
  return (
    <div className="shuttle-map">
      <MapContainer
        center={USM_CENTER}
        zoom={15}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={SHUTTLE_ROUTE}
          pathOptions={{ color: "#6b21a8", weight: 4, dashArray: "6 8" }}
        />
        {BUS_STOPS.map(function (pos, i) {
          return (
            <Marker key={i} position={pos} icon={busIcon}>
              <Popup>{BUS_LABELS[i]}</Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
