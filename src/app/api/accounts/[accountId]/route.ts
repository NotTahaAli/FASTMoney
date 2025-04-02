import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Account, IEditAccount } from "@/models/accounts.model";
import { response } from "@/utils/response.util";

export const PUT = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ accountId: string }>}
)=>{
    const {accountId} = await params;
    const numericAccountId = parseInt(accountId);
    if (isNaN(numericAccountId)) {
        throw new StatusError('Account ID must be a number', 400);
    }
    const body = await req.json() as IEditAccount;
    const updatedAccount = await Account.editAccount(req.user.Id, numericAccountId, body);
    return response(updatedAccount, 200);
}));

export const DELETE = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ accountId: string }>}
)=>{
    const {accountId} = await params;
    const numericAccountId = parseInt(accountId);
    if (isNaN(numericAccountId)) {
        throw new StatusError('Account ID must be a number', 400);
    }
    await Account.deleteAccount(req.user.Id, numericAccountId);
    return response({message: "Account deleted successfully"}, 200);
}
));