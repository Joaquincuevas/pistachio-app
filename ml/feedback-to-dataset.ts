/**
 * Ingesta del feedback real de los alumnos al dataset de entrenamiento.
 *
 * Los 👍/👎 que los alumnos dan a las respuestas de Export se guardan en su
 * navegador y se exportan desde Perfil → "Ayuda a mejorar a Export". Este
 * script toma ese JSON y:
 *
 *  - 👍  la intención era correcta → la frase es una etiqueta confiable y se
 *        agrega al dataset (enmascarando el nombre del ramo como 'ramox', igual
 *        que hace la inferencia).
 *  - 👎  la intención era INCORRECTA → no sabemos cuál era la buena, así que no
 *        se puede agregar sola: se listan aparte para que las revises a mano.
 *
 * Uso:  npm run feedback:ingest -- ~/Downloads/export-feedback-2026-07-17.json
 *       npm run train:intent
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalize } from '../src/lib/intentFeatures.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.join(HERE, 'intents.json');
const CATALOG = path.join(HERE, '..', 'server', 'data', 'catalog.json');

interface FeedbackEntry {
  ts: string;
  query: string;
  intent: string;
  helpful: boolean;
}

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run feedback:ingest -- <ruta-al-export-feedback.json>');
  process.exit(1);
}

const feedback = JSON.parse(readFileSync(file, 'utf8')) as FeedbackEntry[];
const dataset = JSON.parse(readFileSync(DATASET, 'utf8')) as Record<string, unknown>;

// ─── Vocabulario de nombres de ramo, para enmascarar ─────────────

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as {
  specialties: { plans: { courses: { name: string }[] }[] }[];
};

// Cuenta en cuántos ramos DISTINTOS aparece cada palabra. Las que aparecen en
// muchos son conectores o genéricos ("para", "de", "proyecto", "ingenieria") y
// enmascararlas destruiría la frase: "me alcanza el tiempo PARA titularme" no
// habla de ningún ramo. Solo enmascaramos palabras distintivas.
const GENERIC_MIN_COURSES = 5;
const nameCount = new Map<string, number>();
const seenNames = new Set<string>();
for (const sp of catalog.specialties) {
  for (const plan of sp.plans) {
    for (const course of plan.courses) {
      if (seenNames.has(course.name)) continue;
      seenNames.add(course.name);
      for (const w of new Set(normalize(course.name).split(' '))) {
        if (w.length >= 4) nameCount.set(w, (nameCount.get(w) ?? 0) + 1);
      }
    }
  }
}
/**
 * Palabras gramaticales que igual aparecen en algún nombre de ramo ("Bases PARA
 * el Estudio…"). Son raras en el catálogo, así que el conteo no las filtra:
 * hay que excluirlas a mano o se destruye la frase del alumno.
 */
const FUNCTION_WORDS = new Set([
  'para', 'pero', 'como', 'cuando', 'donde', 'desde', 'hasta', 'entre', 'sobre', 'segun',
  'este', 'esta', 'estos', 'estas', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas',
  'otro', 'otra', 'cada', 'algun', 'alguna', 'mucho', 'mucha', 'poco', 'poca', 'tanto',
  'muy', 'mas', 'menos', 'bien', 'solo', 'aqui', 'alli', 'ahora', 'antes', 'despues',
]);

const courseWords = new Set(
  [...nameCount.entries()]
    .filter(([w, n]) => n < GENERIC_MIN_COURSES && !FUNCTION_WORDS.has(w))
    .map(([w]) => w),
);

/** Sustituye las palabras que son nombre de ramo por el token 'ramox'. */
function mask(text: string): string {
  const out: string[] = [];
  for (const w of normalize(text).split(' ').filter(Boolean)) {
    if (courseWords.has(w)) {
      if (out[out.length - 1] !== 'ramox') out.push('ramox');
    } else {
      out.push(w);
    }
  }
  return out.join(' ');
}

// ─── Ingesta ─────────────────────────────────────────────────────

const existing = new Set<string>();
for (const [intent, phrases] of Object.entries(dataset)) {
  if (Array.isArray(phrases)) for (const p of phrases) existing.add(`${intent}::${normalize(p)}`);
}

const added: { intent: string; phrase: string }[] = [];
const triage: FeedbackEntry[] = [];
let skipped = 0;

for (const entry of feedback) {
  if (!entry.query || !entry.intent) continue;
  if (!entry.helpful) {
    triage.push(entry);
    continue;
  }
  const phrase = mask(entry.query);
  const key = `${entry.intent}::${phrase}`;
  if (!phrase || existing.has(key)) {
    skipped++;
    continue;
  }
  if (!Array.isArray(dataset[entry.intent])) {
    console.warn(`  (intención desconocida en el dataset: ${entry.intent})`);
    continue;
  }
  (dataset[entry.intent] as string[]).push(phrase);
  existing.add(key);
  added.push({ intent: entry.intent, phrase });
}

if (added.length > 0) {
  writeFileSync(DATASET, `${JSON.stringify(dataset, null, 2)}\n`);
}

console.log(`Feedback leído: ${feedback.length} registros`);
console.log(`Agregadas al dataset: ${added.length}${skipped > 0 ? ` (${skipped} ya existían)` : ''}`);
for (const a of added) console.log(`  + [${a.intent}] ${a.phrase}`);

if (triage.length > 0) {
  console.log(`\nPara revisar a mano (👎, la intención fue incorrecta): ${triage.length}`);
  for (const t of triage) {
    console.log(`  ? "${t.query}"  → respondió '${t.intent}'  (enmascarada: "${mask(t.query)}")`);
  }
  console.log('\nAgrega estas frases a ml/intents.json bajo la intención CORRECTA y reentrena.');
}
if (added.length > 0) console.log('\nAhora corre: npm run train:intent');
