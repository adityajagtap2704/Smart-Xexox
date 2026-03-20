# 🖨️ Smart Xerox – Online Print Ordering Platform

A full-stack production-grade web application that connects users with nearby printing shops. Users can upload documents, place print orders, and pay online — while shop owners manage orders in real-time through a dedicated dashboard.

> **Stack:** React JS + Tailwind CSS (Frontend) · Node.js + Express + MongoDB (Backend)

---

## 📸 Features

- 🔐 **Auth** — Email/OTP registration, JWT + refresh token login, password reset via OTP
- 📄 **Document Upload** — Multi-file upload to AWS S3 with presigned URL downloads
- 🛒 **Smart Ordering** — Page count detection, print config (B&W/Color, single/double-sided, copies, binding)
- 💰 **Payments** — Razorpay integration with webhook verification and auto-refunds
- 🗺️ **Nearby Shops** — Geospatial search to find closest printing shops
- 📡 **Real-time Updates** — Socket.IO for live order status (accepted → printing → ready → picked up)
- 📱 **QR Code Pickup** — Unique pickup code per order for contactless collection
- 🔔 **Notifications** — In-app + email notifications for all order events
- ⏰ **Background Jobs** — Auto-expiry, 1-hour expiry alerts, daily S3 cleanup
- 🛡️ **Admin Panel** — User/shop management, revenue analytics, broadcast notifications

---

## 🗂️ Project Structure

```
smart-xerox/
├── frontend/               ← React 18 + Vite + Tailwind CSS
└── backend/
    └── smart-xerox-backend/  ← Node.js + Express + MongoDB
```

---

## ⚙️ Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router v6 |
| State / Fetching | TanStack Query v5 |
| HTTP Client | Axios |
| Real-time | Socket.IO Client |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB Atlas (Mongoose) |
| File Storage | AWS S3 |
| Payments | Razorpay |
| Real-time | Socket.IO |
| Auth | JWT + OTP |
| Logging | Winston |
| Scheduler | node-cron |
| Deployment | Render / AWS EC2 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18.0.0`
- npm `>= 8`
- MongoDB Atlas account
- AWS S3 bucket
- Razorpay account

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/smart-xerox.git
cd smart-xerox
```

---

### 2. Backend Setup

```bash
cd backend/smart-xerox-backend
npm install
```

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Seed the admin user:

```bash
node scripts/seedAdmin.js
```

Start the server:

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

> Backend runs on `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Copy the example env file:

```bash
cp .env.example .env
```

Start the dev server:

```bash
npm run dev
```

> Frontend runs on `http://localhost:3000`

---

## 🔑 Environment Variables

### Backend — `.env`

```env
# ============================================
# SMART XEROX PLATFORM - ENVIRONMENT CONFIG
# ============================================

# Server
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/smart-xerox?retryWrites=true&w=majority

# JWT Secrets
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_token_secret_key
JWT_REFRESH_EXPIRES_IN=30d

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=smart-xerox-documents

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app

# Admin Credentials (first setup only)
ADMIN_EMAIL=admin@smartxerox.com
ADMIN_PASSWORD=SecureAdminPassword123!

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=Smart Xerox <noreply@smartxerox.com>

# Order Settings
OTP_EXPIRY_MINUTES=5
ORDER_EXPIRY_HOURS=12
ORDER_EXTENSION_HOURS=12
```

### Frontend — `.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_RAZORPAY_KEY=rzp_test_your_key_here
```

> ⚠️ **Never commit `.env` files to GitHub.** See the [Removing `.env` from Git](#-removing-env-from-git-history) section below if you've already pushed it by mistake.

---

## 📁 Backend Structure

```
smart-xerox-backend/
├── server.js                      # Entry point
├── config/
│   ├── database.js                # MongoDB connection
│   ├── socket.js                  # Socket.IO setup
│   ├── logger.js                  # Winston logger
│   ├── aws.js                     # S3 + Multer config
│   └── razorpay.js                # Razorpay config
├── models/
│   ├── User.js
│   ├── Shop.js                    # Geospatial index
│   ├── Order.js
│   ├── Payment.js
│   ├── Notification.js
│   └── Review.js
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── shop.controller.js
│   ├── order.controller.js
│   ├── payment.controller.js
│   ├── upload.controller.js
│   ├── admin.controller.js
│   └── notification.controller.js
├── routes/                        # Express routers
├── middleware/
│   ├── auth.js                    # JWT protect + role guard
│   ├── errorHandler.js
│   └── validate.js                # Joi validation
├── utils/
│   ├── helpers.js                 # AppError, asyncHandler
│   ├── pricing.js                 # Cost calculation
│   ├── qrcode.js
│   ├── notifications.js
│   ├── email.js
│   └── pdfUtils.js
├── jobs/
│   └── cronJobs.js                # Scheduled tasks
├── scripts/
│   └── seedAdmin.js
├── .env.example
└── package.json
```

---

## 📡 API Reference

### Authentication — `/api/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/register` | Register user or shopkeeper | ❌ |
| POST | `/verify-email` | Verify email via OTP | ❌ |
| POST | `/login` | Login with email + password | ❌ |
| POST | `/send-otp` | Send phone OTP | ❌ |
| POST | `/verify-otp` | Verify phone OTP login | ❌ |
| POST | `/refresh-token` | Refresh access token | ❌ |
| POST | `/forgot-password` | Send reset OTP | ❌ |
| POST | `/reset-password` | Reset password with OTP | ❌ |
| POST | `/logout` | Logout | ✅ |
| GET | `/me` | Get current user | ✅ |
| PATCH | `/change-password` | Change password | ✅ |

### Users — `/api/users`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/profile` | Get profile | ✅ |
| PATCH | `/profile` | Update profile | ✅ |
| GET | `/orders` | Order history | ✅ |
| GET | `/stats` | User statistics | ✅ |

