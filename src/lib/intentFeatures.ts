/**
 * Featurizador de texto para el clasificador de intención de Export.
 *
 * Es el corazón "aprendible" del asistente: convierte una frase en una lista de
 * features (n-gramas de palabras) que el modelo entrenado pondera. Vive aparte
 * de la NLU de reglas para que el MISMO código se use al entrenar (Node) y al
 * inferir (navegador) — si el featurizado difiere, el modelo se rompe.
 *
 * Sin dependencias, determinístico y explicable.
 */

/** Minúsculas, sin tildes, solo letras/números, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte una frase en sus features:
 * - Unigramas y bigramas de palabras: capturan expresiones clave del dominio
 *   ("cuantos creditos", "que ramos da") con marcadores de inicio/fin para las
 *   aperturas típicas de pregunta.
 * - Trigramas de caracteres por palabra (con bordes '#'): dan robustez ante
 *   typos — "credtos" comparte la mayoría de sus trigramas con "creditos",
 *   así que la frase igual cae en la intención correcta aunque el unigrama
 *   exacto no exista. Solo palabras de 4+ letras (las cortas no lo necesitan
 *   y agregan ruido).
 */
export function featurize(text: string): string[] {
  const words = normalize(text).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const tokens = ['<s>', ...words, '</s>'];
  const feats: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t !== '<s>' && t !== '</s>') {
      feats.push(`u:${t}`);
      if (t.length >= 4) {
        const padded = `#${t}#`;
        for (let j = 0; j <= padded.length - 3; j++) feats.push(`c:${padded.slice(j, j + 3)}`);
      }
    }
    if (i < tokens.length - 1) feats.push(`b:${t}_${tokens[i + 1]}`);
  }
  return feats;
}
