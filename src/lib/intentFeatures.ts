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
 * Convierte una frase en sus features. Usamos unigramas y bigramas de palabras:
 * capturan expresiones clave del dominio ("cuantos creditos", "que ramos da",
 * "puedo tomar") sin explotar el tamaño del vocabulario. Se agregan marcadores
 * de inicio/fin para que el modelo aprenda aperturas típicas de pregunta.
 */
export function featurize(text: string): string[] {
  const words = normalize(text).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const tokens = ['<s>', ...words, '</s>'];
  const feats: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== '<s>' && tokens[i] !== '</s>') feats.push(`u:${tokens[i]}`);
    if (i < tokens.length - 1) feats.push(`b:${tokens[i]}_${tokens[i + 1]}`);
  }
  return feats;
}