### Shops — `/api/shops`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/` | List all shops | ❌ |
| GET | `/nearby?lat=&lng=&radius=` | Geospatial nearby search | ❌ |
| GET | `/:id` | Shop details | ❌ |
| GET | `/:id/reviews` | Shop reviews | ❌ |
| POST | `/` | Create shop | ✅ Shopkeeper |
| PATCH | `/my-shop` | Update my shop | ✅ Shopkeeper |
| GET | `/my-shop/dashboard` | Dashboard stats | ✅ Shopkeeper |
| PATCH | `/my-shop/toggle-status` | Open / close shop | ✅ Shopkeeper |

### Orders — `/api/orders`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/` | Create order | ✅ User |
| GET | `/my-orders` | My orders | ✅ User |
| GET | `/:id` | Single order | ✅ |
| POST | `/:id/extend` | Extend expiry by 12h | ✅ User |
| POST | `/:id/rate` | Rate completed order | ✅ User |
| GET | `/shop/orders` | Shop's order queue | ✅ Shopkeeper |
| PATCH | `/:id/accept` | Accept order | ✅ Shopkeeper |
| PATCH | `/:id/reject` | Reject order | ✅ Shopkeeper |
| PATCH | `/:id/status` | Update to printing/ready | ✅ Shopkeeper |
| POST | `/verify-pickup` | Verify QR/pickup code | ✅ Shopkeeper |
| GET | `/:orderId/documents/:docId/url` | Presigned S3 download URL | ✅ Shopkeeper |

### Payments — `/api/payments`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/verify` | Verify Razorpay signature | ✅ |
| POST | `/webhook` | Razorpay webhook handler | ❌ |
| GET | `/order/:orderId` | Payment details | ✅ |
| POST | `/refund` | Initiate refund | ✅ |

### File Upload — `/api/upload`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/single` | Upload single document | ✅ |
| POST | `/multiple` | Upload up to 5 documents | ✅ |
| GET | `/signed-url?key=` | Get S3 presigned URL | ✅ |

### Notifications — `/api/notifications`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/` | Get my notifications | ✅ |
| PATCH | `/read` | Mark selected as read | ✅ |
| PATCH | `/read-all` | Mark all as read | ✅ |
| DELETE | `/:id` | Delete notification | ✅ |

### Admin — `/api/admin`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/dashboard` | Platform overview | ✅ Admin |
| GET | `/analytics` | Order analytics | ✅ Admin |
| GET | `/revenue` | Revenue reports | ✅ Admin |
| GET | `/users` | All users | ✅ Admin |
| PATCH | `/users/:id/toggle-status` | Activate / deactivate user | ✅ Admin |
| GET | `/shops` | All shops | ✅ Admin |
| PATCH | `/shops/:id/verify` | Verify or reject shop | ✅ Admin |
| PATCH | `/shops/:id/margin` | Set platform margin % | ✅ Admin |
| GET | `/orders` | All orders with filters | ✅ Admin |
| POST | `/notifications/broadcast` | Broadcast to all users | ✅ Admin |

---

## 🔌 Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join:shop` | `shopId` | Join shop room (shopkeepers only) |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `order:new` | `{ orderId, orderNumber, ... }` | New order received (shop) |
| `order:status_update` | `{ orderId, status, orderNumber }` | Order status changed |
| `order:expiring_soon` | `{ orderId, minutesLeft }` | Order expiring in ~1 hour |
| `order:expired` | `{ orderId, orderNumber }` | Order has expired |
| `order:extended` | `{ orderId, newExpiry }` | Expiry extended by 12h |
| `payment:success` | `{ orderId, pickupCode, qrCode }` | Payment confirmed |
| `payment:failed` | `{ orderId }` | Payment failed |
| `broadcast:notification` | `{ title, message }` | Admin broadcast |

