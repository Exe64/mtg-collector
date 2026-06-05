/**
 * Middleware de validation zod : parse req.body contre un schéma.
 * En cas d'échec → 400 avec messages agrégés. Sinon req.body est remplacé
 * par la valeur typée/coercée.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ; ');
      return res.status(400).json({ error: msg });
    }
    req.body = result.data;
    return next();
  };
}
