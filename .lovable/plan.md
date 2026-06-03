## Goal

Let any user export a Cost Proposal PDF from an individual project, work, or subscription. The output overlays text on an admin-configurable background template PDF (defaulting to the supplied IO-Gen template), and uses admin-editable conditions per type.

## What gets printed (matches the sample)

- Print date (today)
- `<Client name> - <Project/Work title OR Subscription plan name>`
- Description
- Cost breakdown table from current cost version (Item No., Description, Quantity, Cost ex. VAT) — using the same items already shown on the page - make sure not to print investment cost and profit.
- **Subscriptions only**: `Renewal due: <renewal_date>`
- Conditions list (per-type, admin-editable)

## Database changes (one migration)

1. `subscriptions.description text` — new nullable column.
2. New table `public.cost_proposal_settings` (per tenant):
  - `tenant_id uuid PK` (FK → tenants, one row per tenant)
  - `template_path text` — storage path in `project-files` bucket (nullable, falls back to default bundled template)
  - `conditions_project text[]`, `conditions_work text[]`, `conditions_subscription text[]` (defaults seeded with the 3 bullets from the sample)
  - Standard `updated_at`, plus GRANTs and RLS: read for tenant members, write for tenant admins / super admins.
3. Storage: reuse existing `project-files` bucket; templates stored under `<tenant_id>/cost-proposal-template/template.pdf`.

## Backend

No new server functions needed — all reads/writes go through the standard Supabase client under existing RLS. PDF is generated in the browser.

## Frontend

1. **New util** `src/lib/cost-proposal-pdf.ts`
  - Uses `pdf-lib` to load the tenant's template PDF (or the default bundled one) and draws the dynamic content on page 1 (date, header line, description, items table, renewal line, Conditions heading + bullets) in positions matching the sample.
  - Triggers a browser download `Cost Proposal - <client> - <title>.pdf`.
  - If content overflows page 1, append new blank pages using the template's first page as background.
2. **Default template asset**: copy uploaded `Cost_Proposal_Template.pdf` into `src/assets/cost-proposal-template.pdf` and import it as the fallback.
3. **"Export PDF" button** added to:
  - Project/Work detail page (`src/routes/_authenticated/projects.tsx`)
  - Subscription detail page (`src/routes/_authenticated/subscriptions.tsx`)
   Button is visible to anyone who can view the record.
4. **Subscriptions form**: add a `Description` textarea bound to the new column. Display it on the detail view.
5. **Settings page** `src/routes/_authenticated/settings.cost-proposal.tsx` (admin / super-admin only, linked from settings nav):
  - Upload / replace template PDF (preview current file name + download link).
  - Three editable lists of conditions (Projects / Works / Subscriptions), add/remove/reorder rows.
  - Save persists to `cost_proposal_settings`.

## Dependencies

- `bun add pdf-lib`

## Out of scope

- Server-side PDF rendering / emailing the PDF.
- Multi-page logic beyond the simple overflow handling described above.
- Editing template visual design from inside the app (admin uploads a new PDF instead).