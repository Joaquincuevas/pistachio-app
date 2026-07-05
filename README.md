# 🥜 Pistachio

**Tu malla curricular, al alcance.**

Plataforma para estudiantes de Ingeniería de la Universidad de los Andes (Chile): crea tu cuenta con correo institucional, elige tu especialidad y explora tu **Plan de Estudios 2022 oficial** de forma interactiva — como grid por semestre o como grafo de dependencias. Tu progreso se guarda en tu cuenta (base de datos real), no solo en el navegador.

## Instalación

```bash
npm install
npm run dev        # levanta web (5173) + API (3001) juntos
```

La app queda disponible en `http://localhost:5173`. En dev la base es un **Postgres embebido** (pglite) que se crea y siembra sola en `server/pgdata` — no hay que instalar nada.

Otros comandos:

```bash
npm run dev:web    # solo frontend
npm run dev:api    # solo API
npm run build      # build de producción del frontend (incluye typecheck)
npm start          # producción: la API sirve también el build de dist/
npm run typecheck  # typecheck de frontend y servidor
```

## Datos reales

El catálogo se genera desde las planillas oficiales de la Facultad:

- **`scripts/parse-catalog.py`** lee `Catálogo PE 2022 Versión 2023.xlsx` (hojas `Cursos` y `<ESP> Malla`) y produce `server/data/catalog.json`.
- Las 5 especialidades reales: **Industrial (ICI), Obras Civiles (IOC), Eléctrica (ICE), Computación (ICC) y Ambiental (ICA)** — 60 ramos y ~330 SCT en 11 semestres cada una, incluyendo slots de Teología, Minor, Optativos, Concentración Tecnológica y Electivos.
- Computación tiene **dos versiones de plan**: PE 2022 (rev. 2023) y **PE 2022 · Ajuste 2025** (según la presentación de la Facultad de oct. 2024: entran Fundamentos de Ciberseguridad e Inteligencia Artificial Aplicada; salen Autómatas y Computabilidad y Diseño de Software Verificable; se adelantan BD, Web Technologies, AI, Almacenamiento y Sistemas Embebidos).
- Los códigos `ICC-FCS` e `ICC-IAA` son provisorios: la presentación aún no publica códigos Banner.

## Backend y seguridad

| Área | Implementación |
| --- | --- |
| Servidor | Express + TypeScript (`server/`), corre con tsx |
| Base de datos | Postgres: Supabase en prod, pglite embebido en dev; se siembra desde `catalog.json` |
| Contraseñas | scrypt (`node:crypto`) con salt aleatorio — nunca texto plano |
| Sesiones | Token aleatorio en cookie **httpOnly** (30 días); en la DB solo se guarda su SHA-256 |
| Protección extra | Límite de intentos de login, validación Zod en el servidor, dominio de correo verificado server-side |
| Progreso | `progress(user, plan, ramo)` con updates optimistas desde el cliente |

Endpoints: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`, `GET /api/catalog`, `PUT /api/me/plan`, `GET|PUT /api/progress/:planId[/:courseId]`.

En producción (`npm start`) el mismo proceso sirve la API y el frontend compilado.

## Deploy

La base es **Postgres**: en producción, **Supabase**; en dev, un Postgres embebido (pglite). El mismo SQL corre en ambos. El repo trae `vercel.json` (frontend estático + `api/index.ts` como función serverless).

### Vercel + Supabase (gratis)

1. En **Supabase** → tu proyecto → botón **Connect** (arriba) → **Connection string → Transaction pooler** (puerto `6543`). Copia esa URL y reemplaza `[YOUR-PASSWORD]` por la contraseña de la base. Queda así:
   ```
   postgresql://postgres.xxxx:TU_PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres
   ```
   > Usa el **pooler de transacciones** (6543), no la conexión directa (5432): es la que funciona en serverless.
2. **Importa el repo en Vercel** ([vercel.com/new](https://vercel.com/new) → GitHub → `pistachio-app`).
3. En **Settings → Environment Variables** agrega:
   - `DATABASE_URL` = la URL del paso 1
   - `NODE_ENV` = `production`
4. **Deploy**. En el primer request la API crea las tablas y siembra el catálogo automáticamente.

Cada push a `main` redespliega solo. Los datos de tus amigos viven en Supabase (persistente, con backups).

### Alternativa: Railway / Render / Fly (un solo proceso)

También corre como proceso Node con `npm start` (Express sirve API + estáticos). Usa `railway.json` (incluido) y la misma `DATABASE_URL` de Supabase, o cualquier Postgres. Healthcheck en `/api/health`.

## Stack frontend

React 18 + Vite + TypeScript estricto · React Router v6 · Tailwind CSS v3 con design tokens · Framer Motion · Zustand (persist como cache, el servidor es la verdad) · React Hook Form + Zod · React Flow · Lucide · Instrument Serif + Inter.

## Estructura

```
server/
├── index.ts           API Express (auth, catálogo, progreso)
├── db.ts              esquema Postgres + seed automático (pg / pglite)
├── auth.ts            scrypt, sesiones, rate limit
└── data/catalog.json  catálogo generado desde el Excel oficial
scripts/
└── parse-catalog.py   Excel de la Facultad → catalog.json
src/
├── components/        ui/ · layout/ · malla/
├── pages/             Landing, Login, Register, SpecialtySelect, Dashboard…
├── stores/            useAuthStore, useCatalogStore, useCurriculumStore, useToastStore
├── hooks/             useActivePlan, useLongPress, useMediaQuery, useLocalStorage
├── services/          api.ts (cliente HTTP)
├── lib/               utils.ts, validators.ts
└── types/             index.ts
```

## Bonus

Toca 3 veces el 🥜 del footer de la landing. 🌰
