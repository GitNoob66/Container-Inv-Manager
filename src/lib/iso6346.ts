// ISO 6346 container number validation.
// Format: 4 letters (owner code + category identifier) + 6 digits + 1 check digit.

const LETTER_VALUES: Record<string, number> = {};
{
  // A=10, then skip multiples of 11 (11, 22, 33 ...)
  let value = 10;
  for (let i = 0; i < 26; i++) {
    if (value % 11 === 0) value++;
    LETTER_VALUES[String.fromCharCode(65 + i)] = value;
    value++;
  }
}

export const CONTAINER_NO_REGEX = /^[A-Z]{4}\d{7}$/;

export function normalizeContainerNo(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function computeCheckDigit(first10: string): number | null {
  if (!/^[A-Z]{4}\d{6}$/.test(first10)) return null;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const val = i < 4 ? LETTER_VALUES[ch] : Number(ch);
    sum += val * Math.pow(2, i);
  }
  const remainder = sum % 11;
  return remainder === 10 ? 0 : remainder;
}

export type ContainerCheck = {
  valid: boolean;
  normalized: string;
  message: string;
  expectedCheckDigit?: number;
};

export function validateContainerNo(raw: string): ContainerCheck {
  const normalized = normalizeContainerNo(raw);
  if (!normalized) {
    return { valid: false, normalized, message: "Container number is empty." };
  }
  if (!CONTAINER_NO_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      message: "Must be 4 letters followed by 7 digits (ISO 6346).",
    };
  }
  if (normalized[3] !== "U" && normalized[3] !== "J" && normalized[3] !== "Z") {
    return {
      valid: false,
      normalized,
      message: "4th letter must be U, J or Z (ISO 6346 category identifier).",
    };
  }
  const expected = computeCheckDigit(normalized.slice(0, 10));
  if (expected === null) {
    return { valid: false, normalized, message: "Invalid container number." };
  }
  if (expected !== Number(normalized[10])) {
    return {
      valid: false,
      normalized,
      message: `Check digit is wrong — expected ${expected}.`,
      expectedCheckDigit: expected,
    };
  }
  return { valid: true, normalized, message: "Valid ISO 6346 number." };
}

// Finds every ISO-shaped container number inside an arbitrary blob of text.
export function extractContainerNumbers(text: string): string[] {
  const out: string[] = [];
  const re = /\b([A-Z]{4})[\s-]?(\d{6})[\s-]?(\d)\b/g;
  let m: RegExpExecArray | null;
  const upper = (text || "").toUpperCase();
  while ((m = re.exec(upper)) !== null) {
    out.push(`${m[1]}${m[2]}${m[3]}`);
  }
  return out;
}
