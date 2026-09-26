import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  CONDITIONS,
  DRY_SUBTYPES,
  MODES,
  OWNERSHIPS,
  RAIL_OWNERSHIP,
  STATUSES,
  type EntryDraft,
} from "@/lib/container-fields";
import { validateContainerNo } from "@/lib/iso6346";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ManualEntryFields({
  centreId,
  draft,
  set,
  mode: entryMode = "inward",
  showContainerNo = true,
}: {
  centreId: string;
  draft: EntryDraft;
  set: (patch: Partial<EntryDraft>) => void;
  mode?: "inward" | "outward";
  showContainerNo?: boolean;
}) {
  const { data: rakes = [] } = useQuery({ queryKey: ["rakes"], queryFn: api.rakes });
  const { data: yard = [] } = useQuery({
    queryKey: ["yard", centreId],
    queryFn: () => api.yardPositions(centreId),
  });
  const { data: sizes = [] } = useQuery({ queryKey: ["sizes"], queryFn: api.sizeOptions });
  const { data: types = [] } = useQuery({ queryKey: ["types"], queryFn: api.typeOptions });

  const check = draft.container_no ? validateContainerNo(draft.container_no) : null;
  const isOut = entryMode === "outward";
  const movementMode = isOut ? draft.out_mode : draft.mode;
  const railOwn = isOut ? draft.out_rail_ownership : draft.rail_ownership;
  const rakeName = isOut ? draft.out_rake_name : draft.rake_name;
  const selectedType = types.find((t) => t.label === draft.ctr_type);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {showContainerNo ? (
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Container Number</Label>
          <Input
            value={draft.container_no}
            placeholder="ABCU1234567"
            className="num uppercase"
            onChange={(e) => set({ container_no: e.target.value.toUpperCase() })}
          />
          {check ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs",
                check.valid ? "text-success" : "text-destructive",
              )}
            >
              {check.valid ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {check.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field label="Mode">
        <Picker
          value={movementMode}
          options={MODES}
          onChange={(v) => set(isOut ? { out_mode: v } : { mode: v })}
        />
      </Field>

      {movementMode === "Rail" ? (
        <Field label="Rake Ownership">
          <Picker
            value={railOwn}
            options={RAIL_OWNERSHIP}
            onChange={(v) =>
              set(isOut ? { out_rail_ownership: v, out_rake_name: "" } : { rail_ownership: v, rake_name: "" })
            }
          />
        </Field>
      ) : null}

      {movementMode === "Rail" && railOwn === "Own" ? (
        <Field label="Rake">
          <Picker
            value={rakeName}
            options={rakes.map((r) => r.rake_name)}
            placeholder={rakes.length ? "Select rake" : "Add rakes in Rake Manager"}
            onChange={(v) => set(isOut ? { out_rake_name: v } : { rake_name: v })}
          />
        </Field>
      ) : null}

      {movementMode === "Rail" && railOwn === "Other" ? (
        <Field label="Rake Name">
          <Input
            value={rakeName}
            placeholder="Type rake name"
            onChange={(e) => set(isOut ? { out_rake_name: e.target.value } : { rake_name: e.target.value })}
          />
        </Field>
      ) : null}

      <Field label="Size">
        <Picker value={draft.size} options={sizes.map((s) => s.label)} onChange={(v) => set({ size: v })} />
      </Field>

      <Field label="Type">
        <Picker
          value={draft.ctr_type}
          options={types.map((t) => t.label)}
          onChange={(v) => set({ ctr_type: v, dry_subtype: v === "Dry" ? "GP" : "" })}
        />
      </Field>

      {selectedType && selectedType.subtypes.length ? (
        <Field label="Sub Type">
          <Picker
            value={draft.dry_subtype}
            options={selectedType.subtypes.length ? selectedType.subtypes : DRY_SUBTYPES}
            onChange={(v) => set({ dry_subtype: v })}
          />
        </Field>
      ) : null}

      <Field label="Ownership">
        <Picker value={draft.ownership} options={OWNERSHIPS} onChange={(v) => set({ ownership: v })} />
      </Field>

      <Field label="Status">
        <Picker
          value={draft.status}
          options={STATUSES}
          onChange={(v) => set({ status: v, ...(v === "Empty" ? { weight: "", cargo: "" } : {}) })}
        />
      </Field>

      {draft.status === "Loaded" ? (
        <Field label="Weight (kg)">
          <Input
            type="number"
            value={draft.weight}
            onChange={(e) => set({ weight: e.target.value })}
            className="num"
          />
        </Field>
      ) : null}

      {draft.status === "Loaded" ? (
        <Field label="Cargo">
          <Input value={draft.cargo} onChange={(e) => set({ cargo: e.target.value })} />
        </Field>
      ) : null}

      <Field label="Condition">
        <Picker value={draft.condition} options={CONDITIONS} onChange={(v) => set({ condition: v })} />
      </Field>

      <Field label={isOut ? "Out Date" : "In Date"}>
        <Input
          type="date"
          value={isOut ? draft.out_date : draft.in_date}
          onChange={(e) => set(isOut ? { out_date: e.target.value } : { in_date: e.target.value })}
        />
      </Field>

      <Field label={isOut ? "Out Time (24h)" : "In Time (24h)"}>
        <Input
          type="time"
          value={isOut ? draft.out_time : draft.in_time}
          onChange={(e) => set(isOut ? { out_time: e.target.value } : { in_time: e.target.value })}
        />
      </Field>

      <Field label="Category">
        <Picker value={draft.category} options={CATEGORIES} onChange={(v) => set({ category: v })} />
      </Field>

      <Field label="Account">
        <Input value={draft.account} onChange={(e) => set({ account: e.target.value })} />
      </Field>

      <Field label="Yard Position">
        <Picker
          value={draft.yard_position}
          options={yard.map((y) => y.name)}
          placeholder={yard.length ? "Select position" : "Add positions in Yard Positions"}
          onChange={(v) => set({ yard_position: v })}
        />
      </Field>
    </div>
  );
}
