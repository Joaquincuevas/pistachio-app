import type { Course, Plan } from '@/types';
import type { Offering } from './schedule';
import { classifyIntent } from './intentModel';

/**
 * Pistacho IA — motor de lenguaje natural propio (sin API, sin modelos externos).
 * Corre 100% en el navegador: normaliza el texto, detecta la intención por
 * puntaje de patrones y extrae el ramo mencionado con matching difuso.
 * Determinístico y explicable: nunca inventa prerrequisitos ni secciones.
 */

export type Intent =
  | 'recommend'         // "¿qué tomo el próximo semestre?"
  | 'eligible'          // "¿qué puedo tomar?"
  | 'priority'          // "¿qué me conviene priorizar?"
  | 'progress'          // "¿cómo voy?" / "¿cuánto me falta?"
  | 'course_can'        // "¿puedo tomar Hormigón Armado?"
  | 'course_missing'    // "¿qué me falta para tomar X?"
  | 'course_info'       // "¿cuántos créditos tiene X?" / "¿de qué semestre es X?"
  | 'offered'           // "¿se dicta X?" / "¿qué secciones tiene X?"
  | 'course_professor'  // "¿quién es el profesor de X?"
  | 'professor_courses' // "¿qué ramos da el profesor Y?"
  | 'list_electives'    // "¿qué electivos hay?" / "¿qué minors hay?"
  | 'build_schedule'    // "ármame el horario"
  | 'help'              // "¿qué puedes hacer?"
  | 'greeting'
  | 'unknown';

export interface NluResult {
  intent: Intent;
  course: Course | null;
  /** Confianza 0-1 del matching del ramo (si hay). */
  courseScore: number;
  /** Nombre del profesor detectado en el horario oficial (si hay). */
  professor: string | null;
  /** Categoría de cupo consultada ("Electivo", "Minor"…), para list_electives. */
  electiveCategory: string | null;
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
  /** Requiere que se haya detectado un ramo en la frase. */
  needsCourse?: boolean;
  /** Requiere que se haya detectado un profesor del horario oficial. */
  needsProfessor?: boolean;
}

