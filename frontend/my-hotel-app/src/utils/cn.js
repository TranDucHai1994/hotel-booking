import clsx from 'clsx';

/**
 * Utility for conditionally joining classNames together.
 * Thin wrapper around clsx for consistency across components.
 */
export function cn(...inputs) {
  return clsx(inputs);
}

export default cn;
