// Single source of truth for trade package names.
//
// Previously two different screens (TradeDirectoryPanel.tsx and
// subcontractors.new.tsx) each had their own hardcoded list, and both
// wrote free text from their list into the same subcontractor_invites
// .trade_packages column with nothing enforcing they matched — e.g. one
// screen offered "Structural Steels" and "M&E", the other offered "Steel
// Frame" and separate "Mechanical" / "Electrical" / "Plumbing" entries.
// Anything that reads trade_package by exact value (like the personal
// Site Manager diary's package-to-activity linking) could silently miss
// data depending on which screen was used to register a subcontractor.
//
// This is now the only place trade names are defined. Both registration
// screens import from here. If you need to change or add a trade, change
// it here — do not add a new hardcoded list elsewhere.
export const TRADE_PACKAGES = [
  "Groundworks",
  "Concrete Frame",
  "Steel Frame",
  "Cladding",
  "Roofing",
  "Windows & Curtain Wall",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Drylining & Plaster",
  "Joinery & Carpentry",
  "Painting & Decorating",
  "Flooring",
  "Ceilings",
  "Lifts",
  "Fire Protection",
  "Landscaping",
  "Demolition",
  "Scaffolding",
  "Cleaning",
] as const;

export type TradePackage = (typeof TRADE_PACKAGES)[number];
