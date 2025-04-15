import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Transaction, INewTransactionTag } from "@/models/transactions.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ transactionId: string }>}
) => {
    const {transactionId} = await params;
    const numericTransactionId = parseInt(transactionId);
    if (isNaN(numericTransactionId)) {
        throw new StatusError('Transaction ID must be a number', 400);
    }
    
    const tags = await Transaction.getTransactionTags(req.user.Id, numericTransactionId);
    return response(tags, 200);
}));

export const POST = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ transactionId: string }>}
) => {
    const {transactionId} = await params;
    const numericTransactionId = parseInt(transactionId);
    if (isNaN(numericTransactionId)) {
        throw new StatusError('Transaction ID must be a number', 400);
    }
    
    const body = await req.json() as INewTransactionTag;
    const tag = await Transaction.addTransactionTag(req.user.Id, numericTransactionId, body);
    return response(tag, 201);
}));