/** Orden importa: la primera regla que calza con mejor especificidad gana. */
const RULES: IntentRule[] = [
  {
    // Va antes que "progress" para que "cuántos créditos tiene X" no se confunda
    // con "cuántos créditos llevo".
    intent: 'course_info',
    patterns: [
      /cuantos? (creditos?|sct)/, /creditos? (de|tiene|vale|son)/, /cuantos? sct/,
      /de que semestre (es|va|son)/, /en que semestre (va|esta|es|se dicta)/,
      /cuantas horas/, /que ramo es/, /informacion (de|del|sobre)/, /(de que|que) trata/,
    ],
    needsCourse: true,
  },
  {
    intent: 'course_missing',
    patterns: [
      /que (me )?falta/, /cuanto (me )?falta para/, /requisitos? (de|para)/, /prerrequisitos?/,
      /por que no puedo/, /que necesito para/, /cadena de/,
    ],
    needsCourse: true,
  },
  {
    intent: 'course_professor',
    patterns: [
      /quien (es |da |dicta |hace |ensena |imparte )?.*(profesor|profe)/, /profesor(a)? (de|del)/,
      /quien (da|dicta|hace|ensena|imparte)/, /con quien (es|se toma)/, /quien lo (dicta|hace)/,
    ],
    needsCourse: true,
  },
  {
    intent: 'offered',
    patterns: [
      /se dicta/, /secciones?/, /horarios? (de|del|tiene)/, /nrc/,
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
    intent: 'professor_courses',
    patterns: [
      /que (ramos|cursos|clases|asignaturas) (da|dicta|hace|tiene|imparte)/, /ramos del (profe|profesor)/,
      /^profe(sor|sora)?\b/, /que (dicta|da|hace|imparte) (el |la )?(profe|profesor)/,
      /clases? (de|del) (profe|profesor)/, /(da|dicta) clases/,
    ],
    needsProfessor: true,
  },
  {
    intent: 'list_electives',
    patterns: [
      /electivos?/, /optativos?/, /\bminors?\b/, /formacion general/, /\bofg\b/,
      /concentracion(es)? tecnologic/, /que menciones/,
    ],
  },
  {
    intent: 'build_schedule',
    patterns: [/arma(me|r)? (el |un |mi )?horario/, /horario sin topes/, /planifica/, /organiza(me)? (el |mi )?(horario|semestre)/],
  },
  {
    intent: 'progress',
    patterns: [
      /como voy/, /cuanto (me )?falta( |$)/, /mi avance/, /cuanto llevo/, /cuantos creditos llevo/,
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

/** Qué categoría de cupo (slot) se está preguntando, según palabras clave. */
function electiveCategoryFor(raw: string): string {
  if (/\bminors?\b/.test(raw)) return 'Minor';
  if (/formacion general|\bofg\b/.test(raw)) return 'Formación General';
  if (/concentracion|tecnologic/.test(raw)) return 'Concentración Tecnológica';
  if (/mencion/.test(raw)) return 'Mención';
  return 'Electivo';
}

// ─── Extracción del profesor (matching difuso sobre el horario) ──

/** Palabras de la pregunta que no aportan al matching de un nombre de profesor. */
const PROF_STOP = new Set([
  'profesor', 'profesora', 'profe', 'ramos', 'ramo', 'cursos', 'curso', 'clases', 'clase',
  'da', 'dicta', 'hace', 'imparte', 'tiene', 'ensena', 'quien', 'quienes', 'es', 'el', 'la',
  'de', 'del', 'los', 'las', 'un', 'una', 'que', 'cuales', 'con', 'asignaturas', 'asignatura',
]);

export interface ProfessorMatch {
  /** Nombre tal cual aparece en el horario oficial. */
  name: string;
  score: number;
}

/**
 * Busca un profesor mencionado en la frase contra los nombres del horario
 * oficial. Los nombres vienen como "APELLIDO/APELLIDO NOMBRE1 NOMBRE2"; se
 * comparan por tokens (apellidos y nombres) con tolerancia a que el alumno
 * escriba solo el apellido o el nombre.
 */
export function extractProfessor(text: string, offering: Offering): ProfessorMatch | null {
  const queryTokens = normalize(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !PROF_STOP.has(t) && !STOPWORDS.has(t));
  if (queryTokens.length === 0) return null;

  const names = new Set<string>();
  for (const s of offering.sections) if (s.professor) names.add(s.professor);

  let best: ProfessorMatch | null = null;
  for (const name of names) {
    const nameTokens = normalize(name).split(' ').filter((t) => t.length >= 2);
    if (nameTokens.length === 0) continue;
    let hits = 0;
    for (const qt of queryTokens) {
      if (nameTokens.some((nt) => nt === qt || (qt.length >= 4 && nt.startsWith(qt)))) hits += 1;
    }
    if (hits === 0) continue;
    // Prioriza más coincidencias y penaliza nombres con muchos tokens sueltos.
    const score = hits + hits / nameTokens.length;
    if (!best || score > best.score) best = { name, score };
  }
  // Al menos un token del nombre debe calzar de forma sólida.
  return best && best.score >= 1 ? best : null;
}

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

/** Intenciones que solo tienen sentido si además se identificó un ramo. */
const NEEDS_COURSE = new Set<Intent>([
  'course_can', 'course_missing', 'course_info', 'offered', 'course_professor',
]);
/** Confianza mínima del modelo para confiar en su predicción. */
const MODEL_THRESHOLD = 0.5;

/** Códigos de ramo en el texto (ioc4101, ing 1201…), para enmascararlos. */
const CODE_RE_GLOBAL = /\b(i[a-zñ]{2}|ing|teo|opt|min|ele|men|ct)\s?\d{1,4}\b/g;

/**
 * Reemplaza en la frase los tokens que calzan con un nombre (de ramo o de
 * profesor) por un token genérico ('ramox' / 'profex'). El dataset de
 * entrenamiento usa esos mismos tokens, así el modelo aprende la FORMA de la
 * pregunta ("cuantos creditos tiene ramox") y generaliza a cualquier ramo.
 * Usa la misma tolerancia a typos/traducciones que extractCourse.
 */
function maskMention(text: string, nameTokens: string[], token: string): string {
  const words = normalize(text).split(' ').filter(Boolean);
  const matchesName = (w: string) =>
    !STOPWORDS.has(w) &&
    nameTokens.some((nt) =>
      variants(w).some(
        (v) => nt === v || (v.length >= 4 && nt.startsWith(v)) || (nt.length >= 4 && v.startsWith(nt)),
      ),
    );
  const out: string[] = [];
  for (const w of words) {
    if (matchesName(w)) {
      // Nombres de varias palabras colapsan en un único token.
      if (out[out.length - 1] !== token) out.push(token);
    } else {
      out.push(w);
    }
  }
  return out.join(' ');
}

export function understand(text: string, plan: Plan, offering?: Offering | null): NluResult {
  const raw = normalize(text);
  const match = extractCourse(text, plan.courses);
  // Solo intentamos un profesor si el ramo no calzó con fuerza (evita que
  // "quién da Hidráulica" se lea como un apellido).
  const prof = offering && (!match || match.score < 0.9) ? extractProfessor(text, offering) : null;

  let detected: Intent = 'unknown';
  for (const rule of RULES) {
    if (rule.needsCourse && !match) continue;
    if (rule.needsProfessor && !prof) continue;
    if (rule.patterns.some((p) => p.test(raw))) {
      detected = rule.intent;
      break;
    }
  }

  // Capa aprendida: si las reglas no reconocieron la frase, consultamos el
  // modelo entrenado (Export). Antes de clasificar se enmascaran las entidades
  // detectadas (ramo → 'ramox', profesor → 'profex'), igual que en el dataset
  // de entrenamiento. Se respetan las condiciones de entidad para no inventar
  // respuestas (p. ej. "cuántos créditos" sin ramo detectado).
  if (detected === 'unknown') {
    let modelText = raw.replace(CODE_RE_GLOBAL, ' ramox ');
    if (match) modelText = maskMention(modelText, tokens(match.course.name), 'ramox');
    if (prof) {
      modelText = maskMention(modelText, normalize(prof.name).split(' ').filter(Boolean), 'profex');
    }
    const pred = classifyIntent(modelText);
    if (pred && pred.confidence >= MODEL_THRESHOLD) {
      const intent = pred.intent as Intent;
      const okCourse = !NEEDS_COURSE.has(intent) || Boolean(match);
      const okProf = intent !== 'professor_courses' || Boolean(prof);
      if (okCourse && okProf) detected = intent;
    }
  }

  // Último recurso cuando nombró algo pero ningún patrón/modelo calzó:
  if (detected === 'unknown') {
    if (match && match.score >= 0.6) detected = 'course_can';
    else if (prof) detected = 'professor_courses';
  }

  return {
    intent: detected,
    course: match?.course ?? null,
    courseScore: match?.score ?? 0,
    professor: prof?.name ?? null,
    electiveCategory: detected === 'list_electives' ? electiveCategoryFor(raw) : null,
  };
}

/** Sugerencias que el asistente ofrece cuando no entiende. */
export const SUGGESTIONS = [
  '¿Qué tomo el próximo semestre?',
  '¿Puedo tomar Hormigón Armado?',
  '¿Cuántos créditos tiene Proyecto de Desarrollo de Software?',
  '¿Quién es el profesor de Hidráulica?',
  '¿Qué ramos da el profesor Ballesteros?',
  '¿Qué electivos hay?',
];
