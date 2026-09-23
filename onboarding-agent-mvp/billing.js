import { CONFIG } from "./config.js";

export function priceLabel() {
  return CONFIG.pricePerAdditionalSeatInr ? `₹${CONFIG.pricePerAdditionalSeatInr} / active employee / month` : "Price not configured yet";
}

export async function startUpgrade({ organizationId, requestedPaidSeats }) {
  if (!CONFIG.razorpayKeyId) {
    const error = new Error("BILLING_NOT_CONFIGURED");
    error.code = "BILLING_NOT_CONFIGURED";
    throw error;
  }
  // Live checkout is intentionally server-created. The browser must never hold Razorpay secrets.
  // Wire this to the Supabase Edge Function template in supabase/functions once merchant credentials exist.
  const error = new Error("BILLING_EDGE_FUNCTION_NOT_DEPLOYED");
  error.code = "BILLING_EDGE_FUNCTION_NOT_DEPLOYED";
  error.meta = { organizationId, requestedPaidSeats };
  throw error;
}
