CREATE TRIGGER [Finance].[Accounts_Balance_Trigger]
ON [Finance].[TransactionAmounts]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE A
    SET A.Balance = A.Balance - 
        CASE 
            WHEN T.IsIncome = 1 THEN T.TotalAmount
            ELSE -T.TotalAmount
        END
    FROM [Finance].[Accounts] A
    INNER JOIN (
        SELECT d.AccountId, SUM(d.AmountPaid) AS TotalAmount,
                tr.IsIncome
        FROM deleted d
        INNER JOIN [Finance].[Transactions] tr ON d.TransactionId = tr.Id
        WHERE d.AccountId IS NOT NULL
        GROUP BY d.AccountId, tr.IsIncome
    ) T ON A.Id = T.AccountId;
    
    -- Add new amounts to accounts based on transaction type
    UPDATE A
    SET A.Balance = A.Balance + 
        CASE 
            WHEN T.IsIncome = 1 THEN T.TotalAmount
            ELSE -T.TotalAmount
        END
    FROM [Finance].[Accounts] A
    INNER JOIN (
        SELECT i.AccountId, SUM(i.AmountPaid) AS TotalAmount,
                tr.IsIncome
        FROM inserted i
        INNER JOIN [Finance].[Transactions] tr ON i.TransactionId = tr.Id
        WHERE i.AccountId IS NOT NULL
        GROUP BY i.AccountId, tr.IsIncome
    ) T ON A.Id = T.AccountId;
END;
GO

CREATE TRIGGER [Finance].[Accounts_Balance_Trigger_On_Transaction_Update]
ON [Finance].[Transactions]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE A
    SET A.Balance = A.Balance - 
        CASE 
            WHEN T.IsIncome = 1 THEN T.TotalAmount
            ELSE -T.TotalAmount
        END
    FROM [Finance].[Accounts] A
    INNER JOIN (
        SELECT amt.AccountId, SUM(amt.AmountPaid) AS TotalAmount,
                d.IsIncome
        FROM deleted d
        INNER JOIN [Finance].[TransactionAmounts] amt ON d.Id = amt.TransactionId
        WHERE amt.AccountId IS NOT NULL
        GROUP BY amt.AccountId, d.IsIncome
    ) T ON A.Id = T.AccountId;

    UPDATE A
    SET A.Balance = A.Balance + 
        CASE 
            WHEN T.IsIncome = 1 THEN T.TotalAmount
            ELSE -T.TotalAmount
        END
    FROM [Finance].[Accounts] A
    INNER JOIN (
        SELECT amt.AccountId, SUM(amt.AmountPaid) AS TotalAmount,
                i.IsIncome
        FROM inserted i
        INNER JOIN [Finance].[TransactionAmounts] amt ON i.Id = amt.TransactionId
        WHERE amt.AccountId IS NOT NULL
        GROUP BY amt.AccountId, i.IsIncome
    ) T ON A.Id = T.AccountId;
END
GO

CREATE TRIGGER [Finance].[TransactionAmounts_Create_Trigger]
ON [Finance].[TransactionAmounts]
INSTEAD OF INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT * FROM inserted WHERE (AccountId IS NULL AND AccountName IS NULL) OR (AccountId IS NOT NULL AND AccountName IS NOT NULL))
    BEGIN
        RAISERROR('Either AccountId or AccountName must be NULL, but not both.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    IF EXISTS (SELECT * FROM deleted)
    BEGIN
        UPDATE t
        SET AccountId = i.AccountId,
            AccountName = i.AccountName,
            TransactionId = i.TransactionId,
            AmountPaid = i.AmountPaid,
            AmountToPay = i.AmountToPay,
            CreatedOn = i.CreatedOn
        FROM [Finance].[TransactionAmounts] t
        INNER JOIN inserted i ON t.Id = i.Id
    END
    ELSE
    BEGIN
        INSERT INTO [Finance].[TransactionAmounts]
        (AccountId, AccountName, TransactionId, AmountPaid, AmountToPay, CreatedOn)
        SELECT i.AccountId,
               i.AccountName,
               i.TransactionId,
               i.AmountPaid,
               i.AmountToPay,
               i.CreatedOn
        FROM inserted i;
    END
END