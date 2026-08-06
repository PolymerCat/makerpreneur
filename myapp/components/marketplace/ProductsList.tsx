"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/marketplace/types";
import { ProductCard } from "./ProductCard";
import { ProductFilters } from "./ProductFilters";
import { categories } from "@/lib/marketplace/data";

export function ProductsList({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    const searchQuery = searchParams.get("q")?.toLowerCase();
    const category = searchParams.get("category");
    const priceMin = searchParams.get("price_min");
    const priceMax = searchParams.get("price_max");
    const sort = searchParams.get("sort") || "date-desc";

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          p.description.toLowerCase().includes(searchQuery)
      );
    }

    if (category && category !== "all") {
      filtered = filtered.filter((p) => p.category.id === category);
    }

    if (priceMin) {
      filtered = filtered.filter((p) => p.price >= Number(priceMin));
    }
    if (priceMax) {
      filtered = filtered.filter((p) => p.price <= Number(priceMax));
    }

    switch (sort) {
      case "price-asc":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "date-asc":
        filtered.sort(
          (a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
        );
        break;
      default:
        filtered.sort(
          (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        );
        break;
    }

    return filtered;
  }, [products, searchParams]);

  return (
    <>
      <ProductFilters categories={categories} />
      {filteredProducts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <h3>No products found</h3>
          <p style={{ color: "var(--muted)" }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
