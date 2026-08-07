"use client";

import React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import routeData from "@/lib/data/roadmap.json";
import { useTraccarSocket } from "@/app/study/_lib/traccar/use-traccar";

var usmRoute = routeData as unknown as GeoJsonObject;

var stops = routeData.features
  .filter(function (feature) {
    return feature.geometry.type === "Point";
  })
  .map(function (feature) {
    var coords = feature.geometry.coordinates as number[];
    var props = feature.properties as { title?: string; "next-stop"?: string };
    return { lat: coords[1], lon: coords[0], name: props.title || "", nextStop: props["next-stop"] || "" };
  });

var USM_CENTER: [number, number] = [5.3571, 100.2936];

function makeBusIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "shuttle-bus-marker",
    html:
      '<div class="flex h-full w-full items-center justify-center rounded-full border border-[#1c1917] bg-[#6b21a8] px-2 text-[10px] font-semibold text-white">' +
      label +
      "</div>",
    iconSize: [54, 20],
    iconAnchor: [27, 10],
  });
}

var stopIcon = L.divIcon({
  className: "shuttle-stop-marker",
  html:
    '<div class="relative flex h-3.5 w-3.5">' +
    '<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>' +
    '<span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-blue-500"></span>' +
    "</div>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type BusInfo = {
  id: number;
  name: string;
  status: "In Transit" | "Boarding";
  nextStop: string;
  position: { lat: number; lon: number };
};

export function ShuttleMap() {
  var [selectedBus, setSelectedBus] = React.useState<BusInfo | null>(null);
  var [isExpanded, setIsExpanded] = React.useState(false);
  var mapRef = React.useRef<L.Map | null>(null);
  var [operationalBuses, setOperationalBuses] = React.useState<BusInfo[]>(function () {
    var padangKawad = stops.find(function (s) {
      return s.name === "Padang Kawad";
    });
    return [
      { id: 101, name: "Bus A", status: "In Transit", nextStop: "Pharmacy", position: { lat: 5.355053, lon: 100.29657 } },
      { id: 102, name: "Bus B", status: "In Transit", nextStop: "Pusat Sejahtera", position: { lat: 5.358462, lon: 100.301678 } },
      { id: 103, name: "Bus C", status: "Boarding", nextStop: padangKawad ? padangKawad.nextStop : "", position: { lat: padangKawad ? padangKawad.lat : 5.356562, lon: padangKawad ? padangKawad.lon : 100.293333 } },
      { id: 105, name: "Bus E", status: "In Transit", nextStop: "Harapan", position: { lat: 5.354329, lon: 100.301385 } }
    ];
  });

  useTraccarSocket({
    onPosition: function (position) {
      if (!position.valid) {
        return;
      }
      setOperationalBuses(function (buses) {
        return buses.map(function (bus) {
          if (bus.id !== position.deviceId) {
            return bus;
          }
          return {
            ...bus,
            position: { lat: position.latitude, lon: position.longitude }
          };
        });
      });
    }
  });

  return (
    <div className="shuttle-map h-[65vh] md:h-[75vh] w-full">
      <MapContainer
        ref={mapRef}
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
              feature.geometry.type === "LineString" &&
              feature.geometry.coordinates.length > 5
            );
          }}
          style={{ color: "red", weight: 4, opacity: 1 }}
        />
        {stops.map(function (stop, index) {
          return (
            <Marker key={index} position={[stop.lat, stop.lon]} icon={stopIcon}>
              <Popup>
                <span className="text-xs font-semibold">
                  {stop.name}
                </span>
              </Popup>
            </Marker>
          );
        })}
        {operationalBuses.map(function (bus) {
          return (
            <Marker
              key={bus.id}
              position={[bus.position.lat, bus.position.lon]}
              icon={makeBusIcon(bus.name)}
            />
          );
        })}
      </MapContainer>
      <div className="absolute right-4 top-4 z-[1000] w-60">
        <button
          type="button"
          onClick={function () {
            setIsExpanded(!isExpanded);
          }}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur transition-colors hover:bg-white"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🚌</span>
            <span className="text-sm font-semibold text-[#1c1917]">Active Buses</span>
            <span className="text-xs font-medium text-[#57534e]">
              ({operationalBuses.length} live)
            </span>
          </span>
          <svg
            className={
              "h-4 w-4 text-[#57534e] transition-transform duration-200 " +
              (isExpanded ? "rotate-180" : "")
            }
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div
          className={
            "transition-all duration-300 ease-in-out overflow-hidden " +
            (isExpanded ? "max-h-60 opacity-100" : "max-h-0 opacity-0")
          }
        >
          <ul className="mt-2 space-y-1 rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/10 backdrop-blur">
            {operationalBuses.map(function (bus) {
              var isSelected = selectedBus !== null && selectedBus.id === bus.id;
              return (
                <li key={bus.id}>
                  <button
                    type="button"
                    onClick={function () {
                      setSelectedBus(bus);
                      if (mapRef.current) {
                        mapRef.current.flyTo([bus.position.lat, bus.position.lon], 17, { animate: true });
                      }
                    }}
                    className={
                      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors " +
                      (isSelected
                        ? "bg-[#f3e8ff]"
                        : "hover:bg-gray-100")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          "h-2.5 w-2.5 rounded-full " +
                          (bus.status === "In Transit" ? "bg-green-500" : "bg-amber-400")
                        }
                      ></span>
                      <span className="text-sm font-semibold text-[#1c1917]">{bus.name}</span>
                    </span>
                    <span className="text-xs font-medium text-[#57534e]">
                      {bus.status === "In Transit" ? "Heading to " + bus.nextStop : bus.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <button
          type="button"
          onClick={function () {
            if (mapRef.current) {
              mapRef.current.flyTo(USM_CENTER, 15, { animate: true });
            }
          }}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm transition-colors hover:bg-purple-100"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clipRule="evenodd"
            />
          </svg>
          Refresh Map
        </button>
      </div>
    </div>
  );
}
