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
const WEIGHT_MIN = 0.05; // pesos más chicos que esto se descartan (modelo liviano)

interface Example {
  feats: number[]; // índices de features presentes (binario)
  label: number;
}

/**
 * RNG con semilla (mulberry32): el entrenamiento es reproducible, así los
 * números de validación se pueden comparar entre días al crecer el dataset.
 */
let seed = 20260714;
function random(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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

function predict(ex: Example, W: Float64Array[], b: Float64Array, K: number): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < K; k++) {
    let s = b[k];
    for (const idx of ex.feats) s += W[k][idx];
    if (s > bestScore) [bestScore, best] = [s, k];
  }
  return best;
}

function accuracy(examples: Example[], W: Float64Array[], b: Float64Array, K: number): number {
  let ok = 0;
  for (const ex of examples) if (predict(ex, W, b, K) === ex.label) ok++;
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

// ─── Validación cruzada (5 folds) + matriz de confusión ──────────
// Cada ejemplo se evalúa exactamente una vez como "no visto": estimación mucho
// más estable que un split único, y la matriz muestra QUÉ intenciones se
// confunden entre sí (dónde conviene agregar frases al dataset).

const FOLDS = 5;
const shuffled = shuffle(all.slice());
const confusion = new Map<string, number>(); // "real→pred" → conteo
const foldAccs: number[] = [];

for (let f = 0; f < FOLDS; f++) {
  const valSet = shuffled.filter((_, i) => i % FOLDS === f);
  const trainSet = shuffled.filter((_, i) => i % FOLDS !== f);
  const m = train(trainSet, K, V);
  let ok = 0;
  for (const ex of valSet) {
    const pred = predict(ex, m.W, m.b, K);
    if (pred === ex.label) ok++;
    else {
      const key = `${intents[ex.label]} → ${intents[pred]}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }
  }
  foldAccs.push(ok / valSet.length);
}

const mean = foldAccs.reduce((a, b) => a + b, 0) / FOLDS;
const std = Math.sqrt(foldAccs.reduce((a, b) => a + (b - mean) ** 2, 0) / FOLDS);
console.log(
  `Validación cruzada (${FOLDS} folds): ${(mean * 100).toFixed(1)}% ± ${(std * 100).toFixed(1)}%  [${foldAccs.map((a) => (a * 100).toFixed(0)).join(', ')}]`,
);
if (confusion.size > 0) {
  console.log('Confusiones (real → predicho):');
  for (const [key, n] of [...confusion.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${n}`);
  }
} else {
  console.log('Confusiones: ninguna 🎉');
}

// ─── Modelo final: entrenar con TODO el dataset y guardar ─────────

const final = train(all, K, V);

const vocabObj: Record<string, number> = {};
for (const [feat, idx] of vocab) vocabObj[feat] = idx;

const weights = final.W.map((row) => {
  const sparse: Record<string, number> = {};
  for (let v = 0; v < V; v++) {
    if (Math.abs(row[v]) >= WEIGHT_MIN) sparse[v] = Math.round(row[v] * 1e4) / 1e4;
  }
  return sparse;
});

// La exactitud se mide con los pesos YA podados/redondeados: es exactamente el
// modelo que va a correr en el navegador, no una versión idealizada.
const prunedW = weights.map((sparse) => {
  const row = new Float64Array(V);
  for (const [idx, w] of Object.entries(sparse)) row[Number(idx)] = w;
  return row;
});
const finalAcc = accuracy(all, prunedW, final.b, K);
console.log(`Modelo final (podado): exactitud sobre todo el dataset ${(finalAcc * 100).toFixed(1)}%`);

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
