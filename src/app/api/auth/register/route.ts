import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { IUserRegistration, User } from "@/models/auth/users.model";
import { response } from "@/utils/response.util";

export const POST = withErrorHandling(async (request: Request): Promise<Response> => {
    const body = await request.json() as IUserRegistration;
    return response(await User.register(body), 200);
})