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
 * Clasifica una frase y devuelve las `k` intenciones más probables (ordenadas
 * por confianza). Devuelve [] si el modelo aún no está cargado — el motor de
 * reglas sigue funcionando mientras tanto. El top-k alimenta la pregunta
 * aclaratoria del asistente cuando ninguna intención domina.
 */
export function classifyIntentTopK(text: string, k = 3): IntentPrediction[] {
  if (!model) return [];
  // Dedup: el entrenamiento usa features binarias (presencia), así que la
  // inferencia debe contarlas una sola vez aunque se repitan en la frase.
  const feats = [...new Set(featurize(text))];
  if (feats.length === 0) return [];

  const K = model.intents.length;
  const logits = new Array<number>(K);
  for (let ki = 0; ki < K; ki++) {
    let s = model.bias[ki] ?? 0;
    const w = model.weights[ki];
    for (const f of feats) {
      const idx = model.vocab[f];
      if (idx !== undefined) {
        const wv = w[idx];
        if (wv !== undefined) s += wv;
      }
    }
    logits[ki] = s;
  }

  const max = Math.max(...logits);
  let sum = 0;
  const exp = logits.map((l) => {
    const e = Math.exp(l - max);
    sum += e;
    return e;
  });

  return exp
    .map((e, i) => ({ intent: model!.intents[i], confidence: e / sum }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}

/** La intención más probable (o null si el modelo no está cargado). */
export function classifyIntent(text: string): IntentPrediction | null {
  return classifyIntentTopK(text, 1)[0] ?? null;
}
