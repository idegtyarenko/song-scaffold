import './Checkbox.css';

interface CheckboxProps {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Box and label as one target — a tick this small is hard to hit on its own. */
export function Checkbox({ id, label, checked, onChange }: CheckboxProps) {
  return (
    <label className="check">
      <input
        className="check__box"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="check__label">{label}</span>
    </label>
  );
}
