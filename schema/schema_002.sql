-- Stop the script if the migration has already been applied
IF EXISTS (SELECT *
FROM Migration.Versions
WHERE Version = '002')
BEGIN
    RAISERROR('Version 002 has already been applied', 16, 1);
    RETURN;
END

-- Create a Transaction so it can be rolled back if an error occurs
BEGIN TRANSACTION;

-- Modify the TransactionAmounts table to allow AmountToPay to be 0
ALTER TABLE Finance.TransactionAmounts
    DROP CONSTRAINT TransactionAmounts_Check_AmountToPay;
    
ALTER TABLE Finance.TransactionAmounts
    ADD CONSTRAINT TransactionAmounts_Check_AmountToPay CHECK (AmountToPay >= 0);

-- Add the migration record
INSERT INTO Migration.Versions
    (Version)
VALUES
    ('002');

SELECT 'Version 002 applied successfully' AS 'Message';
COMMIT TRANSACTION;
GO