---

## 🏗️ Order Status Flow

```
pending_payment
      │
      ▼
    paid ──────────► rejected
      │
      ▼
  accepted
      │
      ▼
  printing
      │
      ▼
   ready
      │
      ▼
 picked_up
      │
      ▼
(any active state) ──► expired / cancelled
```

---

## 💰 Pricing Formula

```
Document Price    = BasePrice (set by shop) × EffectivePages × Copies
Effective Pages   = ceil(pages / 2)  →  for double-sided
                  = pages             →  for single-sided
Subtotal          = Σ Document Prices
Extras            = Binding + Lamination + Urgent charges
Platform Margin   = (Subtotal + Extras) × margin%
Total             = Subtotal + Extras + Platform Margin
Shop Receivable   = Subtotal + Extras  (margin stays with platform)
```

---

## ⏰ Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Expiry Alerts | Every 30 min | Notifies users of orders expiring within 1 hour |
| Order Expiry | Every 15 min | Marks overdue orders as expired |
| S3 Cleanup | Daily at 2 AM | Deletes documents from old completed/expired orders |

---

## 🔐 Security

- JWT with short-lived access tokens + refresh token rotation
- OTP-based email/phone verification (5-minute expiry)
- Razorpay webhook HMAC signature verification
- Rate limiting: 200 req/15min globally · 20 req/15min on auth routes
- MongoDB injection sanitization via `express-mongo-sanitize`
- Security headers via `helmet`
- CORS whitelist via `FRONTEND_URL` env
- AWS S3 presigned URLs (15-minute expiry, no public bucket access)
- Input validation via Joi schemas

---

## 🚀 Deployment

### Backend — Render

1. Push code to GitHub (without `.env`)
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Set all environment variables in the Render dashboard
5. Build command: `npm install`
6. Start command: `npm start`
7. Set Razorpay webhook URL in dashboard:
   ```
   https://your-api.render.com/api/payments/webhook
   ```

### Frontend — Vercel

1. Import your GitHub repo on [Vercel](https://vercel.com)
2. Set environment variables:
   ```
   VITE_API_URL=https://your-api.render.com/api
   VITE_SOCKET_URL=https://your-api.render.com
   VITE_RAZORPAY_KEY=rzp_live_xxxxxxxxxx
   ```
3. Deploy — Vercel auto-detects Vite

---

## 🧹 Removing `.env` from Git History

> If you accidentally pushed your `.env` file to GitHub, follow these steps immediately to remove it and rotate all secrets.

### Step 1 — Add `.env` to `.gitignore`

Make sure both `.gitignore` files contain:

```
# Backend gitignore
.env
logs/
node_modules/

# Frontend gitignore
.env
node_modules/
dist/
```

### Step 2 — Remove `.env` from Git tracking (do NOT delete the file)

```bash
# For backend
git rm --cached backend/smart-xerox-backend/.env

# For frontend
git rm --cached frontend/.env
```

### Step 3 — Rewrite Git history to erase the file completely

```bash
# Install git-filter-repo if you don't have it
pip install git-filter-repo

# Remove .env from ALL commits in history
git filter-repo --path backend/smart-xerox-backend/.env --invert-paths
git filter-repo --path frontend/.env --invert-paths
```

> ⚠️ Alternatively use `BFG Repo Cleaner` (faster for large repos):
> ```bash
> # Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
> java -jar bfg.jar --delete-files .env
> git reflog expire --expire=now --all && git gc --prune=now --aggressive
> ```

### Step 4 — Force push to GitHub

```bash
git push origin --force --all
git push origin --force --tags
```

### Step 5 — ⚠️ ROTATE ALL SECRETS IMMEDIATELY

Because the secrets were public (even briefly), treat them as compromised:

| Secret | Where to Rotate |
|--------|----------------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Generate new random strings (min 32 chars) |
| `MONGODB_URI` | Rotate password in MongoDB Atlas → Database Access |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Delete the IAM key in AWS Console → Create new one |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → API Keys → Regenerate |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks → Regenerate |
| `SMTP_PASS` | Revoke and regenerate Gmail App Password |
| `ADMIN_PASSWORD` | Change directly in your MongoDB database |

### Step 6 — Ask GitHub to clear caches (optional)

Even after a force push, GitHub may cache the old commits briefly. You can contact GitHub Support to purge cached views, or make your repo private temporarily.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  Built with ❤️ · Smart Xerox Platform
</div>
