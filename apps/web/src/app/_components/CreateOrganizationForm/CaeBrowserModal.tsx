"use client";

import { listAllCaesAction } from "@/app/actions";
import type { CaeEntry } from "@/lib/api-client";
import { Accordion, AccordionItem, Modal, Search, Tag } from "@carbon/react";
import { useEffect, useMemo, useState } from "react";

interface CaeBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (entry: CaeEntry) => void;
}

// Strip diacritics + lowercase so "agua" matches "água" and vice versa.
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface DivisionGroup {
  prefix: string;
  heading: CaeEntry | null;
  items: CaeEntry[];
}

function groupByDivision(entries: CaeEntry[]): DivisionGroup[] {
  const byPrefix = new Map<string, DivisionGroup>();
  for (const entry of entries) {
    const prefix = entry.code.slice(0, 2);
    let group = byPrefix.get(prefix);
    if (!group) {
      group = { prefix, heading: null, items: [] };
      byPrefix.set(prefix, group);
    }
    if (entry.code.length === 2) {
      group.heading = entry;
    } else {
      group.items.push(entry);
    }
  }
  return Array.from(byPrefix.values()).sort((a, b) => a.prefix.localeCompare(b.prefix));
}

export function CaeBrowserModal({ open, onClose, onSelect }: CaeBrowserModalProps) {
  const [entries, setEntries] = useState<CaeEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [openDivisions, setOpenDivisions] = useState<Set<string>>(new Set());

  function setDivisionOpen(prefix: string, nextOpen: boolean) {
    setOpenDivisions((prev) => {
      const set = new Set(prev);
      if (nextOpen) set.add(prefix);
      else set.delete(prefix);
      return set;
    });
  }

  useEffect(() => {
    if (!open || entries !== null) return;
    let cancelled = false;
    setLoading(true);
    listAllCaesAction()
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entries]);

  const filteredGroups = useMemo(() => {
    if (!entries) return [];
    const groups = groupByDivision(entries);
    const q = normalize(query.trim());
    if (q === "") return groups;
    return groups
      .map((group) => {
        const headingMatches =
          group.heading !== null &&
          (group.heading.code.startsWith(q) || normalize(group.heading.description).includes(q));
        const items = headingMatches
          ? group.items
          : group.items.filter(
              (it) => it.code.startsWith(q) || normalize(it.description).includes(q),
            );
        if (!headingMatches && items.length === 0) return null;
        return { ...group, items };
      })
      .filter((g): g is DivisionGroup => g !== null);
  }, [entries, query]);

  function handleSelect(entry: CaeEntry) {
    onSelect(entry);
    onClose();
  }

  return (
    <Modal
      open={open}
      onRequestClose={() => {
        setQuery("");
        onClose();
      }}
      modalHeading="Procurar CAE Rev.4"
      modalLabel="Catálogo de actividades económicas"
      passiveModal
      size="lg"
    >
      <div className="space-y-4 pb-2">
        <Search
          id="cae-browser-search"
          labelText="Filtrar CAEs"
          placeholder="Filtrar por código (35) ou descrição (eletricidade)…"
          size="lg"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />

        <div className="cae-browser-list max-h-[60vh] overflow-y-auto border border-neutral-200">
          {loading && entries === null && (
            <p className="px-3 py-4 text-sm text-neutral-600">A carregar catálogo…</p>
          )}
          {!loading && filteredGroups.length === 0 && entries !== null && (
            <p className="px-3 py-4 text-sm text-neutral-600">
              {query.trim() === ""
                ? "Catálogo vazio."
                : `Nenhum resultado para "${query.trim()}".`}
            </p>
          )}
          <Accordion size="md" align="start">
            {filteredGroups.map((group) => {
              const filtering = query.trim() !== "";
              const isOpen = filtering || openDivisions.has(group.prefix);
              return (
                <AccordionItem
                  key={group.prefix}
                  open={isOpen}
                  onHeadingClick={({ isOpen: next }) =>
                    setDivisionOpen(group.prefix, next)
                  }
                  title={
                    <span className="flex items-center gap-2">
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {group.heading?.code ?? group.prefix}
                      </span>
                      <span>{group.heading?.description ?? "Divisão"}</span>
                      <Tag size="sm" type="cool-gray" className="ml-auto">
                        {group.items.length}
                      </Tag>
                    </span>
                  }
                >
                  <ul>
                    {group.items.map((entry) => (
                      <li key={entry.code}>
                        <button
                          type="button"
                          onClick={() => handleSelect(entry)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                        >
                          <code
                            className="mr-2 inline-block min-w-[3rem] text-[var(--cds-link-primary)]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {entry.code}
                          </code>
                          {entry.description}
                        </button>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </Modal>
  );
}
