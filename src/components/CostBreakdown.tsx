import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/format";
import { Plus, Trash2, GitBranch } from "lucide-react";
import { toast } from "sonner";

export type CostParentType = "project" | "subscription";

type Version = {
  id: string;
  parent_type: string;
  parent_id: string;
  version: number;
  label: string | null;
  is_current: boolean;
  created_at: string;
};

type Item = {
  id: string;
  version_id: string;
  position: number;
  item_no: string | null;
  description: string;
  quantity: number;
  final_cost: number;
  supplier_cost: number;
};

export function CostBreakdown({
  parentType, parentId, editable, onTotalsChange,
}: {
  parentType: CostParentType;
  parentId: string;
  editable: boolean;
  onTotalsChange?: (totals: { final: number; supplier: number }) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVersions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cost_versions").select("*")
      .eq("parent_type", parentType).eq("parent_id", parentId)
      .order("version", { ascending: false });
    const vs = (data ?? []) as Version[];
    setVersions(vs);
    const current = vs.find((v) => v.is_current) ?? vs[0] ?? null;
    setActiveId(current?.id ?? null);
    setLoading(false);
  };

  const loadItems = async (vid: string) => {
    const { data } = await supabase
      .from("cost_items").select("*").eq("version_id", vid).order("position");
    setItems((data ?? []) as Item[]);
  };

  useEffect(() => { void loadVersions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [parentType, parentId]);
  useEffect(() => { if (activeId) void loadItems(activeId); else setItems([]); }, [activeId]);

  const totals = useMemo(() => {
    return items.reduce(
      (a, i) => ({
        final: a.final + Number(i.quantity || 0) * Number(i.final_cost || 0),
        supplier: a.supplier + Number(i.quantity || 0) * Number(i.supplier_cost || 0),
      }),
      { final: 0, supplier: 0 },
    );
  }, [items]);

  useEffect(() => { onTotalsChange?.(totals); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [totals.final, totals.supplier]);

  const active = versions.find((v) => v.id === activeId) ?? null;

  const createVersion = async (cloneFromActive: boolean) => {
    const nextNum = versions.length === 0 ? 1 : Math.max(...versions.map((v) => v.version)) + 1;
    // Unset current on others
    if (versions.length > 0) {
      await supabase.from("cost_versions").update({ is_current: false })
        .eq("parent_type", parentType).eq("parent_id", parentId);
    }
    const { data, error } = await supabase.from("cost_versions").insert({
      parent_type: parentType, parent_id: parentId, version: nextNum,
      label: `v${nextNum}`, is_current: true,
    }).select().single();
    if (error || !data) { toast.error(error?.message ?? "Failed"); await loadVersions(); return; }
    if (cloneFromActive && items.length > 0) {
      await supabase.from("cost_items").insert(items.map((i) => ({
        version_id: data.id, position: i.position, item_no: i.item_no,
        description: i.description, quantity: i.quantity,
        final_cost: i.final_cost, supplier_cost: i.supplier_cost,
      })));
    }
    toast.success(`Version ${nextNum} created`);
    await loadVersions();
    setActiveId(data.id);
  };

  const setCurrent = async (vid: string) => {
    await supabase.from("cost_versions").update({ is_current: false })
      .eq("parent_type", parentType).eq("parent_id", parentId);
    await supabase.from("cost_versions").update({ is_current: true }).eq("id", vid);
    void loadVersions();
  };

  const deleteVersion = async (vid: string) => {
    if (!confirm("Delete this version and its items?")) return;
    const { error } = await supabase.from("cost_versions").delete().eq("id", vid);
    if (error) return toast.error(error.message);
    void loadVersions();
  };

  const addItem = async () => {
    if (!activeId) return;
    const { error } = await supabase.from("cost_items").insert({
      version_id: activeId, position: items.length,
      item_no: String(items.length + 1), description: "", quantity: 1,
      final_cost: 0, supplier_cost: 0,
    });
    if (error) return toast.error(error.message);
    void loadItems(activeId);
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
    const { error } = await supabase.from("cost_items").update(patch).eq("id", id);
    if (error) { toast.error(error.message); if (activeId) void loadItems(activeId); }
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cost_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId) void loadItems(activeId);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading cost breakdown…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Version:</span>
        {versions.length > 0 ? (
          <Select value={activeId ?? ""} onValueChange={setActiveId}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  v{v.version}{v.is_current ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <span className="text-sm text-muted-foreground">No versions yet</span>}
        {active && !active.is_current && editable && (
          <Button size="sm" variant="outline" onClick={() => setCurrent(active.id)}>Set as current</Button>
        )}
        {active?.is_current && <Badge variant="secondary">Current</Badge>}
        {editable && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => createVersion(true)} disabled={versions.length === 0}>Duplicate version</Button>
            <Button size="sm" onClick={() => createVersion(false)}><Plus className="size-4 mr-1" />New version</Button>
            {active && versions.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => deleteVersion(active.id)}><Trash2 className="size-4" /></Button>
            )}
          </div>
        )}
      </div>

      {!active ? (
        <p className="text-sm text-muted-foreground">Create a version to start adding items.</p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-2 w-20">Item #</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2 w-20">Qty</th>
                <th className="text-right p-2 w-32">Final cost</th>
                <th className="text-right p-2 w-32">Supplier cost</th>
                <th className="text-right p-2 w-32">Line total</th>
                {editable && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={editable ? 7 : 6} className="text-center text-muted-foreground py-6">No items yet.</td></tr>
              ) : items.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-1.5"><Input className="h-8" disabled={!editable} value={i.item_no ?? ""} onChange={(e) => updateItem(i.id, { item_no: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8" disabled={!editable} value={i.description} onChange={(e) => updateItem(i.id, { description: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!editable} value={i.quantity} onChange={(e) => updateItem(i.id, { quantity: Number(e.target.value) || 0 })} /></td>
                  <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!editable} value={i.final_cost} onChange={(e) => updateItem(i.id, { final_cost: Number(e.target.value) || 0 })} /></td>
                  <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!editable} value={i.supplier_cost} onChange={(e) => updateItem(i.id, { supplier_cost: Number(e.target.value) || 0 })} /></td>
                  <td className="p-2 text-right tabular-nums">{formatGBP(Number(i.quantity || 0) * Number(i.final_cost || 0))}</td>
                  {editable && <td className="p-1.5 text-right"><Button variant="ghost" size="icon" onClick={() => removeItem(i.id)}><Trash2 className="size-4" /></Button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr className="font-medium">
                <td colSpan={3} className="p-2 text-right">Totals</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.final)}</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.supplier)}</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.final)}</td>
                {editable && <td />}
              </tr>
              <tr className="text-muted-foreground">
                <td colSpan={3} className="p-2 text-right text-xs uppercase tracking-wide">Profit</td>
                <td colSpan={3} className="p-2 text-right tabular-nums">{formatGBP(totals.final - totals.supplier)}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editable && active && (
        <Button size="sm" variant="outline" onClick={addItem}><Plus className="size-4 mr-1" />Add item</Button>
      )}
    </div>
  );
}
