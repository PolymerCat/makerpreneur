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
      <p className="source-label">{label}: {selectedCount} / {materials.length} selected</p>
      <div className="source-actions">
        <button className="btn btn-sm" onClick={handleSelectAll}>All</button>
        <button className="btn btn-sm" onClick={handleDeselectAll}>None</button>
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
            <label key={material.id} className="source-item">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={function() { handleToggle(material.id); }}
              />
              {" " + material.title}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default SourceSelector;
