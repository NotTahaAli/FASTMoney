--Trigger for Deleting Friends and Friend Requests
CREATE TRIGGER
    tr_DeleteFriend
ON
    Auth.Users
INSTEAD OF
    DELETE
AS
BEGIN
    -- Delete all records from the Friends table where the UserId or FriendId is equal to the deleted UserId
    DELETE FROM Friends.Friends
    WHERE UserId IN (SELECT Id FROM DELETED) OR FriendId IN (SELECT Id FROM DELETED);

    -- Delete all records from the FriendRequests table where the UserId or FriendId is equal to the deleted UserId
    DELETE FROM Friends.FriendRequests
    WHERE UserId IN (SELECT Id FROM DELETED) OR FriendId IN (SELECT Id FROM DELETED);

    -- Continue with the delete operation
    DELETE FROM Auth.Users
    WHERE Id IN (SELECT Id FROM DELETED);
END;
GO