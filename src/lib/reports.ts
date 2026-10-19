import * as XLSX from "xlsx";
import type { Container } from "./api";

const HEADERS = [
  "Centre",
  "Container No",
  "Size",
  "Type",
  "Sub Type",
  "Ownership",
  "Status",
  "Weight (kg)",
  "Condition",
  "Category",
  "Cargo",
  "Account",
  "Yard Position",
  "In Mode",
  "In Rake",
  "In Date",
  "In Time",
  "Out Mode",
  "Out Rake",
  "Out Date",
  "Out Time",
  "Destination",
  "Remarks",
  "Dispatched",
];

function rowFor(c: Container, centreName: string) {
  return [
    centreName,
    c.container_no,
    c.size ?? "",
    c.ctr_type ?? "",
    c.dry_subtype ?? "",
    c.ownership ?? "",
    c.status ?? "",
    c.weight ?? "",
    c.condition ?? "",
    c.category ?? "",
    c.cargo ?? "",
    c.account ?? "",
    c.yard_position ?? "",
    c.mode ?? "",
    c.rake_name ?? "",
    c.in_date ?? "",
    c.in_time ?? "",
    c.out_mode ?? "",
    c.out_rake_name ?? "",
    c.out_date ?? "",
    c.out_time ?? "",
    c.destination ?? "",
    c.remarks ?? "",
    c.dispatched ? "Yes" : "No",
  ];
}

export function buildContainerWorkbook(
  containers: Container[],
  centreNameById: Record<string, string>,
  title: string,
) {
  const body = containers.map((c) => rowFor(c, centreNameById[c.centre_id] ?? ""));
  const aoa = [[title], [`Generated: ${new Date().toLocaleString()}`], [], HEADERS, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = HEADERS.map((h, i) => ({
    wch: Math.max(
      h.length + 2,
      ...body.map((r) => String(r[i] ?? "").length + 2),
      12,
    ),
  }));

  const headerRowIndex = 3;
  for (let c = 0; c < HEADERS.length; c++) {
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
