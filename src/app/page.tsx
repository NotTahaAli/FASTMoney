"use client";

import Navigation from "@/components/Navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPenToSquare,
  faTrash,
  faChevronUp,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { IAccount } from "@/models/accounts.model";
import { getAccountDetails } from "@/middleware/clientAuth.middleware";
import SweetAlert from "sweetalert2";
import {
  ITransaction,
  ITransactionAmount,
  ITransactionTag,
} from "@/models/transactions.model";

type APIAccount = Omit<IAccount, "CreatedOn" | "Balance"> & {
  CreatedOn: string;
  Balance: number | null;
};

type APITags = Omit<ITransactionTag, "createdOn"> & {
  createdOn: string;
};
type APIAmount = Omit<ITransactionAmount, "createdOn"> & {
  createdOn: string;
};

type APITransaction = Omit<ITransaction, "createdOn" | "amounts" | "tags"> & {
  createdOn: string;
  amounts: APIAmount[];
  tags?: APITags[];
};
export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [accounts, setAccounts] = useState<APIAccount[]>([]); // State to hold account data
  const [error, setError] = useState<string | null>(null);
  const [transactionSettings, setTransactionSettings] = useState<{
    limit: number;
    page: number;
    totalPages: number;
  }>({
    limit: 2,
    page: 1,
    totalPages: 1,
  });
  const [transactions, setTransactions] = useState<APITransaction[]>([]); // State to hold transaction data
  const [accountNames, setAccountNames] = useState<{ [key: number]: string }>({});
  const [accountOwners, setAccountOwners] = useState<{[key: number]: number;}>({});
  const [userNames, setUserNames] = useState<{ [key: number]: string }>({});

  async function addAccountClicked() {
    const result = await SweetAlert.fire({
      theme: "dark",
      title: "Add Account",
      input: "text",
      inputLabel: "Account Name",
      inputPlaceholder: "Enter account name",
      showCancelButton: true,
      confirmButtonText: "Add",
      cancelButtonText: "Cancel",
      preConfirm: (accountName) => {
        if (!accountName) {
          SweetAlert.showValidationMessage("Please enter an account name");
        }
        return accountName;
      },
    });
    if (result.isConfirmed) {
      const accountName = result.value;
      const account = await getAccountDetails();
      if (!account) {
        router.push("/login");
        return;
      }
      const token = localStorage.getItem("token");

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: accountName,
          initialBalance: 0,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(
          `Failed to add account: ${errorData.message || response.statusText}`
        );
      } else {
        const newAccount = await response.json();
        setAccounts((prevAccounts) => [newAccount, ...prevAccounts]);
        setAccountNames((prevNames) => ({
          ...prevNames,
          [newAccount.Id]: newAccount.Name,
        }));
        SweetAlert.fire({
          theme: "dark",
          icon: "success",
          title: "Account Added",
          text: `Account "${accountName}" has been added successfully.`,
        });
      }
    }
  }

  async function deleteAccountClicked(account: APIAccount) {
    const result = await SweetAlert.fire({
      theme: "dark",
      title: "Delete Account",
      text: `Are you sure you want to delete the account "${account.Name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });
    if (!result.isConfirmed) {
      return; // User canceled the deletion
    }

    SweetAlert.fire({
      theme: "dark",
      title: "Deleting Account...",
      text: `Please wait while we delete the account.`,
      showConfirmButton: false,
      didOpen: () => {
        SweetAlert.showLoading();
      },
      allowOutsideClick: () => !SweetAlert.isLoading(),
    });

    const acc = await getAccountDetails();
    if (!acc) {
      router.push("/login");
      return;
    }
    const token = localStorage.getItem("token");

    const response = await fetch(`/api/accounts/${account.Id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(
        `Failed to delete account: ${errorData.message || response.statusText}`
      );
      SweetAlert.close();
    } else {
      SweetAlert.fire({
        theme: "dark",
        icon: "success",
        title: "Account Deleted",
        text: `Account has been deleted successfully.`,
      });
      setAccounts((prevAccounts) =>
        prevAccounts.filter((thisAccount) => thisAccount.Id !== account.Id)
      );
    }
  }

  async function editAccountClicked(account: APIAccount) {
    const result = await SweetAlert.fire({
      theme: "dark",
      title: "Edit Account",
      input: "text",
      inputLabel: "Account Name",
      inputValue: account.Name,
      inputPlaceholder: "Enter new account name",
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      preConfirm: (accountName) => {
        if (!accountName) {
          SweetAlert.showValidationMessage("Please enter an account name");
        }
        return accountName;
      },
    });
    if (!result.isConfirmed) {
      return; // User canceled the edit
    }

    SweetAlert.fire({
      theme: "dark",
      title: "Updating Account...",
      text: `Please wait while we update the account.`,
      showConfirmButton: false,
      didOpen: () => {
        SweetAlert.showLoading();
      },
      allowOutsideClick: () => !SweetAlert.isLoading(),
    });

    const accountName = result.value;
    const acc = await getAccountDetails();
    if (!acc) {
      router.push("/login");
      return;
    }
    const token = localStorage.getItem("token");

    const response = await fetch(`/api/accounts/${account.Id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: accountName,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      SweetAlert.fire({
        theme: "dark",
        icon: "error",
        title: "Error",
        text: `Failed to update account: ${
          errorData.message || response.statusText
        }`,
      });
    } else {
      const updatedAccount = await response.json();
      setAccounts((prevAccounts) =>
        prevAccounts.map((thisAccount) =>
          thisAccount.Id === updatedAccount.Id ? updatedAccount : thisAccount
        )
      );
      setAccountNames((prevNames) => ({
        ...prevNames,
        [updatedAccount.Id]: updatedAccount.Name,
      }));
      SweetAlert.fire({
        theme: "dark",
        icon: "success",
        title: "Account Updated",
        text: `Account "${accountName}" has been updated successfully.`,
      });
    }
  }

  async function deleteTransaction(transaction: APITransaction) {
    const result = await SweetAlert.fire({
      theme: "dark",
      title: "Delete Transaction",
      text: `Are you sure you want to delete the transaction "${transaction.description || "No Description"}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });
    if (!result.isConfirmed) {
      return; // User canceled the deletion
    }

    SweetAlert.fire({
      theme: "dark",
      title: "Deleting Transaction...",
      text: `Please wait while we delete the transaction.`,
      showConfirmButton: false,
      didOpen: () => {
        SweetAlert.showLoading();
      },
      allowOutsideClick: () => !SweetAlert.isLoading(),
    });

    const token = localStorage.getItem("token");

    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amounts: []
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(
        `Failed to delete transaction: ${
          errorData.message || response.statusText
        }`
      );
    } else {
      SweetAlert.fire({
        theme: "dark",
        icon: "success",
        title: "Transaction Deleted",
        text: `Transaction has been deleted successfully.`,
      });
      await fetchTransactions();
    }
  }

  async function goToPage(newPage: number) {
    if (newPage < 1 || newPage > transactionSettings.totalPages) {
      return;
    }
    setTransactionSettings((prevSettings) => ({
      ...prevSettings,
      page: newPage,
    }));
  }

  const fetchTransactions = useCallback(async () => {
    SweetAlert.fire({
      theme: "dark",
      title: "Loading Transactions...",
      text: `Please wait while we load the transactions.`,
      showConfirmButton: false,
      didOpen: () => {
        SweetAlert.showLoading();
      },
      allowOutsideClick: () => !SweetAlert.isLoading(),
    });
    const token = localStorage.getItem("token");

    const response = await fetch(
      `/api/transactions?limit=${transactionSettings.limit}&page=${transactionSettings.page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    SweetAlert.close();
    if (!response.ok) {
      const errorData = await response.json();
      setError(
        `Failed to fetch transactions: ${
          errorData.message || response.statusText
        }`
      );
      setTransactions([]);
    } else {
      const transactionsData: {
        page: number;
        limit: number;
        total: number;
        transactions: APITransaction[];
      } = await response.json();
      setTransactionSettings((prevSettings) => ({
        ...prevSettings,
        totalPages: Math.ceil(transactionsData.total / transactionsData.limit),
      }));
      for (const transaction of transactionsData.transactions) {
        for (const amount of transaction.amounts) {
          if (amount.accountId && !accountNames[amount.accountId]) {
            const accountResponse = await fetch(
              `/api/accounts/${amount.accountId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (accountResponse.ok) {
              const accountData: APIAccount = await accountResponse.json();
              setAccountNames((prevNames) => ({
                ...prevNames,
                [accountData.Id]: accountData.Name,
              }));
              if (!accountOwners[accountData.Id]) {
                setAccountOwners((prevOwners) => ({
                  ...prevOwners,
                  [accountData.Id]: accountData.UserId,
                }));
                if (!userNames[accountData.UserId]) {
                  const userResponse = await fetch(
                    `/api/friends/${accountData.UserId}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );
                  if (userResponse.ok) {
                    const userData: {
                      userId: number,
                      username: string,
                      accounts: APIAccount[]
                    } = await userResponse.json();
                    setUserNames((prevNames) => ({
                      ...prevNames,
                      [userData.userId]: userData.username,
                    }));
                  }
                }
              }
            }
          }
        }
      }
      setTransactions(transactionsData.transactions);
    }
  }, [transactionSettings.limit, transactionSettings.page]);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const acc = await getAccountDetails();
        if (!acc) {
          router.push("/login");
          return;
        }
        const token = localStorage.getItem("token");

        // Fetch accounts data
        const response = await fetch("/api/accounts", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(
            `Failed to fetch accounts: ${
              errorData.message || response.statusText
            }`
          );
          setAccounts([]);
          setIsLoading(false);
        } else {
          const accountsData = await response.json();
          const accountNamesMap: { [key: number]: string } = accountNames;
          const userNamesMap: { [key: number]: string } = userNames;
          const accountOwnersMap: { [key: number]: number } = accountOwners;
          let userId: number | null = null;
          accountsData.forEach((account: APIAccount) => {
            accountNamesMap[account.Id] = account.Name;
            userNamesMap[account.UserId] = acc.userName;
            accountOwnersMap[account.Id] = account.UserId;
            if (account.UserId !== userId) {
              userId = account.UserId;
            }
          });
          setAccountNames(accountNamesMap);
          setUserNames(userNamesMap);
          setAccountOwners(accountOwnersMap);
          setAccounts([...accountsData]);
          await fetchTransactions();
          setIsLoading(false);
        }
      } catch (error) {
        console.error(
          "Error checking authentication or fetching accounts:",
          error
        );
        setError("An unexpected error occurred.");
        setAccounts([]); // Show demo account on error
        router.push("/login");
      }
    };

    checkAuthAndFetchData();
  }, [router, fetchTransactions]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28 cursor-default">
        <div className="max-w-screen-xl mx-auto">
          {/* App Title */}
          <div className="text-center mb-8 cursor-default">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              FASTMoney
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Finance Management in your Pocket
            </p>
          </div>

          {/* Balance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6 cursor-pointer-area hover:shadow-xl transition-shadow">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Total Balance
            </p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              Rs. 25,000.00{" "}
              {/* This will eventually be calculated from accounts */}
            </h2>
          </div>

          {/* Dropdown */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md cursor-pointer-area hover:shadow-xl transition-shadow flex items-center justify-between">
              <span className="text-gray-900 dark:text-white font-semibold">
                Your Accounts
              </span>
              <div className="flex items-center" style={{ gap: "25px" }}>
                <button
                  className="text-green-500 hover:text-green-600 focus:outline-none cursor-pointer"
                  onClick={() => {
                    addAccountClicked();
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
                </button>
                <span onClick={toggleDropdown} className="cursor-pointer">
                  {isDropdownOpen ? (
                    <FontAwesomeIcon
                      icon={faChevronUp}
                      className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-300"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-300"
                    />
                  )}
                </span>
              </div>
            </div>
            <div
              className={`mt-2 space-y-2 overflow-hidden transition-max-height duration-300 ${
                isDropdownOpen ? "max-h-[500px]" : "max-h-0" // Adjust max-h as needed
              }`}
            >
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <div
                    key={account.Id}
                    className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm cursor-pointer-area hover:shadow-md transition-shadow flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {account.Name}
                      </h4>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Created On:{" "}
                        {new Date(account.CreatedOn).toLocaleString("en-PK")}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Balance: Rs.{" "}
                        {account.Balance?.toLocaleString("en-IN") || "0.00"}
                      </p>
                    </div>
                    <div className="flex items-center" style={{ gap: "25px" }}>
                      <button
                        className="text-blue-500 hover:text-blue-600 focus:outline-none cursor-pointer"
                        onClick={() => {
                          editAccountClicked(account);
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faPenToSquare}
                          className="w-4 h-4"
                        />
                      </button>
                      <button
                        className="text-red-500 hover:text-red-600 focus:outline-none cursor-pointer"
                        onClick={() => {
                          deleteAccountClicked(account);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                  <p className="text-gray-500 dark:text-gray-400">
                    No accounts added yet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <section className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 cursor-default">
              Recent Transactions
            </h3>
            <div className="space-y-4">
              {transactionSettings.totalPages > 0 ? (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow min-h-[250px] flex flex-col items-start justify-start cursor-pointer-area hover:shadow-xl transition-shadow">
                    {transactions.length > 0 ? 
                    transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-2 w-full shadow-sm flex items-center justify-between"
                      >
                        <div>
                          <h4 className={`text-lg font-semibold ${transaction.isIncome ? "text-green-500" : "text-red-500"}`}>
                            {transaction.description || "No Description"}{" - "}{transaction.isIncome ? "Income" : "Expense"}
                          </h4>
                          {transaction.notes && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Notes: {transaction.notes}
                            </p>
                          )}
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Created On:{" "}
                            {new Date(transaction.createdOn).toLocaleString(
                              "en-PK"
                            )}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Category: {transaction.category}
                          </p>
                          {transaction.tags && transaction.tags.length > 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Tags:{" "}
                              {transaction.tags
                                .map((tag) => tag.tag)
                                .join(", ")}
                            </p>
                          )}
                          {/* Display amounts */}
                          {transaction.amounts &&
                            transaction.amounts.length > 0 && (
                              <div className="mt-2">
                                {transaction.amounts.map((amount) => (
                                  <p
                                    key={amount.id}
                                    className={`text-sm ${
                                      amount.amountPaid > amount.amountToPay
                                        ? "text-green-500"
                                        : amount.amountPaid < amount.amountToPay ? "text-red-500" : "text-gray-300"
                                    }`}
                                  >
                                    Account: {amount.accountName ?? accountNames[amount.accountId!]} - {" "}
                                    {amount.accountId && (
                                      <>Owner: {userNames[accountOwners[amount.accountId]]} -{" "}</>
                                    )}
                                    Amount: Rs.{" "}
                                    {amount.amountPaid.toLocaleString("en-IN")}/{amount.amountToPay.toLocaleString("en-IN")}
                                  </p>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center" style={{ gap: "25px" }}>
                          {/* <button
                            className="text-blue-500 hover:text-blue-600 focus:outline-none cursor-pointer"
                            onClick={() => {
                              // TODO: Edit transaction logic here
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faPenToSquare}
                              className="w-4 h-4"
                            />
                          </button> */}
                          <button
                            className="text-red-500 hover:text-red-600 focus:outline-none cursor-pointer"
                            onClick={() => {
                              deleteTransaction(transaction);
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faTrash}
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                      </div>
                    ))
                    : (
                      <p className="text-gray-500 dark:text-gray-400 text-lg w-full text-center">
                        No transactions on this page yet
                      </p>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  <div className="w-full flex justify-center items-center space-x-4 mt-4">
                    <button
                      onClick={() => goToPage(transactionSettings.page - 1)}
                      disabled={transactionSettings.page <= 1}
                      className={`px-3 py-1 rounded ${
                        transactionSettings.page <= 1
                          ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
                      }`}
                    >
                      Previous
                    </button>
                    <span className="text-gray-700 dark:text-gray-300">
                      Page {transactionSettings.page} of {transactionSettings.totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(transactionSettings.page + 1)}
                      disabled={transactionSettings.page >= transactionSettings.totalPages}
                      className={`px-3 py-1 rounded ${
                        transactionSettings.page >= transactionSettings.totalPages
                          ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow min-h-[250px] flex items-center justify-center cursor-pointer-area hover:shadow-xl transition-shadow">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    No transactions yet
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <Navigation />
    </>
  );
}
