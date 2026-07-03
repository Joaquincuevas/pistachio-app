import type { User } from '@/types';

/**
 * Servicio de autenticación simulado.
 * Hoy resuelve contra localStorage; la firma async permite reemplazar
 * cada función por llamadas reales a una API sin tocar el resto de la app.
 */

const USERS_KEY = 'pistachio:users';

interface StoredUser extends User {
  password: string;
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Simula la latencia de red de una API real. */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPublicUser({ name, email, createdAt }: StoredUser): User {
  return { name, email, createdAt };
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  await delay(700);
  const users = readUsers();
  const normalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    throw new Error('Ya existe una cuenta con este correo. Intenta iniciar sesión.');
  }
  const user: StoredUser = {
    name: name.trim(),
    email: normalized,
    password,
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, user]);
  return toPublicUser(user);
}

export async function login(email: string, password: string): Promise<User> {
  await delay(700);
  const normalized = email.trim().toLowerCase();
  const user = readUsers().find(
    (u) => u.email === normalized && u.password === password,
  );
  if (!user) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  return toPublicUser(user);
}
