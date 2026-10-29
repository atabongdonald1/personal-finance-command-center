/**
 * Backend actor access.
 *
 * The generated `@/backend` module is the single source of truth for the
 * canister API: method names, positional argument shapes and return types all
 * come from `backend.d.ts`. This module only re-exports the generated actor
 * type so the rest of the frontend can name it without reaching into the
 * generated file directly.
 */

export type { Backend } from "@/backend";
