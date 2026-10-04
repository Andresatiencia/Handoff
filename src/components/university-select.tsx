import { universities } from "@/lib/universities";

export function UniversitySelect() {
  return <label className="block text-sm font-semibold">University
    <select name="university" className="form-input mt-2" required>
      {universities.map(name => <option key={name} value={name}>{name}</option>)}
    </select>
  </label>;
}
