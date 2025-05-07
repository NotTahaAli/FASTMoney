import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Account, IEditAccount } from "@/models/accounts.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ accountId: string }>}
)=>{
    const {accountId} = await params;
    const numericAccountId = parseInt(accountId);
    if (isNaN(numericAccountId)) {
        throw new StatusError('Account ID must be a number', 400);
    }
    const account = await Account.getAccount(req.user.Id, numericAccountId);
    if (!account) {
        throw new StatusError('Account not found', 404);
    }
    return response(account, 200);
}));

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