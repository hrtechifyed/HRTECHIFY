// Template only. Deploy after you have a Razorpay merchant account and have chosen pricing.
// Required Supabase Edge Function secrets:
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// For a true per-user/month product, use Razorpay Subscriptions/Plans rather than trusting
// a browser-supplied amount. The server must derive amount/quantity from your own pricing rules.

Deno.serve(async () => new Response(JSON.stringify({
  error: "BILLING_NOT_CONFIGURED",
  message: "Choose pricing and configure Razorpay recurring billing before deploying this function."
}), { status: 501, headers: { "content-type": "application/json" } }));
