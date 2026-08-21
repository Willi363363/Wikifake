// L'environnement est validé une fois, au démarrage, et échoue fort.
//
// Sans ça, une variable absente se manifeste trois couches plus loin par un
// `undefined` inexplicable — typiquement une requête vers `undefined/api`.
// Ici, le processus refuse de démarrer en nommant ce qui manque.
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Postgres — phase 2. */
  DATABASE_URL: z.url({
    error: "DATABASE_URL doit être une URL Postgres valide",
  }),

  /** Redis — cache d'articles et état des salles, phases 3 et 5. */
  REDIS_URL: z.url({ error: "REDIS_URL doit être une URL Redis valide" }),

  /** Modèle de langage — phase 3. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "clé de modèle absente"),
  MODEL_NAME: z.string().min(1).default("gemini-3.1-flash-lite"),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Configuration invalide :\n${issues.map((i) => `  - ${i}`).join("\n")}`,
    );
    this.name = "EnvError";
  }
}

/**
 * Valide une source de variables d'environnement.
 *
 * @throws {EnvError} avec le nom de chaque variable fautive — jamais sa valeur,
 * qui peut être un secret.
 */
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(racine)";
    return `${name} : ${issue.message}`;
  });
  throw new EnvError(issues);
}
