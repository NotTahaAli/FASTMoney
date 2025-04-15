import { withAuth } from "@/middleware/auth.middleware";
import { withErrorHandling } from "@/middleware/errorHandler.middleware";
import { Transaction, INewTransaction, ITransactionFilters } from "@/models/transactions.model";
import { response } from "@/utils/response.util";

export const GET = withErrorHandling(withAuth(async (req) => {
    // Parse query parameters
    const url = new URL(req.url);
    const filters: ITransactionFilters = {};
    
    // Extract pagination parameters
    const page = url.searchParams.get('page');
    if (page) filters.page = parseInt(page);
    
    const limit = url.searchParams.get('limit');
    if (limit) filters.limit = parseInt(limit);
    
    // Extract date range parameters
    const startDate = url.searchParams.get('startDate');
    if (startDate) filters.startDate = new Date(startDate);
    
    const endDate = url.searchParams.get('endDate');
    if (endDate) filters.endDate = new Date(endDate);
    
    // Extract category filter
    const category = url.searchParams.get('category');
    if (category) filters.category = category;
    
    // Extract tags filter (could be multiple)
    const tags = url.searchParams.getAll('tags');
    if (tags?.length > 0) filters.tags = tags;
    
    // Extract accountId filter
    const accountId = url.searchParams.get('accountId');
    if (accountId) filters.accountId = parseInt(accountId);
    
    return response(await Transaction.getUserTransactions(req.user.Id, filters), 200);
}));

export const POST = withErrorHandling(withAuth(async (req) => {
    const body = await req.json() as INewTransaction;
    const transaction = await Transaction.createTransaction(req.user.Id, body);
    return response(transaction, 201);
}));