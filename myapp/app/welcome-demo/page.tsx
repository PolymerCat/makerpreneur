"use client";

import React from "react";
import { WelcomeOverlay } from "@/components/landing/WelcomeOverlay";
import { useRouter } from "next/navigation";

export default function WelcomeDemoPage() {
  var router = useRouter();

  function handleSkip() {
    router.push("/");
  }

  return <WelcomeOverlay onSkip={handleSkip} />;
}
