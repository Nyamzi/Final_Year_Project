# KidsApp (React Native + Web)

This project is a React Native app created with Expo and runs on:

- Android
- iOS
- Web

## Goal

Mirror ProjectFY behavior while keeping the original ProjectFY codebase unchanged.

## Environment

1. Copy `.env.example` to `.env`.
2. Set your backend URL:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

Notes:
- Android emulator usually needs `http://10.0.2.2:3000`.
- Physical devices need your machine LAN IP.

## Run

```bash
npm run web
npm run android
npm run ios
```

## Implemented (Phase 1)

- Login screen wired to `/api/auth/login`
- Register screen wired to `/api/auth/register`
- Session restore via `/api/auth/me`
- Logout via `/api/auth/logout`
- Role-based dashboard shell for `parent`, `child`, and `admin`

