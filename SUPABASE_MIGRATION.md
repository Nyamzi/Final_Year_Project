# Supabase Migration Runbook

## Migration Order

1. Create a Supabase project.
2. Copy the project URL, anon key, service-role key, pooled database URL, and direct database URL.
3. Update root `.env` for Expo:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Update `backend/.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
ADMIN_EMAIL="admin@banking-sim.ug"
ADMIN_PASSWORD="Admin12345!"
```

5. Generate the Prisma client:

```bash
cd backend
npm install
npm run prisma:generate
```

6. Apply the Postgres baseline migration:

```bash
npx prisma migrate deploy
```

If Prisma's schema engine fails silently on Windows while normal Prisma Client queries work, apply the checked-in baseline through Prisma Client:

```bash
npm run prisma:apply-baseline
```

7. Seed the first admin user and learning content:

```bash
npm run prisma:seed
```

8. Run the backend and Expo app:

```bash
cd backend
npm run dev
```

```bash
npm start
```

9. Build an Android APK with EAS:

```bash
npm run build:apk
```

## Notes

- Active Prisma migrations now target Supabase Postgres only.
- The old SQLite migrations are preserved in `backend/prisma/sqlite_migrations_archive`.
- `User.id` is now the Supabase Auth user UUID.
- `passwordHash`, bcrypt, and local JWT signing were removed from application auth.
- Express is still used for custom business logic: wallets, chores, learning, reports, admin analytics, and parent-managed child accounts.
