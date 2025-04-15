CREATE TRIGGER [Finance].[Account_Delete_TransactionAmountUpdate]
ON [Finance].[Accounts]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Update the AccountId and AccountName to 0 and NULL respectively for deleted accounts
    UPDATE amt
    SET AccountId = NULL,
        AccountName = deleted.Name
    FROM [Finance].[TransactionAmounts] amt
    INNER JOIN deleted ON amt.AccountId = deleted.Id;
END;