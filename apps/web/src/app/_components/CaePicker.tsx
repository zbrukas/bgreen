"use client";

import type { CaeEntry } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";
import { searchCaeAction } from "../actions";

interface CaePickerProps {
  name: string;
  initialEntry?: CaeEntry | null;
}

export function CaePicker({ name, initialEntry }: CaePickerProps) {
  const [selected, setSelected] = useState<CaeEntry | null>(initialEntry ?? null);
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [matches, setMatches] = useState<CaeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim() === "") {
      setMatches([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchCaeAction(query);
      if (cancelled) return;
      setMatches(results);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div style={{ display: "grid", gap: "0.25rem", position: "relative" }}>
      <span>CAE Rev.4 (opcional)</span>
      <input type="hidden" name={name} value={selected?.code ?? ""} readOnly />
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
              setSelected(null);
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
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
          {open && (loading || matches.length > 0) && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: "calc((1.6em + 0.5rem) * 8)",
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
              {loading && (
                <li style={{ padding: "0.4rem 0.5rem", color: "#666", fontSize: "0.9rem" }}>
                  A pesquisar…
                </li>
              )}
              {!loading &&
                matches.map((entry) => (
                  <li key={entry.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelected(entry);
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
          {open && query.trim() !== "" && !loading && matches.length === 0 && (
            <p style={{ margin: 0, padding: "0.4rem 0", fontSize: "0.85rem", color: "#666" }}>
              Nenhum resultado para "{query}".
            </p>
          )}
        </>
      )}
    </div>
  );
}
