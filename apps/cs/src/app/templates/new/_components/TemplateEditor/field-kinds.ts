// Kind dropdown contents + capability flags. Not React components —
// shared lookups between the field cards and their sub-editors.

import type { EditorFieldKind, EditorLeafKind } from "./template-editor-build";

export const TOP_LEVEL_KINDS: Array<{ value: EditorFieldKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
  { value: "repeating", label: "Linhas repetidas" },
];

export const LEAF_KINDS: Array<{ value: EditorLeafKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
];

// Kinds that can be source-mapped from another template's submitted record.
export const MAPPABLE_KINDS: ReadonlySet<EditorFieldKind> = new Set([
  "text",
  "number",
  "date",
  "select",
]);
