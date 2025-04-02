import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Friend, IFriendRequestResponse } from "@/models/friends.model";
import { response } from "@/utils/response.util";

export const PUT = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ friendId: string }> }
)=>{
    const {friendId} = await params;
    const numericFriendId = parseInt(friendId);
    if (isNaN(numericFriendId)) {
        throw new StatusError('Friend ID must be a number', 400);
    }
    const body = await req.json() as IFriendRequestResponse;
    await Friend.respondToFriendRequest(req.user.Id, numericFriendId, body);
    if (body.action === 'accept') {
        return response({message: "Friend Request Accepted successfully"}, 200);
    } else {
        return response({message: "Friend Request Rejected successfully"}, 200);
    }
}));