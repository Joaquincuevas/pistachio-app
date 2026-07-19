# Export — el asistente de Pistachio

**Export** es el asistente de malla de Pistachio: ayuda a los alumnos a decidir
qué ramos tomar, cruzando su avance en la malla con los prerrequisitos y con el
horario oficial de la Facultad. Corre **100 % en el navegador**, sin API ni
servicios de IA externos: la "inteligencia" es un motor de reglas determinístico
+ un **modelo de clasificación entrenado por nosotros**. Nunca inventa datos
(prerrequisitos, secciones, profesores): si no sabe algo, lo dice.

Ruta en la app: `/asistente` · UI en [`src/pages/Advisor.tsx`](../src/pages/Advisor.tsx).

---

## 1. Cómo entiende una pregunta (arquitectura)

Cada mensaje pasa por `understand(text, plan, offering)` en
[`src/lib/nlu.ts`](../src/lib/nlu.ts), que combina **tres piezas**:

```
                          texto del alumno
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                         ▼
  Extracción de entidad    Motor de reglas          Modelo entrenado
  (ramo / profesor)        (regex por intención)    (clasificador)
        │                        │                         │
        └───────────► decisión híbrida de INTENCIÓN ◄──────┘
                                 │
                                 ▼
                    respuesta (answer* en Advisor.tsx)
```

1. **Extracción de entidad (determinística).** Detecta si la frase nombra un
   ramo (`extractCourse`: por código, nombre exacto o solapamiento difuso de
   tokens con tolerancia a typos y diccionario ES→EN) o un profesor
   (`extractProfessor`: matching por apellido/nombre contra el horario oficial).

2. **Motor de reglas (alta precisión).** Una lista ordenada de patrones regex
   por intención (`RULES`). La primera regla que calza gana. Es rápido y
   explicable para las formas de preguntar que ya conocemos.

