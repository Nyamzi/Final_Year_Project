# KidsApp Backend

A Node.js + Express backend for the KidsApp financial education platform.

## Features

- ✅ Authentication (JWT-based with cookies)
- ✅ User management (Parents, Children, Admins)
- ✅ Wallet & transaction management
- ✅ Savings goals tracking
- ✅ Chores & allowances
- ✅ Spending limits
- ✅ Financial analytics
- ✅ Lessons & Quizzes management

## Prerequisites

- Node.js 16+
- npm or yarn

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create a `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. **Update `.env` with your settings** (especially `JWT_SECRET`):
   ```
   PORT=3000
   JWT_SECRET=your-very-secret-key-change-this
   NODE_ENV=development
   DB_PATH=./data/kidsapp.db
   ```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (parent)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/change-password` - Change password

### Child Routes (Protected)
- `GET /api/child/wallet` - Get wallet summary & savings goals
- `GET /api/child/transactions` - Get all transactions
- `POST /api/child/transactions` - Create transaction (pending approval)
- `GET /api/child/chores` - Get assigned chores
- `PATCH /api/child/chores` - Mark chore as completed
- `GET /api/child/savings-goals` - Get savings goals
- `POST /api/child/savings-goals` - Create savings goal
- `GET /api/child/allowances` - Get allowances

### Parent Routes (Protected)
- `GET /api/parent/children` - Get all children
- `POST /api/parent/children` - Add a child
- `GET /api/parent/transactions/pending` - Get pending child transactions
- `POST /api/parent/transactions/:id/decision` - Approve/reject transaction
- `POST /api/parent/spending-limit` - Set spending limit for child
- `GET /api/parent/chores` - Get all children's chores
- `POST /api/parent/chores` - Create chore for child
- `GET /api/parent/allowances` - Get all children's allowances
- `POST /api/parent/allowances` - Create allowance for child
- `PATCH /api/parent/account` - Update own profile

### Admin Routes (Protected)
- `GET /api/admin/analytics` - Get system analytics
- `GET /api/admin/lessons` - Get all lessons
- `POST /api/admin/lessons` - Create lesson
- `GET /api/admin/quizzes` - Get all quizzes
- `POST /api/admin/quizzes` - Create quiz

## Database

Uses SQLite with the following tables:
- `users` - User accounts
- `parent_children` - Parent-child relationships
- `transactions` - Financial transactions
- `savings_goals` - Savings goals
- `chores` - Chores assigned to children
- `allowances` - Allowances for children
- `spending_limits` - Monthly spending limits
- `lessons` - Educational lessons
- `quizzes` - Quizzes
- `sessions` - Session management

## Authentication Flow

1. User registers or logs in
2. JWT token is generated and stored in HTTP-only cookie
3. Protected routes verify token via middleware
4. Authorization checks role-based access

## Error Handling

Standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `500` - Server error

## Development Notes

- The database file is stored locally at `./data/kidsapp.db`
- Change `JWT_SECRET` in production
- CORS is configured for local development
- Uses bcryptjs for password hashing
- TypeScript for type safety

## Next Steps

- Add validation middleware
- Add rate limiting
- Add request logging
- Add tests
- Add frontend integration
