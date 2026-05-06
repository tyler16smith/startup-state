# FinApp iOS

Native iOS app for Fin, built with SwiftUI.

## Repo Findings Summary

### Auth Model
- **Web app** uses NextAuth v5 with Google OAuth + Credentials (email/password)
- **NOT using Auth0** - uses custom JWT-based token system
- Session strategy: JWT with shared `AUTH_SECRET` across web and API

### API Auth Expectations  
The API supports **both** session cookies AND bearer tokens:
- Web: NextAuth session cookies
- Mobile: Bearer tokens via `Authorization: Bearer {accessToken}`

Token exchange endpoint: `POST /api/v1/auth/exchange`
- `type: "credentials"` - email/password login → returns access + refresh tokens
- `type: "session"` - exchange web session for tokens
- Access tokens expire in 1 hour, refresh tokens in 90 days

### Available Endpoints for iOS
| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/exchange` | Get access/refresh tokens (credentials login) |
| `POST /api/v1/auth/refresh` | Refresh access token |
| `POST /api/v1/auth/revoke` | Logout / revoke sessions |
| `POST /api/v1/balanceSnapshot/getHistory` | Net worth history (chart-ready) |
| `GET /api/v1/investment/getAll` | List all investments |
| `POST /api/v1/transaction/getMonthlyAggregates` | Monthly income/expense |

### Net Worth Data Format
`POST /api/v1/balanceSnapshot/getHistory` returns:
```json
[
  { "month": "2024-01", "total": 125000 },
  { "month": "2024-02", "total": 128500 }
]
```

### Auth Pattern for iOS
**Pattern A (Credentials)** - Currently implemented:
1. iOS collects email/password
2. Calls `POST /api/v1/auth/exchange` with `type: "credentials"`
3. Receives `{ accessToken, refreshToken, expiresAt }`
4. Stores tokens in Keychain
5. Attaches `Authorization: Bearer {accessToken}` to API calls

**Pattern B (Google Sign-In)** - Placeholder exists in API:
- Requires completing OAuth ID token verification in API
- Would use native Google Sign-In SDK

## Project Structure

```
apps/ios/
├── FinApp/
│   ├── App/                      # App entry, router, dependencies
│   ├── Config/                   # Environment configuration
│   ├── Core/
│   │   ├── Auth/                 # Auth state, session, credentials storage
│   │   ├── Networking/           # API client, requests, errors
│   │   ├── DesignSystem/         # Shared UI components
│   │   └── Utilities/            # Formatters, helpers
│   ├── Features/
│   │   ├── Auth/                 # Login views and view models
│   │   ├── Dashboard/            # Net worth chart, summary
│   │   ├── Investments/          # Investment list (placeholder)
│   │   └── Settings/             # Settings (placeholder)
│   ├── Resources/                # Assets, strings
│   └── SupportingFiles/          # Entitlements, configs
├── FinApp.xcodeproj/             # Xcode project
└── README.md
```

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+

## Setup Instructions

### 1. Clone and Open
```bash
cd apps/ios
open FinApp.xcodeproj
```

### 2. Configure Environment
Create `FinApp/Config/Secrets.xcconfig` (gitignored):
```
API_BASE_URL = http://localhost:3001
```

For production:
```
API_BASE_URL = https://api.financewithfin.com
```

### 3. Run the API locally
From project root:
```bash
pnpm install
pnpm --filter fin-api dev
```

### 4. Build and Run
Select simulator or device in Xcode and press Run (⌘R).

## Validation Checklist

- [ ] Login with email/password succeeds
- [ ] Tokens are stored in Keychain
- [ ] App restores session on relaunch
- [ ] Authenticated API request succeeds
- [ ] Unauthorized state redirects to login
- [ ] Net worth chart renders with data
- [ ] Empty state displays when no data
- [ ] Loading state displays during fetch
- [ ] Error state displays on failure
- [ ] Logout clears session properly
- [ ] Token refresh works when access token expires

## Follow-up Gaps

1. **Google Sign-In**: API has placeholder but OAuth token verification not implemented
2. **Apple Sign-In**: Not yet supported in API
3. **Biometric unlock**: Out of scope for scaffold
4. **Push notifications**: Out of scope
5. **Offline mode**: Out of scope

## Architecture Notes

- **MVVM pattern** with SwiftUI
- **Swift Concurrency** (async/await) for networking
- **Keychain** for secure credential storage
- **Swift Charts** for net worth visualization
- **Combine** used sparingly for reactive state
