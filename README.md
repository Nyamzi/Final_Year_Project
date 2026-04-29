# 🧒 KidsApp Backend

Backend service for the **Kids Banking System**, a financial literacy platform that allows parents to manage their children’s finances while teaching responsible money habits.

---

## 🚀 Overview

This backend powers the KidsApp platform by handling:

* User authentication & authorization
* Wallet and transaction management
* Savings goals
* Chores and allowances
* Spending limits
* Financial analytics
* Learning content (lessons & quizzes)

Built with **Node.js, Express, and SQLite**, designed for easy migration to **PostgreSQL (Supabase)**.

---

## ✨ Features

* 🔐 JWT Authentication (secure HTTP-only cookies)
* 👨‍👩‍👧 Role-based access (Parent, Child, Admin)
* 💰 Wallet & transaction system
* 🎯 Savings goals tracking
* ✅ Chores & reward system
* 📅 Allowances management
* 🚫 Spending limits enforcement
* 📊 Admin analytics & reporting
* 📚 Lessons & quizzes

---

## 🧱 Tech Stack

| Layer         | Technology    |
| ------------- | ------------- |
| Runtime       | Node.js       |
| Framework     | Express.js    |
| Language      | TypeScript    |
| Database      | SQLite (dev)  |
| ORM (planned) | Prisma        |
| Auth          | JWT + Cookies |
| Security      | bcryptjs      |

---

## 📁 Project Structure

```text
kidsapp-backend/
│── src/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── models/
│   ├── utils/
│── data/                # SQLite database
│── .env
│── package.json
│── tsconfig.json
```

---

## ⚙️ Setup & Installation

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

```bash
cp .env.example .env
```

### 3. Configure `.env`

```env
PORT=3000
JWT_SECRET=your-very-secret-key-change-this
NODE_ENV=development
DB_PATH=./data/kidsapp.db
```

---

## ▶️ Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

---

## 🔗 API Endpoints

### 🔐 Authentication

* `POST /api/auth/register` – Register parent
* `POST /api/auth/login` – Login
* `GET /api/auth/me` – Current user
* `POST /api/auth/logout` – Logout
* `POST /api/auth/change-password` – Change password

---

### 🧒 Child Routes (Protected)

* `GET /api/child/wallet`
* `GET /api/child/transactions`
* `POST /api/child/transactions` *(request withdrawal)*
* `GET /api/child/chores`
* `PATCH /api/child/chores` *(mark complete)*
* `GET /api/child/savings-goals`
* `POST /api/child/savings-goals`
* `GET /api/child/allowances`

---

### 👨‍👩‍👧 Parent Routes (Protected)

* `GET /api/parent/children`
* `POST /api/parent/children`
* `GET /api/parent/transactions/pending`
* `POST /api/parent/transactions/:id/decision` *(approve/reject)*
* `POST /api/parent/spending-limit`
* `GET /api/parent/chores`
* `POST /api/parent/chores`
* `GET /api/parent/allowances`
* `POST /api/parent/allowances`
* `PATCH /api/parent/account`

---

### 🛠️ Admin Routes (Protected)

* `GET /api/admin/analytics`
* `GET /api/admin/lessons`
* `POST /api/admin/lessons`
* `GET /api/admin/quizzes`
* `POST /api/admin/quizzes`

---

## 🗄️ Database Schema

Main tables:

* `users`
* `parent_children`
* `transactions`
* `savings_goals`
* `chores`
* `allowances`
* `spending_limits`
* `lessons`
* `quizzes`
* `sessions`

---

## 🔐 Authentication Flow

```text
User Login/Register
        ↓
JWT Token Generated
        ↓
Stored in HTTP-only Cookie
        ↓
Middleware Verifies Token
        ↓
Role-based Access Control Applied
```

---

## ⚠️ Security Notes

* Passwords hashed using bcrypt
* JWT stored in HTTP-only cookies
* Role-based route protection
* Do NOT commit `.env` file
* Change `JWT_SECRET` in production

---

## ❗ Error Handling

| Code | Meaning      |
| ---- | ------------ |
| 200  | Success      |
| 201  | Created      |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 403  | Forbidden    |
| 404  | Not Found    |
| 500  | Server Error |

---

## 🧠 Development Notes

* Uses local SQLite database (`./data/kidsapp.db`)
* Designed for future migration to **PostgreSQL (Supabase)**
* CORS enabled for development
* Clean modular structure

---

## 🚧 Next Steps

* ✅ Add request validation (Joi/Zod)
* ✅ Add rate limiting (security)
* ✅ Add request logging (Winston/Morgan)
* ✅ Add automated tests
* 🔜 Integrate with frontend (Next.js)
* 🔜 Migrate to Prisma + PostgreSQL (Supabase)
* 🔜 Implement OTP approval system

---

## 👨‍💻 Author

**David**
Final Year Project – Kids Banking System

---

## 📄 License

This project is for educational purposes.
