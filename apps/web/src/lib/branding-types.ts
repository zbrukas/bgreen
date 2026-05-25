// V11.4 — branding error class. Lives separately from
// branding-actions.ts because Next.js "use server" files may only
// export async functions; same pattern as IesError, CoverageError,
// ReportsError.

export class BrandingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "BrandingError";
  }
}
