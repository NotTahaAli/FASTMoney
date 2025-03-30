import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { IUserRefresh, User } from "@/models/auth/users.model";
import { response } from "@/utils/response.util";

export const POST = withErrorHandling(async (request: Request): Promise<Response> => {
    const body = await request.json() as IUserRefresh;
    return response(await User.refresh(body), 200);
})