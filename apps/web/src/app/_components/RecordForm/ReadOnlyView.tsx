import type { RecordTemplate } from "@bgreen/types";
import { ReadOnlyField } from "./ReadOnlyField";
import type { FormValues } from "./record-form-helpers";
import { type SubTemplateSection, statusLabel } from "./utils";

export function ReadOnlyView({
  template,
  values,
  subTemplates,
  subValues,
  status,
}: {
  template: RecordTemplate;
  values: FormValues;
  subTemplates: SubTemplateSection[];
  subValues: Record<string, FormValues>;
  status: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Estado: {statusLabel[status] ?? status}</p>
      {template.formSchema.rows.map((row) => (
        <section key={row.id} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
          {row.label && <h3 className="text-sm font-medium">{row.label}</h3>}
          <dl className="space-y-1.5">
            {row.fields.map((f) => (
              <ReadOnlyField key={f.id} field={f} value={values[f.id]} />
            ))}
          </dl>
        </section>
      ))}
      {subTemplates.map((sub) => (
        <section
          key={sub.id}
          className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3"
        >
          <h3 className="text-sm font-semibold">{sub.name}</h3>
          {sub.formSchema.rows.map((row) => (
            <div key={row.id} className="space-y-1">
              {row.label && <h4 className="text-xs font-medium">{row.label}</h4>}
              <dl className="space-y-1.5">
                {row.fields.map((f) => (
                  <ReadOnlyField key={f.id} field={f} value={subValues[sub.id]?.[f.id]} />
                ))}
              </dl>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
