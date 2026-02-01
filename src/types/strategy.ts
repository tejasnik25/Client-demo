export type Strategy = {
  id: string;
  name: string;
  description: string;
  // Deprecated fields
  performance?: number;
  riskLevel?: "Low" | "Medium" | "High";
  category?: "Growth" | "Income" | "Momentum" | "Value";
  // Old fields from admin
  minCapital?: number;
  avgDrawdown?: number;
  riskReward?: number;
  winStreak?: number;
  // New fields
  riskScore?: number;
  roi?: number;
  profit?: number;
  maxDdi?: number;
  copiers?: number;
  tag?: string;
  mastersTag?: string;
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
  masterAccountId?: string;
  masterAccountPassword?: string;
  masterAccountServer?: string;
  masterPlatform?: "mt4" | "mt5";
  createdAt: Date;
  updatedAt: Date;
};