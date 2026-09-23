// Public runtime configuration. The Supabase publishable key is designed to be used in clients;
// tenant security must come from the RLS policies in supabase/schema.sql.
export const CONFIG = {
  productName: "Onboard AI",
  supabaseUrl: "",
  supabasePublishableKey: "",
  freeActiveSeats: 3,
  pricePerAdditionalSeatInr: null, // e.g. 199. Keep null until you choose pricing.
  razorpayKeyId: "", // public key only; secrets belong in Supabase Edge Function secrets.
  localModelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  maxDocumentSizeMb: 5,
  maxKnowledgeChunksPerDocument: 240,
};
