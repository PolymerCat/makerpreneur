/* db.ts now delegates to Supabase via supabase-db.ts.
   All functions are async. Pages must use await. */
export { sdb as db } from "./supabase-db";
