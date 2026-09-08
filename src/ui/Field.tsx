import type { ReactNode } from 'react';

import './Field.css';

interface FieldProps {
  /** The control's id. Without one the label is a plain span — a radio group has no single
   * element to point a `for` at, and its group name is announced by the fieldset instead. */
  htmlFor?: string;
  label: ReactNode;
  /** A small control sharing the label's line, such as the Auto chip. */
  action?: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  /** Grid placement from the enclosing screen, e.g. `fields__item--wide`. */
  className?: string;
  children: ReactNode;
}

/** One labelled control: its name, the control itself, and the line explaining it. */
export function Field({ htmlFor, label, action, hint, hintId, className, children }: FieldProps) {
  const name = htmlFor ? (
    <label className="field__label" htmlFor={htmlFor}>
      {label}
    </label>
  ) : (
    <span className="field__label">{label}</span>
  );

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      {action ? (
        <div className="field__header">
          {name}
          {action}
        </div>
      ) : (
        name
      )}
      {children}
      {hint !== undefined && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
