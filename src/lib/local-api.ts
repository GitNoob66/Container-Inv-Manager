import type {
  ActivityLog,
  Centre,
  Container,
  CustomColumn,
  Rake,
  SizeOption,
  TypeOption,
  Vehicle,
  YardPosition,
} from "@/lib/api";

type LocalData = {
  version: 1;
  centres: Centre[];
  yardPositions: YardPosition[];
  sizeOptions: SizeOption[];
  typeOptions: TypeOption[];
  rakes: Rake[];
  containers: Container[];
  logs: ActivityLog[];
  vehicles: Vehicle[];
  customColumns: CustomColumn[];
  /** subject ("admin" or centre id) -> "salt:sha256hex" */
  passwords: Record<string, string>;
};

/** Every container column with its empty value, so older records gain new fields. */
function blankContainer(): Omit<Container, "id" | "centre_id" | "container_no" | "created_at" | "updated_at"> {
  return {
    mode: null, rail_ownership: null, rake_name: null, size: null, ctr_type: null, dry_subtype: null,
    ownership: null, status: null, weight: null, condition: null, in_date: null, in_time: null,
    cargo: null, category: null, account: null, yard_position: null, out_mode: null,
    out_rail_ownership: null, out_rake_name: null, out_date: null, out_time: null,
    destination: null, remarks: null, truck_no: null, seal_no: null, inward_bill_no: null,
    net_weight: null, lessor: null, wagon_no: null, stack: null, double_stack: false,
    out_truck_no: null, out_wagon_no: null, out_stack: null, out_double_stack: false,
    iso_valid: true, custom_fields: {}, dispatched: false,
  };
}

function normalise(data: LocalData): LocalData {
  if (!Array.isArray(data.vehicles)) data.vehicles = [];
  if (!Array.isArray(data.customColumns)) data.customColumns = [];
  if (!data.passwords || typeof data.passwords !== "object") data.passwords = {};
  data.containers = data.containers.map((c) => ({ ...blankContainer(), ...c }));
  data.rakes = data.rakes.map((r) => ({ ...r, rake_type: r.rake_type ?? null }));
  return data;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const DB_NAME = "container-yard-manager";
const STORE_NAME = "app-data";
const DATA_KEY = "current";

const CENTRE_NAMES = [
  "RWC KOKG",
  "PLPC",
  "CWCN",
  "SFA",
  "NDT",
  "DGSN",
  "GIMB",
  "CW KGP",
  "MVI CRT",
  "NCLW",
  "CW Mundra",
  "PISK",
];

function makeId(): string {
  return crypto.randomUUID();
}

function initialData(): LocalData {
  return {
    version: 1,
    centres: CENTRE_NAMES.map((name, index) => ({
      id: `default-centre-${index + 1}`,
      name,
      code: null,
      location: null,
    })),
    yardPositions: [],
    sizeOptions: [
      { id: "default-size-20", label: "20ft", teu: 1 },
      { id: "default-size-40", label: "40ft", teu: 2 },
      { id: "default-size-45", label: "45ft", teu: 2 },
    ],
    typeOptions: [
      { id: "default-type-dry", label: "Dry", subtypes: ["GP", "HC"] },
      { id: "default-type-reefer", label: "Reefer", subtypes: [] },
      { id: "default-type-open-top", label: "Open Top", subtypes: [] },
      { id: "default-type-side-access", label: "Side Access", subtypes: [] },
      { id: "default-type-flat-rack", label: "Flat Rack", subtypes: [] },
      { id: "default-type-tank", label: "Tank", subtypes: [] },
    ],
    rakes: [],
    containers: [],
    logs: [],
    vehicles: [],
    customColumns: [],
    passwords: {},
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database could not be opened."));
  });
}

async function readData(): Promise<LocalData> {
  const db = await openDatabase();
  const saved = await new Promise<LocalData | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve(request.result as LocalData | undefined);
    request.onerror = () => reject(request.error ?? new Error("Local records could not be read."));
  });
  db.close();
  if (saved) return normalise(saved);
  const seeded = initialData();
  await writeData(seeded);
  return seeded;
}

async function writeData(data: LocalData): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local records could not be saved."));
  });
  db.close();
}

let writeQueue = Promise.resolve();

