import type { Course, Plan } from '@/types';

/**
 * Pistacho IA — motor de lenguaje natural propio (sin API, sin modelos externos).
 * Corre 100% en el navegador: normaliza el texto, detecta la intención por
 * puntaje de patrones y extrae el ramo mencionado con matching difuso.
 * Determinístico y explicable: nunca inventa prerrequisitos ni secciones.
 */

export type Intent =
  | 'recommend'      // "¿qué tomo el próximo semestre?"
  | 'eligible'       // "¿qué puedo tomar?"
  | 'priority'       // "¿qué me conviene priorizar?"
  | 'progress'       // "¿cómo voy?" / "¿cuánto me falta?"
  | 'course_can'     // "¿puedo tomar Hormigón Armado?"
  | 'course_missing' // "¿qué me falta para tomar X?"
  | 'offered'        // "¿se dicta X?" / "¿qué secciones tiene X?"
  | 'build_schedule' // "ármame el horario"
  | 'help'           // "¿qué puedes hacer?"
  | 'greeting'
  | 'unknown';

export interface NluResult {
  intent: Intent;
  course: Course | null;
  /** Confianza 0-1 del matching del ramo (si hay). */
  courseScore: number;
}

/** Minúsculas, sin tildes, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras vacías del dominio: no aportan al matching de nombres de ramos. */
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'y', 'o', 'en',
  'que', 'cual', 'cuales', 'como', 'para', 'por', 'con', 'sin', 'mi', 'me', 'se',
  'puedo', 'tomar', 'cursar', 'hacer', 'inscribir', 'ramo', 'ramos', 'curso',
  'cursos', 'semestre', 'proximo', 'este', 'falta', 'faltan', 'necesito', 'quiero',
  'dicta', 'dictan', 'ofrece', 'hay', 'tiene', 'tienen', 'es', 'si', 'no', 'ya',
]);

const tokens = (text: string) => normalize(text).split(' ').filter((t) => t && !STOPWORDS.has(t));

/**
 * Varios ramos del catálogo tienen nombre en inglés (Dynamics of Structures,
 * Fluid Mechanics…). Este diccionario traduce los tokens de la pregunta en
 * español para que igual calcen.
 */
const ES_EN: Record<string, string[]> = {
  dinamica: ['dynamics'],
  estructuras: ['structures'],
  fluidos: ['fluid', 'fluids'],
  mecanica: ['mechanics'],
  costos: ['cost'],
  costo: ['cost'],
  ingenieria: ['engineering'],
  elementos: ['elements'],
  finitos: ['finite'],
  logistica: ['logistics'],
  practica: ['practice'],
  profesional: ['professional'],
  preprofesional: ['pre'],
  aprendizaje: ['learning'],
  profundo: ['deep'],
  redes: ['web'],
  tecnologias: ['technologies'],
  analitica: ['analytics'],
  negocios: ['business'],
  inteligencia: ['intelligence'],
  artificial: ['artificial'],
};

/** Variantes de un token de la pregunta: él mismo + sus traducciones. */
const variants = (qt: string): string[] => [qt, ...(ES_EN[qt] ?? [])];

// ─── Detección de intención ──────────────────────────────────────

interface IntentRule {
  intent: Intent;
  patterns: RegExp[];
  /** Requiere (o excluye) que se haya detectado un ramo en la frase. */
  needsCourse?: boolean;
}

