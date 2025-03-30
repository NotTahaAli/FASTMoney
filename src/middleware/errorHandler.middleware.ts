import { errorResponse } from "@/utils/response.util";

export class StatusError extends Error {
    status: number;
    constructor(message: string | Error, status: number = 400) {
        if (message instanceof Error) {
            super(message.message, { cause: message.cause});
            const message_lines =  (this.message.match(/\n/g)||[]).length + 1
            this.stack = this.stack?.split('\n').slice(0, message_lines+1).join('\n') + '\n' +
            message?.stack
        } else {
            super(message);
        }
        this.status = status;
    }
};

export function withErrorHandling<T extends unknown[]>(
    handler: (...args: T) => Promise<Response> | Response
): (...args: T) => Promise<Response> {
    return async (...args: T): Promise<Response> => {
        try {
            return await handler(...args);
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("Error in API handler:", error);
            }
            if (error instanceof StatusError) {
                return errorResponse(error.message, error.status);
            }
            if (error instanceof Error || typeof error === 'string') {
                return errorResponse(error, 400);
            }
            if (error instanceof Response) {
                return error;
            }
            if (typeof (error) === 'object' && error !== null) {
                const message = "message" in error ? error.message : "An Unknown Error Occurred";
                const status = ("status" in error && typeof (error.status) == "number" && error.status >= 0) ? error.status : 400;
                if (typeof (message) == "string") {
                    return errorResponse(message, status);
                } else if (Array.isArray(message)) {
                    return errorResponse(message.join(", "), status);
                }
                return errorResponse("An Unknown Error Occurred", status);
            }
            return errorResponse("An Unknown Error Occurred", 400);
        }
    };
}