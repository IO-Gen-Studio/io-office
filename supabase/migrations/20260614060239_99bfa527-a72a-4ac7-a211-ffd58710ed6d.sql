CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  issue_number integer NOT NULL, task text NOT NULL, issue_date date, priority text, owner text, status text NOT NULL DEFAULT 'Open', comment text,
  custom jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, issue_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues view" ON public.issues FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_module_access(auth.uid(), 'issues')));
CREATE POLICY "issues write" ON public.issues FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE POLICY "issues update" ON public.issues FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues'))) WITH CHECK (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE POLICY "issues delete" ON public.issues FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE TRIGGER set_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.issue_column_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL, label text NOT NULL, type public.custom_field_type NOT NULL DEFAULT 'text', options jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_column_defs TO authenticated;
GRANT ALL ON public.issue_column_defs TO service_role;
ALTER TABLE public.issue_column_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issue columns view" ON public.issue_column_defs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_module_access(auth.uid(), 'issues')));
CREATE POLICY "issue columns write" ON public.issue_column_defs FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE POLICY "issue columns update" ON public.issue_column_defs FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues'))) WITH CHECK (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE POLICY "issue columns delete" ON public.issue_column_defs FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.can_edit_module(auth.uid(), 'issues')));
CREATE TRIGGER set_issue_column_defs_updated_at BEFORE UPDATE ON public.issue_column_defs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.issues (tenant_id,issue_number,task,issue_date,priority,owner,status,comment) VALUES
('00000000-0000-0000-0000-00000000a001',19,'1 Park Lane - HQPV_INV (kWh)_58977787','2025-06-03','L','RC','Open','CT Ratio wrong, Wessex to Sort /'),
('00000000-0000-0000-0000-00000000a001',34,'Check all water meters with Wendys list / Water review','2025-06-27','H','KC','In Progress','Start with Main meters, compare with Watersave too. Lets do sub-meters after. Sub-meters should be clearly labelled as SUB. Eg SUB22TE011198. Manual meters excluded from Main total variable formula. | Do Not include manual meters in the Water Main Volume Total Formula'),
('00000000-0000-0000-0000-00000000a001',48,'LV05 – A482301122 – 62877998 - Kent Coast e-van trial','2025-09-05','H','KC','In Progress','Not flowing on IO-Gen. Sent email to Simon - 12/09/25 - KC (the new DC fitted by Hawkins did not fix the comms issue-Simon) | Sent a follow up email to Simon 22/10/2025 - KC'),
('00000000-0000-0000-0000-00000000a001',56,'Cross-checked all Energy Control Meters | SV_Touring Block_FDU1 53260355 | SV_Wonder Bar Office 62877881','2025-11-10','L','KC','In Progress','ECS nearly done | TA - in progress | Still not on io-gen, sent follow up email to Peter 22/10/2025 - KC'),
('00000000-0000-0000-0000-00000000a001',58,'Set up Craig Tara UV Parameters - BMS (Reighton Sands)','2025-11-22','H','KC','In Progress','what is the category and unit? | sent an email to Dan - Craig Tara UV meters not flowing on io-gen'),
('00000000-0000-0000-0000-00000000a001',62,'53260377 - Humberstone Fitties Submeters @ Cleethorpes - need to set up but not flowing on io-gen','2026-03-21',NULL,'KC','Open','08/05/26 - not flowing on io-gen'),
('00000000-0000-0000-0000-00000000a001',63,'23000470 - AHSVS0025 - Gas Sunrise View (Kent Coast) - need to set up, but not sure how and where?','2026-03-21',NULL,'KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',65,'new controllers at Haggerston Castle - Kuntze Meters - NeP06943W11 and NeP06949W11','2026-04-09',NULL,'KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',67,'AH_JD Wetherspoon Kitchen - 53260240 (MSN - old) - 53260376 (New Meter)','2026-04-15',NULL,'KC','Open','the 53260240 (MSN - old) is not flowing on io-gen.'),
('00000000-0000-0000-0000-00000000a001',68,'AHLVG0005 - Elec Trial - 42268819 (MSN - old) - 68162353 (New Meter)','2026-04-15',NULL,'KC','Open','the 42268819 (MSN - old) is not flowing on io-gen.'),
('00000000-0000-0000-0000-00000000a001',69,'AHLVG0005_Solar - 62877998 (MSN - old) - 68162351 (New Meter)','2026-04-15',NULL,'KC','Open','the 62877998 (MSN - old) is not flowing on io-gen.'),
('00000000-0000-0000-0000-00000000a001',70,'Golden Sands, Development Meter Numbers - need to set up','2026-05-05',NULL,'KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',73,'Bourne Leisure SMART meters - SNAGGING','2026-06-01',NULL,'KC','In Progress',NULL),
('00000000-0000-0000-0000-00000000a001',74,'BE_Berwick - 53260021','2026-06-01',NULL,'KC','Open','What does it mean Berwick on Dashboard?'),
('00000000-0000-0000-0000-00000000a001',76,'Caister has missing meter - 2713525 ending meter - Stark meter','2026-10-06',NULL,'KC','Open','now just need backfill data'),
('00000000-0000-0000-0000-00000000a001',77,'Cross-check all Stark MPANs from Matthew''s list against io-gen','2026-06-01',NULL,'KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',78,'Full validation for EC','2026-12-06','H','KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',79,'Add phase 3 elec caravans','2026-12-06','M','KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',80,'Config Kent Coast Victory Unit - AHLVG0005 - Elec Trial Lakeview 68162353 172.21.12.99','2026-12-06','H','KC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',81,'Confirm data type for Elec Vans gas control units m3 or kwh?','2026-12-06','H','RC','Open',NULL),
('00000000-0000-0000-0000-00000000a001',82,'Config under KC elec caravan','2026-12-06','M','KC','Open','AHSVS0025 - Gas | Sunrise View | Ending 23000470');