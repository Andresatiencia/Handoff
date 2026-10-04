export function DateInput({ label, name }: { label: string; name: string }) {
  return <label className="block text-sm font-semibold" htmlFor={name}>{label}<input className="form-input mt-2" type="date" id={name} name={name} required min="2026-01-01" max="2100-12-31" /></label>;
}
