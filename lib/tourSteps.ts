export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    target: "body",
    title: "Welcome to AutoEDA",
    description:
      "Let's take a quick tour of the platform. We'll walk you through the key features so you can start exploring your data right away.",
    position: "center",
  },
  {
    id: "solutions",
    target: "[data-tour='solutions-link']",
    title: "Solutions — start here",
    description:
      "Pick a solution and click Run analysis. Data checks, exploration, models, validation and the report all run automatically, in one place.",
    position: "right",
  },
  {
    id: "workspace-selector",
    target: "[data-tour='workspace-selector']",
    title: "Workspace Switcher",
    description:
      "Switch between workspaces here. Each workspace is isolated and holds its own datasets, sources, and analysis.",
    position: "bottom",
  },
  {
    id: "data-sources",
    target: "[data-tour='data-sources-link']",
    title: "Data Sources",
    description:
      "Connect databases, cloud storage, or APIs here — anything that feeds data into your workspace starts at this step.",
    position: "right",
  },
  {
    id: "datasets-section",
    target: "[data-tour='datasets-section']",
    title: "Datasets",
    description:
      "Everything you've uploaded or connected lands here. Expand the list to open any dataset and start exploring its contents.",
    position: "right",
  },
  {
    id: "scout",
    target: "[data-tour='scout-link']",
    title: "Scout — your AI data analyst",
    description:
      "Ask Scout anything about your data. It runs real analysis — profiling, correlations, SQL, statistical tests — and shows its work instead of guessing.",
    position: "right",
  },
  {
    id: "hypotheses",
    target: "[data-tour='hypotheses-link']",
    title: "Hypotheses",
    description:
      "Propose a claim about your data, or let AI generate one, and get a verdict backed by an actual computed test — not a narrative guess.",
    position: "right",
  },
  {
    id: "wrap-up",
    target: "body",
    title: "You're ready to explore",
    description:
      "That's the core flow: connect a source, explore your datasets, investigate with Scout, and validate hypotheses.",
    position: "center",
  },
];

// Short tour shown once, right after login, on the Solutions page
export const solutionsTour: TourStep[] = [
  {
    id: "welcome-solutions",
    target: "body",
    title: "Welcome",
    description: "Everything starts in Solutions. It analyses your data automatically and gives you the findings, charts and files in one place.",
    position: "center",
  },
  {
    id: "solutions-link",
    target: "[data-tour='solutions-link']",
    title: "Solutions",
    description: "This is your home. Come back here any time to run an analysis or reopen a previous one.",
    position: "right",
  },
  {
    id: "run-analysis",
    target: "[data-tour='run-analysis']",
    title: "Run analysis",
    description: "One click runs the whole analysis on the datasets in this workspace — nothing to set up or select.",
    position: "left",
  },
];
