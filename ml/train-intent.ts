/**
 * Entrenamiento del clasificador de intención de Export.
 *
 * Modelo: regresión logística multinomial (softmax) sobre features de texto,
 * entrenada con descenso de gradiente estocástico. Sin librerías, sin API:
 * es "nuestro" modelo, chico (pesos en JSON) y corre en el navegador.
 *
 * Uso:  npm run train:intent
 * Lee   ml/intents.json  (dataset etiquetado)
 * Emite src/lib/intentModel.json  (vocabulario + pesos)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { featurize } from '../src/lib/intentFeatures.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.join(HERE, 'intents.json');
const OUT = path.join(HERE, '..', 'src', 'lib', 'intentModel.json');

// Hiperparámetros (juega con estos para ver cómo cambia la exactitud).
const EPOCHS = 400;
const LR = 0.5;
const L2 = 1e-4;
const WEIGHT_MIN = 0.02; // pesos más chicos que esto se descartan (modelo liviano)

interface Example {
  feats: number[]; // índices de features presentes (binario)
  label: number;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / sum);
}

/** Entrena W (K×V) y b (K) sobre los ejemplos dados. */
function train(examples: Example[], K: number, V: number) {
  const W = Array.from({ length: K }, () => new Float64Array(V));
  const b = new Float64Array(K);
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    for (const ex of shuffle(examples.slice())) {
      const logits = new Array(K).fill(0);
      for (let k = 0; k < K; k++) {
        let s = b[k];
        for (const idx of ex.feats) s += W[k][idx];
        logits[k] = s;
      }
      const p = softmax(logits);
      for (let k = 0; k < K; k++) {
        const g = p[k] - (k === ex.label ? 1 : 0);
        b[k] -= LR * g;
        for (const idx of ex.feats) W[k][idx] -= LR * (g + L2 * W[k][idx]);
      }
    }
  }
  return { W, b };
}

function accuracy(examples: Example[], W: Float64Array[], b: Float64Array, K: number): number {
  let ok = 0;
  for (const ex of examples) {
    let best = 0;
    let bestScore = -Infinity;
    for (let k = 0; k < K; k++) {
      let s = b[k];
      for (const idx of ex.feats) s += W[k][idx];
      if (s > bestScore) [bestScore, best] = [s, k];
    }
    if (best === ex.label) ok++;
  }
  return ok / examples.length;
}

// ─── Cargar dataset y construir vocabulario ──────────────────────

const raw = JSON.parse(readFileSync(DATASET, 'utf8')) as Record<string, unknown>;
const intents = Object.keys(raw).filter((k) => Array.isArray(raw[k]));
const vocab = new Map<string, number>();
const all: Example[] = [];

for (let label = 0; label < intents.length; label++) {
  const phrases = raw[intents[label]] as string[];
  for (const phrase of phrases) {
    const idxs = new Set<number>();
    for (const f of featurize(phrase)) {
      let vi = vocab.get(f);
      if (vi === undefined) {
        vi = vocab.size;
        vocab.set(f, vi);
      }
      idxs.add(vi);
    }
    all.push({ feats: [...idxs], label });
  }
}

const K = intents.length;
const V = vocab.size;
console.log(`Dataset: ${all.length} ejemplos · ${K} intenciones · ${V} features`);

// ─── Estimar exactitud con un split de validación ────────────────

const split = shuffle(all.slice());
const cut = Math.max(1, Math.floor(split.length * 0.15));
const valSet = split.slice(0, cut);
const trainSet = split.slice(cut);
const tmp = train(trainSet, K, V);
const valAcc = accuracy(valSet, tmp.W, tmp.b, K);
const trainAcc = accuracy(trainSet, tmp.W, tmp.b, K);
console.log(`Validación: train ${(trainAcc * 100).toFixed(1)}% · val ${(valAcc * 100).toFixed(1)}% (${valSet.length} ejemplos)`);

// ─── Modelo final: entrenar con TODO el dataset y guardar ─────────

const final = train(all, K, V);
const finalAcc = accuracy(all, final.W, final.b, K);
console.log(`Modelo final: exactitud sobre todo el dataset ${(finalAcc * 100).toFixed(1)}%`);

const vocabObj: Record<string, number> = {};
for (const [feat, idx] of vocab) vocabObj[feat] = idx;

const weights = final.W.map((row) => {
  const sparse: Record<string, number> = {};
  for (let v = 0; v < V; v++) {
    if (Math.abs(row[v]) >= WEIGHT_MIN) sparse[v] = Math.round(row[v] * 1e4) / 1e4;
  }
  return sparse;
});

const model = {
  intents,
  vocab: vocabObj,
  bias: Array.from(final.b, (x) => Math.round(x * 1e4) / 1e4),
  weights,
};
writeFileSync(OUT, JSON.stringify(model));
const kb = (Buffer.byteLength(JSON.stringify(model)) / 1024).toFixed(0);
const nz = weights.reduce((a, w) => a + Object.keys(w).length, 0);
console.log(`Guardado en src/lib/intentModel.json (${kb} KB · ${nz} pesos no nulos)`);
