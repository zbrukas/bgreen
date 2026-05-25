export function ProgressBlock() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
      A processar o documento. Esta página atualiza automaticamente.
    </div>
  );
}
