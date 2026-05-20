// PT NIF (Número de Identificação Fiscal) validator — mod-11 checksum.
//
// Spec: 9 digits, last digit is a check digit computed from the first 8 via
// a weighted sum modulo 11. First digit hints at the entity type
// (1/2 = singular/heritage, 5 = legal entity, 6 = public administration,
// 8 = sole-proprietor, 9 = special) but we accept any first digit — clients
// who need to constrain by entity type can do so on top of this validator.

export type NifValidationResult =
  | { valid: true; normalized: string }
  | {
      valid: false;
      reason: "empty" | "non_numeric" | "wrong_length" | "bad_checksum";
    };

/**
 * Validate a NIF string. Whitespace is stripped before validation;
 * non-digit characters (e.g., dashes) cause `non_numeric`.
 */
export function validateNif(input: string | null | undefined): NifValidationResult {
  if (input === null || input === undefined) {
    return { valid: false, reason: "empty" };
  }
  const stripped = input.replace(/\s+/g, "");
  if (stripped.length === 0) return { valid: false, reason: "empty" };
  if (!/^\d+$/.test(stripped)) return { valid: false, reason: "non_numeric" };
  if (stripped.length !== 9) return { valid: false, reason: "wrong_length" };

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    // biome-ignore lint/style/noNonNullAssertion: substring length is guaranteed
    sum += Number(stripped[i]!) * (9 - i);
  }
  const remainder = sum % 11;
  const expectedCheck = remainder < 2 ? 0 : 11 - remainder;
  // biome-ignore lint/style/noNonNullAssertion: index 8 is in bounds
  if (Number(stripped[8]!) !== expectedCheck) {
    return { valid: false, reason: "bad_checksum" };
  }

  return { valid: true, normalized: stripped };
}
