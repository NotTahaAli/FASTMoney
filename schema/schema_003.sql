-- Drop the stored procedure if it already exists
IF EXISTS (
SELECT *
    FROM INFORMATION_SCHEMA.ROUTINES
WHERE SPECIFIC_SCHEMA = N'Auth'
    AND SPECIFIC_NAME = N'ChangePassword'
)
DROP PROCEDURE Auth.ChangePassword
GO
CREATE PROCEDURE Auth.ChangePassword
    @Id INT,
    @NewPassword BINARY(60)
AS
    UPDATE Auth.Users
    SET Password = @NewPassword,
        ModifiedOn = SYSDATETIMEOFFSET()
    WHERE Id = @Id
GO