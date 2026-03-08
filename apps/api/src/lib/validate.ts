import { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>, payload: unknown): T {
  return schema.parse(payload);
}
