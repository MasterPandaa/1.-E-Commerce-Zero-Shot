# E-Commerce (Node.js + Express + MySQL)

Aplikasi web E-Commerce lengkap dengan autentikasi, manajemen produk, keranjang, checkout, dan dashboard admin. Dibangun dengan Node.js, Express.js, MySQL, EJS, dan JavaScript.

## Fitur
- Autentikasi user (registrasi, login, logout, lupa/reset password)
- Manajemen produk (CRUD, filter, search, upload & resize gambar)
- Keranjang belanja dengan kalkulasi harga
- Checkout (COD default; Stripe opsional)
- Dashboard admin dengan statistik
- Keamanan: Helmet, Rate Limit, CSRF, Session store MySQL, Validasi input

## Persyaratan
- Node.js >= 18
- MySQL 8+

## Setup
1. Salin file environment
```bash
cp .env.example .env
```
2. Edit `.env` sesuai kredensial MySQL Anda.
3. Install dependencies
```bash
npm install
```
4. Buat/migrasi skema database dan seed admin
```bash
npm run migrate
```
5. Jalankan server (development)
```bash
npm run dev
```
Aplikasi berjalan di `http://localhost:3000`.

## Akun Admin
Nilai default berasal dari `.env`:
- Email: `ADMIN_EMAIL`
- Password: `ADMIN_PASSWORD`

## Struktur Direktori
```
.
├─ src/
│  ├─ app.js
│  ├─ server.js
│  ├─ config/
│  │  └─ db.js
│  ├─ controllers/
│  ├─ middleware/
│  ├─ routes/
│  ├─ utils/
│  └─ views/
├─ public/
│  ├─ css/
│  └─ js/
├─ uploads/ (tergenerate otomatis saat upload)
├─ db/
│  └─ schema.sql
├─ scripts/
│  └─ migrate.js
```

## Catatan Keamanan
- Ganti `SESSION_SECRET` dan gunakan HTTPS di production.
- Atur domain CORS jika perlu.
- Simpan file gambar di storage yang aman/terisolasi di production (S3, dll).

## Lisensi
MIT
