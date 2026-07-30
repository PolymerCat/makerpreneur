"use client";

import React from "react";

function LanguageToggle(props: {
  currentLanguage: string;
  onToggle: (lang: string) => void
}): React.JSX.Element {
  var currentLanguage = props.currentLanguage;
  var onToggle = props.onToggle;

  function handleClick(): void {
    if (currentLanguage === "en") {
      onToggle("ms");
    } else {
      onToggle("en");
    }
  }

  var label = "";
  if (currentLanguage === "en") {
    label = "Bahasa Melayu";
  } else {
    label = "English";
  }

  return (
    <button className="lang-toggle" onClick={handleClick}>
      <i className="ti ti-language"></i>
      {" " + label}
    </button>
  );
}

export default LanguageToggle;