3. **Modelo entrenado (cobertura).** Si las reglas **no** reconocen la frase,
   entra el clasificador entrenado (ver §2). Solo se le hace caso si su
   confianza ≥ `0.5` y se respetan las entidades (p. ej. no responde "cuántos
   créditos" si no se detectó ningún ramo).

Esta capa híbrida es **aditiva**: el comportamiento conocido no cambia, y el
modelo solo rellena los huecos que las reglas no cubren.

### Intenciones que reconoce

| Intención           | Ejemplo                                            |
|---------------------|----------------------------------------------------|
| `recommend`         | "¿Qué tomo el próximo semestre?"                   |
| `eligible`          | "¿Qué ramos ya puedo tomar?"                       |
| `priority`          | "¿Qué me conviene priorizar?"                      |
| `progress`          | "¿Cómo voy?" / "¿Cuántos créditos llevo?"          |
| `course_can`        | "¿Puedo tomar Hormigón Armado?"                    |
| `course_missing`    | "¿Qué me falta para Hidráulica?"                   |
| `course_info`       | "¿Cuántos créditos tiene Proyecto de Software?"    |
| `offered`           | "¿Qué secciones/NRC tiene ese ramo?"               |
| `course_professor`  | "¿Quién es el profesor de Hidráulica?"             |
| `professor_courses` | "¿Qué ramos da el profesor Ballesteros?"           |
| `list_electives`    | "¿Qué electivos / minors / OFG hay?"               |
| `build_schedule`    | "Ármame el horario"                                |
| `help`              | "¿Qué puedes hacer?"                               |
| `greeting`          | "Hola"                                             |

---

## 2. El modelo entrenado (sin API)

Es un **clasificador de intención**: dada una frase, predice cuál de las 14
intenciones es. No es un LLM: es **regresión logística multinomial** (softmax),
entrenada con **descenso de gradiente estocástico**, en JavaScript puro. El
modelo es "nuestro" —lo entrenamos con nuestros datos— y es chico, rápido y
100 % offline.

### Piezas

| Archivo | Rol |
|---------|-----|
| [`ml/intents.json`](../ml/intents.json) | **Dataset**: frases de ejemplo etiquetadas por intención. Crece a diario. |
| [`ml/train-intent.ts`](../ml/train-intent.ts) | **Entrenamiento**: SGD, reporta exactitud y emite los pesos. |
| [`src/lib/intentFeatures.ts`](../src/lib/intentFeatures.ts) | **Featurizador** compartido (n-gramas de palabras). *El mismo código en entrenamiento e inferencia.* |
| [`src/lib/intentModel.json`](../src/lib/intentModel.json) | **Pesos** del modelo (vocabulario + matriz dispersa). Generado por el trainer. |
| [`src/lib/intentModel.ts`](../src/lib/intentModel.ts) | **Inferencia** en el navegador (carga diferida, softmax). |

### Cómo funciona por dentro

- **Features:** cada frase se normaliza (minúsculas, sin tildes) y se convierte
  en unigramas y bigramas de palabras, con marcadores de inicio/fin. Así el
  modelo aprende expresiones clave ("cuantos creditos", "que ramos da", "puedo
  tomar") sin explotar el tamaño del vocabulario.
- **Enmascaramiento de entidades:** en el dataset, los nombres de ramo se
  escriben como el token `ramox` y los de profesor como `profex`. En inferencia,
  `nlu.ts` reemplaza el ramo/profesor detectado por esos mismos tokens antes de
  clasificar. Resultado: el modelo aprende la **forma** de la pregunta
  ("cuanto pesa ramox") y generaliza a cualquier ramo, en vez de memorizar
  nombres puntuales.
- **Modelo:** una matriz de pesos `W` (intención × feature) + sesgo `b`. Para
  una frase: `logit[k] = b[k] + Σ W[k][feature]`, luego `softmax` → probabilidad
  por intención → gana la más alta.
- **Entrenamiento:** para cada ejemplo se calcula el gradiente
  `(predicción − real)` y se ajustan los pesos (con regularización L2). Se
  repite `EPOCHS` veces sobre el dataset barajado. El RNG tiene semilla fija:
  correr dos veces da exactamente los mismos números (métricas comparables
  entre días).
- **Evaluación:** validación cruzada de 5 folds (cada ejemplo se evalúa una vez
  como "no visto") + reporte de confusiones `real → predicho`, que dice
  exactamente dónde agregar frases. La exactitud final se mide con los pesos
  **ya podados/redondeados** — el modelo real que corre en el navegador.
- **Tamaño:** los pesos casi nulos se descartan (almacenamiento disperso) y se
  redondean. Hoy: ~126 KB (~43 KB gzip), cargado como **chunk aparte** para no
  engordar el bundle inicial.

### Baseline actual

| Día | Ejemplos | Features | Validación (5-fold CV) |
|-----|----------|----------|------------------------|
| 1   | 134      | 623      | ~75 % (split único de 20 ej., poco confiable) |
| 2   | 412      | 1426     | 82.0 % ± 2.7 % + enmascaramiento de entidades |
| 3   | 477      | 2411     | **88.9 % ± 3.4 %** + trigramas de caracteres (typos) |

Confusiones típicas hoy: `recommend ↔ eligible`, `offered → course_info`,
`priority → recommend` — intenciones semánticamente vecinas; se mejoran con
más frases que marquen la diferencia.

### Memoria conversacional

Export recuerda el último ramo/profesor del que se habló, así que se puede
conversar sin repetir el nombre:

> — ¿Puedo tomar Hidráulica?
> — Aún no puedes tomar **Hidráulica**: te falta Fluid Mechanics.
> — ¿Y cuántos créditos tiene?
> — **Hidráulica** (IOC4103) tiene 6 SCT…
> — ¿Qué me falta para ese ramo?
> — Para tomar **Hidráulica** te faltan 10 ramos…

`understand()` hace dos pasadas: la normal (entidades explícitas en la frase) y,
si queda `unknown`, una segunda usando la entidad recordada. La segunda solo se
acepta si resuelve una intención que **de verdad necesita** esa entidad — por
eso "cuánto me falta para titularme" sigue respondiendo tu avance y no el ramo
anterior, y sin contexto previo "¿y cuántos créditos tiene?" pregunta en vez de
inventar.

### Cuando el modelo duda, pregunta

Si ninguna intención supera el umbral de confianza (0.5), Export **no adivina**:
muestra "¿Te refieres a algo de esto?" con las hipótesis del modelo como chips
accionables (filtradas por entidades — no ofrece "créditos de un ramo" si no
detectó ningún ramo). Elegir un chip ejecuta la intención al tiro.

### Feedback 👍/👎 (recolección de datos reales)

Cada respuesta lleva pulgares. Al calificar se guarda
`{ts, query, intent, helpful}` en `localStorage` bajo la clave
`pistachio:export-feedback` (tope 300 registros, solo en el dispositivo del
alumno — nada viaja al servidor). Para cosecharlo y crecer el dataset:

```js
// En la consola del navegador (DevTools):
copy(localStorage.getItem('pistachio:export-feedback'))
```

Los `helpful: false` son frases mal entendidas → agrégalas a `ml/intents.json`
con su intención correcta y reentrena.

---

## 3. El loop diario (cómo mejorar a Export)

El proyecto está pensado para avanzar **un poco cada día**:

```bash
# 1. Agrega frases nuevas y variadas a ml/intents.json
#    (así como las escribiría un alumno de verdad)

# 2. Reentrena y mira si sube la exactitud
npm run train:intent

# 3. Prueba en el navegador (npm run dev) y commitea
git add ml/intents.json src/lib/intentModel.json && git commit
```

Mientras más ejemplos y más naturales, mejor generaliza el modelo.

---

## 4. De la intención a la respuesta

Una vez decidida la intención, `Advisor.tsx` llama a la función `answer*`
correspondiente, que se apoya en dos motores determinísticos:

- **Motor de reglas de la malla** ([`src/lib/advisor.ts`](../src/lib/advisor.ts)):
  `analyzePlan` calcula, para cada ramo, si es elegible (pendiente + se dicta +
  créditos suficientes + prerrequisitos cumplidos, incluyendo concurrentes),
  cuántos ramos desbloquea, y arma una carga recomendada priorizando la ruta
  crítica.
- **Horario oficial** ([`src/lib/schedule.ts`](../src/lib/schedule.ts)): el
  Excel que la Facultad publica en Canvas, parseado en el navegador (SheetJS).
  De ahí salen secciones, NRC, horarios, profesores y la detección de topes
  para armar un horario sin conflictos.

Así, "¿qué tomo?" con el horario cargado devuelve una carga real **con NRC y
horario sin topes**, y "¿quién da X?" lee el profesor directamente del Excel.

---

## 5. Datos y privacidad

- **Malla y prerrequisitos:** catálogo oficial (Plan de Estudios 2022) en la
  base de datos; el asistente lo recibe vía `/api/catalog`.
- **Horario:** lo sube el propio alumno; se procesa **solo en su navegador** y
  se guarda en `localStorage`. No viaja a ningún servidor.
- **Modelo:** los pesos son estáticos y públicos; la inferencia es local. Export
  no envía las preguntas del alumno a ningún lado.

---

## 6. Roadmap

**Del modelo**
1. ~~Crecer el dataset~~ ✅ Día 2: 134 → 412 · Día 3: → 477 (dirigido a confusiones).
2. ~~Enmascarar nombres de ramo/profesor~~ ✅ Día 2: tokens `ramox`/`profex`.
3. ~~Matriz de confusión~~ ✅ Día 2: 5-fold CV + reporte de confusiones.
4. ~~Feedback 👍/👎 por respuesta~~ ✅ Día 3: se guarda en localStorage para reentrenar.
5. ~~Pregunta aclaratoria cuando la confianza es baja~~ ✅ Día 3: chips accionables.
6. ~~Trigramas de caracteres~~ ✅ Día 3: CV 83.4 % → 88.9 %.
7. Reentrenar con el feedback recolectado (cerrar el ciclo con datos reales).
8. ~~Memoria de conversación~~ ✅ Día 4: recuerda el último ramo/profesor.

**Funciones nuevas**
- 🎓 Ruta a titularte: planificador multi-semestre completo (ruta crítica del
  grafo de prerrequisitos).
- 🔀 "¿Qué pasa si repruebo X?" — replanificación.
- ⚖️ Comparador de menciones.
- 📅 Analítica del horario ("días libres", horario más liviano, 3 opciones).
- 🏆 Optimizador del orden de ramos para titularse antes.

---

*Documenta la branch `feat/export-ml`. El asistente en producción (main) ya
cruza malla + horario; el clasificador entrenado es el paso siguiente.*
