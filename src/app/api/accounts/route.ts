import { withAuth } from "@/middleware/auth.middleware";
import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Account, INewAccount } from "@/models/accounts.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req)=>{
    return response(await Account.getUserAccounts(req.user.Id), 200);
}))

export const POST = withErrorHandling(withAuth(async (req)=>{
    const body = await req.json() as INewAccount;
    return response(await Account.createAccount(req.user.Id, body), 201);
}))