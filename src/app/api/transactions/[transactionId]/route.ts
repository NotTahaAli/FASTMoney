import { withAuth } from "@/middleware/auth.middleware";
import { StatusError, withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Transaction, IEditTransaction } from "@/models/transactions.model";
import { response } from "@/utils/response.util";

export const PUT = withErrorHandling(withAuth(async (req,
    {params}: { params: Promise<{ transactionId: string }>}
) => {
    const {transactionId} = await params;
    const numericTransactionId = parseInt(transactionId);
    if (isNaN(numericTransactionId)) {
        throw new StatusError('Transaction ID must be a number', 400);
    }
    
    const body = await req.json() as IEditTransaction;
    // The transaction model handles the amounts array if included
    const updatedTransaction = await Transaction.updateTransaction(req.user.Id, numericTransactionId, body);
    
    return response(updatedTransaction ?? {
        message: "Transaction deleted successfully"
    }, 200);
}));