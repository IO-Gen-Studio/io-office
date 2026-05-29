# Implementation plan

## 1. UK localisation (global)
- New helper `src/lib/format.ts` with `formatGBP(n)`, `formatDateUK(d)` (dd/mm/yyyy), `formatDateTimeUK(d)`, `parseDateUK(str)`.
- Replace every `toLocaleString` / `$` / `USD` / `en-US` date formatting in Dashboard, Projects, Subscriptions, Calendar, Outreach, Notifications, CRM with the new helpers.
- Native `<input type="date">` returns ISO `yyyy-mm-dd` (browser still renders per locale) — keep ISO in DB, format on display.

## 2. Dashboard
- Hide the Activity Feed card entirely (commented out, not deleted, so we can restore later).
- KPIs remain.

## 3. Projects & Works
- Remove **Business Cost** input from the project dialog and the KPI card. Profit = `total_cost − supplier_cost`.
- Leave the `business_cost` DB column in place (no migration) — just stop reading/writing it from the UI.
- Milestones table inside a project:
  - Inline editable `Due date` column (blank by default, `<input type="date">`).
  - `Completed` checkbox auto-sets `completed_at = now()` when ticked, clears it when unticked.
  - New `Completed date` column showing `completed_at` (dd/mm/yyyy).

## 4. Email Outreach — per-contact outreach status
- Replace the freeform `outreach` jsonb usage with three structured slots: `email_1`, `email_2`, `email_3`, each with `{ sent: boolean, date: string|null }`. Stored in the existing `outreach` jsonb column (no schema change).
- In the contact dialog and as inline columns: checkbox + date input for each of the three emails.
- "Next action" derivation: first email where `sent === false` (or `email_1` if none ticked); "Next action date" = that slot's date.

## 5. Email Outreach — campaigns list
- Add columns: **Contacts** (count), **Next action**, **Next action date** (earliest upcoming across that campaign's contacts).
- Computed client-side from a single contacts fetch per campaign.

## 6. Email Outreach — CSV bulk import
- "Import CSV" button on the campaign detail page.
- Template download: static CSV string generated client-side with headers `first_name,last_name,email,job_title,organisation,industry,website,notes`.
- Parse CSV in-browser (no new dep — simple split with quote handling), preview row count, insert as `campaign_contacts` with `lead_status='no_reply'`.

## 7. Reusable customisable DataTable
Single component `src/components/DataTable.tsx` used by every list (CRM, Outreach campaigns, Outreach contacts, Projects, Subscriptions, Users, Social, Notifications, Calendar list).

Features:
- **Column sort**: click header to toggle asc/desc/none.
- **Column filter**: per-column text/select filter row (toggleable).
- **Column reorder**: drag headers (HTML5 drag-and-drop, no new dep).
- **Column show/hide**: dropdown menu.
- **Inline edit**: cell-level edit when the column declares `editable: true` (text, number, date, select). Saves via a per-row `onSave(row, patch)` callback.
- **Persistence**: localStorage key `dt:<tableKey>:<userId>` storing `{ order, hidden, sort, filters }`. "Reset to default" button in the column menu.
- Column defs: `{ key, header, accessor, type?, editable?, options?, filterType?, render? }`.

Migration strategy: ship the component and convert the high-traffic tables (Outreach campaigns, Outreach contacts, Projects, Subscriptions, CRM) this turn. Users/Social/Notifications stay as-is in this pass; I'll note them for a follow-up to keep the diff reviewable.

## Out of scope this turn
- Cross-device sync of table prefs (localStorage only for now; can move to a `user_table_prefs` table later).
- Converting Users/Social/Notifications/Calendar tables to `DataTable` (will do next turn).

Reply **continue** to proceed, or tell me which sections to drop / reprioritise.