-- Modify the TransactionAmounts table to allow AmountToPay to be 0
ALTER TABLE Finance.TransactionAmounts
    DROP CONSTRAINT TransactionAmounts_Check_AmountToPay;
    
ALTER TABLE Finance.TransactionAmounts
    ADD CONSTRAINT TransactionAmounts_Check_AmountToPay CHECK (AmountToPay >= 0);