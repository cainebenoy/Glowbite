export const STATUSES = ["new", "contacted", "converted", "dropped"] as const;
export type LeadStatus = (typeof STATUSES)[number];
