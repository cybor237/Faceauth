export interface Developer {
  id: string;
  email: string;
  firebase_uid: string;
  created_at: string;
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  credits: number;
  created_at: string;
  last_used_at: string | null;
}

export interface NewAPIKeyResponse {
  raw_key: string;  // Affiché UNE SEULE FOIS
  api_key: APIKey;
}

export interface AuditLog {
  id: string;
  end_user_id: string;
  action: "enroll" | "verify_success" | "verify_failed" | "error";
  success: boolean;
  similarity_score: number | null;
  credits_before: number;
  credits_after: number;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_verifications: number;
  successful_verifications: number;
  total_enrollments: number;
  total_credits_used: number;
  credits_remaining: number;
  api_keys_count: number;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  price_per_credit: number;
  highlighted?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "growth",
    name: "Croissance",
    credits: 2000,
    price_usd: 100,
    price_per_credit: 0.05,
  },
  {
    id: "scale",
    name: "Échelle",
    credits: 10000,
    price_usd: 400,
    price_per_credit: 0.04,
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Entreprise",
    credits: 0,
    price_usd: 0,
    price_per_credit: 0,
  },
];
