# HerSentinel Backend

Secure Node.js/Express backend for HerSentinel with MongoDB, JWT auth, refresh token rotation, and API hardening.

## 1) Configure environment

1. Open `.env`
2. Replace:
   - `ACCESS_TOKEN_SECRET`
   - `REFRESH_TOKEN_SECRET`
3. Keep `MONGODB_URI=mongodb://127.0.0.1:27017/hersentinel` for local MongoDB Compass setup.

## 2) Run MongoDB locally

- Start local MongoDB service.
- Open MongoDB Compass and connect using:
  - `mongodb://127.0.0.1:27017`
- Database `hersentinel` will be created automatically when first records are inserted.

## 3) Start backend

```bash
npm run dev
```

Health check:

- `GET http://localhost:4000/api/health`

## 4) Auth endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me` (Bearer access token)

## Example register payload

```json
{
  "name": "Ananya",
  "email": "ananya@example.com",
  "password": "Secure@123",
  "phone": "+919999999999"
}
```

## Security included

- `helmet` headers and production HSTS
- CORS allowlist from `.env`
- Global and auth-specific rate limiting
- Password hashing with `bcryptjs` (12 rounds)
- Access/refresh JWT with refresh token rotation and revocation
- Generic login failures to prevent user enumeration
- Malformed JSON rejection

## Notes

- `.env` is ignored by git.
- For production, enforce HTTPS at reverse proxy/load balancer and keep TLS 1.2+ only.
