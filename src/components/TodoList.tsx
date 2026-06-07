import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDateUK } from "@/lib/format";

type Todo = {
  id: string;
  parent_type: string;
  parent_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number;
};
type Profile = { id: string; full_name: string };

export function TodoList({
  parentType, parentId, editable,
}: {
  parentType: "project" | "subscription";
  parentId: string;
  editable: boolean;
}) {
  const [rows, setRows] = useState<Todo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("__none__");
  const [due, setDue] = useState("");

  const load = async () => {
    const [{ data: t }, { data: pf }] = await Promise.all([
      supabase.from("todos").select("*")
        .eq("parent_type", parentType).eq("parent_id", parentId)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);
    setRows((t ?? []) as Todo[]);
    setProfiles((pf ?? []) as Profile[]);
  };
  useEffect(() => { void load(); }, [parentId, parentType]);

  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("todos").insert({
      parent_type: parentType, parent_id: parentId,
      title: title.trim(),
      assignee_id: assignee === "__none__" ? null : assignee,
      due_date: due || null,
      position: rows.length,
    } as never);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setAssignee("__none__"); setDue("");
    void load();
  };

  const toggle = async (t: Todo, done: boolean) => {
    const { error } = await supabase.from("todos")
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const updateField = async (t: Todo, patch: Partial<Todo>) => {
    const { error } = await supabase.from("todos").update(patch as never).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const remove = async (t: Todo) => {
    const { error } = await supabase.from("todos").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  // open todos first, completed at bottom
  const open = rows.filter((r) => !r.completed_at);
  const done = rows.filter((r) => !!r.completed_at);
  const ordered = [...open, ...done];

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No to-dos yet.</p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left p-2 w-10">Done</th>
                <th className="text-left p-2">Task</th>
                <th className="text-left p-2 w-48">Assignee</th>
                <th className="text-left p-2 w-44">Due date</th>
                {editable && <th className="text-right p-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {ordered.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="p-2">
                    <Checkbox
                      checked={!!t.completed_at}
                      onCheckedChange={(c) => editable && toggle(t, c === true)}
                      disabled={!editable}
                    />
                  </td>
                  <td className={`p-2 ${t.completed_at ? "line-through text-muted-foreground" : ""}`}>{t.title}</td>
                  <td className="p-2">
                    {editable ? (
                      <Select
                        value={t.assignee_id ?? "__none__"}
                        onValueChange={(v) => updateField(t, { assignee_id: v === "__none__" ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">{profiles.find((p) => p.id === t.assignee_id)?.full_name ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {editable ? (
                      <Input
                        type="date" value={t.due_date ?? ""}
                        onChange={(e) => updateField(t, { due_date: e.target.value || null })}
                        className="h-8 text-sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">{formatDateUK(t.due_date)}</span>
                    )}
                  </td>
                  {editable && (
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="size-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr,200px,180px,auto] gap-2 pt-2 border-t">
          <Input placeholder="Add a to-do…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button onClick={add} disabled={!title.trim()}><Plus className="size-4 mr-1" />Add</Button>
        </div>
      )}
    </div>
  );
}
