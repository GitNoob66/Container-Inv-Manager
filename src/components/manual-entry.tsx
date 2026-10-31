import { SuggestInput } from "@/components/suggest-input";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  CONDITIONS,
  CUSTOM_PREFIX,
  DRY_SUBTYPES,
  MODES,
  OWNERSHIPS,
  RAIL_OWNERSHIP,
  STACKS,
  STATUSES,
  type EntryDraft,
} from "@/lib/container-fields";
import { validateContainerNo } from "@/lib/iso6346";
import { useColumnConfig } from "@/lib/use-field-options";
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

export function Picker({
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
    <Select value={value ?? ""} onValueChange={onChange}>
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
  wagonOptions = [],
  doubleStack = false,
}: {
  centreId: string;
  draft: EntryDraft;
  set: (patch: Partial<EntryDraft>) => void;
  mode?: "inward" | "outward";
  showContainerNo?: boolean;
  wagonOptions?: string[];
  doubleStack?: boolean;
}) {
  const { data: rakes = [] } = useQuery({ queryKey: ["rakes"], queryFn: api.rakes });
  const { data: yard = [] } = useQuery({
    queryKey: ["yard", centreId],
    queryFn: () => api.yardPositions(centreId),
  });
  const { data: sizes = [] } = useQuery({ queryKey: ["sizes"], queryFn: api.sizeOptions });
  const { data: types = [] } = useQuery({ queryKey: ["types"], queryFn: api.typeOptions });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", centreId],
    queryFn: () => api.vehicles(centreId),
  });
  const cfg = useColumnConfig(centreId);
  const L = cfg.label;
  const show = (key: string) => !cfg.hidden(key);

  const check = draft.container_no ? validateContainerNo(draft.container_no) : null;
  const isOut = entryMode === "outward";
  const movementMode = isOut ? draft.out_mode : draft.mode;
  const railOwn = isOut ? draft.out_rail_ownership : draft.rail_ownership;
  const rakeName = isOut ? draft.out_rake_name : draft.rake_name;
  const wagonNo = isOut ? draft.out_wagon_no : draft.wagon_no;
  const stack = isOut ? draft.out_stack : draft.stack;
  const truckNo = isOut ? draft.out_truck_no : draft.truck_no;
  const selectedType = types.find((t) => t.label === draft.ctr_type);
  const listId = `trucks-${centreId}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {showContainerNo ? (
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">{L("container_no", "Container Number")}</Label>
          <Input
            value={draft.container_no}
            placeholder="ABCU1234567"
            className={cn("num uppercase", check && !check.valid && "border-warning bg-warning/10")}
            onChange={(e) => set({ container_no: e.target.value.toUpperCase() })}
          />
          {check ? (
            <p className={cn("flex items-center gap-1 text-xs", check.valid ? "text-success" : "text-warning")}>
              {check.valid ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {check.valid ? check.message : `${check.message} — you can still save; it stays highlighted.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field label={L("mode", "Mode")}>
        <Picker value={movementMode} options={MODES} onChange={(v) => set(isOut ? { out_mode: v } : { mode: v })} />
      </Field>

      {movementMode === "Road" && show("truck_no") ? (
        <Field label={L("truck_no", "Truck Number")}>
          <SuggestInput
            value={truckNo}
            className="num"
            options={vehicles.map((v) => v.vehicle_no)}
            placeholder={vehicles.length ? "Pick or type a truck number" : "Type truck number"}
            onChange={(v) => set(isOut ? { out_truck_no: v } : { truck_no: v })}
          />
        </Field>
      ) : null}

      {movementMode === "Rail" ? (
        <Field label={L("rail_ownership", "Rake Ownership")}>
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
        <Field label={L("rake_name", "Rake")}>
          <Picker
            value={rakeName}
            options={rakes.map((r) => r.rake_name)}
            placeholder={rakes.length ? "Select rake" : "Add rakes in Rake Manager"}
            onChange={(v) => set(isOut ? { out_rake_name: v } : { rake_name: v })}
          />
        </Field>
      ) : null}

      {movementMode === "Rail" && railOwn === "Other" ? (
        <Field label={L("rake_name", "Rake Name")}>
          <Input
            value={rakeName}
            placeholder="Type rake name"
            onChange={(e) => set(isOut ? { out_rake_name: e.target.value } : { rake_name: e.target.value })}
          />
        </Field>
      ) : null}

      {movementMode === "Rail" && show("wagon_no") ? (
        <Field label={L("wagon_no", "Wagon Number")}>
          <SuggestInput
            className="num"
            value={wagonNo}
            options={wagonOptions}
            placeholder={wagonOptions.length ? "Type or pick a wagon" : "Type wagon number"}
            onChange={(v) => set(isOut ? { out_wagon_no: v } : { wagon_no: v })}
          />
        </Field>
      ) : null}

      {movementMode === "Rail" && show("stack") ? (
        <Field label={L("stack", "Stack")}>
          <Picker
            value={doubleStack ? stack : "Lower"}
            options={doubleStack ? STACKS : ["Lower"]}
            onChange={(v) => set(isOut ? { out_stack: v } : { stack: v })}
          />
        </Field>
      ) : null}

      {!isOut ? (
        <>
          <Field label={L("size", "Size")}>
            <Picker value={draft.size} options={sizes.map((s) => s.label)} onChange={(v) => set({ size: v })} />
          </Field>

          <Field label={L("ctr_type", "Type")}>
            <Picker
              value={draft.ctr_type}
              options={types.map((t) => t.label)}
              onChange={(v) => set({ ctr_type: v, dry_subtype: v === "Dry" ? "GP" : "" })}
            />
          </Field>

          {selectedType && selectedType.subtypes.length && show("dry_subtype") ? (
            <Field label={L("dry_subtype", "Sub Type")}>
              <Picker
                value={draft.dry_subtype}
                options={selectedType.subtypes.length ? selectedType.subtypes : DRY_SUBTYPES}
                onChange={(v) => set({ dry_subtype: v })}
              />
            </Field>
          ) : null}

          {show("ownership") ? (
            <Field label={L("ownership", "Ownership")}>
              <Picker value={draft.ownership} options={OWNERSHIPS} onChange={(v) => set({ ownership: v })} />
            </Field>
          ) : null}

          {draft.ownership === "Hired" && show("lessor") ? (
            <Field label={L("lessor", "Lessor")}>
              <Input value={draft.lessor} placeholder="Company / container provider" onChange={(e) => set({ lessor: e.target.value })} />
            </Field>
          ) : null}

          <Field label={L("status", "Status")}>
            <Picker
              value={draft.status}
              options={STATUSES}
              onChange={(v) => set({ status: v, ...(v === "Empty" ? { weight: "", cargo: "" } : {}) })}
            />
          </Field>

          {draft.status === "Loaded" && show("weight") ? (
            <Field label={L("weight", "Weight (kg)")}>
              <Input type="number" value={draft.weight} onChange={(e) => set({ weight: e.target.value })} className="num" />
            </Field>
          ) : null}

          {show("net_weight") ? (
            <Field label={L("net_weight", "Net Weight")}>
              <Input type="number" value={draft.net_weight} onChange={(e) => set({ net_weight: e.target.value })} className="num" />
            </Field>
          ) : null}

          {draft.status === "Loaded" && show("cargo") ? (
            <Field label={L("cargo", "Cargo")}>
              <Input value={draft.cargo} onChange={(e) => set({ cargo: e.target.value })} />
            </Field>
          ) : null}

          {show("seal_no") ? (
            <Field label={L("seal_no", "Seal Number")}>
              <Input value={draft.seal_no} onChange={(e) => set({ seal_no: e.target.value })} />
            </Field>
          ) : null}

          {show("inward_bill_no") ? (
            <Field label={L("inward_bill_no", "Inward Bill No")}>
              <Input value={draft.inward_bill_no} onChange={(e) => set({ inward_bill_no: e.target.value })} />
            </Field>
          ) : null}

          {show("condition") ? (
            <Field label={L("condition", "Condition")}>
              <Picker value={draft.condition} options={CONDITIONS} onChange={(v) => set({ condition: v })} />
            </Field>
          ) : null}
        </>
      ) : null}

      <Field label={isOut ? "Out Date" : L("in_date", "In Date")}>
        <Input
          type="date"
          value={isOut ? draft.out_date : draft.in_date}
          onChange={(e) => set(isOut ? { out_date: e.target.value } : { in_date: e.target.value })}
        />
      </Field>

      <Field label={isOut ? "Out Time (24h)" : L("in_time", "In Time (24h)")}>
        <Input
          type="time"
          value={isOut ? draft.out_time : draft.in_time}
          onChange={(e) => set(isOut ? { out_time: e.target.value } : { in_time: e.target.value })}
        />
      </Field>

      {!isOut ? (
        <>
          {show("category") ? (
            <Field label={L("category", "Category")}>
              <Picker value={draft.category} options={CATEGORIES} onChange={(v) => set({ category: v })} />
            </Field>
          ) : null}
          {show("account") ? (
            <Field label={L("account", "Party")}>
              <Input value={draft.account} onChange={(e) => set({ account: e.target.value })} />
            </Field>
          ) : null}
          {show("yard_position") ? (
            <Field label={L("yard_position", "Yard Position")}>
              <Picker
                value={draft.yard_position}
                options={yard.map((y) => y.name)}
                placeholder={yard.length ? "Select position" : "Add positions in Yard Positions"}
                onChange={(v) => set({ yard_position: v })}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {cfg.custom
        .filter((c) => !c.hidden)
        .map((c) => {
          const k = `${CUSTOM_PREFIX}${c.key}` as `cf_${string}`;
          const v = draft[k] ?? "";
          return (
            <Field key={c.id} label={c.label}>
              {c.kind === "select" ? (
                <Picker value={v} options={c.options} onChange={(nv) => set({ [k]: nv } as Partial<EntryDraft>)} />
              ) : (
                <Input
                  type={c.kind === "number" ? "number" : c.kind === "date" ? "date" : "text"}
                  value={v}
                  onChange={(e) => set({ [k]: e.target.value } as Partial<EntryDraft>)}
                />
              )}
            </Field>
          );
        })}
    </div>
  );
}
