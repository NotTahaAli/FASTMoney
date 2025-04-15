import 'server-only';

export function response(data: Record<string, unknown> | unknown[] | Exclude<object, null>, statusCode: number, customHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...customHeaders,
        },
    });
}

export function errorResponse(message: string | Error, statusCode: number, customHeaders: Record<string, string> = {}): Response {
    if (message instanceof Error) {
        message = message.message;
    }
    return response({error: message}, statusCode, customHeaders);
}