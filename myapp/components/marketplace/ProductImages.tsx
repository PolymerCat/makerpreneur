"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

type ProductImagesProps = {
  images: string[];
  productName: string;
};

/** Simple image switcher (no embla-carousel dep). */
export function ProductImages({ images, productName }: ProductImagesProps) {
  const [current, setCurrent] = useState(0);
  const src = images[current];

  return (
    <div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${productName} image ${current + 1}`}
            style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontWeight: 700,
            }}
          >
            No photo
          </div>
        )}
      </Card>
      {images.length > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1}`}
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                overflow: "hidden",
                border: `3px solid ${i === current ? "var(--brand)" : "transparent"}`,
                opacity: i === current ? 1 : 0.6,
                padding: 0,
                cursor: "pointer",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`Thumbnail ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
