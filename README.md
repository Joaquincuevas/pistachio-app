# 🥜 Pistachio

**Tu malla curricular, al alcance.**

Plataforma para estudiantes de Ingeniería Civil de la Universidad de los Andes (Chile): regístrate con tu correo institucional, elige tu especialidad y explora tu malla completa de forma interactiva — como grid por semestre o como grafo de dependencias.

## Instalación

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

Otros comandos:

```bash
npm run build      # build de producción (incluye typecheck)
npm run preview    # sirve el build localmente
```

## Cómo usarla

1. **Crea una cuenta** con un correo `@uandes.cl` o `@miuandes.cl` (auth simulada, sin backend).
2. **Elige tu especialidad**: Obras Civiles, Computación, Industrial, Eléctrica o Química.
3. **Explora tu malla** en `/malla`:
   - **Vista Grid**: scroll por semestre con headers sticky. Tap en un ramo abre su detalle.
   - **Vista Grafo**: nodos por semestre y aristas de prerrequisitos. Al tocar un ramo se resaltan en verde sus prerrequisitos y en azul lo que desbloquea. Segundo tap abre el detalle.
   - **Long-press** (mobile) o **click derecho** (desktop) sobre un ramo → marcar como Cursado / En progreso / Pendiente.
4. Tu progreso persiste en `localStorage` y se conserva por especialidad.
5. Bonus: toca 3 veces el 🥜 del footer de la landing. 🌰

## Stack

| Área | Tecnología |
| --- | --- |
| Framework | React 18 + Vite + TypeScript (strict) |
| Routing | React Router v6 con rutas protegidas |
| Estilos | Tailwind CSS v3 con design tokens propios |
| Animaciones | Framer Motion |
| Estado | Zustand (+ persist en localStorage) |
| Formularios | React Hook Form + Zod |
| Grafo | React Flow (`@xyflow/react`) |
| Iconos | Lucide React |
| Fuentes | Instrument Serif (display) + Inter (body) |

## Estructura

```
src/
├── components/
│   ├── ui/            Button, Card, Input, Badge, Modal, BottomSheet, Toast…
│   ├── layout/        AppShell, Header, TabBar (mobile), Sidebar (desktop)
│   └── malla/         MallaGraph, MallaGrid, CourseCard, CourseDetail…
├── pages/             Landing, Login, Register, SpecialtySelect, Dashboard…
├── stores/            useAuthStore, useCurriculumStore, useToastStore
├── hooks/             useLocalStorage, useMediaQuery, useLongPress
├── services/          auth.ts (mock async, listo para conectar API real)
├── data/              curriculum.ts (5 especialidades, 32 ramos c/u)
├── lib/               utils.ts, validators.ts
└── types/             index.ts
```

## Notas de arquitectura

- **Auth simulada**: `src/services/auth.ts` expone `login`/`register` async que hoy resuelven contra localStorage. Para conectar un backend real basta reemplazar el cuerpo de esas funciones.
- **Progreso por especialidad**: el store guarda `progress[especialidad][ramo]`, así cambiar de especialidad no borra el avance anterior.
- **Plan común compartido**: los semestres 1–4 son los mismos objetos en las 5 especialidades, definidos una sola vez en `curriculum.ts`.
