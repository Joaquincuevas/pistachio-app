import { featurize } from './intentFeatures';

/**
 * Inferencia del clasificador de intención de Export (el modelo entrenado en
 * ml/train-intent.ts). Carga los pesos de forma diferida —así no engordan el
 * bundle inicial— y predice la intención con su confianza. Es determinístico:
 * el mismo featurizado que en el entrenamiento.
 */

interface IntentModel {
  intents: string[];
  vocab: Record<string, number>;
  bias: number[];
  /** Pesos dispersos por intención: índice de feature → peso. */
  weights: Record<string, number>[];
}

let model: IntentModel | null = null;
let loading: Promise<void> | null = null;

/** Carga el modelo (una vez). Llámalo al abrir el asistente. */
export function loadIntentModel(): Promise<void> {
  if (model) return Promise.resolve();
  if (!loading) {
    loading = import('./intentModel.json')
      .then((m) => {
        model = ((m as { default: unknown }).default ?? m) as IntentModel;
      })
      .catch((err) => {
        console.error('[export] no se pudo cargar el modelo de intención', err);
      });
  }
  return loading;
}

export interface IntentPrediction {
  intent: string;
  /** Probabilidad softmax de la intención ganadora (0-1). */
  confidence: number;
}

/**
 * Clasifica la intención de una frase. Devuelve null si el modelo aún no está
 * cargado (el motor de reglas sigue funcionando mientras tanto).
 */
export function classifyIntent(text: string): IntentPrediction | null {
  if (!model) return null;
  // Dedup: el entrenamiento usa features binarias (presencia), así que la
  // inferencia debe contarlas una sola vez aunque se repitan en la frase.
  const feats = [...new Set(featurize(text))];
  if (feats.length === 0) return null;

  const K = model.intents.length;
  const logits = new Array<number>(K);
  for (let k = 0; k < K; k++) {
    let s = model.bias[k] ?? 0;
    const w = model.weights[k];
    for (const f of feats) {
      const idx = model.vocab[f];
      if (idx !== undefined) {
        const wv = w[idx];
        if (wv !== undefined) s += wv;
      }
    }
    logits[k] = s;
  }

  const max = Math.max(...logits);
  let sum = 0;
  const exp = logits.map((l) => {
    const e = Math.exp(l - max);
    sum += e;
    return e;
  });

  let best = 0;
  let bestP = -1;
  for (let k = 0; k < K; k++) {
    const p = exp[k] / sum;
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return { intent: model.intents[best], confidence: bestP };
}
