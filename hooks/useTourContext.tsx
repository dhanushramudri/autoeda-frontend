"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { TourStep } from "@/lib/tourSteps";

interface TourContextType {
  isOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  skipTour: () => void;
  goToStep: (index: number) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);

  const currentStep = steps[currentStepIndex] || null;

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < steps.length - 1) return prev + 1;
      // last step — close tour inline to avoid stale endTour ref
      setIsOpen(false);
      setSteps([]);
      return 0;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  const endTour = useCallback(() => {
    setIsOpen(false);
    setCurrentStepIndex(0);
    setSteps([]);
  }, []);

  const skipTour = useCallback(() => {
    endTour();
  }, [endTour]);

  return (
    <TourContext.Provider
      value={{
        isOpen,
        currentStepIndex,
        currentStep,
        steps,
        startTour,
        nextStep,
        prevStep,
        endTour,
        skipTour,
        goToStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextType => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
};
