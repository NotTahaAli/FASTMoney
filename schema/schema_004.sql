-- Set TransactionAmounts to On Delete No Action for Future Trigger
ALTER TABLE Finance.TransactionAmounts
    DROP CONSTRAINT TransactionAmounts_FK_Accounts;
ALTER TABLE Finance.TransactionAmounts
    ADD CONSTRAINT TransactionAmounts_FK_Accounts FOREIGN KEY (AccountId) REFERENCES Finance.Accounts(Id) ON DELETE NO ACTION;