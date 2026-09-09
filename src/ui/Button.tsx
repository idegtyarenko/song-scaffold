import type { ComponentPropsWithRef } from 'react';

import './Button.css';
import { cx } from './classes';

/**
 * `primary` is the one action a screen is asking for, `secondary` the way back out, and
 * `chip` a small switch that rides beside a field's label. Plain is everything else.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'chip';

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
}

/** Never a submit button by default: no screen here posts a form. */
export function Button({ variant, className, type = 'button', ...rest }: ButtonProps) {
  const classes = cx('button', variant && `button--${variant}`, className);

  return <button className={classes} type={type} {...rest} />;
}
