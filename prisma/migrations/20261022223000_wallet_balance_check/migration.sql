-- Add check constraint ensuring wallet balance is never negative (anti double-spending / overdraft defense)
ALTER TABLE "WalletAccount" ADD CONSTRAINT "wallet_balance_non_negative" CHECK ("balance" >= 0);
