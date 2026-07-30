/**
 * Single shared source of truth for toolbox talk topics.
 * Every dropdown must read from here so the list can never drift.
 */
export const TOOLBOX_TOPICS = [
  "Manual Handling",
  "Working at Height",
  "Lifting Operations (LOLER)",
  "Slips/Trips",
  "Fire Safety",
  "PPE",
  "Traffic Management and Vehicle Movements",
  "Electrical Safety and Isolation",
  "Noise and Vibration",
  "Dust and Silica (RCS)",
  "Asbestos Awareness",
  "Working Alone",
  "Emergency Procedures and First Aid",
  "Scaffolding and Access",
  "Temporary Works",
  "Permit to Work",
  "Confined Spaces",
  "Hot Works",
  "Excavations",
  "Waste Segregation",
  "Spill Control",
  "Hot Weather",
  "Mental Health and Wellbeing",
  "Environmental and Ecology",
] as const;

export type ToolboxTopic = (typeof TOOLBOX_TOPICS)[number];

/** Sentinel used by the UI to reveal a free-text topic field. */
export const TOOLBOX_TOPIC_OTHER = "Other";

export const MAX_TOOLBOX_TOPIC_LENGTH = 120;
