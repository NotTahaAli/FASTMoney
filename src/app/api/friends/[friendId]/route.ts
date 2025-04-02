import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Friend } from "@/models/friends.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ friendId: string }> }
)=>{
    const {friendId} = await params;
    const numericFriendId = parseInt(friendId);
    if (isNaN(numericFriendId)) {
        throw new StatusError('Friend ID must be a number', 400);
    }
    const friend = await Friend.getFriendAccounts(req.user.Id, numericFriendId);
    return response(friend, 200);
}));

export const DELETE = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ friendId: string }>}
)=>{
    const {friendId} = await params;
    const numericFriendId = parseInt(friendId);
    if (isNaN(numericFriendId)) {
        throw new StatusError('Friend ID must be a number', 400);
    }
    await Friend.removeFriend(req.user.Id, numericFriendId);
    return response({message: "Friend Removed successfully"}, 200);
}
));