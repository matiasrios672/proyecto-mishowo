import { useId, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

const base =
  "w-full min-h-11 rounded-lg border border-input bg-background px-3.5 py-2.5 text-base text-foreground sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-60";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  counter?: { value: string; max: number };
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Etiqueta + campo + ayuda/error + contador. Accesible: label asociada y aria-describedby. */
export function Field({ label, hint, error, required, counter, children }: FieldProps) {
  const id = useId();
  const descId = hint || error ? `${id}-d` : undefined;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span aria-hidden className="text-destructive"> *</span>}
        </label>
        {counter && (
          <span className={`text-xs ${counter.value.length > counter.max ? "text-destructive" : "text-muted-foreground"}`} aria-hidden>
            {counter.value.length}/{counter.max}
          </span>
        )}
      </div>
      {children(id, descId)}
      {error ? (
        <p id={descId} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={descId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      <button
        id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${checked ? "bg-primary" : "bg-muted-foreground/40"}`}
      >
        <span aria-hidden className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function Section({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
