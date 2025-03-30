import { z, type ZodTypeAny } from "zod";

export const customValidators = {
    email: z.string().email("Invalid email format"),
    password: z.string()
        .min(8, "Password must be at least 8 characters long")
        .max(72, "Password must be at most 72 characters long")
        .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
        .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
        .regex(/(?=.*[0-9])/, 'Password must contain at least one number')
        .regex(/(?=.*[^a-zA-Z0-9 \n])/, 'Password must contain at least one special character'),
    username: z.string()
    .min(3, "Username must be at least 3 characters long")
    .max(255, "Username must be at most 255 characters long")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .transform((value) => value.toLowerCase()),
    dateString: z.string().datetime({offset: true, message: "Invalid date format"}),
    id: z.number().int("Id must be Integer").positive("Id must be positive"),
    idString: z.string().trim().regex(/^(?:[1-9]\d*)|(?:0\d+)$/).transform(Number),
    jwt: z.string(),
}

export function validateObject<T extends object, U extends {[K in keyof T]: ZodTypeAny}>(
    object: T,
    schema: U
    ) {
    const safeObject = z.object(schema).safeParse(object);
    if (!safeObject.success) {
        return [false, safeObject.error] as const;
    }
    return [true, safeObject.data] as const;
}