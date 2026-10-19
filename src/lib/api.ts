import { supabase } from "@/integrations/supabase/client";
import { localApi } from "@/lib/local-api";

export type Centre = { id: string; name: string; code: string | null; location: string | null };
export type YardPosition = { id: string; centre_id: string; name: string };
export type SizeOption = { id: string; label: string; teu: number };
export type TypeOption = { id: string; label: string; subtypes: string[] };
export type Rake = {
  id: string;
  rake_name: string;
  rake_id: string | null;
  rake_basing: string | null;
  bpc_due_date: string | null;
  ownership: string;
  wagons: number | null;
  current_user_type: string;
  rake_type: string | null;
};

/** Per-centre column configuration: custom columns and overrides of built-in ones. */
export type CustomColumn = {
  id: string;
  centre_id: string;
  key: string;
  label: string;
  kind: string;
  options: string[];
  builtin: boolean;
  hidden: boolean;
  sort: number;
};

export type Container = {
  id: string;
  centre_id: string;
  container_no: string;
  mode: string | null;
  rail_ownership: string | null;
  rake_name: string | null;
  size: string | null;
  ctr_type: string | null;
  dry_subtype: string | null;
  ownership: string | null;
  status: string | null;
  weight: number | null;
  condition: string | null;
  in_date: string | null;
  in_time: string | null;
  cargo: string | null;
  category: string | null;
  account: string | null;
  yard_position: string | null;
  out_mode: string | null;
  out_rail_ownership: string | null;
  out_rake_name: string | null;
  out_date: string | null;
  out_time: string | null;
  destination: string | null;
  remarks: string | null;
  truck_no: string | null;
  seal_no: string | null;
  inward_bill_no: string | null;
  net_weight: number | null;
  lessor: string | null;
  wagon_no: string | null;
  stack: string | null;
  double_stack: boolean;
  out_truck_no: string | null;
  out_wagon_no: string | null;
  out_stack: string | null;
  out_double_stack: boolean;
  iso_valid: boolean;
  custom_fields: Record<string, string>;
  dispatched: boolean;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  centre_id: string;
  vehicle_no: string;
  vehicle_type: string | null;
  transporter: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  remarks: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  centre_id: string | null;
  centre_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const cloudApi = {
  async centres(): Promise<Centre[]> {
    return unwrap(await supabase.from("centres").select("*").order("name"));
  },
  async centre(id: string): Promise<Centre | null> {
    const { data } = await supabase.from("centres").select("*").eq("id", id).maybeSingle();
    return data as Centre | null;
  },
  async createCentre(row: Partial<Centre>) {
    return unwrap(await supabase.from("centres").insert(row as never).select().single());
  },
  async updateCentre(id: string, row: Partial<Centre>) {
    return unwrap(await supabase.from("centres").update(row as never).eq("id", id).select().single());
  },
  async deleteCentre(id: string) {
    const { error } = await supabase.from("centres").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async yardPositions(centreId: string): Promise<YardPosition[]> {
    return unwrap(
      await supabase.from("yard_positions").select("*").eq("centre_id", centreId).order("name"),
    );
  },
  async createYardPosition(centreId: string, name: string) {
    return unwrap(
      await supabase
        .from("yard_positions")
        .insert({ centre_id: centreId, name } as never)
        .select()
        .single(),
    );
  },
  async updateYardPosition(id: string, name: string) {
    return unwrap(
      await supabase.from("yard_positions").update({ name } as never).eq("id", id).select().single(),
    );
  },
  async deleteYardPosition(id: string) {
    const { error } = await supabase.from("yard_positions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async sizeOptions(): Promise<SizeOption[]> {
    return unwrap(await supabase.from("size_options").select("*").order("label"));
  },
  async typeOptions(): Promise<TypeOption[]> {
    return unwrap(await supabase.from("type_options").select("*").order("label"));
  },
  async upsertSize(row: Partial<SizeOption>) {
    if (row.id) {
      return unwrap(
        await supabase.from("size_options").update(row as never).eq("id", row.id).select().single(),
      );
    }
    return unwrap(await supabase.from("size_options").insert(row as never).select().single());
  },
  async deleteSize(id: string) {
    const { error } = await supabase.from("size_options").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
  async upsertType(row: Partial<TypeOption>) {
    if (row.id) {
      return unwrap(
        await supabase.from("type_options").update(row as never).eq("id", row.id).select().single(),
      );
    }
    return unwrap(await supabase.from("type_options").insert(row as never).select().single());
  },
  async deleteType(id: string) {
    const { error } = await supabase.from("type_options").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async rakes(): Promise<Rake[]> {
    return unwrap(await supabase.from("rakes").select("*").order("rake_name"));
  },
  async upsertRake(row: Partial<Rake>) {
    if (row.id) {
      return unwrap(await supabase.from("rakes").update(row as never).eq("id", row.id).select().single());
    }
    return unwrap(await supabase.from("rakes").insert(row as never).select().single());
  },
  async deleteRake(id: string) {
    const { error } = await supabase.from("rakes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async containers(centreId: string, dispatched = false): Promise<Container[]> {
    return unwrap(
      await supabase
        .from("containers")
        .select("*")
        .eq("centre_id", centreId)
        .eq("dispatched", dispatched)
        .order("created_at", { ascending: false }),
    );
  },
  async allContainers(): Promise<Container[]> {
    return unwrap(await supabase.from("containers").select("*").order("created_at", { ascending: false }));
  },
  async searchContainers(term: string): Promise<Container[]> {
    return unwrap(
      await supabase
        .from("containers")
        .select("*")
        .ilike("container_no", `%${term.toUpperCase()}%`)
        .order("created_at", { ascending: false })
        .limit(50),
    );
  },
  async insertContainers(rows: Partial<Container>[]) {
    return unwrap(await supabase.from("containers").insert(rows as never).select());
  },
  async updateContainer(id: string, row: Partial<Container>) {
    return unwrap(
      await supabase.from("containers").update(row as never).eq("id", id).select().single(),
    );
  },
  async updateContainers(ids: string[], row: Partial<Container>) {
    return unwrap(await supabase.from("containers").update(row as never).in("id", ids).select());
  },
  async deleteContainers(ids: string[]) {
    const { error } = await supabase.from("containers").delete().in("id", ids);
    if (error) throw new Error(error.message);
  },
  async dispatchedContainers(centreId: string, from: string, to: string): Promise<Container[]> {
    return unwrap(
      await supabase
        .from("containers")
        .select("*")
        .eq("centre_id", centreId)
        .eq("dispatched", true)
        .gte("out_date", from)
        .lte("out_date", to)
        .order("out_date", { ascending: false }),
    );
  },

  async vehicles(centreId?: string): Promise<Vehicle[]> {
    let q = supabase.from("vehicles").select("*").order("vehicle_no");
    if (centreId) q = q.eq("centre_id", centreId);
    return unwrap(await q) as Vehicle[];
  },
  async upsertVehicle(row: Partial<Vehicle>): Promise<Vehicle> {
    if (row.id) {
      return unwrap(
        await supabase.from("vehicles").update(row as never).eq("id", row.id).select().single(),
      ) as Vehicle;
    }
    return unwrap(await supabase.from("vehicles").insert(row as never).select().single()) as Vehicle;
  },
  async deleteVehicle(id: string) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async customColumns(centreId?: string): Promise<CustomColumn[]> {
    let q = supabase.from("custom_columns").select("*").order("sort").order("created_at");
    if (centreId) q = q.eq("centre_id", centreId);
    return unwrap(await q) as unknown as CustomColumn[];
  },
  async upsertCustomColumn(row: Partial<CustomColumn>): Promise<CustomColumn> {
    if (row.id) {
      return unwrap(
        await supabase.from("custom_columns").update(row as never).eq("id", row.id).select().single(),
      ) as unknown as CustomColumn;
    }
    return unwrap(
      await supabase.from("custom_columns").insert(row as never).select().single(),
    ) as unknown as CustomColumn;
  },
  async deleteCustomColumn(id: string) {
    const { error } = await supabase.from("custom_columns").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** subject is "admin" or a centre id. */
  async verifyLogin(subject: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("verify_access" as never, {
      _subject: subject,
      _password: password,
    } as never);
    if (error) throw new Error(error.message);
    return data === true;
  },
  async setPassword(adminPassword: string, subject: string, newPassword: string): Promise<void> {
    const { error } = await supabase.rpc("set_access_password" as never, {
      _admin_password: adminPassword,
      _subject: subject,
      _new_password: newPassword,
    } as never);
    if (error) throw new Error(error.message);
  },

  async logs(centreId: string, since?: string): Promise<ActivityLog[]> {
    let q = supabase
      .from("activity_logs")
      .select("*")
      .eq("centre_id", centreId)
      .order("created_at", { ascending: true });
    if (since) q = q.gte("created_at", since);
    return unwrap(await q);
  },
  async log(centreId: string | null, centreName: string | null, action: string, details?: string) {
    await supabase
      .from("activity_logs")
      .insert({ centre_id: centreId, centre_name: centreName, action, details } as never);
  },
};

export const api: typeof cloudApi =
  import.meta.env.VITE_OFFLINE_MODE === "true" ? (localApi as unknown as typeof cloudApi) : cloudApi;

export function teuFor(size: string | null): number {
  if (!size) return 0;
  if (size.startsWith("20")) return 1;
  if (size.startsWith("40") || size.startsWith("45")) return 2;
  return 0;
}
