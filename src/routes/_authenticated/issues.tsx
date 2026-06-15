import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { ReferencePreview } from "@/components/CustomFieldValues";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { DataTable, type DataTableColumn, type ColumnType } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/issues")({ component: IssuesPage });

type Issue = {
  id: string;
  issue_number: number;
  task: string;
  issue_date: string | null;
  priority: string | null;
  owner: string | null;
  status: string;
  comment: string | null;
  custom: Record<string, unknown>;
};

type ColumnDef = {
  module: string;
  id: string;
  key: string;
  label: string;
  type: "text" | "long_text" | "number" | "date" | "dropdown" | "checkbox" | "checklist" | "attachment" | "reference";
  options: unknown;
  position: number;
};

const EMPTY_ISSUE = {
  task: "",
  issue_date: "",
  priority: "",
  owner: "",
  status: "Open",
  comment: "",
};

function IssuesPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("issues");
  const [rows, setRows] = useState<Issue[]>([]);
  const [defs, setDefs] = useState<ColumnDef[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const load = async () => {
    const [{ data: issues, error: issueError }, { data: columns, error: columnError }] =
      await Promise.all([
        supabase.from("issues").select("*").order("issue_number", { ascending: true }),
        supabase.from("issue_column_defs").select("*").order("position", { ascending: true }),
      ]);
    if (issueError || columnError)
      toast.error(issueError?.message ?? columnError?.message ?? "Unable to load issues");
    setRows((issues ?? []) as Issue[]);
    setDefs((columns ?? []) as ColumnDef[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveCell = async (row: Issue, key: string, value: unknown) => {
    const update = key.startsWith("custom.")
      ? { custom: { ...(row.custom ?? {}), [key.slice(7)]: value } }
      : { [key]: value };
    const { error } = await supabase
      .from("issues")
      .update(update as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  const removeIssue = async (issue: Issue) => {
    if (!confirm(`Delete issue #${issue.issue_number}?`)) return;
    const { error } = await supabase.from("issues").delete().eq("id", issue.id);
    if (error) return toast.error(error.message);
    toast.success("Issue deleted");
    void load();
  };

  const columns = useMemo<DataTableColumn<Issue>[]>(() => {
    const builtIn: DataTableColumn<Issue>[] = [
      {
        key: "issue_number",
        header: "Number",
        accessor: (r) => r.issue_number,
        type: "number",
        align: "right",
        width: "90px",
        editable,
      },
      {
        key: "task",
        header: "Task",
        accessor: (r) => r.task,
        type: "text",
        editable,
        width: "320px",
      },
      {
        key: "issue_date",
        header: "Date",
        accessor: (r) => r.issue_date,
        type: "date",
        editable,
        width: "140px",
      },
      {
        key: "priority",
        header: "Priority",
        accessor: (r) => r.priority,
        editable,
        type: "select",
        options: [
          { value: "H", label: "High" },
          { value: "M", label: "Medium" },
          { value: "L", label: "Low" },
        ],
        render: (r) =>
          r.priority ? (
            <Badge
              variant={
                r.priority === "H" ? "destructive" : r.priority === "L" ? "outline" : "secondary"
              }
            >
              {r.priority === "H" ? "High" : r.priority === "M" ? "Medium" : "Low"}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { key: "owner", header: "Owner", accessor: (r) => r.owner, type: "text", editable },
      {
        key: "status",
        header: "Status",
        accessor: (r) => r.status,
        editable,
        type: "select",
        options: [
          { value: "Open", label: "Open" },
          { value: "In Progress", label: "In Progress" },
          { value: "Resolved", label: "Resolved" },
          { value: "Closed", label: "Closed" },
        ],
        render: (r) => (
          <Badge
            variant={r.status === "Closed" || r.status === "Resolved" ? "default" : "secondary"}
          >
            {r.status}
          </Badge>
        ),
      },
      {
        key: "comment",
        header: "Comment",
        accessor: (r) => r.comment,
        type: "text",
        editable,
        width: "360px",
      },
    ];
    const custom = defs.map<DataTableColumn<Issue>>((def) => ({
      key: `custom.${def.key}`,
      header: def.label,
      accessor: (r) => (r.custom ?? {})[def.key],
      editable: editable && ["text", "number", "date", "dropdown", "checkbox"].includes(def.type),
      type: (def.type === "dropdown"
        ? "select"
        : def.type === "checkbox"
          ? "boolean"
          : ["text", "number", "date"].includes(def.type) ? def.type : "text") as ColumnType,
      options:
        def.type === "dropdown" && Array.isArray(def.options)
          ? def.options.map((option) => ({ value: String(option), label: String(option) }))
          : undefined,
      render: (r) => {
        const val = (r.custom ?? {})[def.key];
        if (!val) return null;
        if (def.type === "reference" && typeof val === "string") {
          return <ReferencePreview target={(def.options as { target?: string })?.target ?? "contacts"} value={val} />;
        }
        if (def.type === "checkbox") {
          return <Badge variant={val ? "default" : "secondary"}>{val ? "Yes" : "No"}</Badge>;
        }
        return undefined;
      },
    }));
    return [...builtIn, ...custom];
  }, [defs, editable]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <CircleAlert className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Operations</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Issues Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track operational issues in a flexible, shared workspace.
          </p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setColumnsOpen(true)}>
              <Settings2 className="size-4" />
              Manage columns
            </Button>
            <Button
              onClick={() => {
                setEditingIssue(null);
                setIssueOpen(true);
              }}
            >
              <Plus className="size-4" />
              New issue
            </Button>
          </div>
        )}
      </div>
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <DataTable
            tableKey="issues"
            columns={columns}
            rows={rows}
            rowId={(r) => r.id}
            onSaveCell={saveCell}
            emptyMessage="No issues yet."
            actions={
              editable
                ? (issue) => (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit issue ${issue.issue_number}`}
                        onClick={() => {
                          setEditingIssue(issue);
                          setIssueOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete issue ${issue.issue_number}`}
                        onClick={() => void removeIssue(issue)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )
                : undefined
            }
          />
        </CardContent>
      </Card>
      {issueOpen && (
        <IssueDialog
          issue={editingIssue}
          nextNumber={Math.max(0, ...rows.map((r) => r.issue_number)) + 1}
          onClose={() => setIssueOpen(false)}
          onSaved={() => {
            setIssueOpen(false);
            void load();
          }}
        />
      )}
      {columnsOpen && (
        <ColumnsDialog defs={defs} onClose={() => setColumnsOpen(false)} onChanged={load} />
      )}
    </div>
  );
}

function IssueDialog({
  issue,
  nextNumber,
  onClose,
  onSaved,
}: {
  issue: Issue | null;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    issue
      ? {
          task: issue.task,
          issue_date: issue.issue_date ?? "",
          priority: issue.priority ?? "",
          owner: issue.owner ?? "",
          status: issue.status,
          comment: issue.comment ?? "",
        }
      : EMPTY_ISSUE,
  );
  const [number, setNumber] = useState(issue?.issue_number ?? nextNumber);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.task.trim()) return toast.error("Task is required");
    setSaving(true);
    const payload = {
      issue_number: number,
      task: form.task.trim(),
      issue_date: form.issue_date || null,
      priority: form.priority || null,
      owner: form.owner.trim() || null,
      status: form.status,
      comment: form.comment.trim() || null,
    };
    const result = issue
      ? await supabase.from("issues").update(payload).eq("id", issue.id)
      : await supabase.from("issues").insert(payload);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(issue ? "Issue updated" : "Issue created");
    onSaved();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{issue ? `Edit issue #${issue.issue_number}` : "New issue"}</DialogTitle>
          <DialogDescription>
            Add the core issue details. Extra organisation columns can be edited directly in the
            grid.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="issue-number">Number</Label>
            <Input
              id="issue-number"
              type="number"
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-date">Date</Label>
            <Input
              id="issue-date"
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="issue-task">Task</Label>
            <Textarea
              id="issue-task"
              rows={3}
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={form.priority || "none"}
              onValueChange={(value) =>
                setForm({ ...form, priority: value === "none" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="H">High</SelectItem>
                <SelectItem value="M">Medium</SelectItem>
                <SelectItem value="L">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-owner">Owner</Label>
            <Input
              id="issue-owner"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Open", "In Progress", "Resolved", "Closed"].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="issue-comment">Comment</Label>
            <Textarea
              id="issue-comment"
              rows={4}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnsDialog({
  defs,
  onClose,
  onChanged,
}: {
  defs: ColumnDef[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ColumnDef["type"]>("text");
  const [options, setOptions] = useState("");
  const add = async () => {
    const key = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!key) return toast.error("Column name is required");
    const parsedOptions =
      type === "dropdown"
        ? options
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    if (type === "dropdown" && !parsedOptions.length)
      return toast.error("Add at least one dropdown option");
    const { error } = await supabase.from("custom_field_defs").insert({
      module: "issues",
      key,
      label: label.trim(),
      type,
      options: parsedOptions,
      position: defs.length,
    } as never);
    if (error) return toast.error(error.message);
    setLabel("");
    setType("text");
    setOptions("");
    toast.success("Column added");
    onChanged();
  };
  const remove = async (def: ColumnDef) => {
    if (
      !confirm(
        `Delete the “${def.label}” column? Existing values in this column will no longer be shown.`,
      )
    )
      return;
    const { error } = await supabase.from("custom_field_defs").delete().eq("id", def.id);
    if (error) return toast.error(error.message);
    toast.success("Column deleted");
    onChanged();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage shared columns</DialogTitle>
          <DialogDescription>
            New columns are available to everyone in this organisation. Each person can drag, hide,
            sort, and filter them in their own view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {defs.length === 0 ? (
            <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              No custom columns yet.
            </p>
          ) : (
            defs.map((def) => (
              <div key={def.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{def.label}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {def.type.replace("_", " ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${def.label} column`}
                  onClick={() => void remove(def)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-semibold">Add a column</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="column-label">Column name</Label>
              <Input
                id="column-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Site"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as ColumnDef["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short text</SelectItem>
                  <SelectItem value="long_text">Long text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="attachment">Attachment</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "dropdown" && (
            <div className="space-y-1.5">
              <Label htmlFor="column-options">Options, one per line</Label>
              <Textarea
                id="column-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <Button onClick={() => void add()}>
            <Plus className="size-4" />
            Add column
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


