"use client";

import { type CaeEntry, caeCatalog, findCaeByCode, searchCae } from "@bgreen/pt-data";
import { useMemo, useRef, useState } from "react";

interface CaePickerProps {
  name: string;
  initialCode?: string;
}

const ROW_HEIGHT = "calc(1.6em + 0.5rem)";

export function CaePicker({ name, initialCode }: CaePickerProps) {
  const [selectedCode, setSelectedCode] = useState<string>(initialCode ?? "");
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<CaeEntry[]>(() => {
    if (query.trim() === "") return [];
    return searchCae(query, 30);
  }, [query]);

  const selected = useMemo<CaeEntry | null>(() => {
    return selectedCode ? findCaeByCode(selectedCode) : null;
  }, [selectedCode]);

  if (caeCatalog.length === 0) {
    return (
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <span>CAE</span>
        <p
          style={{
            margin: 0,
            padding: "0.5rem",
            border: "1px dashed #c00",
            borderRadius: "0.25rem",
            background: "#fff5f5",
            color: "#a00",
            fontSize: "0.85rem",
          }}
        >
          Sem dados de CAE carregados. Coloque o ficheiro INE em
          <code style={{ margin: "0 0.25rem" }}>packages/pt-data/raw/</code>e execute{" "}
          <code>pnpm --filter @bgreen/pt-data parse-cae</code>.
        </p>
        <input type="hidden" name={name} value="" />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.25rem", position: "relative" }}>
      <span>CAE Rev.3 (opcional)</span>
      <input type="hidden" name={name} value={selectedCode} readOnly />
      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            border: "1px solid #1f7a3d",
            borderRadius: "0.25rem",
            background: "#f4faf6",
            fontSize: "0.95rem",
          }}
        >
          <strong style={{ fontFamily: "monospace" }}>{selected.code}</strong>
          <span style={{ flex: 1 }}>{selected.description}</span>
          <button
            type="button"
            onClick={() => {
              setSelectedCode("");
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.85rem",
            }}
          >
            Alterar
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Pesquise por código (35) ou descrição (eletricidade)…"
            autoComplete="off"
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
          {open && matches.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: `calc(${ROW_HEIGHT} * 8)`,
                overflowY: "auto",
                margin: 0,
                padding: 0,
                listStyle: "none",
                background: "white",
                border: "1px solid #c5c5c5",
                borderRadius: "0.25rem",
                zIndex: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {matches.map((entry) => (
                <li key={entry.code}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedCode(entry.code);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.4rem 0.5rem",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    <code style={{ marginRight: "0.5rem" }}>{entry.code}</code>
                    {entry.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() !== "" && matches.length === 0 && (
            <p style={{ margin: 0, padding: "0.4rem 0", fontSize: "0.85rem", color: "#666" }}>
              Nenhum resultado para "{query}".
            </p>
          )}
        </>
      )}
    </div>
  );
}
