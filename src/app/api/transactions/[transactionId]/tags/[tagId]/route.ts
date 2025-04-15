import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Transaction } from "@/models/transactions.model";
import { response } from "@/utils/response.util";

export const DELETE = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ transactionId: string, tagId: string }>}
) => {
    const {transactionId, tagId} = await params;
    const numericTransactionId = parseInt(transactionId);
    if (isNaN(numericTransactionId)) {
        throw new StatusError('Transaction ID must be a number', 400);
    }
    
    const numericTagId = parseInt(tagId);
    if (isNaN(numericTagId)) {
        throw new StatusError('Tag ID must be a number', 400);
    }
    
    await Transaction.removeTransactionTag(req.user.Id, numericTransactionId, numericTagId);
    return response({message: "Tag removed successfully"}, 200);
}));