/** Orden importa: la primera regla que calza con mejor especificidad gana. */
const RULES: IntentRule[] = [
  {
    intent: 'course_missing',
    patterns: [
      /que (me )?falta/, /cuanto (me )?falta para/, /requisitos? (de|para)/, /prerrequisitos?/,
      /por que no puedo/, /que necesito para/, /cadena de/,
    ],
    needsCourse: true,
  },
  {
    intent: 'offered',
    patterns: [
      /se dicta/, /secciones?/, /horarios? (de|del|tiene)/, /nrc/, /profesor/, /profe/,
      /cuando (se )?(dicta|hace|es)/, /(se )?ofrece/, /a que hora/, /que dia/, /en que dia/,
      /que sala/, /donde (es|se hace|lo hacen)/,
    ],
    needsCourse: true,
  },
  {
    intent: 'course_can',
    patterns: [
      /puedo (tomar|cursar|inscribir|hacer|meter)/, /me deja/, /estoy habilitado/, /cumplo/,
      /me sirve/, /alcanzo a (tomar|cursar)/, /califico/, /soy elegible/, /podria tomar/,
    ],
    needsCourse: true,
  },
  {
    intent: 'build_schedule',
    patterns: [/arma(me|r)? (el |un |mi )?horario/, /horario sin topes/, /planifica/, /organiza(me)? (el |mi )?(horario|semestre)/],
  },
  {
    intent: 'progress',
    patterns: [
      /como voy/, /cuanto (me )?falta( |$)/, /mi avance/, /cuanto llevo/, /cuantos creditos/,
      /me falta para (terminar|titular|egresar|recibir|graduar)/, /porcentaje/, /voy bien/,
      /cuantos ramos (llevo|me quedan)/,
    ],
  },
  {
    intent: 'priority',
    patterns: [/prioriza/, /conviene/, /mas importante/, /(que|cual) (tomo )?primero/, /critico/, /desbloquea/, /destraba/, /clave/],
  },
  {
    intent: 'recommend',
    patterns: [
      /que (tomo|deberia|me recomiendas|inscribo|ramos tomo)/, /recomienda/, /sugiere/, /sugerencia/,
      /arma(me)? (la |una )?carga/, /cuales tomo/, /toma de ramos/, /que me conviene tomar/,
      /que ramos (me convienen|tomar)/, /carga (academica|de ramos)/,
    ],
  },
  {
    intent: 'eligible',
    patterns: [
      /que puedo (tomar|cursar|inscribir)/, /que ramos puedo/, /disponibles/, /habilitad/,
      /opciones/, /puedo tomar$/, /para cuales (cumplo|tengo)/, /desbloquead/,
    ],
  },
  {
    intent: 'help',
    patterns: [
      /que puedes hacer/, /en que (me )?puedes ayudar/, /^ayuda$/, /para que sirves/,
      /que sabes hacer/, /como (te )?(uso|funcionas)/, /que me puedes decir/,
    ],
  },
  {
    intent: 'greeting',
    patterns: [/^(hola|buenas|hey|que tal|hello|holi|holaa+)( .*)?$/, /^(gracias|genial|ok|dale|ya|perfecto|bacan)( .*)?$/],
  },
];

// ─── Extracción del ramo (matching difuso) ───────────────────────

interface CourseMatch {
  course: Course;
  score: number;
}

/**
 * Busca el ramo mencionado en la frase. Estrategia por capas:
 * 1) código exacto (IOC4101, ing1201…), 2) nombre contenido, 3) solapamiento
 * de tokens (permite "hormigon" → "Hormigón Armado", errores menores de tipeo).
 */
export function extractCourse(text: string, courses: Course[]): CourseMatch | null {
  const raw = normalize(text);

  // Capa 1: código explícito.
  const codeMatch = raw.match(/\b(i[a-zñ]{2}|ing|teo|opt|min|ele|men|ct)\s?(\d{1,4})\b/);
  if (codeMatch) {
    const code = (codeMatch[1] + codeMatch[2]).toUpperCase();
    const exact = courses.find((c) => c.id.toUpperCase() === code);
    if (exact) return { course: exact, score: 1 };
  }

  const queryTokens = tokens(text);
  if (queryTokens.length === 0) return null;

  let best: CourseMatch | null = null;
  for (const course of courses) {
    const nameNorm = normalize(course.name);
    const nameTokens = tokens(course.name);
    if (nameTokens.length === 0) continue;

    // Capa 2: el nombre completo aparece en la frase.
    if (raw.includes(nameNorm)) {
      const score = 0.95 + Math.min(0.05, nameNorm.length / 400);
      if (!best || score > best.score) best = { course, score };
      continue;
    }

    // Capa 3: solapamiento de tokens con tolerancia a typos (prefijos) y
    // traducción ES→EN para los ramos con nombre en inglés.
    let hits = 0;
    for (const nt of nameTokens) {
      const hit = queryTokens.some((raw) =>
        variants(raw).some(
          (qt) => nt === qt || (qt.length >= 4 && nt.startsWith(qt)) || (nt.length >= 4 && qt.startsWith(nt)),
        ),
      );
      if (hit) hits += 1;
    }
    if (hits === 0) continue;
    // Cobertura del nombre + un empujón si el usuario no escribió mucho más.
    const coverage = hits / nameTokens.length;
    const precision = hits / queryTokens.length;
    const score = coverage * 0.7 + precision * 0.3;
    if (score >= 0.45 && (!best || score > best.score)) best = { course, score };
  }
  return best;
}

// ─── Análisis completo de la frase ───────────────────────────────

export function understand(text: string, plan: Plan): NluResult {
  const raw = normalize(text);
  const match = extractCourse(text, plan.courses);

  let detected: Intent = 'unknown';
  for (const rule of RULES) {
    if (rule.needsCourse && !match) continue;
    if (rule.patterns.some((p) => p.test(raw))) {
      detected = rule.intent;
      break;
    }
  }

  // Si nombró un ramo pero ningún patrón calzó, lo más útil es el veredicto.
  if (detected === 'unknown' && match && match.score >= 0.6) {
    detected = 'course_can';
  }

  return { intent: detected, course: match?.course ?? null, courseScore: match?.score ?? 0 };
}

/** Sugerencias que el asistente ofrece cuando no entiende. */
export const SUGGESTIONS = [
  '¿Qué tomo el próximo semestre?',
  '¿Puedo tomar Hormigón Armado?',
  '¿Qué me falta para Proyecto de Titulo 1?',
  '¿Cómo voy?',
];
