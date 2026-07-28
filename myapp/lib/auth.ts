const USERS_KEY = "sh_users";
const SESSION_KEY = "sh_session";

type StoredUser = {
  email: string;
  password: string;
  id: string;
};

export function getSession(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function signUp(email: string, password: string): StoredUser {
  const raw = localStorage.getItem(USERS_KEY);
  const users: StoredUser[] = raw ? JSON.parse(raw) : [];
  const existing = users.find(u => u.email === email);
  if (existing) throw new Error("An account with this email already exists.");
  const user: StoredUser = { email, password, id: crypto.randomUUID() };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function signIn(email: string, password: string): StoredUser {
  const raw = localStorage.getItem(USERS_KEY);
  const users: StoredUser[] = raw ? JSON.parse(raw) : [];
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) throw new Error("Invalid email or password.");
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}