async function change<T>(update: (data: LocalData) => T): Promise<T> {
  let result: { value: T } | undefined;
  const operation = writeQueue.then(async () => {
    const data = await readData();
    result = { value: update(data) };
    await writeData(data);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
  if (!result) throw new Error("Local update did not complete.");
  return result.value;
}

function sortBy<T>(rows: T[], field: keyof T, descending = false): T[] {
  return [...rows].sort((a, b) => {
    const result = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
    return descending ? -result : result;
  });
}

function validateBackup(value: unknown): LocalData {
  if (!value || typeof value !== "object") throw new Error("This is not a valid backup file.");
  const data = value as Partial<LocalData>;
  const keys: (keyof LocalData)[] = [
    "centres",
    "yardPositions",
    "sizeOptions",
    "typeOptions",
    "rakes",
    "containers",
    "logs",
  ];
  if (data.version !== 1 || keys.some((key) => !Array.isArray(data[key]))) {
    throw new Error("This backup is incomplete or belongs to an unsupported version.");
  }
  return normalise(data as LocalData);
}

export const isOfflineMode = import.meta.env.VITE_OFFLINE_MODE === "true";

export async function exportLocalBackup(): Promise<void> {
  const data = await readData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `container-yard-backup-${new Date().toISOString().slice(0, 10)}.cym-backup`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importLocalBackup(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as unknown;
  await writeData(validateBackup(parsed));
}

/** Wipes every local record and restores the factory defaults (12 centres, sizes, types). */
export async function resetAllLocalData(): Promise<void> {
  await change((data) => {
    Object.assign(data, initialData());
  });
}

/** Wipes containers, yard positions, vehicles and logs for one centre only. */
export async function resetCentreLocalData(centreId: string): Promise<void> {
  await change((data) => {
    data.containers = data.containers.filter((r) => r.centre_id !== centreId);
    data.yardPositions = data.yardPositions.filter((r) => r.centre_id !== centreId);
    data.vehicles = data.vehicles.filter((r) => r.centre_id !== centreId);
    data.logs = data.logs.filter((r) => r.centre_id !== centreId);
    data.customColumns = data.customColumns.filter((r) => r.centre_id !== centreId);
  });
}

export const localApi = {
  async customColumns(centreId?: string): Promise<CustomColumn[]> {
    const rows = (await readData()).customColumns.filter((r) => !centreId || r.centre_id === centreId);
    return [...rows].sort((a, b) => a.sort - b.sort);
  },
  async upsertCustomColumn(row: Partial<CustomColumn>): Promise<CustomColumn> {
    return change((data) => {
      const clash = data.customColumns.find(
        (c) => c.centre_id === row.centre_id && c.key === row.key && c.id !== row.id,
      );
      if (clash && !row.id) throw new Error("A column with that name already exists for this centre.");
      const current = row.id ? data.customColumns.find((c) => c.id === row.id) : undefined;
      if (current) {
        Object.assign(current, row);
        return { ...current };
      }
      const created: CustomColumn = {
        id: makeId(), centre_id: row.centre_id ?? "", key: row.key ?? "", label: row.label ?? "",
        kind: row.kind ?? "text", options: row.options ?? [], builtin: row.builtin ?? false,
        hidden: row.hidden ?? false, sort: row.sort ?? data.customColumns.length,
      };
      data.customColumns.push(created);
      return created;
    });
  },
  async deleteCustomColumn(id: string): Promise<void> {
    await change((data) => {
      data.customColumns = data.customColumns.filter((c) => c.id !== id);
    });
  },
  async verifyLogin(subject: string, password: string): Promise<boolean> {
    const data = await readData();
    const stored = data.passwords[subject];
    if (stored) {
      const [salt, hash] = stored.split(":");
      return (await sha256(`${salt}${password}`)) === hash;
    }
    if (subject === "admin") return password === "admin123";
    const centre = data.centres.find((c) => c.id === subject);
    return !!centre && centre.name.toLowerCase() === password;
  },
  async setPassword(adminPassword: string, subject: string, newPassword: string): Promise<void> {
    if (!(await localApi.verifyLogin("admin", adminPassword))) throw new Error("The admin password is incorrect.");
    if (newPassword.length < 4) throw new Error("The new password must have at least 4 characters.");
    const salt = makeId();
    const hash = await sha256(`${salt}${newPassword}`);
    await change((data) => {
      data.passwords[subject] = `${salt}:${hash}`;
    });
  },
  async vehicles(centreId?: string): Promise<Vehicle[]> {
    const rows = (await readData()).vehicles.filter((r) => !centreId || r.centre_id === centreId);
    return sortBy(rows, "vehicle_no");
  },
  async upsertVehicle(row: Partial<Vehicle>): Promise<Vehicle> {
    return change((data) => {
      const no = (row.vehicle_no ?? "").trim().toUpperCase();
      const clash = data.vehicles.find(
        (v) => v.centre_id === row.centre_id && v.vehicle_no === no && v.id !== row.id,
      );
      if (clash) throw new Error(`Vehicle ${no} is already registered at this centre.`);
      if (row.id) {
        const existing = data.vehicles.find((v) => v.id === row.id);
        if (!existing) throw new Error("Vehicle not found.");
        Object.assign(existing, row, { vehicle_no: no });
        return existing;
      }
      const created: Vehicle = {
        id: makeId(),
        centre_id: row.centre_id ?? "",
        vehicle_no: no,
        vehicle_type: row.vehicle_type ?? null,
        transporter: row.transporter ?? null,
        driver_name: row.driver_name ?? null,
        driver_phone: row.driver_phone ?? null,
        remarks: row.remarks ?? null,
        created_at: new Date().toISOString(),
      };
      data.vehicles.push(created);
      return created;
    });
  },
  async deleteVehicle(id: string): Promise<void> {
    await change((data) => {
      data.vehicles = data.vehicles.filter((v) => v.id !== id);
    });
  },
  async centres(): Promise<Centre[]> {
    return sortBy((await readData()).centres, "name");
  },
  async centre(id: string): Promise<Centre | null> {
    return (await readData()).centres.find((row) => row.id === id) ?? null;
  },
  async createCentre(row: Partial<Centre>): Promise<Centre> {
    return change((data) => {
      if (data.centres.some((item) => item.name.toLowerCase() === row.name?.toLowerCase())) {
        throw new Error("A centre with that name already exists.");
      }
      const created: Centre = {
        id: makeId(),
        name: row.name ?? "",
        code: row.code || null,
        location: row.location || null,
      };
      data.centres.push(created);
      return created;
    });
  },
  async updateCentre(id: string, row: Partial<Centre>): Promise<Centre> {
    return change((data) => {
      const current = data.centres.find((item) => item.id === id);
      if (!current) throw new Error("Centre not found.");
      Object.assign(current, row);
      return { ...current };
    });
  },
  async deleteCentre(id: string): Promise<void> {
    return change((data) => {
      data.centres = data.centres.filter((row) => row.id !== id);
      data.yardPositions = data.yardPositions.filter((row) => row.centre_id !== id);
      data.containers = data.containers.filter((row) => row.centre_id !== id);
      data.vehicles = data.vehicles.filter((row) => row.centre_id !== id);
    });
  },
  async yardPositions(centreId: string): Promise<YardPosition[]> {
    return sortBy((await readData()).yardPositions.filter((row) => row.centre_id === centreId), "name");
  },
  async createYardPosition(centreId: string, name: string): Promise<YardPosition> {
    return change((data) => {
      const created = { id: makeId(), centre_id: centreId, name };
      data.yardPositions.push(created);
      return created;
    });
  },
  async updateYardPosition(id: string, name: string): Promise<YardPosition> {
    return change((data) => {
      const current = data.yardPositions.find((row) => row.id === id);
      if (!current) throw new Error("Yard position not found.");
      current.name = name;
      return { ...current };
    });
  },
  async deleteYardPosition(id: string): Promise<void> {
    return change((data) => {
      data.yardPositions = data.yardPositions.filter((row) => row.id !== id);
    });
  },
  async sizeOptions(): Promise<SizeOption[]> {
    return sortBy((await readData()).sizeOptions, "label");
  },
  async typeOptions(): Promise<TypeOption[]> {
    return sortBy((await readData()).typeOptions, "label");
  },
  async upsertSize(row: Partial<SizeOption>): Promise<SizeOption> {
    return change((data) => {
      const current = row.id ? data.sizeOptions.find((item) => item.id === row.id) : undefined;
      if (current) {
        Object.assign(current, row);
        return { ...current };
      }
      const created = { id: makeId(), label: row.label ?? "", teu: row.teu ?? 1 };
      data.sizeOptions.push(created);
      return created;
    });
  },
  async deleteSize(id: string): Promise<void> {
    return change((data) => {
      data.sizeOptions = data.sizeOptions.filter((row) => row.id !== id);
    });
  },
  async upsertType(row: Partial<TypeOption>): Promise<TypeOption> {
    return change((data) => {
      const current = row.id ? data.typeOptions.find((item) => item.id === row.id) : undefined;
      if (current) {
        Object.assign(current, row);
        return { ...current };
      }
      const created = { id: makeId(), label: row.label ?? "", subtypes: row.subtypes ?? [] };
      data.typeOptions.push(created);
      return created;
    });
  },
  async deleteType(id: string): Promise<void> {
    return change((data) => {
      data.typeOptions = data.typeOptions.filter((row) => row.id !== id);
    });
  },
  async rakes(): Promise<Rake[]> {
    return sortBy((await readData()).rakes, "rake_name");
  },
  async upsertRake(row: Partial<Rake>): Promise<Rake> {
    return change((data) => {
      const current = row.id ? data.rakes.find((item) => item.id === row.id) : undefined;
      if (current) {
        Object.assign(current, row);
        return { ...current };
      }
      const created: Rake = {
        id: makeId(), rake_name: row.rake_name ?? "", rake_id: row.rake_id ?? null,
        rake_basing: row.rake_basing ?? null, bpc_due_date: row.bpc_due_date ?? null,
        ownership: row.ownership ?? "Owned", wagons: row.wagons ?? null,
        current_user_type: row.current_user_type ?? "Self",
        rake_type: row.rake_type ?? null,
      };
      data.rakes.push(created);
      return created;
    });
  },
  async deleteRake(id: string): Promise<void> {
    return change((data) => {
      data.rakes = data.rakes.filter((row) => row.id !== id);
    });
  },
  async containers(centreId: string, dispatched = false): Promise<Container[]> {
    const rows = (await readData()).containers.filter(
      (row) => row.centre_id === centreId && row.dispatched === dispatched,
    );
    return sortBy(rows, "created_at", true);
  },
  async allContainers(): Promise<Container[]> {
    return sortBy((await readData()).containers, "created_at", true);
  },
  async searchContainers(term: string): Promise<Container[]> {
    const value = term.toUpperCase();
    return sortBy(
      (await readData()).containers.filter((row) => row.container_no.toUpperCase().includes(value)),
      "created_at",
      true,
    ).slice(0, 50);
  },
  async insertContainers(rows: Partial<Container>[]): Promise<Container[]> {
    return change((data) => {
      const now = new Date().toISOString();
      const created: Container[] = rows.map((row) => ({
        ...blankContainer(),
        ...row,
        id: makeId(),
        centre_id: row.centre_id ?? "",
        container_no: row.container_no ?? "",
        custom_fields: row.custom_fields ?? {},
        created_at: row.created_at ?? now,
        updated_at: now,
      }));
      for (const row of created) {
        if (data.containers.some((item) => item.container_no === row.container_no && !item.dispatched)) {
          throw new Error(`${row.container_no} is already in inventory.`);
        }
      }
      data.containers.push(...created);
      return created;
    });
  },
  async updateContainer(id: string, row: Partial<Container>): Promise<Container> {
    return change((data) => {
      const current = data.containers.find((item) => item.id === id);
      if (!current) throw new Error("Container not found.");
      Object.assign(current, row, { updated_at: new Date().toISOString() });
      return { ...current };
    });
  },
  async updateContainers(ids: string[], row: Partial<Container>): Promise<Container[]> {
    return change((data) => data.containers.filter((item) => ids.includes(item.id)).map((item) => {
      Object.assign(item, row, { updated_at: new Date().toISOString() });
      return { ...item };
    }));
  },
  async deleteContainers(ids: string[]): Promise<void> {
    return change((data) => {
      data.containers = data.containers.filter((row) => !ids.includes(row.id));
    });
  },
  async dispatchedContainers(centreId: string, from: string, to: string): Promise<Container[]> {
    return sortBy((await readData()).containers.filter((row) =>
      row.centre_id === centreId && row.dispatched && Boolean(row.out_date) &&
      String(row.out_date) >= from && String(row.out_date) <= to
    ), "out_date", true);
  },
  async logs(centreId: string, since?: string): Promise<ActivityLog[]> {
    return sortBy((await readData()).logs.filter((row) =>
      row.centre_id === centreId && (!since || row.created_at >= since)
    ), "created_at");
  },
  async log(centreId: string | null, centreName: string | null, action: string, details?: string): Promise<void> {
    return change((data) => {
      data.logs.push({
        id: makeId(), centre_id: centreId, centre_name: centreName, action,
        details: details ?? null, created_at: new Date().toISOString(),
      });
    });
  },
};