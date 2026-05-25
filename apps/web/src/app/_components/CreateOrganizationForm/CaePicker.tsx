"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CaeEntry } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";
import { searchCaeAction } from "../../actions";

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
    <div className="relative space-y-1.5">
      <Label>CAE Rev.4 (opcional)</Label>
      <input type="hidden" name={name} value={selected?.code ?? ""} readOnly />
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500 bg-emerald-50/60 px-3 py-2 text-sm">
          <strong className="font-mono">{selected.code}</strong>
          <span className="flex-1">{selected.description}</span>
          <Button
            type="button"
            variant="ghost"
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
      ) : (
        <>
          <Input
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
          />
          {open && (loading || matches.length > 0) && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
              {loading && <li className="px-3 py-2 text-sm text-muted-foreground">A pesquisar…</li>}
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
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <code className="mr-2 font-mono">{entry.code}</code>
                      {entry.description}
                    </button>
                  </li>
                ))}
            </ul>
          )}
          {open && query.trim() !== "" && !loading && matches.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum resultado para "{query}".</p>
          )}
        </>
      )}
    </div>
  );
}
