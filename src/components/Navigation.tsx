"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccountDetails } from "@/middleware/clientAuth.middleware";
import { IAccount } from "@/models/accounts.model";
import SweetAlert from "sweetalert2";

type TransactionData = {
  amount: number;
  category: string;
  description: string;
  notes?: string;
  isIncome: boolean;
  amounts: {
    accountId?: number;
    accountName?: string;
    amountToPay: number;
    amountPaid: number;
  }[];
};

type APIAccount = Omit<IAccount, "CreatedOn" | "Balance">;

type APIFriendsResponse = {
  userId: number;
  username: string;
  createdOn: string;
}[];

type APIFriendDetails = Omit<APIFriendsResponse[number], "createdOn"> & {
  accounts: APIAccount[];
};

export default function Navigation() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<
    "income" | "expense" | null
  >(null);
  const [showHelpMessage, setShowHelpMessage] = useState(false);
  const [username, setUsername] = useState("");
  const [accounts, setAccounts] = useState<APIAccount[]>([]);
  const [friends, setFriends] = useState<{ [key: number]: APIFriendDetails }>(
    {}
  );
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  };

  const chooseAccount = async (options: APIAccount[]) => {
    const accountOptions: { [key: string]: string } = {};
    options.forEach((account) => {
      accountOptions[account.Id.toString()] = `${account.Name}`;
    });
    console.log(accountOptions);

    const { value: selectedAccount } = await SweetAlert.fire({
      theme: "dark",
      title: "Select an Account",
      input: "select",
      inputOptions: accountOptions,
      showCancelButton: true,
      confirmButtonText: "Next",
      cancelButtonText: "Cancel",
    });

    if (typeof selectedAccount === "number") {
      return selectedAccount;
    }
    if (typeof selectedAccount === "string" && !isNaN(parseInt(selectedAccount))) {
      return parseInt(selectedAccount);
    }
    return null;
  }

  const chooseFriend = async (options: APIFriendDetails[]) => {
    const friendOptions: { [key: string]: string } = {};
    options.forEach((friend) => {
      friendOptions[friend.userId.toString()] = `${friend.username}`;
    });

    const { value: selectedFriend } = await SweetAlert.fire({
      theme: "dark",
      title: "Select a Friend",
      input: "select",
      inputOptions: friendOptions,
      showCancelButton: true,
      confirmButtonText: "Next",
      cancelButtonText: "Cancel",
    });
    if (typeof selectedFriend === "number") {
      return selectedFriend;
    }
    if (typeof selectedFriend === "string" && !isNaN(parseInt(selectedFriend))) {
      return parseInt(selectedFriend);
    }
    return null;
  }

  const processAddTransaction = async (data: TransactionData) => {
    if (data.amount <= 0) {
      SweetAlert.fire({
        theme: "dark",
        icon: "error",
        title: "Invalid Amount",
        text: "Amount must be greater than zero.",
      });
      return;
    }
    let amountPaid = 0;
    let amountToPay = 0;
    // Make User Select Number of Accounts to Divide Amount in
    const accountsToPay = await SweetAlert.fire({
      theme: "dark",
      title: "How many accounts to divide the amount?",
      input: "number",
      showCancelButton: true,
      confirmButtonText: "Next",
      cancelButtonText: "Cancel",
      inputAttributes: {
        min: "1",
        step: "1"
      },
      inputValidator: (value) => {
        if (!value) {
          return "You need to select at least one account!";
        }
        if (parseInt(value) < 1) {
          return "You need to select at least one account!";
        }
      }
    });
    if (!accountsToPay.isConfirmed) {
      return;
    }
    const numberOfAccounts = parseInt(accountsToPay.value);
    let selfAccounts = accounts;
    const friendsAccounts: {[key: number]: APIFriendDetails} = {};
    for (const friend in friends) {
      if (friends[friend].accounts.length === 0) {
        continue;
      }
      friendsAccounts[friend] = {...friends[friend]};
    }
    for (let i = 0; i < numberOfAccounts; i++) {
      let option : "self" | "friend" | "other" = "other";
      if (i == 0) {
        option = "self";
      }
      if (i > 0 && (selfAccounts.length > 0 || Object.values(friendsAccounts).length > 0)) {
        const inOptions: { [key: string]: string } = {};
        if (selfAccounts.length > 0) {
          inOptions["self"] = "Self Account";
        }
        if (Object.values(friendsAccounts).length > 0) {
          inOptions["friend"] = "Friend Account";
        }
        inOptions["other"] = "Other Account";
        // Make User Select If Account is Self, Friend or Other
        const accountType = await SweetAlert.fire({
          theme: "dark",
          title: "Select Account Type",
          input: "select",
          inputOptions: inOptions,
          showCancelButton: true,
          confirmButtonText: "Next",
          cancelButtonText: "Cancel",
        });
        if (!accountType.isConfirmed) {
          return;
        }
        if (accountType.value === "self") {
          option = "self";
        } else if (accountType.value === "friend") {
          option = "friend";
        }
      }
      let accountId: number | null = null;
      let accountName: string | null = null;
      if (option === "other") {
        //Make User Enter Account Name
        const accountNameInput = await SweetAlert.fire({
          theme: "dark",
          title: "Enter Account Name",
          input: "text",
          showCancelButton: true,
          confirmButtonText: "Next",
          cancelButtonText: "Cancel",
          inputValidator: (value) => {
            if (!value) {
              return "You need to enter an account name!";
            }
          }
        });
        if (!accountNameInput.isConfirmed) {
          return;
        }
        accountName = accountNameInput.value;
        if (!accountName) {
          return;
        }
      } else if (option === "self") {
        accountId = await chooseAccount(selfAccounts);
        if (accountId === null) {
          return;
        }
        selfAccounts = selfAccounts.filter((account) => account.Id !== accountId);
      } else {
        const friendId = await chooseFriend(Object.values(friendsAccounts));
        if (friendId === null) {
          return;
        }
        const friend = friendsAccounts[friendId];
        accountId = await chooseAccount(friend.accounts);
        if (accountId === null) {
          return;
        }
        friendsAccounts[friendId].accounts = friend.accounts.filter(
          (account) => account.Id !== accountId
        );
        if (friendsAccounts[friendId].accounts.length === 0) {
          delete friendsAccounts[friendId];
        }
      }

      // Make User Enter Amount to Pay
      const amountToPayInput = await SweetAlert.fire({
        theme: "dark",
        title: "Enter Amount to Pay (Remaining: " + (data.amount - amountToPay) + ")",
        input: "number",
        showCancelButton: true,
        confirmButtonText: "Next",
        cancelButtonText: "Cancel",
        inputAttributes: {
          min: "0.01",
          step: "0.01",
          max: (data.amount - amountToPay).toString(),
        },
        inputValidator: (value) => {
          if (!value) {
            return "You need to enter an amount!";
          }
          if (parseFloat(value) < 0) {
            return "Amount must be greater than or equal to zero.";
          }
          if (parseFloat(value) > data.amount - amountToPay) {
            return "Amount must be less than or equal to remaining amount.";
          }
          if (i == numberOfAccounts - 1 && parseFloat(value) != data.amount - amountToPay) {
            return "Last account must be equal to remaining amount.";
          }
        }
      });
      if (!amountToPayInput.isConfirmed) {
        return;
      }
      const thisAmt = parseFloat(amountToPayInput.value);
      if (isNaN(thisAmt) || thisAmt < 0) {
        return;
      }
      amountToPay += thisAmt;

      const amountPaidInput = await SweetAlert.fire({
        theme: "dark",
        title: "Enter Amount Paid (Remaining: " + (data.amount - amountPaid) + ")",
        input: "number",
        showCancelButton: true,
        confirmButtonText: "Next",
        cancelButtonText: "Cancel",
        inputAttributes: {
          min: "0.01",
          step: "0.01",
          max: (data.amount - amountPaid).toString(),
        },
        inputValidator: (value) => {
          if (!value) {
            return "You need to enter an amount!";
          }
          if (parseFloat(value) < 0) {
            return "Amount must be greater than or equal to zero.";
          }
          if (parseFloat(value) > data.amount - amountPaid) {
            return "Amount must be less than or equal to remaining amount.";
          }
          if (i == numberOfAccounts - 1 && parseFloat(value) != data.amount - amountPaid) {
            return "Last account must be equal to remaining amount.";
          }
        }
      });
      if (!amountPaidInput.isConfirmed) {
        return;
      }
      const thisAmt2 = parseFloat(amountPaidInput.value);
      if (isNaN(thisAmt2) || thisAmt2 < 0) {
        return;
      }
      amountPaid += thisAmt2;

      if ((accountId === null || isNaN(accountId)) && accountName === null) {
        return
      }

      if (accountId) {
        data.amounts.push({
          accountId,
          amountToPay: thisAmt,
          amountPaid: thisAmt2,
        })
      } else if (accountName) {
        data.amounts.push({
          accountName,
          amountToPay: thisAmt,
          amountPaid: thisAmt2,
        })
      }
    }

    if (amountPaid !== data.amount) {
      SweetAlert.fire({
        theme: "dark",
        icon: "error",
        title: "Invalid Amounts",
        text: "Total amount paid must be equal to total amount.",
      });
      return;
    }
    if (amountToPay !== data.amount) {
      SweetAlert.fire({
        theme: "dark",
        icon: "error",
        title: "Invalid Amounts",
        text: "Total amount to pay must be equal to total amount.",
      });
      return;
    }

    const acc = await getAccountDetails();
    if (!acc) {
      router.push("/login");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    SweetAlert.fire({
      theme: "dark",
      title: "Creating Transaction",
      text: "Please wait...",
      allowOutsideClick: false,
      didOpen: () => {
        SweetAlert.showLoading();
      },
    });

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data)
    });
    SweetAlert.close();
    if (!response.ok) {
      SweetAlert.fire({
        theme: "dark",
        icon: "error",
        title: "Error",
        text: "Failed to create transaction.",
      });
      return;
    }
    await SweetAlert.fire({
      theme: "dark",
      icon: "success",
      title: "Success",
      text: "Transaction created successfully.",
    });
    router.refresh();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    async function getAccounts() {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const response = await fetch("/api/accounts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch accounts");
        return;
      }
      const accountsData = await response.json();
      setAccounts([...accountsData]);
    }

    async function getFriends() {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const response = await fetch("/api/friends", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch friends");
        return;
      }
      const friendsData: APIFriendsResponse = await response.json();
      const friendsDetails: { [key: number]: APIFriendDetails } = {};
      for (const friend of friendsData) {
        const accountResponse = await fetch(`/api/friends/${friend.userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!accountResponse.ok) {
          console.error(
            `Failed to fetch accounts for friend ${friend.username}`
          );
          continue;
        }
        const accountData: APIFriendDetails = await accountResponse.json();
        friendsDetails[friend.userId] = accountData;
      }
      setFriends(friendsDetails);
    }

    getAccountDetails().then((account) => {
      if (account) {
        setUsername(account.userName || "User");
        getAccounts();
        getFriends();
      } else {
        router.push("/login");
      }
    });
  }, [router]);

  const handleHelpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowHelpMessage(true);
    setTimeout(() => setShowHelpMessage(false), 3000); // Hide after 3 seconds
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg md:top-0 md:bottom-auto">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Dashboard Link */}
            <Link
              href="/"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </Link>

            {/* Statistics Link */}
            {/* <Link
              href="/statistics"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </Link> */}
            
            {/* Friends Link */}
            <Link
              href="/friends"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </Link>

            {/* Add Transaction Button */}
            <button
              onClick={() => setShowTransactionModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transform transition-transform hover:scale-105"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>


            {/* Settings Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                  {/* Username Display */}
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {username}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleHelpClick}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Help
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Help Message Popup */}
      {showHelpMessage && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          Ganney ka juice, bara glass, 20 rupay mein
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {!transactionType ? (
              // Transaction Type Selection
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Add Transaction
                  </h3>
                  <button
                    onClick={() => setShowTransactionModal(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTransactionType("income")}
                    className="p-4 border-2 border-green-500 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  >
                    <svg
                      className="w-8 h-8 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 11l5-5m0 0l5 5m-5-5v12"
                      />
                    </svg>
                    Income
                  </button>
                  <button
                    onClick={() => setTransactionType("expense")}
                    className="p-4 border-2 border-red-500 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <svg
                      className="w-8 h-8 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 13l-5 5m0 0l-5-5m5 5V6"
                      />
                    </svg>
                    Expense
                  </button>
                </div>
              </div>
            ) : (
              // Transaction Form
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Add {transactionType === "income" ? "Income" : "Expense"}
                  </h3>
                  <button
                    onClick={() => setTransactionType(null)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Back
                  </button>
                </div>
                {/* Add your transaction form here */}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const data: TransactionData = {
                      amount: parseFloat(formData.get("amount")!.toString()),
                      category: formData.get("category")!.toString(),
                      description: formData.get("description")!.toString(),
                      notes: formData.get("notes")?.toString(),
                      isIncome: transactionType === "income",
                      amounts: [],
                    };
                    if (data.notes == "") {
                      data.notes = undefined;
                    }
                    processAddTransaction(data);
                  }}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Amount
                    </label>
                    <input
                      type="number"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter amount"
                      name="amount"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Category
                    </label>
                    <input
                      required
                      type="text"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter category"
                      name="category"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Description
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter description"
                      required
                      name="description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Notes
                    </label>
                    <textarea
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter notes"
                      name="notes"
                      rows={3}
                    ></textarea>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowTransactionModal(false)}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 rounded-md text-white ${
                        transactionType === "income"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      Add {transactionType === "income" ? "Income" : "Expense"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
