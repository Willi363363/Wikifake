/** Message d'erreur inline, avec role live pour les lecteurs d'ecran. */

function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <p className="lobby-error" role="alert">
      {children}
    </p>
  );
}

export default ErrorBanner;
