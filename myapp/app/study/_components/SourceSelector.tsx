"use client";

import React from "react";
import type { Material } from "../_lib/types";

function SourceSelector(props: {
  materials: Material[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  label: string
}): React.JSX.Element {
  var materials = props.materials;
  var selectedIds = props.selectedIds;
  var onSelectionChange = props.onSelectionChange;
  var label = props.label;

  function handleToggle(materialId: string): void {
    var newSelected: string[] = [];
    var found = false;
    for (var i = 0; i < selectedIds.length; i++) {
      if (selectedIds[i] === materialId) {
        found = true;
      } else {
        newSelected.push(selectedIds[i]);
      }
    }
    if (!found) {
      newSelected.push(materialId);
    }
    onSelectionChange(newSelected);
  }

  function handleSelectAll(): void {
    var allIds: string[] = [];
    for (var i = 0; i < materials.length; i++) {
      allIds.push(materials[i].id);
    }
    onSelectionChange(allIds);
  }

  function handleDeselectAll(): void {
    onSelectionChange([]);
  }

  var selectedCount = selectedIds.length;

  return (
    <div className="source-selector">
      <div className="source-header">
        <p className="source-label">{label}: {selectedCount} / {materials.length} selected</p>
        <div className="source-actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={handleSelectAll}>All</button>
          <button type="button" className="btn btn-sm" onClick={handleDeselectAll}>None</button>
        </div>
      </div>
      <div className="source-list">
        {materials.map(function(material: Material) {
          var isSelected = false;
          for (var i = 0; i < selectedIds.length; i++) {
            if (selectedIds[i] === material.id) {
              isSelected = true;
              break;
            }
          }
          return (
            <label key={material.id} className={"source-item" + (isSelected ? " selected" : "")}>
              <div className="source-info" style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, flexWrap: "wrap" }}>
                <span className="source-title">{material.title}</span>
                {material.year ? (
                  <span className="paper-meta" style={{ fontSize: "12px", color: "var(--text-muted)", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px" }}>
                    {material.year} / Sem {material.semester || 1}
                  </span>
                ) : null}
                {material.status ? (
                  <span className="status-badge status-ready" style={{ fontSize: "11px", textTransform: "lowercase", padding: "2px 8px" }}>
                    {material.status}
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
                {material.fileUrl ? (
                  <a
                    href={material.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ fontSize: "12px", padding: "4px 10px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={function(e) { e.stopPropagation(); }}
                  >
                    <i className="ti ti-file-text"></i> View PDF
                  </a>
                ) : null}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={function() { handleToggle(material.id); }}
                />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default SourceSelector;
