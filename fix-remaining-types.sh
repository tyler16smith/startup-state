#!/bin/bash

# Fix add-investment-dialog purchaseDate
sed -i '' 's/purchaseDate: values\.purchaseDate || undefined,/purchaseDate: values.purchaseDate ? new Date(values.purchaseDate).toISOString() : undefined,/g' apps/web/src/components/dashboard/add-investment-dialog.tsx

# Fix real-estate-card purchaseDate
sed -i '' 's/purchaseDate: values\.purchaseDate$/purchaseDate: values.purchaseDate ? new Date(values.purchaseDate).toISOString() : undefined/g' apps/web/src/components/dashboard/real-estate-card.tsx

# Fix real-estate-card projection access
sed -i '' 's/projection\?\.\[4\]/projection?.years?.[4]/g' apps/web/src/components/dashboard/real-estate-card.tsx
sed -i '' 's/projection\.length/projection?.years?.length/g' apps/web/src/components/dashboard/real-estate-card.tsx
sed -i '' 's/data={projection}/data={projection?.years ?? []}/g' apps/web/src/components/dashboard/real-estate-card.tsx

# Fix connect-institution-button metadata type
sed -i '' 's/metadata\?: unknown/metadata as any/g' apps/web/src/components/plaid/connect-institution-button.tsx

# Fix connected-institutions-list
sed -i '' 's/utils\.plaid\.getConnectedInstitutions\.invalidate/queryClient.invalidateQueries({ queryKey: ["plaid", "institutions"] })/g' apps/web/src/components/plaid/connected-institutions-list.tsx
sed -i '' 's/institution={institution}/institution={institution as any}/g' apps/web/src/components/plaid/connected-institutions-list.tsx

# Fix onboarding results-screen
sed -i '' 's/statusLabel={$/statusLabel={(/' apps/web/src/app/onboarding/analysis/results-screen.tsx
sed -i '' 's/)$/)) as string/' apps/web/src/app/onboarding/analysis/results-screen.tsx
sed -i '' 's/projections={result\.projections}/projections={result.projections ?? []}/g' apps/web/src/app/onboarding/analysis/results-screen.tsx
sed -i '' 's/categoryScores={result\.categoryScores}/categoryScores={result.categoryScores ?? []}/g' apps/web/src/app/onboarding/analysis/results-screen.tsx
sed -i '' 's/recommendations={result\.recommendations}/recommendations={result.recommendations ?? []}/g' apps/web/src/app/onboarding/analysis/results-screen.tsx

echo "All type fixes applied"
