import type {
  ActivityLog,
  Centre,
  Container,
  Rake,
  SizeOption,
  TypeOption,
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
};

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
  if (saved) return saved;
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
  let output: T | undefined;
  const operation = writeQueue.then(async () => {
    const data = await readData();
    output = update(data);
    await writeData(data);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
  if (output === undefined) throw new Error("Local update did not complete.");
  return output;
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
  return data as LocalData;
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

export const localApi = {
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
      const created = rows.map((row) => ({
        id: makeId(), centre_id: row.centre_id ?? "", container_no: row.container_no ?? "",
        mode: row.mode ?? null, rail_ownership: row.rail_ownership ?? null, rake_name: row.rake_name ?? null,
        size: row.size ?? null, ctr_type: row.ctr_type ?? null, dry_subtype: row.dry_subtype ?? null,
        ownership: row.ownership ?? null, status: row.status ?? null, weight: row.weight ?? null,
        condition: row.condition ?? null, in_date: row.in_date ?? null, in_time: row.in_time ?? null,
        cargo: row.cargo ?? null, category: row.category ?? null, account: row.account ?? null,
        yard_position: row.yard_position ?? null, out_mode: row.out_mode ?? null,
        out_rail_ownership: row.out_rail_ownership ?? null, out_rake_name: row.out_rake_name ?? null,
        out_date: row.out_date ?? null, out_time: row.out_time ?? null, dispatched: row.dispatched ?? false,
        created_at: row.created_at ?? now, updated_at: now,
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