export type Strategy = {
  id: string;
  name: string;
  description: string;
  // Deprecated fields
  performance?: number;
  riskLevel?: "Low" | "Medium" | "High";
  category?: "Growth" | "Income" | "Momentum" | "Value";
  // New fields from admin
  minCapital?: number;
  avgDrawdown?: number;
  riskReward?: number;
  winStreak?: number;
  tag?: string;
  planPrices?: {
    Pro?: number;
    Expert?: number;
    Premium?: number;
  };
  planDetails?: {
    Pro?: { priceLabel?: string; percent?: number };
    Expert?: { priceLabel?: string; percent?: number };
    Premium?: { priceLabel?: string; percent?: number };
  };
  imageUrl: string;
  details: string;
  parameters: Record<string, string>;
  contentType?: "html" | "pdf" | "text";
  contentUrl?: string;
  contentBlob?: Buffer;
  contentMime?: string;
  contentS3Key?: string;
  enabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};