-- Check that current DB is not master DB
IF DB_NAME() = 'master'
BEGIN
    RAISERROR('This script should not be run on the master database', 16, 1);
    RETURN;
END

-- Create Migration Schema if it does not already exist
IF NOT EXISTS (SELECT *
FROM sys.schemas
WHERE name = 'Migration')
BEGIN
    EXEC('CREATE SCHEMA Migration');
END
GO

-- Create the Auth Schema if it does not already exist
IF NOT EXISTS (SELECT *
FROM sys.schemas
WHERE name = 'Auth')
BEGIN
    EXEC('CREATE SCHEMA Auth');
END
GO

-- Create the Finance Schema if it does not already exist
IF NOT EXISTS (SELECT *
FROM sys.schemas
WHERE name = 'Finance')
BEGIN
    EXEC('CREATE SCHEMA Finance');
END
GO

-- Create the Friends Schema if it does not already exist
IF NOT EXISTS (SELECT *
FROM sys.schemas
WHERE name = 'Friends')
BEGIN
    EXEC('CREATE SCHEMA Friends');
END
GO

-- Create the Migration Table if it does not already exist
IF NOT EXISTS (SELECT *
FROM sys.tables
WHERE name = 'Versions' AND schema_id = SCHEMA_ID('Migration'))
BEGIN
    CREATE TABLE Migration.Versions
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Version VARCHAR(255) NOT NULL,
        AppliedOn DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- Stop the script if the migration has already been applied
IF EXISTS (SELECT *
FROM Migration.Versions
WHERE Version = '001')
BEGIN
    RAISERROR('Version 001 has already been applied', 16, 1);
    RETURN;
END

-- Create a Transaction so it can be rolled back if an error occurs
BEGIN TRANSACTION;
-- Create the Users Table
-- This table is used to store all the users of the application
-- Each user has a username, password, email, and created date
-- The password field is a BCrypt hash of the user's password
-- The email field is used for account recovery and notifications
-- The created date is used to track when the user account was created
-- The modified date is used to track when the user account was last modified (To invalidate sessions)
CREATE TABLE Auth.Users
(
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(255) NOT NULL,
    Password BINARY(60) NOT NULL, -- BCrypt Hash of Password
    Email NVARCHAR(255) NOT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT Users_Uniq_Username UNIQUE (Username),
    CONSTRAINT Users_Uniq_Email UNIQUE (Email),
    CONSTRAINT Users_Check_Password CHECK (LEN(Password) >= 59),
    CONSTRAINT Users_Check_Username CHECK (LEN(Username) >= 3),
);

-- Create the Accounts Table
-- This table is used to store all the accounts of the users
-- Each account has a name, balance, and created date
-- The balance field will be updated when a transaction is made.
CREATE TABLE Finance.Accounts
(
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    Balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT Accounts_FK_Users FOREIGN KEY (UserId) REFERENCES Auth.Users(Id) ON DELETE CASCADE
);

