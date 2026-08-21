/** Bouton unique du projet : une variante, une taille, pas de style inline. */

function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  block = false,
  ...rest
}) {
  const className = ['btn', variant, size === 'sm' ? 'sm' : '', block ? 'block' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
}

export default Button;
