#!/bin/bash

# Fix transactions page issues
sed -i '' 's/(h._count.transactions)/(h._count?.transactions ?? 0)/g' apps/web/src/app/dashboard/transactions/page.tsx
sed -i '' 's/setEditingTx(tx);/setEditingTx(tx as any);/g' apps/web/src/app/dashboard/transactions/page.tsx
sed -i '' 's/hashtags={tx.hashtags}/hashtags={tx.hashtags ?? []}/g' apps/web/src/app/dashboard/transactions/page.tsx

echo "Type fixes applied"