-- Create the Transactions Table
-- This table is used to store all the transactions made by the users
-- Each transaction has a category, description, notes, and tags
-- The IsIncome field is used to differentiate between expenses and income
-- The IncludeInReports field is used to exclude transactions from reports
-- For example, if a user receives a salary, the transaction will be marked as income and included in reports
-- For example, if the user transfers money between his own accounts, the transaction will be marked as expense and excluded from reports
CREATE TABLE Finance.Transactions
(
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Category NVARCHAR(255) NOT NULL,
    IsIncome BIT NOT NULL DEFAULT 0, -- 0 = Expense, 1 = Income
    IncludeInReports BIT NOT NULL DEFAULT 1, -- 0 = Exclude from Reports, 1 = Include in Reports
    Description NVARCHAR(255) NULL DEFAULT NULL,
    Notes NVARCHAR(MAX) NULL DEFAULT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Create the Transaction Tags Table
-- This table is used to tag transactions with multiple tags
-- For example, a transaction for a meal with friends can be tagged with "Food", "Friends", "Restaurant"
-- This allows users to filter transactions by tags
CREATE TABLE Finance.TransactionTags
(
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    TransactionId BIGINT NOT NULL,
    Tag NVARCHAR(255) NOT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT TransactionTags_FK_Transactions FOREIGN KEY (TransactionId) REFERENCES Finance.Transactions(Id) ON DELETE CASCADE
);

-- Create Transaction Amount Table
-- This table is used for splitting bills between multiple accounts or users
-- For example, if a user pays for a meal with friends, the transaction amount will be split between the users
-- AmountToPay is the total amount that needs to be paid by the account
-- AmountPaid is the amount that has already been paid by the account
-- AmountToPay - AmountPaid is the amount that still needs to be paid
-- If AmountPaid is equal to AmountToPay, the transaction is considered paid
-- If AmountPaid is greater than AmountToPay, the transaction is considered overpaid (Loaned to other Users)
-- If AmountPaid is less than AmountToPay, the transaction is considered unpaid (Owed to other Users)
-- If the AccountId is NULL, one or more users are not registered on the platform in that case the AccountName will be used as a placeholder
-- If the AccountId is not NULL, the AccountName will be NULL
CREATE TABLE Finance.TransactionAmounts
(
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    TransactionId BIGINT NOT NULL,
    AccountId BIGINT NULL,
    AccountName NVARCHAR(255) NULL,
    AmountToPay DECIMAL(19, 4) NOT NULL,
    AmountPaid DECIMAL(19, 4) NOT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT TransactionAmounts_Check_AmountToPay CHECK (AmountToPay > 0),
    CONSTRAINT TransactionAmounts_Check_AmountPaid CHECK (AmountPaid >= 0),
    CONSTRAINT TransactionAmounts_Uniq_TransactionId_AccountId UNIQUE (TransactionId, AccountId),
    CONSTRAINT TransactionAmounts_FK_Transactions FOREIGN KEY (TransactionId) REFERENCES Finance.Transactions(Id) ON DELETE CASCADE,
    CONSTRAINT TransactionAmounts_FK_Accounts FOREIGN KEY (AccountId) REFERENCES Finance.Accounts(Id) ON DELETE CASCADE
);

-- Create the Friends Table
-- When a user is deleted, a trigger will delete all the records from this table where the UserId or FriendId is equal to the deleted UserId
CREATE TABLE Friends.Friends
(
    UserId INT NOT NULL,
    FriendId INT NOT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT Friends_PK PRIMARY KEY (UserId, FriendId),
    CONSTRAINT Friends_FK_Users FOREIGN KEY (UserId) REFERENCES Auth.Users(Id) ON DELETE NO ACTION,
    CONSTRAINT Friends_FK_Friends FOREIGN KEY (FriendId) REFERENCES Auth.Users(Id) ON DELETE NO ACTION,
    CONSTRAINT Friends_Check_UserId_FriendId CHECK (UserId != FriendId)
);

-- Create the Friend Requests Table
-- When a user sends a friend request, a record is created in this table
-- When the friend request is accepted, a record is created in the Friends Table
-- When the friend request is accepted or rejected, the record is deleted from this table
-- When a user is deleted, a trigger will delete all the records from this table where the UserId or FriendId is equal to the deleted UserId
CREATE TABLE Friends.FriendRequests
(
    UserId INT NOT NULL,
    FriendId INT NOT NULL,
    CreatedOn DATETIMEOFFSET(5) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT FriendRequests_PK PRIMARY KEY (UserId, FriendId),
    CONSTRAINT FriendRequests_FK_Users FOREIGN KEY (UserId) REFERENCES Auth.Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FriendRequests_FK_Friends FOREIGN KEY (FriendId) REFERENCES Auth.Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FriendRequests_Check_UserId_FriendId CHECK (UserId != FriendId)
);

-- Add the initial migration record
INSERT INTO Migration.Versions
    (Version)
VALUES
    ('001');

SELECT 'Version 001 applied successfully' AS 'Message';
COMMIT TRANSACTION;
GO