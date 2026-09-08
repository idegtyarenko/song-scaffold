import './RadioGroup.css';

interface RadioGroupProps<T extends string> {
  /** Shared across the inputs, so the browser gives the group arrow-key navigation. */
  name: string;
  /** Announced in place of a label, which a group of inputs cannot carry. */
  ariaLabel: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/**
 * A segmented control built from real radios: the inputs are hidden but still focusable
 * and still keyboard-driven, and their labels do the drawing.
 */
export function RadioGroup<T extends string>({
  name,
  ariaLabel,
  value,
  options,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <div className="choice" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <label className="choice__option" key={option.value}>
          <input
            className="choice__input"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="choice__label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
