import { withAuth } from "@/middleware/auth.middleware";
import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Friend, IFriendRequestSend } from "@/models/friends.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req)=>{
    return response(await Friend.getFriendRequests(req.user.Id), 200);
}))

export const POST = withErrorHandling(withAuth(async (req)=>{
    const body = await req.json() as IFriendRequestSend;
    await Friend.sendFriendRequest(req.user.Id, body)
    return response({message: "Friend request sent successfully"}, 201);
}))