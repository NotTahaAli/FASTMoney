import { withAuth } from "@/middleware/auth.middleware";
import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Friend } from "@/models/friends.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req)=>{
    return response(await Friend.getFriends(req.user.Id), 200);
}))