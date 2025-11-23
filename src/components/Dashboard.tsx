"use client";

import { useState, useEffect } from "react";
import { useAccounts, useTransactions, useCategories, useHouseholds } from "@/hooks/useApi";
import { transactionService, accountService } from "@/services/apiService";
import { useHousehold } from "@/contexts/HouseholdContext";

export default function Dashboard() {
  const { householdId, setHouseholdId } = useHousehold();
  const { data: households } = useHouseholds();
  const { data: accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts();
  const { data: transactions, loading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useTransactions();
  const { data: categories, loading: categoriesLoading } = useCategories();
  
  // Set the first household as the active one when households are loaded
  useEffect(() => {
    if (households && households.length > 0 && !householdId) {
      setHouseholdId(households[0].id);
    }
  }, [households, householdId, setHouseholdId]);
  
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    type: "EXPENSE",
    accountId: "",
    categoryId: "",
    description: "",
  });

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transactionService.create(householdId, newTransaction);
      // Reset form and refresh data
      setNewTransaction({
        amount: "",
        type: "EXPENSE",
        accountId: "",
        categoryId: "",
        description: "",
      });
      setShowAddTransaction(false);
      // Refetch data to update balances
      await refetchAccounts();
      await refetchTransactions();
    } catch (error) {
      console.error("Failed to add transaction:", error);
      alert("Failed to add transaction");
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      await transactionService.delete(householdId, transactionId);
      // Refetch data to update balances
      await refetchAccounts();
      await refetchTransactions();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      alert("Failed to delete transaction");
    }
  };

  const handleEditAccount = (accountId: string, currentName: string) => {
    setEditingAccountId(accountId);
    setEditingAccountName(currentName);
  };

  const handleSaveAccountName = async () => {
    if (!editingAccountId || !editingAccountName.trim()) return;

    try {
      await accountService.update(editingAccountId, { name: editingAccountName });
      setEditingAccountId(null);
      setEditingAccountName("");
      await refetchAccounts();
    } catch (error) {
      console.error("Failed to update account name:", error);
      alert("Failed to update account name");
    }
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditingAccountName("");
  };

  // Show loading while households are being fetched or while no household is selected yet
  if (!householdId || accountsLoading || transactionsLoading || categoriesLoading) {
    return <div>Loading dashboard...</div>;
  }

  if (accountsError || transactionsError) {
    return <div>Error loading data: {accountsError || transactionsError}</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Financial Dashboard</h1>
      
      {/* Accounts Section */}
      <div style={{ marginBottom: "30px" }}>
        <h2>Accounts</h2>
        {accounts && accounts.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
            {accounts.map((account: any) => (
              <div key={account.id} style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px",
                backgroundColor: "#f9f9f9"
              }}>
                {editingAccountId === account.id ? (
                  <div>
                    <input
                      type="text"
                      value={editingAccountName}
                      onChange={(e) => setEditingAccountName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "4px",
                        marginBottom: "8px",
                        fontSize: "16px",
                        fontWeight: "bold"
                      }}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button
                        onClick={handleSaveAccountName}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ margin: 0 }}>{account.name}</h3>
                      <button
                        onClick={() => handleEditAccount(account.id, account.name)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                        title="Edit account name"
                      >
                        Edit
                      </button>
                    </div>
                    <p>Balance: {account.currency} {account.balance}</p>
                    <p>Type: {account.scope}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No accounts found. Create your first account to get started.</p>
        )}
      </div>

      {/* Transactions Section */}
      <div style={{ marginBottom: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2>Recent Transactions</h2>
          <button
            onClick={() => setShowAddTransaction(!showAddTransaction)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Add Transaction
          </button>
        </div>

        {showAddTransaction && (
          <form onSubmit={handleAddTransaction} style={{ 
            marginBottom: "20px", 
            padding: "15px", 
            backgroundColor: "#f0f0f0", 
            borderRadius: "8px" 
          }}>
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Amount</label>
              <input
                type="number"
                step="0.01"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                required
                style={{ width: "100%", padding: "8px" }}
              />
            </div>
            
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Type</label>
              <select
                value={newTransaction.type}
                onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>
            
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Account</label>
              <select
                value={newTransaction.accountId}
                onChange={(e) => setNewTransaction({...newTransaction, accountId: e.target.value})}
                required
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Select Account</option>
                {accounts?.map((account: any) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Category</label>
              <select
                value={newTransaction.categoryId}
                onChange={(e) => setNewTransaction({...newTransaction, categoryId: e.target.value})}
                required
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">Select Category</option>
                {categories?.map((category: any) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Description</label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                style={{ width: "100%", padding: "8px" }}
              />
            </div>
            
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "10px"
              }}
            >
              Save Transaction
            </button>
            <button
              type="button"
              onClick={() => setShowAddTransaction(false)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </form>
        )}

        {transactions && transactions.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>Date</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Category</th>
                <th style={{ textAlign: "right", padding: "8px" }}>Amount</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                <th style={{ textAlign: "center", padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((transaction: any) => (
                <tr key={transaction.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px" }}>
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px" }}>{transaction.description || "-"}</td>
                  <td style={{ padding: "8px" }}>{transaction.category?.name || "-"}</td>
                  <td style={{
                    padding: "8px",
                    textAlign: "right",
                    color: transaction.type === "INCOME" ? "green" : "red"
                  }}>
                    {transaction.type === "INCOME" ? "+" : "-"}{transaction.amount}
                  </td>
                  <td style={{ padding: "8px" }}>{transaction.type}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                      title="Delete transaction"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No transactions found. Add your first transaction to get started.</p>
        )}
      </div>
    </div>
  );
}