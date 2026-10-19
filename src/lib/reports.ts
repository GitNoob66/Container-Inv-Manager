import * as XLSX from "xlsx";
import type { Container, CustomColumn, Vehicle } from "./api";

const HEADERS = [
  "Centre", "Container No", "ISO Check", "Size", "Type", "Sub Type", "Ownership", "Lessor", "Status",
  "Weight (kg)", "Net Weight", "Seal Number", "Inward Bill No", "Condition", "Category", "Cargo", "Party",
  "Yard Position", "In Mode", "In Truck No", "In Rake", "In Wagon No", "In Stack", "In Date", "In Time",
  "Out Mode", "Out Truck No", "Out Rake", "Out Wagon No", "Out Stack", "Out Date", "Out Time",
  "Destination", "Remarks", "Dispatched",
];

function rowFor(c: Container, centreName: string, customKeys: { key: string; centreIds: Set<string> }[]) {
  return [
    centreName, c.container_no, c.iso_valid === false ? "Failed" : "OK", c.size ?? "", c.ctr_type ?? "",
    c.dry_subtype ?? "", c.ownership ?? "", c.lessor ?? "", c.status ?? "", c.weight ?? "", c.net_weight ?? "",
    c.seal_no ?? "", c.inward_bill_no ?? "", c.condition ?? "", c.category ?? "", c.cargo ?? "", c.account ?? "",
    c.yard_position ?? "", c.mode ?? "", c.truck_no ?? "", c.rake_name ?? "", c.wagon_no ?? "", c.stack ?? "",
    c.in_date ?? "", c.in_time ?? "", c.out_mode ?? "", c.out_truck_no ?? "", c.out_rake_name ?? "",
    c.out_wagon_no ?? "", c.out_stack ?? "", c.out_date ?? "", c.out_time ?? "", c.destination ?? "",
    c.remarks ?? "", c.dispatched ? "Yes" : "No",
    ...customKeys.map((k) => (k.centreIds.has(c.centre_id) ? (c.custom_fields?.[k.key] ?? "") : "")),
  ];
}

export function buildContainerWorkbook(
  containers: Container[],
  centreNameById: Record<string, string>,
  title: string,
  customColumns: CustomColumn[] = [],
) {
  // Custom columns are per centre; columns sharing a label are merged into one report column.
  const byLabel = new Map<string, { key: string; label: string; centreIds: Set<string> }[]>();
  for (const col of customColumns.filter((c) => !c.builtin)) {
    const list = byLabel.get(col.label) ?? [];
    list.push({ key: col.key, label: col.label, centreIds: new Set([col.centre_id]) });
    byLabel.set(col.label, list);
  }
  const labels = [...byLabel.keys()];
  const headers = [...HEADERS, ...labels];
  const body = containers.map((c) => {
    const base = rowFor(c, centreNameById[c.centre_id] ?? "", []);
    const extra = labels.map((l) => {
      const hit = byLabel.get(l)!.find((k) => k.centreIds.has(c.centre_id));
      return hit ? (c.custom_fields?.[hit.key] ?? "") : "";
    });
    return [...base, ...extra];
  });
  const aoa = [[title], [`Generated: ${new Date().toLocaleString()}`], [], headers, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.max(
      h.length + 2,
      ...body.map((r) => String(r[i] ?? "").length + 2),
      12,
    ),
  }));

  const headerRowIndex = 3;
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    const cell = ws[ref];
    if (cell) {
      cell.s = {
        font: { bold: true, name: "Google Sans", sz: 11 },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, name: "Google Sans", sz: 14 } };
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Containers");
  return wb;
}

const VEHICLE_HEADERS = ["Centre", "Vehicle No.", "Vehicle Type", "Transporter", "Driver Name", "Driver Phone", "Remarks", "Registered On"];

export function buildVehicleWorkbook(vehicles: Vehicle[], centreNameById: Record<string, string>) {
  const body = vehicles.map((v) => [
    centreNameById[v.centre_id] ?? "",
    v.vehicle_no,
    v.vehicle_type ?? "",
    v.transporter ?? "",
    v.driver_name ?? "",
    v.driver_phone ?? "",
    v.remarks ?? "",
    v.created_at.slice(0, 10),
  ]);
  const aoa = [["Vehicle Register — All Centres"], [`Generated: ${new Date().toLocaleString()}`], [], VEHICLE_HEADERS, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = VEHICLE_HEADERS.map((h, i) => ({
    wch: Math.max(h.length + 2, ...body.map((r) => String(r[i] ?? "").length + 2), 12),
  }));
  for (let c = 0; c < VEHICLE_HEADERS.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 3, c })];
    if (cell) cell.s = { font: { bold: true, name: "Google Sans", sz: 11 }, alignment: { horizontal: "center", vertical: "center" } };
  }
  const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (titleCell) titleCell.s = { font: { bold: true, name: "Google Sans", sz: 14 } };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { compression: true });
}
