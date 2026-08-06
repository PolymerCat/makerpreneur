"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Category } from "@/lib/marketplace/types";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";

type ProductFiltersProps = {
  categories: Category[];
};

export function ProductFilters({ categories }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    router.push(pathname + "?" + createQueryString(name, value));
  };

  const clearFilters = () => {
    router.push(pathname);
    setFilterOpen(false);
    setSortOpen(false);
  };

  const hasActiveCategoryOrPrice =
    searchParams.has("category") ||
    searchParams.has("price_min") ||
    searchParams.has("price_max");

  const hasActiveFilters =
    searchParams.has("q") || hasActiveCategoryOrPrice || searchParams.has("sort");

  const currentSort = searchParams.get("sort") || "date-desc";

  return (
    <div className="events-controls-row" style={{ position: "relative" }}>
      {/* Search Input Bar */}
      <div className="events-search-input-wrap">
        <Icon name="ti-search" className="search-icon" />
        <input
          className="events-search-input"
          placeholder="Search listings by keyword..."
          defaultValue={searchParams.get("q") || ""}
          onChange={(e) => handleFilterChange("q", e.target.value)}
        />
      </div>

      {/* Filter Icon Button */}
      <button
        type="button"
        className={`icon-btn-toggle ${filterOpen ? "active" : ""}`}
        onClick={() => {
          setFilterOpen((v) => !v);
          setSortOpen(false);
        }}
        title="Filter listings"
        aria-label="Filter listings"
        style={{ position: "relative" }}
      >
        <Icon name="ti-filter" />
        {hasActiveCategoryOrPrice && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: filterOpen ? "#ffffff" : "var(--brand-deep, #4c1d95)",
            }}
          />
        )}
      </button>

      {/* Sort Icon Button */}
      <button
        type="button"
        className={`icon-btn-toggle ${sortOpen ? "active" : ""}`}
        onClick={() => {
          setSortOpen((v) => !v);
          setFilterOpen(false);
        }}
        title="Sort listings"
        aria-label="Sort listings"
      >
        <Icon name="ti-arrows-sort" />
      </button>

      {/* Filter Popover */}
      {filterOpen && (
        <div className="popover-panel" style={{ right: 54 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-filter" /> Filter Listings
            </strong>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              aria-label="Close filters"
            >
              <Icon name="ti-x" />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
              <Select
                value={searchParams.get("category") || "all"}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Price Range (RM)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <TextInput
                  type="number"
                  placeholder="Min"
                  defaultValue={searchParams.get("price_min") || ""}
                  onChange={(e) => handleFilterChange("price_min", e.target.value)}
                />
                <TextInput
                  type="number"
                  placeholder="Max"
                  defaultValue={searchParams.get("price_max") || ""}
                  onChange={(e) => handleFilterChange("price_max", e.target.value)}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ cursor: "pointer" }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Popover */}
      {sortOpen && (
        <div className="popover-panel" style={{ right: 0, width: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-arrows-sort" /> Sort By
            </strong>
            <button
              type="button"
              onClick={() => setSortOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              aria-label="Close sort"
            >
              <Icon name="ti-x" />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { value: "date-desc", label: "Newest first" },
              { value: "date-asc", label: "Oldest first" },
              { value: "price-asc", label: "Price: Low to High" },
              { value: "price-desc", label: "Price: High to Low" },
            ].map((opt) => {
              const isSelected = currentSort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    handleFilterChange("sort", opt.value);
                    setSortOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "var(--radius)",
                    border: isSelected ? "1px solid var(--brand)" : "1px solid transparent",
                    background: isSelected ? "var(--brand-soft)" : "transparent",
                    color: isSelected ? "var(--brand-deep)" : "var(--text)",
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Icon name="ti-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
