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
    id: "workspace-selector",
    target: "[data-tour='workspace-selector']",
    title: "Workspace Switcher",
    description:
      "Switch between workspaces here. Each workspace is isolated and holds its own datasets, sources, and analysis.",
    position: "bottom",
  },
  {
    id: "datasets-section",
    target: "[data-tour='datasets-section']",
    title: "Datasets",
    description:
      "All your uploaded datasets live here. Expand the list to open any dataset and start exploring its contents.",
    position: "right",
  },
  {
    id: "warehouse",
    target: "[data-tour='warehouse-link']",
    title: "Warehouse",
    description:
      "Run SQL queries across all datasets in your workspace at once — perfect for cross-dataset analysis and ad-hoc exploration.",
    position: "right",
  },
  {
    id: "join-builder",
    target: "[data-tour='join-builder-link']",
    title: "Join Builder",
    description:
      "Visually combine datasets using drag-and-drop joins. No SQL required — preview the merged result instantly.",
    position: "right",
  },
  {
    id: "subnav-bar",
    target: "[data-tour='subnav-bar']",
    title: "Analysis Features Bar",
    description:
      "This bar gives you quick access to every analysis module — Overview, Profile, Missing Values, Correlations, Distributions, Charts, SQL, and more.",
    position: "bottom",
  },
];
