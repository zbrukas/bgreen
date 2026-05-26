"use client";

import type { CaeEntry } from "@/lib/api-client";
import { Search } from "@carbon/icons-react";
import { Button, TextInput } from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { searchCaeAction } from "../../actions";
import { CaeBrowserModal } from "./CaeBrowserModal";

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
  const [browserOpen, setBrowserOpen] = useState<boolean>(false);
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
    <div className="relative">
      <input type="hidden" name={name} value={selected?.code ?? ""} readOnly />
      {selected ? (
        <div>
          <span className="cds--label">CAE Rev.4 (opcional)</span>
          <div
            className="mt-1 flex items-center gap-2 border border-l-4 border-l-[var(--cds-interactive)] border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
          >
            <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{selected.code}</strong>
            <span className="flex-1">{selected.description}</span>
            <Button
              type="button"
              kind="ghost"
              size="sm"
              onClick={() => {
                setSelected(null);
                setQuery("");
                setOpen(true);
                inputRef.current?.focus();
              }}
            >
              Alterar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                id="cae-picker"
                labelText="CAE Rev.4 (opcional)"
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Pesquise por código (35) ou descrição (eletricidade)…"
                autoComplete="off"
                helperText={
                  open && query.trim() !== "" && !loading && matches.length === 0
                    ? `Nenhum resultado para "${query}".`
                    : undefined
                }
              />
            </div>
            <Button
              type="button"
              kind="tertiary"
              renderIcon={Search}
              hasIconOnly
              iconDescription="Procurar no catálogo"
              tooltipPosition="top"
              onClick={() => setBrowserOpen(true)}
            />
          </div>
          {open && (loading || matches.length > 0) && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto border border-neutral-200 bg-white shadow-md">
              {loading && (
                <li className="px-3 py-2 text-sm text-neutral-600">A pesquisar…</li>
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
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                    >
                      <code
                        className="mr-2"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {entry.code}
                      </code>
                      {entry.description}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
      <CaeBrowserModal
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={(entry) => {
          setSelected(entry);
          setQuery("");
          setOpen(false);
        }}
      />
    </div>
  );
}
