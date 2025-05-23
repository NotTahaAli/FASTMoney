import { User } from "@/models/users.model";
import { withAuth } from "@/middleware/auth.middleware";
import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { response } from "@/utils/response.util";

export const PUT = withErrorHandling(withAuth(async (request): Promise<Response> => {
    const user = request.user;
    const {currentPassword, newPassword} = await request.json();
    const [newToken, newRefreshToken] = await User.changePassword({
        userId: user.Id,
        currentPassword,
        newPassword
    })
    return response({
        message: "Password has been updated successfully",
        token: newToken,
        refreshToken: newRefreshToken
    }, 200)
}))