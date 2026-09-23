# Onboard AI — multi-company onboarding agent MVP

A GitHub-ready, browser-first SaaS prototype for reusable employee onboarding. One agent engine can serve many companies while each company's knowledge, employees, progress and billing state remain isolated by `organization_id`.

## What makes it an agent

The chat experience implements an agent loop rather than only RAG:

1. **Observe** employee profile, onboarding stage and message.
2. **Plan** which tools to use (local WebLLM planner when loaded; deterministic planner otherwise).
3. **Act** with tools: retrieve company knowledge, inspect open onboarding tasks, inspect employee context, or complete an explicitly completed task.
4. **Synthesize** a grounded answer and next step.
5. **Persist** progress and conversation memory.

The local LLM is optional. The MVP uses WebLLM in the browser, so LLM inference can run without a per-message API charge. The default model is `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` and can be changed in `config.js`.

## Commercial model included

- First **3 active employees** per company are free.
- Employee #4 is blocked unless the company has paid-seat capacity.
- The limit exists in the UI **and** in the Supabase database trigger in `supabase/schema.sql`, so a client cannot bypass the paywall by calling the API directly.
- Set `pricePerAdditionalSeatInr` in `config.js` when you decide pricing.
- Razorpay is intentionally not faked. Live recurring billing requires your merchant account and secret keys. Secrets must live in server-side/Edge Function secrets, never in GitHub or `config.js`.

## Run immediately — no backend

The app automatically runs in **Demo mode** when `supabaseUrl` and `supabasePublishableKey` are blank.

1. Serve this folder over HTTP (for example with any static dev server).
2. Create a company workspace.
3. Upload PDF/DOCX/TXT/MD/CSV knowledge.
4. Add up to three employees.
5. Open **Onboarding Agent** and test the guided agent.
6. Optionally click **Load local AI** to download/run the browser model through WebGPU.

Demo mode stores data only in the current browser's `localStorage`. It is for product testing, not real employee data.

## Connect a real Supabase backend

Create a **separate Supabase project for this product**. Do not mix customer HR data into an unrelated product database.

1. Open the Supabase SQL editor and run `supabase/schema.sql`.
2. In Supabase Storage, confirm the private `company-knowledge` bucket exists (the SQL creates it if absent).
3. Copy the Project URL and **publishable** key into `config.js`.
4. Keep Row Level Security enabled. The browser publishable key is not the security boundary; the RLS policies are.
5. Test with two companies and verify neither can read the other's employees, documents, chunks, tasks or messages.

### Auth model

- A user can sign up/sign in with Supabase email/password auth.
- The first user creates a company workspace and becomes its admin through a database trigger.
- Admins create employee records by work email.
- When an invited employee signs in with the matching email, `claim_pending_employee()` can link the auth user to that employee record and membership.

## Knowledge architecture

Uploaded sources are parsed in the browser and broken into chunks. The MVP uses lexical retrieval to keep infrastructure/API cost at zero. This is enough for small onboarding libraries and can later be upgraded to embeddings/pgvector without changing the tenant model.

Supported MVP file types:

- PDF
- DOCX
- TXT
- Markdown
- CSV

The agent is instructed never to invent company-specific policy, benefits, culture, manager or process information when retrieval does not provide evidence.

## Deployment

The project is a static web app, so the source can stay on GitHub and deploy to any static host. For a commercial SaaS, use a host whose free/paid terms permit commercial use. GitHub Pages and Vercel Hobby have restrictions that make them unsuitable as the final commercial hosting plan.

## Security before real customers

Before real employee/company data:

- Use a dedicated Supabase project.
- Run Supabase security advisors after applying the schema.
- Verify every table and storage bucket has the intended RLS behavior.
- Add a privacy policy, retention/deletion controls and customer terms.
- Add rate limiting/bot protection to signup and billing functions.
- Do not upload confidential company information to Demo mode for production use.
- Do not place service-role keys or Razorpay secrets in GitHub/browser code.

## Files

- `app.js` — UI and product flow
- `agent.js` — agent planner, tool loop and response synthesis
- `knowledge.js` — file parsing, chunking and retrieval
- `repository.js` — Demo/Supabase data abstraction
- `local-llm.js` — WebLLM browser inference
- `billing.js` — paywall/billing adapter hook
- `config.js` — public runtime settings
- `supabase/schema.sql` — multi-tenant database, RLS, storage policies and seat-limit enforcement
