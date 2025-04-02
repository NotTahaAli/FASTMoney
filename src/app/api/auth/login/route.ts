import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { IUserLogin, User } from "@/models/users.model";
import { response } from "@/utils/response.util";

export const POST = withErrorHandling(async (request: Request): Promise<Response> => {
    const body = await request.json() as IUserLogin;
    return response(await User.login(body), 200);
})