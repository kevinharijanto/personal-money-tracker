import { TxnType } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Utility functions for transaction amount handling
 * Prevents double-signing issues and ensures consistent amount formatting
 */

/**
 * Normalize amount string by removing leading signs
 */
export function normalizeAmount(amount: string | number): string {
  const str = String(amount);
  return str.replace(/^[-+]/, "");
}

/**
 * Check if transaction type should have negative amount
 */
export function shouldBeNegative(type: TxnType): boolean {
  return type === "EXPENSE" || type === "TRANSFER_OUT";
}

/**
 * Sign amount based on transaction type
 * Only signs if amount is positive (not already signed)
 */
export function signAmount(amount: string | number, type: TxnType): string {
  const normalized = normalizeAmount(amount);
  const shouldNeg = shouldBeNegative(type);
  
  // Only sign if not already negative
  const isAlreadyNegative = String(amount).startsWith('-');
  
  if (isAlreadyNegative) {
    return amount.toString();
  }
  
  return shouldNeg ? `-${normalized}` : normalized;
}

/**
 * Re-sign amount when transaction type changes
 * Handles all sign change scenarios correctly
 */
export function resignAmount(
  currentAmount: string | number | Prisma.Decimal,
  newType: TxnType
): string {
  const currentStr = currentAmount.toString();
  const isCurrentlyNegative = currentStr.startsWith('-');
  const shouldNeg = shouldBeNegative(newType);
  
  // Extract absolute value
  const absolute = normalizeAmount(currentStr);
  
  // Apply new sign
  return shouldNeg ? `-${absolute}` : absolute;
}

/**
 * Format amount for display (with currency symbol)
 */
export function formatAmount(
  amount: string | number | Prisma.Decimal,
  currency: string = "IDR",
  showSign: boolean = true
): string {
  const amountStr = amount.toString();
  const isNegative = amountStr.startsWith('-');
  const absolute = normalizeAmount(amountStr);
  
  // Format with thousand separators
  const formatted = parseFloat(absolute).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  const sign = showSign && isNegative ? '-' : '';
  const symbol = currency === 'IDR' ? 'Rp ' : `${currency} `;
  
  return `${sign}${symbol}${formatted}`;
}

/**
 * Calculate balance from transactions and starting balance
 */
export function calculateBalance(
  startingBalance: string | number | Prisma.Decimal,
  transactions: Array<{ amount: string | number | Prisma.Decimal }>
): string {
  const start = new Prisma.Decimal(startingBalance);
  
  const sum = transactions.reduce((acc, txn) => {
    return acc.plus(new Prisma.Decimal(txn.amount));
  }, new Prisma.Decimal(0));
  
  return start.plus(sum).toString();
}

/**
 * Validate amount string
 */
export function validateAmount(amount: string): {
  isValid: boolean;
  error?: string;
  normalized?: string;
} {
  // Check if amount is a valid number
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return {
      isValid: false,
      error: 'Amount must be a valid number',
    };
  }
  
  // Check if amount is positive
  if (num < 0) {
    return {
      isValid: false,
      error: 'Amount must be positive (sign is handled automatically)',
    };
  }
  
  // Check reasonable limits
  if (num > 999999999.99) {
    return {
      isValid: false,
      error: 'Amount exceeds maximum allowed value',
    };
  }
  
  return {
    isValid: true,
    normalized: normalizeAmount(amount),
  };
}

/**
 * Create transaction data with proper amount signing
 */
export function createTransactionData(
  data: {
    amount: string | number;
    type: TxnType;
    accountId: string;
    categoryId: string;
    description?: string;
    date?: Date | string;
  }
) {
  return {
    ...data,
    amount: signAmount(data.amount, data.type),
    date: data.date instanceof Date ? data.date : 
            data.date ? new Date(data.date) : undefined,
  };
}

/**
 * Update transaction data with proper amount handling
 */
export function updateTransactionData(
  currentData: {
    amount: string | number | Prisma.Decimal;
    type: TxnType;
  },
  updates: Partial<{
    amount: string | number;
    type: TxnType;
    accountId: string;
    categoryId: string;
    description: string;
    date: Date | string;
  }>
) {
  const result: any = { ...updates };
  
  // Handle amount updates
  if (updates.amount !== undefined) {
    result.amount = signAmount(updates.amount, currentData.type);
  } else if (updates.type !== undefined) {
    // Type changed, re-sign existing amount
    result.amount = resignAmount(currentData.amount, updates.type);
  }
  
  // Handle date updates
  if (updates.date !== undefined) {
    result.date = updates.date instanceof Date ? updates.date : 
                updates.date ? new Date(updates.date) : undefined;
  }
  
  return result;
}

/**
 * Transaction type utilities
 */
export const TransactionTypes = {
  isIncome: (type: TxnType): boolean => type === "INCOME",
  isExpense: (type: TxnType): boolean => type === "EXPENSE",
  isTransferIn: (type: TxnType): boolean => type === "TRANSFER_IN",
  isTransferOut: (type: TxnType): boolean => type === "TRANSFER_OUT",
  isTransfer: (type: TxnType): boolean => 
    type === "TRANSFER_IN" || type === "TRANSFER_OUT",
  
  getAll: (): TxnType[] => [
    "INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"
  ],
  
  getDisplay: (type: TxnType): string => {
    const displays = {
      "INCOME": "Income",
      "EXPENSE": "Expense", 
      "TRANSFER_IN": "Transfer In",
      "TRANSFER_OUT": "Transfer Out",
    };
    return displays[type] || type;
  },
};

/**
 * Amount validation rules
 */
export const AmountValidation = {
  min: 0.01,
  max: 999999999.99,
  decimalPlaces: 2,
  
  validate: (amount: string | number): {
    isValid: boolean;
    error?: string;
  } => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(num)) {
      return { isValid: false, error: 'Invalid number format' };
    }
    
    if (num < AmountValidation.min) {
      return { isValid: false, error: `Amount must be at least ${AmountValidation.min}` };
    }
    
    if (num > AmountValidation.max) {
      return { isValid: false, error: `Amount must not exceed ${AmountValidation.max}` };
    }
    
    // Check decimal places
    const decimal = num.toString().split('.')[1];
    if (decimal && decimal.length > AmountValidation.decimalPlaces) {
      return { 
        isValid: false, 
        error: `Amount cannot have more than ${AmountValidation.decimalPlaces} decimal places` 
      };
    }
    
    return { isValid: true };
  },
};

/**
 * Currency utilities
 */
export const CurrencyUtils = {
  format: (
    amount: string | number, 
    currency: string = 'IDR'
  ): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('id-ID', {
      style: 'currency',
      currency: currency === 'IDR' ? 'IDR' : currency,
    });
  },
  
  getSymbol: (currency: string): string => {
    const symbols: Record<string, string> = {
      'IDR': 'Rp',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
    };
    return symbols[currency] || currency;
  },
  
  isValid: (currency: string): boolean => {
    const validCurrencies = ['IDR', 'USD', 'EUR', 'GBP', 'JPY'];
    return validCurrencies.includes(currency.toUpperCase());
  },
};