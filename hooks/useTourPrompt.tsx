"use client";

import { useEffect } from "react";
import { useTour } from "@/hooks/useTourContext";
import { tourSteps } from "@/lib/tourSteps";

const TOUR_SEEN_KEY = "autoeda_tour_seen";

export const useTourPrompt = () => {
  const { startTour } = useTour();

  useEffect(() => {
    // Check if user has seen the tour before
    if (typeof window !== "undefined") {
      const tourSeen = localStorage.getItem(TOUR_SEEN_KEY);

      if (!tourSeen) {
        // Optionally show tour on first visit - commented out as it can be intrusive
        // Uncomment if you want to auto-start tour for new users
        // const timer = setTimeout(() => {
        //   startTour(tourSteps);
        //   localStorage.setItem(TOUR_SEEN_KEY, "true");
        // }, 1500);
        // return () => clearTimeout(timer);
      }
    }
  }, [startTour]);

  const markTourAsSeen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
    }
  };

  return { markTourAsSeen };
};
