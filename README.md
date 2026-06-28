# منشئة ايواء — Demo
Monorepo: **Next.js (Frontend)** + **Node/Express (Backend)** + **PostgreSQL**  
يدعم لغتين: **العربية (RTL)** و **English (LTR)** + لوحة أدمن.

## 1) التشغيل محلياً (Docker Compose)
المتطلبات: Docker + Docker Compose

```bash
cd infra/compose
docker compose up -d --build
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:4001
- Admin: http://localhost:3001/admin/login

### بيانات الأدمن الافتراضية
- Email: `admin@demo.local`
- Password: `Admin@12345`

> غيّرها بعد أول دخول.

## 2) بنية المشروع
- `apps/frontend` — Next.js + Tailwind + i18n (ar/en)
- `apps/backend` — Express + Prisma + JWT + REST API
- `infra/compose` — Docker compose
- `infra/k8s` — Kubernetes manifests (Postgres + Backend + Frontend + Ingress اختياري)

## 3) قاعدة البيانات + Seed
عند تشغيل الـ compose أول مرة:
- يتم تشغيل Postgres
- يتم تطبيق Prisma migrate
- يتم عمل Seed تلقائي للـ inventory (30 وحدة) حسب وصفك

## 4) ملاحظات التشغيل على كلاسستر (k3s/k8s)
ادخل مجلد:
- `infra/k8s`
واستخدم:
```bash
kubectl apply -f .
```

ثم (اختياري) عدّل ingress الدومين.

## 5) API مختصر
- `GET /api/public/unit-types?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD`
- `GET /api/public/unit-types/:id`
- `POST /api/public/bookings`
- `POST /api/admin/auth/login`
- `GET /api/admin/bookings` (JWT)
- `PATCH /api/admin/bookings/:id/status` (JWT)

## 6) تصميم الواجهات
راجع:
- `docs/WIREFRAMES.md`
- `docs/UI-DESIGN.md`
