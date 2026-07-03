import type { Course, Specialty } from '@/types';

/**
 * Malla curricular mockeada de Ingeniería Civil U. Andes.
 * Los semestres 1-4 corresponden al plan común, compartido por las cinco
 * especialidades; los semestres 5-10 son propios de cada mención.
 */

const PLAN_COMUN: Course[] = [
  // ── Semestre 1 ──────────────────────────────────────────────
  {
    id: 'MAT1101',
    name: 'Cálculo I',
    semester: 1,
    credits: 8,
    prerequisites: [],
    description:
      'Estudio de funciones reales de una variable: límites, continuidad, derivadas e introducción a la integral, con énfasis en aplicaciones a problemas de ingeniería.',
    objectives: [
      'Calcular límites y derivadas de funciones de una variable',
      'Aplicar la derivada a problemas de optimización y razón de cambio',
      'Comprender la integral definida y el Teorema Fundamental del Cálculo',
    ],
  },
  {
    id: 'MAT1102',
    name: 'Álgebra Lineal',
    semester: 1,
    credits: 6,
    prerequisites: [],
    description:
      'Sistemas de ecuaciones lineales, matrices y determinantes, espacios vectoriales, transformaciones lineales, valores y vectores propios.',
    objectives: [
      'Resolver sistemas de ecuaciones lineales mediante métodos matriciales',
      'Operar con espacios vectoriales y transformaciones lineales',
      'Diagonalizar matrices y aplicar valores propios a problemas concretos',
    ],
  },
  {
    id: 'QIM1101',
    name: 'Química General',
    semester: 1,
    credits: 6,
    prerequisites: [],
    description:
      'Fundamentos de la química moderna: estructura atómica, enlace químico, estequiometría, estados de la materia, termoquímica y equilibrio.',
    objectives: [
      'Explicar la estructura de la materia a nivel atómico y molecular',
      'Resolver problemas de estequiometría y equilibrio químico',
      'Relacionar propiedades macroscópicas con la estructura molecular',
    ],
  },
  {
    id: 'ING1101',
    name: 'Introducción a la Ingeniería',
    semester: 1,
    credits: 4,
    prerequisites: [],
    description:
      'Panorama de la profesión y sus especialidades. Desarrollo de un proyecto introductorio en equipo aplicando metodologías de diseño en ingeniería.',
    objectives: [
      'Conocer el rol del ingeniero civil y sus áreas de desempeño',
      'Aplicar el proceso de diseño en un proyecto simple en equipo',
      'Comunicar resultados técnicos de forma oral y escrita',
    ],
  },
  {
    id: 'ANT1101',
    name: 'Antropología: Persona y Cultura',
    semester: 1,
    credits: 4,
    prerequisites: [],
    description:
      'Curso del ciclo de formación general que aborda las grandes preguntas sobre la persona humana, su libertad, su dignidad y su vida en sociedad.',
    objectives: [
      'Reflexionar críticamente sobre la naturaleza de la persona humana',
      'Analizar textos clásicos y contemporáneos de antropología filosófica',
      'Argumentar por escrito con rigor sobre preguntas fundamentales',
    ],
  },

  // ── Semestre 2 ──────────────────────────────────────────────
  {
    id: 'MAT1201',
    name: 'Cálculo II',
    semester: 2,
    credits: 8,
    prerequisites: ['MAT1101'],
    description:
      'Técnicas de integración y sus aplicaciones geométricas y físicas, integrales impropias, sucesiones y series numéricas y de potencias.',
    objectives: [
      'Dominar las técnicas de integración de funciones de una variable',
      'Aplicar la integral a cálculo de áreas, volúmenes y trabajo',
      'Analizar la convergencia de sucesiones y series',
    ],
  },
  {
    id: 'FIS1201',
    name: 'Física I: Mecánica',
    semester: 2,
    credits: 8,
    prerequisites: ['MAT1101'],
    description:
      'Cinemática y dinámica de partículas y cuerpos rígidos, leyes de Newton, trabajo y energía, momentum lineal y angular, y oscilaciones.',
    objectives: [
      'Modelar el movimiento de partículas usando las leyes de Newton',
      'Aplicar principios de conservación de energía y momentum',
      'Resolver problemas de dinámica rotacional y oscilaciones',
    ],
  },
  {
    id: 'ING1201',
    name: 'Fundamentos de Programación',
    semester: 2,
    credits: 6,
    prerequisites: [],
    description:
      'Introducción a la programación con Python: tipos de datos, estructuras de control, funciones, listas y diccionarios, y resolución algorítmica de problemas.',
    objectives: [
      'Diseñar algoritmos para resolver problemas de ingeniería',
      'Implementar programas correctos y legibles en Python',
      'Descomponer problemas complejos en funciones reutilizables',
    ],
  },
  {
    id: 'FGE1201',
    name: 'Formación General: Grandes Libros',
    semester: 2,
    credits: 4,
    prerequisites: [],
    description:
      'Seminario de lectura y discusión de obras fundamentales del pensamiento occidental, orientado a desarrollar juicio crítico y capacidad de diálogo.',
    objectives: [
      'Leer comprensivamente obras clásicas del canon occidental',
      'Participar en discusiones argumentadas de tipo socrático',
      'Escribir ensayos breves con tesis y evidencia textual',
    ],
  },

  // ── Semestre 3 ──────────────────────────────────────────────
  {
    id: 'MAT1301',
    name: 'Cálculo III',
    semester: 3,
    credits: 6,
    prerequisites: ['MAT1201'],
    description:
      'Cálculo en varias variables: derivadas parciales, gradiente, optimización con restricciones, integrales múltiples y cálculo vectorial.',
    objectives: [
      'Analizar funciones de varias variables y sus derivadas parciales',
      'Resolver problemas de optimización multivariable',
      'Calcular integrales dobles, triples y de línea',
    ],
  },
  {
    id: 'MAT1302',
    name: 'Ecuaciones Diferenciales',
    semester: 3,
    credits: 6,
    prerequisites: ['MAT1201', 'MAT1102'],
    description:
      'Ecuaciones diferenciales ordinarias de primer y segundo orden, sistemas lineales, transformada de Laplace y aplicaciones a modelos físicos.',
    objectives: [
      'Resolver EDO lineales y no lineales de primer y segundo orden',
      'Modelar fenómenos físicos mediante ecuaciones diferenciales',
      'Aplicar la transformada de Laplace a problemas de valor inicial',
    ],
  },
  {
    id: 'FIS1301',
    name: 'Física II: Electricidad y Magnetismo',
    semester: 3,
    credits: 8,
    prerequisites: ['FIS1201', 'MAT1201'],
    description:
      'Electrostática, potencial eléctrico, circuitos de corriente continua, campos magnéticos, inducción electromagnética y ecuaciones de Maxwell.',
    objectives: [
      'Calcular campos eléctricos y magnéticos en configuraciones simples',
      'Analizar circuitos de corriente continua y transientes RC',
      'Comprender la inducción electromagnética y sus aplicaciones',
    ],
  },
  {
    id: 'ING1301',
    name: 'Termodinámica',
    semester: 3,
    credits: 6,
    prerequisites: ['FIS1201', 'MAT1201'],
    description:
      'Primera y segunda ley de la termodinámica, propiedades de sustancias puras, ciclos de potencia y refrigeración, y análisis de entropía.',
    objectives: [
      'Aplicar la primera ley a sistemas cerrados y volúmenes de control',
      'Evaluar propiedades termodinámicas de sustancias puras',
      'Analizar ciclos termodinámicos y su eficiencia',
    ],
  },
  {
    id: 'ETI1301',
    name: 'Ética',
    semester: 3,
    credits: 4,
    prerequisites: ['ANT1101'],
    description:
      'Fundamentos de la ética filosófica y su aplicación al ejercicio profesional: bien, virtud, normas y dilemas éticos en ingeniería.',
    objectives: [
      'Distinguir las principales tradiciones de la filosofía moral',
      'Analizar dilemas éticos propios del ejercicio de la ingeniería',
      'Fundamentar juicios morales con argumentos rigurosos',
    ],
  },

  // ── Semestre 4 ──────────────────────────────────────────────
  {
    id: 'MAT1401',
    name: 'Probabilidad y Estadística',
    semester: 4,
    credits: 6,
    prerequisites: ['MAT1301'],
    description:
      'Probabilidad, variables aleatorias discretas y continuas, distribuciones clásicas, estimación, intervalos de confianza y pruebas de hipótesis.',
    objectives: [
      'Modelar fenómenos aleatorios con distribuciones de probabilidad',
      'Construir estimadores e intervalos de confianza',
      'Aplicar pruebas de hipótesis a datos experimentales',
    ],
  },
  {
    id: 'ING1401',
    name: 'Mecánica de Fluidos',
    semester: 4,
    credits: 6,
    prerequisites: ['FIS1201', 'MAT1301'],
    description:
      'Estática de fluidos, ecuaciones de conservación, ecuación de Bernoulli, flujo viscoso en tuberías y análisis dimensional.',
    objectives: [
      'Aplicar las ecuaciones de conservación a flujos incompresibles',
      'Calcular pérdidas de carga en sistemas de tuberías',
      'Usar análisis dimensional para escalar modelos experimentales',
    ],
  },
  {
    id: 'ING1402',
    name: 'Ciencia de los Materiales',
    semester: 4,
    credits: 6,
    prerequisites: ['QIM1101'],
    description:
      'Estructura interna de los materiales y su relación con las propiedades mecánicas, térmicas y eléctricas de metales, polímeros, cerámicos y compuestos.',
    objectives: [
      'Relacionar microestructura con propiedades macroscópicas',
      'Interpretar diagramas de fase y tratamientos térmicos',
      'Seleccionar materiales según requerimientos de diseño',
    ],
  },
  {
    id: 'ING1403',
    name: 'Métodos Numéricos',
    semester: 4,
    credits: 6,
    prerequisites: ['ING1201', 'MAT1302'],
    description:
      'Resolución computacional de problemas matemáticos: raíces de ecuaciones, sistemas lineales, interpolación, integración numérica y EDO.',
    objectives: [
      'Implementar métodos numéricos clásicos en Python',
      'Analizar el error y la estabilidad de los algoritmos',
      'Resolver numéricamente ecuaciones diferenciales de ingeniería',
    ],
  },
  {
    id: 'ECO1401',
    name: 'Introducción a la Economía',
    semester: 4,
    credits: 4,
    prerequisites: [],
    description:
      'Conceptos fundamentales de micro y macroeconomía: oferta y demanda, mercados, indicadores macroeconómicos y política económica.',
    objectives: [
      'Analizar el funcionamiento de los mercados competitivos',
      'Interpretar los principales indicadores macroeconómicos',
      'Evaluar el impacto de políticas económicas en decisiones de ingeniería',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Especialidad: Obras Civiles
// ═══════════════════════════════════════════════════════════════

const OBRAS_CIVILES: Course[] = [
  {
    id: 'OBC2501',
    name: 'Estática',
    semester: 5,
    credits: 6,
    prerequisites: ['FIS1201', 'MAT1301'],
    description:
      'Equilibrio de partículas y cuerpos rígidos, análisis de reticulados, vigas y marcos, fuerzas internas, centroides y momentos de inercia.',
    objectives: [
      'Determinar reacciones y fuerzas internas en estructuras isostáticas',
      'Analizar reticulados por métodos de nodos y secciones',
      'Trazar diagramas de esfuerzo de corte y momento flector',
    ],
  },
  {
    id: 'OBC2502',
    name: 'Topografía y Geomática',
    semester: 5,
    credits: 5,
    prerequisites: ['MAT1101'],
    description:
      'Métodos e instrumentos de medición del terreno: nivelación, taquimetría, GNSS y sistemas de información geográfica aplicados a proyectos civiles.',
    objectives: [
      'Ejecutar levantamientos topográficos con instrumentos modernos',
      'Procesar datos de terreno y generar planos digitales',
      'Aplicar herramientas SIG a proyectos de infraestructura',
    ],
  },
  {
    id: 'OBC2601',
    name: 'Resistencia de Materiales',
    semester: 6,
    credits: 6,
    prerequisites: ['OBC2501', 'ING1402'],
    description:
      'Esfuerzos y deformaciones en elementos estructurales: tracción, compresión, flexión, corte y torsión; deflexiones y pandeo de columnas.',
    objectives: [
      'Calcular esfuerzos y deformaciones en elementos sometidos a carga',
      'Dimensionar secciones según criterios de resistencia y rigidez',
      'Analizar la estabilidad de columnas frente al pandeo',
    ],
  },
  {
    id: 'OBC2602',
    name: 'Mecánica de Suelos',
    semester: 6,
    credits: 6,
    prerequisites: ['OBC2501'],
    description:
      'Propiedades índice y clasificación de suelos, esfuerzos efectivos, consolidación, resistencia al corte y flujo de agua en medios porosos.',
    objectives: [
      'Clasificar suelos a partir de ensayos de laboratorio',
      'Calcular esfuerzos efectivos y asentamientos por consolidación',
      'Evaluar la resistencia al corte para problemas geotécnicos',
    ],
  },
  {
    id: 'OBC2701',
    name: 'Análisis Estructural',
    semester: 7,
    credits: 6,
    prerequisites: ['OBC2601'],
    description:
      'Análisis de estructuras hiperestáticas mediante métodos de fuerza, rigidez y matriciales, con introducción al análisis computacional.',
    objectives: [
      'Resolver estructuras hiperestáticas por métodos clásicos',
      'Formular el método de rigidez en forma matricial',
      'Modelar estructuras en software de análisis profesional',
    ],
  },
  {
    id: 'OBC2702',
    name: 'Hidráulica',
    semester: 7,
    credits: 6,
    prerequisites: ['ING1401'],
    description:
      'Flujo en canales abiertos y redes de tuberías, diseño de obras hidráulicas y fundamentos de hidrología aplicada a proyectos civiles.',
    objectives: [
      'Diseñar canales abiertos en régimen uniforme y gradualmente variado',
      'Dimensionar redes de distribución de agua potable',
      'Estimar caudales de diseño a partir de datos hidrológicos',
    ],
  },
  {
    id: 'OBC2703',
    name: 'Fundaciones',
    semester: 7,
    credits: 5,
    prerequisites: ['OBC2602'],
    description:
      'Diseño geotécnico de fundaciones superficiales y profundas: capacidad de soporte, asentamientos, pilotes y muros de contención.',
    objectives: [
      'Calcular la capacidad de soporte de fundaciones superficiales',
      'Diseñar fundaciones profundas y sistemas de pilotes',
      'Verificar la estabilidad de muros de contención',
    ],
  },
  {
    id: 'OBC2801',
    name: 'Hormigón Armado',
    semester: 8,
    credits: 6,
    prerequisites: ['OBC2701'],
    description:
      'Diseño de elementos de hormigón armado según la normativa chilena vigente: vigas, losas, columnas y detallamiento sísmico.',
    objectives: [
      'Diseñar vigas y losas de hormigón armado a flexión y corte',
      'Dimensionar columnas considerando flexo-compresión',
      'Aplicar el detallamiento sísmico exigido por la norma chilena',
    ],
  },
  {
    id: 'OBC2802',
    name: 'Estructuras de Acero',
    semester: 8,
    credits: 6,
    prerequisites: ['OBC2701'],
    description:
      'Comportamiento y diseño de estructuras de acero: elementos en tracción, compresión y flexión, conexiones apernadas y soldadas.',
    objectives: [
      'Diseñar elementos de acero según especificaciones AISC',
      'Verificar la estabilidad de elementos comprimidos',
      'Dimensionar conexiones apernadas y soldadas',
    ],
  },
  {
    id: 'OBC2901',
    name: 'Ingeniería Sísmica',
    semester: 9,
    credits: 6,
    prerequisites: ['OBC2801'],
    description:
      'Sismicidad chilena, dinámica de estructuras, espectros de respuesta y diseño sismorresistente según NCh433 y normativa complementaria.',
    objectives: [
      'Analizar la respuesta dinámica de estructuras ante sismos',
      'Aplicar el análisis modal espectral de la norma NCh433',
      'Evaluar criterios de diseño sismorresistente en edificios chilenos',
    ],
  },
  {
    id: 'OBC2902',
    name: 'Gestión de Proyectos de Construcción',
    semester: 9,
    credits: 5,
    prerequisites: ['ECO1401'],
    description:
      'Planificación, programación y control de proyectos de construcción: cartas Gantt, ruta crítica, presupuestos, contratos y prevención de riesgos.',
    objectives: [
      'Programar obras mediante ruta crítica y cartas Gantt',
      'Elaborar presupuestos y estados de pago de obras civiles',
      'Administrar contratos de construcción y sus riesgos',
    ],
  },
  {
    id: 'OBC2A01',
    name: 'Proyecto de Título',
    semester: 10,
    credits: 10,
    prerequisites: ['OBC2901', 'OBC2902'],
    description:
      'Desarrollo de un proyecto integrador de ingeniería estructural o geotécnica real, desde el anteproyecto hasta la memoria de cálculo final.',
    objectives: [
      'Integrar conocimientos de la especialidad en un proyecto real',
      'Elaborar memorias de cálculo y planos de nivel profesional',
      'Defender el proyecto ante una comisión evaluadora',
    ],
  },
  {
    id: 'OBC2A02',
    name: 'Ingeniería Vial y Transporte',
    semester: 10,
    credits: 5,
    prerequisites: ['OBC2502'],
    description:
      'Diseño geométrico de caminos, pavimentos flexibles y rígidos, y fundamentos de ingeniería de tránsito según el Manual de Carreteras.',
    objectives: [
      'Diseñar el alineamiento geométrico de una ruta interurbana',
      'Dimensionar pavimentos según métodos del Manual de Carreteras',
      'Analizar flujos vehiculares y niveles de servicio',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Especialidad: Computación
// ═══════════════════════════════════════════════════════════════

const COMPUTACION: Course[] = [
  {
    id: 'CMP2501',
    name: 'Estructuras de Datos y Algoritmos',
    semester: 5,
    credits: 6,
    prerequisites: ['ING1201'],
    description:
      'Estructuras fundamentales (listas, pilas, colas, árboles, grafos y tablas de hash), análisis de complejidad y diseño de algoritmos eficientes.',
    objectives: [
      'Seleccionar la estructura de datos adecuada para cada problema',
      'Analizar la complejidad temporal y espacial de algoritmos',
      'Implementar algoritmos clásicos de ordenamiento y búsqueda en grafos',
    ],
  },
  {
    id: 'CMP2502',
    name: 'Matemáticas Discretas',
    semester: 5,
    credits: 5,
    prerequisites: ['MAT1102'],
    description:
      'Lógica proposicional, técnicas de demostración, inducción, combinatoria, relaciones, y teoría de grafos aplicada a la computación.',
    objectives: [
      'Construir demostraciones formales por inducción y contradicción',
      'Resolver problemas de conteo con técnicas combinatorias',
      'Modelar problemas computacionales mediante grafos',
    ],
  },
  {
    id: 'CMP2601',
    name: 'Bases de Datos',
    semester: 6,
    credits: 6,
    prerequisites: ['CMP2501'],
    description:
      'Modelamiento entidad-relación, modelo relacional, SQL, normalización, transacciones e introducción a bases de datos NoSQL.',
    objectives: [
      'Diseñar esquemas relacionales normalizados a partir de requisitos',
      'Escribir consultas SQL complejas y optimizarlas',
      'Comprender transacciones, concurrencia y recuperación',
    ],
  },
  {
    id: 'CMP2602',
    name: 'Arquitectura de Computadores',
    semester: 6,
    credits: 6,
    prerequisites: ['ING1201'],
    description:
      'Organización de un computador moderno: representación de datos, lenguaje ensamblador, jerarquía de memoria, pipeline y paralelismo.',
    objectives: [
      'Explicar el camino de datos de un procesador moderno',
      'Programar rutinas simples en lenguaje ensamblador',
      'Evaluar el impacto de la jerarquía de memoria en el rendimiento',
    ],
  },
  {
    id: 'CMP2701',
    name: 'Sistemas Operativos',
    semester: 7,
    credits: 6,
    prerequisites: ['CMP2602'],
    description:
      'Procesos e hilos, planificación de CPU, sincronización, manejo de memoria virtual, sistemas de archivos y fundamentos de virtualización.',
    objectives: [
      'Explicar la gestión de procesos y memoria de un sistema operativo',
      'Resolver problemas de concurrencia con mecanismos de sincronización',
      'Implementar componentes simples de un sistema operativo',
    ],
  },
  {
    id: 'CMP2702',
    name: 'Ingeniería de Software',
    semester: 7,
    credits: 6,
    prerequisites: ['CMP2601'],
    description:
      'Ciclo de vida del software: requisitos, diseño, testing, control de versiones y metodologías ágiles, aplicados en un proyecto grupal real.',
    objectives: [
      'Levantar y especificar requisitos de software con stakeholders',
      'Aplicar prácticas ágiles y control de versiones en equipo',
      'Diseñar y ejecutar estrategias de testing automatizado',
    ],
  },
  {
    id: 'CMP2703',
    name: 'Inteligencia Artificial',
    semester: 7,
    credits: 5,
    prerequisites: ['CMP2501', 'MAT1401'],
    description:
      'Agentes inteligentes, búsqueda informada, representación del conocimiento, razonamiento probabilístico e introducción al aprendizaje automático.',
    objectives: [
      'Formular problemas como búsqueda en espacios de estados',
      'Aplicar razonamiento probabilístico a decisiones bajo incertidumbre',
      'Distinguir los paradigmas clásicos y modernos de la IA',
    ],
  },
  {
    id: 'CMP2801',
    name: 'Redes de Computadores',
    semester: 8,
    credits: 6,
    prerequisites: ['CMP2701'],
    description:
      'Modelo de capas de Internet: aplicación, transporte, red y enlace; TCP/IP, enrutamiento, DNS y programación de sockets.',
    objectives: [
      'Explicar el funcionamiento de los protocolos centrales de Internet',
      'Desarrollar aplicaciones de red mediante sockets',
      'Diagnosticar problemas de conectividad con herramientas estándar',
    ],
  },
  {
    id: 'CMP2802',
    name: 'Aprendizaje de Máquina',
    semester: 8,
    credits: 6,
    prerequisites: ['CMP2703'],
    description:
      'Regresión, clasificación, validación de modelos, árboles y ensambles, redes neuronales y buenas prácticas de machine learning aplicado.',
    objectives: [
      'Entrenar y validar modelos supervisados sobre datos reales',
      'Diagnosticar sobreajuste y aplicar técnicas de regularización',
      'Construir un pipeline completo de aprendizaje de máquina',
    ],
  },
  {
    id: 'CMP2901',
    name: 'Seguridad Informática',
    semester: 9,
    credits: 5,
    prerequisites: ['CMP2801'],
    description:
      'Principios de seguridad de la información: criptografía aplicada, autenticación, vulnerabilidades comunes y desarrollo seguro de software.',
    objectives: [
      'Aplicar criptografía simétrica y asimétrica correctamente',
      'Identificar y mitigar vulnerabilidades comunes (OWASP)',
      'Diseñar sistemas con principios de defensa en profundidad',
    ],
  },
  {
    id: 'CMP2902',
    name: 'Arquitectura de Software',
    semester: 9,
    credits: 6,
    prerequisites: ['CMP2702'],
    description:
      'Diseño de sistemas a gran escala: patrones arquitectónicos, microservicios, atributos de calidad, documentación y evaluación de arquitecturas.',
    objectives: [
      'Diseñar arquitecturas guiadas por atributos de calidad',
      'Comparar estilos arquitectónicos y sus trade-offs',
      'Documentar y comunicar decisiones de arquitectura',
    ],
  },
  {
    id: 'CMP2A01',
    name: 'Proyecto de Título',
    semester: 10,
    credits: 10,
    prerequisites: ['CMP2902'],
    description:
      'Desarrollo de un producto de software completo para un cliente real, integrando ingeniería de software, arquitectura y gestión de proyectos.',
    objectives: [
      'Construir un producto de software de calidad profesional',
      'Gestionar el ciclo completo de un proyecto con cliente real',
      'Defender las decisiones técnicas ante una comisión',
    ],
  },
  {
    id: 'CMP2A02',
    name: 'Computación en la Nube',
    semester: 10,
    credits: 5,
    prerequisites: ['CMP2801'],
    description:
      'Infraestructura como servicio, contenedores y orquestación, arquitecturas serverless, y despliegue continuo de aplicaciones en la nube.',
    objectives: [
      'Desplegar aplicaciones usando contenedores y orquestadores',
      'Diseñar arquitecturas cloud escalables y tolerantes a fallas',
      'Automatizar pipelines de integración y despliegue continuo',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Especialidad: Industrial
// ═══════════════════════════════════════════════════════════════

const INDUSTRIAL: Course[] = [
  {
    id: 'IND2501',
    name: 'Investigación de Operaciones',
    semester: 5,
    credits: 6,
    prerequisites: ['MAT1102', 'MAT1401'],
    description:
      'Modelamiento y resolución de problemas de optimización: programación lineal, dualidad, programación entera y flujo en redes.',
    objectives: [
      'Formular problemas de decisión como modelos de optimización',
      'Resolver programas lineales e interpretar su dualidad',
      'Aplicar modelos de redes a problemas logísticos',
    ],
  },
  {
    id: 'IND2502',
    name: 'Contabilidad y Costos',
    semester: 5,
    credits: 5,
    prerequisites: ['ECO1401'],
    description:
      'Estados financieros, contabilidad de gestión, sistemas de costeo y análisis costo-volumen-utilidad para la toma de decisiones.',
    objectives: [
      'Interpretar balances y estados de resultados',
      'Calcular costos de productos con distintos sistemas de costeo',
      'Usar información de costos para decisiones operativas',
    ],
  },
  {
    id: 'IND2601',
    name: 'Gestión de Operaciones',
    semester: 6,
    credits: 6,
    prerequisites: ['IND2501'],
    description:
      'Diseño y control de sistemas productivos: pronósticos, planificación agregada, inventarios, programación de la producción y lean management.',
    objectives: [
      'Elaborar pronósticos de demanda con métodos cuantitativos',
      'Dimensionar inventarios y planificar la producción',
      'Aplicar principios lean a procesos productivos y de servicios',
    ],
  },
  {
    id: 'IND2602',
    name: 'Microeconomía',
    semester: 6,
    credits: 5,
    prerequisites: ['ECO1401'],
    description:
      'Teoría del consumidor y de la firma, equilibrio de mercado, estructuras de competencia, externalidades y fallas de mercado.',
    objectives: [
      'Modelar el comportamiento de consumidores y firmas',
      'Analizar equilibrios en distintas estructuras de mercado',
      'Evaluar los efectos de externalidades y regulación',
    ],
  },
  {
    id: 'IND2701',
    name: 'Finanzas',
    semester: 7,
    credits: 6,
    prerequisites: ['IND2502'],
    description:
      'Valor del dinero en el tiempo, valoración de activos, riesgo y retorno, costo de capital y decisiones de financiamiento corporativo.',
    objectives: [
      'Valorar flujos de caja mediante VAN, TIR y payback',
      'Estimar el costo de capital de una empresa',
      'Analizar decisiones de inversión bajo riesgo',
    ],
  },
  {
    id: 'IND2702',
    name: 'Logística y Cadena de Suministro',
    semester: 7,
    credits: 5,
    prerequisites: ['IND2601'],
    description:
      'Diseño y gestión de cadenas de suministro: localización, transporte, distribución, gestión de proveedores y logística de última milla.',
    objectives: [
      'Diseñar redes de distribución eficientes',
      'Optimizar decisiones de transporte e inventario en la cadena',
      'Coordinar proveedores mediante contratos e incentivos',
    ],
  },
  {
    id: 'IND2703',
    name: 'Estadística Industrial',
    semester: 7,
    credits: 5,
    prerequisites: ['MAT1401'],
    description:
      'Diseño de experimentos, control estadístico de procesos, análisis de regresión y confiabilidad aplicados a la mejora industrial.',
    objectives: [
      'Diseñar experimentos para mejorar procesos productivos',
      'Implementar cartas de control estadístico de procesos',
      'Ajustar modelos de regresión a datos industriales',
    ],
  },
  {
    id: 'IND2801',
    name: 'Evaluación de Proyectos',
    semester: 8,
    credits: 6,
    prerequisites: ['IND2701'],
    description:
      'Formulación y evaluación privada y social de proyectos de inversión: estudios de mercado, flujos de caja, análisis de riesgo y sensibilidad.',
    objectives: [
      'Construir flujos de caja de proyectos de inversión',
      'Evaluar proyectos con criterios privados y sociales',
      'Incorporar riesgo e incertidumbre en la evaluación',
    ],
  },
  {
    id: 'IND2802',
    name: 'Gestión de Calidad',
    semester: 8,
    credits: 5,
    prerequisites: ['IND2703'],
    description:
      'Sistemas de gestión de calidad, Six Sigma, mejora continua, normas ISO y métricas de calidad en productos y servicios.',
    objectives: [
      'Implementar herramientas de mejora continua y Six Sigma',
      'Diseñar sistemas de gestión de calidad certificables',
      'Medir la calidad de servicio con indicadores adecuados',
    ],
  },
  {
    id: 'IND2901',
    name: 'Gestión Estratégica',
    semester: 9,
    credits: 6,
    prerequisites: ['IND2801'],
    description:
      'Análisis competitivo, formulación de estrategia corporativa, modelos de negocio y control de gestión mediante cuadros de mando.',
    objectives: [
      'Analizar industrias con marcos de estrategia competitiva',
      'Formular estrategias y modelos de negocio coherentes',
      'Diseñar cuadros de mando para el control de gestión',
    ],
  },
  {
    id: 'IND2902',
    name: 'Analítica de Datos para la Gestión',
    semester: 9,
    credits: 5,
    prerequisites: ['IND2703', 'ING1403'],
    description:
      'Ciencia de datos aplicada a decisiones de negocio: limpieza y visualización de datos, modelos predictivos y storytelling con datos.',
    objectives: [
      'Procesar y visualizar datos de negocio con Python',
      'Construir modelos predictivos para decisiones de gestión',
      'Comunicar hallazgos analíticos a audiencias ejecutivas',
    ],
  },
  {
    id: 'IND2A01',
    name: 'Proyecto de Título',
    semester: 10,
    credits: 10,
    prerequisites: ['IND2901'],
    description:
      'Proyecto integrador en una organización real: diagnóstico, propuesta de mejora con impacto medible y plan de implementación.',
    objectives: [
      'Diagnosticar problemas de gestión en una organización real',
      'Proponer soluciones con impacto económico cuantificado',
      'Defender el proyecto ante una comisión evaluadora',
    ],
  },
  {
    id: 'IND2A02',
    name: 'Innovación y Emprendimiento',
    semester: 10,
    credits: 5,
    prerequisites: ['IND2801'],
    description:
      'Proceso emprendedor de principio a fin: descubrimiento de clientes, prototipado, modelos de negocio, levantamiento de capital y pitch.',
    objectives: [
      'Validar hipótesis de negocio con metodologías lean startup',
      'Construir y testear prototipos de productos o servicios',
      'Presentar un pitch de inversión convincente',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Especialidad: Eléctrica
// ═══════════════════════════════════════════════════════════════

const ELECTRICA: Course[] = [
  {
    id: 'ELE2501',
    name: 'Circuitos Eléctricos',
    semester: 5,
    credits: 6,
    prerequisites: ['FIS1301', 'MAT1302'],
    description:
      'Análisis de circuitos en corriente continua y alterna: leyes de Kirchhoff, teoremas de redes, fasores, potencia y circuitos trifásicos.',
    objectives: [
      'Analizar circuitos resistivos con técnicas sistemáticas',
      'Resolver circuitos en régimen sinusoidal permanente',
      'Calcular potencia en sistemas monofásicos y trifásicos',
    ],
  },
  {
    id: 'ELE2502',
    name: 'Señales y Sistemas',
    semester: 5,
    credits: 6,
    prerequisites: ['MAT1302'],
    description:
      'Señales continuas y discretas, sistemas lineales e invariantes, convolución, series y transformada de Fourier, y transformada Z.',
    objectives: [
      'Caracterizar sistemas lineales mediante su respuesta al impulso',
      'Analizar señales en el dominio de la frecuencia',
      'Aplicar las transformadas de Fourier y Z a sistemas reales',
    ],
  },
  {
    id: 'ELE2601',
    name: 'Electrónica Analógica',
    semester: 6,
    credits: 6,
    prerequisites: ['ELE2501'],
    description:
      'Diodos, transistores BJT y MOSFET, polarización, amplificadores de pequeña señal y amplificadores operacionales.',
    objectives: [
      'Analizar y polarizar circuitos con transistores',
      'Diseñar amplificadores de pequeña señal',
      'Construir aplicaciones con amplificadores operacionales',
    ],
  },
  {
    id: 'ELE2602',
    name: 'Electromagnetismo Aplicado',
    semester: 6,
    credits: 5,
    prerequisites: ['FIS1301'],
    description:
      'Ecuaciones de Maxwell en forma diferencial, ondas electromagnéticas, líneas de transmisión y fundamentos de antenas.',
    objectives: [
      'Aplicar las ecuaciones de Maxwell a problemas de ingeniería',
      'Analizar la propagación de ondas en líneas de transmisión',
      'Comprender los principios de radiación y antenas',
    ],
  },
  {
    id: 'ELE2701',
    name: 'Electrónica Digital',
    semester: 7,
    credits: 6,
    prerequisites: ['ELE2601'],
    description:
      'Lógica combinacional y secuencial, máquinas de estado, memorias, y diseño digital con lenguajes de descripción de hardware (HDL).',
    objectives: [
      'Diseñar circuitos combinacionales y secuenciales',
      'Implementar máquinas de estado finito en FPGA',
      'Describir hardware digital mediante HDL',
    ],
  },
  {
    id: 'ELE2702',
    name: 'Máquinas Eléctricas',
    semester: 7,
    credits: 6,
    prerequisites: ['ELE2501'],
    description:
      'Transformadores, máquinas de corriente continua, motores de inducción y máquinas sincrónicas: principios, modelos y aplicaciones.',
    objectives: [
      'Modelar transformadores monofásicos y trifásicos',
      'Analizar el funcionamiento de motores de inducción',
      'Seleccionar máquinas eléctricas para aplicaciones industriales',
    ],
  },
  {
    id: 'ELE2703',
    name: 'Control Automático',
    semester: 7,
    credits: 5,
    prerequisites: ['ELE2502'],
    description:
      'Modelamiento de sistemas dinámicos, análisis de estabilidad, lugar de las raíces, respuesta en frecuencia y diseño de controladores PID.',
    objectives: [
      'Modelar sistemas dinámicos con funciones de transferencia',
      'Analizar estabilidad mediante criterios clásicos',
      'Sintonizar controladores PID para especificaciones dadas',
    ],
  },
  {
    id: 'ELE2801',
    name: 'Sistemas Eléctricos de Potencia',
    semester: 8,
    credits: 6,
    prerequisites: ['ELE2702'],
    description:
      'Generación, transmisión y distribución de energía eléctrica: flujo de potencia, cortocircuitos, protecciones y mercados eléctricos chilenos.',
    objectives: [
      'Calcular flujos de potencia en redes de transmisión',
      'Analizar fallas y coordinar protecciones eléctricas',
      'Comprender la operación del sistema eléctrico nacional',
    ],
  },
  {
    id: 'ELE2802',
    name: 'Sistemas de Comunicaciones',
    semester: 8,
    credits: 5,
    prerequisites: ['ELE2502'],
    description:
      'Modulación analógica y digital, ruido, capacidad de canal y fundamentos de sistemas de comunicación inalámbrica modernos.',
    objectives: [
      'Analizar esquemas de modulación analógica y digital',
      'Evaluar el desempeño de sistemas ante ruido',
      'Comprender la arquitectura de redes inalámbricas actuales',
    ],
  },
  {
    id: 'ELE2901',
    name: 'Energías Renovables',
    semester: 9,
    credits: 5,
    prerequisites: ['ELE2801'],
    description:
      'Tecnologías solares, eólicas y de almacenamiento, su integración a la red y el contexto de la transición energética en Chile.',
    objectives: [
      'Dimensionar plantas solares fotovoltaicas y parques eólicos',
      'Evaluar la integración de renovables a la red eléctrica',
      'Analizar proyectos de energía en el marco regulatorio chileno',
    ],
  },
  {
    id: 'ELE2902',
    name: 'Sistemas Embebidos',
    semester: 9,
    credits: 6,
    prerequisites: ['ELE2701', 'ING1201'],
    description:
      'Microcontroladores, periféricos, interrupciones, sistemas operativos de tiempo real y desarrollo de dispositivos IoT.',
    objectives: [
      'Programar microcontroladores con periféricos estándar',
      'Diseñar firmware con restricciones de tiempo real',
      'Construir un dispositivo IoT conectado de extremo a extremo',
    ],
  },
  {
    id: 'ELE2A01',
    name: 'Proyecto de Título',
    semester: 10,
    credits: 10,
    prerequisites: ['ELE2801', 'ELE2703'],
    description:
      'Proyecto integrador de ingeniería eléctrica con un mandante real: especificación, diseño, implementación y validación experimental.',
    objectives: [
      'Desarrollar una solución de ingeniería eléctrica completa',
      'Validar experimentalmente el diseño propuesto',
      'Defender el proyecto ante una comisión evaluadora',
    ],
  },
  {
    id: 'ELE2A02',
    name: 'Redes Eléctricas Inteligentes',
    semester: 10,
    credits: 5,
    prerequisites: ['ELE2901'],
    description:
      'Smart grids: medición inteligente, generación distribuida, electromovilidad y gestión de demanda en redes eléctricas modernas.',
    objectives: [
      'Analizar arquitecturas de redes eléctricas inteligentes',
      'Evaluar el impacto de la generación distribuida',
      'Diseñar estrategias de gestión de demanda',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Especialidad: Química
// ═══════════════════════════════════════════════════════════════

const QUIMICA: Course[] = [
  {
    id: 'QUI2501',
    name: 'Química Orgánica',
    semester: 5,
    credits: 6,
    prerequisites: ['QIM1101'],
    description:
      'Estructura, nomenclatura y reactividad de compuestos orgánicos: hidrocarburos, grupos funcionales y mecanismos de reacción fundamentales.',
    objectives: [
      'Nombrar y representar compuestos orgánicos correctamente',
      'Predecir la reactividad según grupos funcionales',
      'Proponer mecanismos de reacciones orgánicas clásicas',
    ],
  },
  {
    id: 'QUI2502',
    name: 'Fisicoquímica',
    semester: 5,
    credits: 6,
    prerequisites: ['QIM1101', 'ING1301'],
    description:
      'Termodinámica de soluciones, equilibrio de fases y químico, electroquímica y cinética química desde una perspectiva molecular.',
    objectives: [
      'Aplicar la termodinámica al equilibrio químico y de fases',
      'Analizar celdas electroquímicas y sus aplicaciones',
      'Determinar leyes de velocidad a partir de datos cinéticos',
    ],
  },
  {
    id: 'QUI2601',
    name: 'Balances de Materia y Energía',
    semester: 6,
    credits: 6,
    prerequisites: ['QIM1101', 'MAT1301'],
    description:
      'Formulación y resolución de balances de materia y energía en procesos químicos continuos y por lotes, con y sin reacción química.',
    objectives: [
      'Plantear balances de materia en procesos multietapa',
      'Resolver balances de energía en equipos de proceso',
      'Analizar procesos con reciclo, purga y reacción',
    ],
  },
  {
    id: 'QUI2602',
    name: 'Química Analítica',
    semester: 6,
    credits: 5,
    prerequisites: ['QIM1101'],
    description:
      'Métodos clásicos e instrumentales de análisis químico: volumetría, espectroscopía, cromatografía y validación de resultados analíticos.',
    objectives: [
      'Seleccionar el método analítico adecuado para cada matriz',
      'Operar técnicas espectroscópicas y cromatográficas',
      'Evaluar la calidad estadística de resultados analíticos',
    ],
  },
  {
    id: 'QUI2701',
    name: 'Fenómenos de Transporte',
    semester: 7,
    credits: 6,
    prerequisites: ['ING1401', 'QUI2601'],
    description:
      'Transferencia de momentum, calor y masa: mecanismos moleculares, ecuaciones de conservación y analogías entre los tres fenómenos.',
    objectives: [
      'Modelar la transferencia de calor por conducción y convección',
      'Resolver problemas de difusión y transferencia de masa',
      'Aplicar analogías entre transporte de momentum, calor y masa',
    ],
  },
  {
    id: 'QUI2702',
    name: 'Termodinámica de Procesos',
    semester: 7,
    credits: 6,
    prerequisites: ['ING1301', 'QUI2502'],
    description:
      'Comportamiento de mezclas reales, equilibrio líquido-vapor, ecuaciones de estado y termodinámica aplicada al diseño de separaciones.',
    objectives: [
      'Calcular propiedades de mezclas con ecuaciones de estado',
      'Predecir equilibrios líquido-vapor de sistemas reales',
      'Aplicar la termodinámica al diseño de procesos de separación',
    ],
  },
  {
    id: 'QUI2703',
    name: 'Ingeniería Ambiental',
    semester: 7,
    credits: 5,
    prerequisites: ['QUI2601'],
    description:
      'Contaminación de agua, aire y suelos, tecnologías de tratamiento, normativa ambiental chilena y evaluación de impacto ambiental.',
    objectives: [
      'Cuantificar cargas contaminantes en efluentes industriales',
      'Seleccionar tecnologías de tratamiento adecuadas',
      'Aplicar el marco normativo ambiental chileno a proyectos',
    ],
  },
  {
    id: 'QUI2801',
    name: 'Reactores Químicos',
    semester: 8,
    credits: 6,
    prerequisites: ['QUI2701', 'QUI2702'],
    description:
      'Cinética aplicada y diseño de reactores ideales y reales: batch, CSTR y flujo pistón, reacciones múltiples y efectos térmicos.',
    objectives: [
      'Diseñar reactores ideales para reacciones simples y múltiples',
      'Analizar efectos térmicos en la operación de reactores',
      'Evaluar desviaciones de la idealidad en reactores reales',
    ],
  },
  {
    id: 'QUI2802',
    name: 'Operaciones Unitarias',
    semester: 8,
    credits: 6,
    prerequisites: ['QUI2701'],
    description:
      'Diseño de equipos de separación: destilación, absorción, extracción, secado y evaporación, con criterios técnicos y económicos.',
    objectives: [
      'Diseñar columnas de destilación y absorción',
      'Dimensionar equipos de secado y evaporación',
      'Seleccionar la operación de separación óptima para cada mezcla',
    ],
  },
  {
    id: 'QUI2901',
    name: 'Control de Procesos',
    semester: 9,
    credits: 5,
    prerequisites: ['QUI2801', 'MAT1302'],
    description:
      'Dinámica de procesos químicos, lazos de control retroalimentado, sintonía de controladores e instrumentación industrial.',
    objectives: [
      'Modelar la dinámica de procesos químicos típicos',
      'Diseñar y sintonizar lazos de control retroalimentado',
      'Especificar la instrumentación de una planta de procesos',
    ],
  },
  {
    id: 'QUI2902',
    name: 'Biotecnología de Procesos',
    semester: 9,
    credits: 5,
    prerequisites: ['QUI2501'],
    description:
      'Microbiología industrial, cinética de fermentaciones, diseño de biorreactores y procesos de separación de productos biológicos.',
    objectives: [
      'Modelar la cinética de crecimiento microbiano',
      'Diseñar biorreactores para procesos fermentativos',
      'Aplicar operaciones de recuperación de bioproductos',
    ],
  },
  {
    id: 'QUI2A01',
    name: 'Proyecto de Título',
    semester: 10,
    credits: 10,
    prerequisites: ['QUI2901'],
    description:
      'Diseño integral de un proceso químico industrial: síntesis del proceso, balances, dimensionamiento de equipos y evaluación económica.',
    objectives: [
      'Integrar la especialidad en el diseño de un proceso completo',
      'Evaluar la factibilidad técnica y económica del proceso',
      'Defender el proyecto ante una comisión evaluadora',
    ],
  },
  {
    id: 'QUI2A02',
    name: 'Diseño de Plantas Químicas',
    semester: 10,
    credits: 6,
    prerequisites: ['QUI2802'],
    description:
      'Ingeniería de detalle de plantas de proceso: diagramas P&ID, layout, selección de equipos, seguridad de procesos y estimación de costos.',
    objectives: [
      'Elaborar diagramas de flujo y P&ID de plantas químicas',
      'Aplicar criterios de seguridad de procesos al diseño',
      'Estimar costos de inversión y operación de una planta',
    ],
  },
];

export const specialties: Specialty[] = [
  {
    id: 'obras-civiles',
    name: 'Obras Civiles',
    emoji: '🏗️',
    tagline: 'Diseña y construye la infraestructura que sostiene al país.',
    courses: [...PLAN_COMUN, ...OBRAS_CIVILES],
  },
  {
    id: 'computacion',
    name: 'Computación',
    emoji: '💻',
    tagline: 'Software, datos e inteligencia artificial para resolver problemas reales.',
    courses: [...PLAN_COMUN, ...COMPUTACION],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    emoji: '⚙️',
    tagline: 'Optimiza procesos, gestiona recursos y lidera organizaciones.',
    courses: [...PLAN_COMUN, ...INDUSTRIAL],
  },
  {
    id: 'electrica',
    name: 'Eléctrica',
    emoji: '⚡',
    tagline: 'Energía, electrónica y automatización para un mundo conectado.',
    courses: [...PLAN_COMUN, ...ELECTRICA],
  },
  {
    id: 'quimica',
    name: 'Química',
    emoji: '🧪',
    tagline: 'Transforma la materia en soluciones sustentables.',
    courses: [...PLAN_COMUN, ...QUIMICA],
  },
];

export function getSpecialty(id: string | null): Specialty | undefined {
  return specialties.find((s) => s.id === id);
}

export function getCourse(specialtyId: string | null, courseId: string): Course | undefined {
  return getSpecialty(specialtyId)?.courses.find((c) => c.id === courseId);
}
