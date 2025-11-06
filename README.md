# Manar — Two-person Encrypted Chat (Purple & Gold theme)

این بسته شامل:
- backend/ — Node.js signaling server (مناسب برای deploy روی Render یا Railway)
- frontend/ — React PWA با نام Manar و تم بنفش/طلایی

## هدف
هر دو گوشی (از هر نقطه‌ای) بتونن بدون نیاز به لپ‌تاپ یا Termux به هم وصل بشن. برای این کار، باید backend رو روی یک سرویس ابری (رایگان یا پولی) مستقر کنیم تا هر دو دستگاه بتوانند از اینترنت به آن وصل شوند.

---

## سریع: مراحلِ آماده‌سازی و راه‌اندازی (خلاصه)
1. کدها را در یک مخزن GitHub قرار بده (یا مستقیم از این فایل‌ها استفاده کن).
2. Backend را روی Render (یا Railway) مستقر کن.
3. Frontend را روی Render (Static Site) یا Vercel مستقر کن، یا فقط آدرس frontend dev را در گوشی باز کن (برای تست).
4. در اپ (Manar) URL سرور signaling را وارد کن و با کد روم مشترک به هم وصل شو.

---

## 1) استقرار backend در Render (سریع)
1. در GitHub یک repository جدید بساز و تمام پوشه‌ی `backend` را در آن push کن.
2. به https://render.com برو و با GitHub متصل شو.  
3. در Render یک **Web Service** جدید بساز:
   - Connect a repository -> انتخاب مخزن
   - Branch: main
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. بعد از deploy، Render بهت یک آدرس HTTPS می‌دهد، مثل `https://manar-signaling.onrender.com`. این آدرس را یادداشت کن.

---

## 2) استقرار frontend
روش ساده: Deploy as Static Site (Render / Vercel)
- اگر از Render Static Sites:
  - Build Command: `npm install && npm run build`
  - Publish Directory: `dist`
- یا Vercel: connect GitHub و تنظیمات پیش‌فرض برای Vite کافی است.

بعد از استقرار، آدرس وب‌سایت (مثلاً `https://manar.app`) را باز کن روی گوشی.

---

## 3) تنظیم و استفاده در گوشی‌ها
1. در صفحه Manar (frontend) روی هر گوشی:
   - در قسمت تنظیمات، آدرس signaling server را وارد کن (مثلاً `https://manar-signaling.onrender.com`)
   - یک کد روم مشترک بساز (مثلاً `MANAR123`) و آن را با شریک‌ات به اشتراک بگذار.
   - هر دو نام خود را وارد کنین و "اتصال" بزنین.
2. وقتی کانکشن برقرار شد، می‌تونین پیام، عکس و ویدیو ارسال کنین. همه پیام‌ها با AES-GCM رمز می‌شن و فقط در دستگاه‌ها ذخیره می‌شن.

---

## 4) نکات فنی و امنیتی
- برای تماس‌های پایدارتر از WebRTC، در صورت مشکل NAT یا فایروال ممکنه نیاز به TURN سرور باشه. Render سرور signaling را میزبانی می‌کند اما برای relay و فایل‌های خیلی بزرگ ممکن است نیاز به راه‌حل اضافی باشد.
- کلید خصوصی روی دستگاه کاربر نگه داشته می‌شود و هرگز به سرور ارسال نمی‌شود.
- اگر نیازمند فایل‌های بزرگ‌تر یا بکاپ مرکزی باشی، باید آپلود به object storage (S3) را پیاده‌سازی کنیم.

---

## 5) فایل‌های داخل بسته
- backend/server.js
- backend/package.json
- frontend/src/* (کدهای React)
- frontend/package.json

---

اگر دوست داری، من می‌تونم:
- 1) برات repo روی GitHub بسازم و کدها رو push کنم (تو فقط لاگین کن و دسترسی بدی).  
- 2) یا خودم گام‌به‌گام تصویر/اسکرین‌شات از نحوهٔ deploy روی Render آماده کنم و بفرستم.  
کدوم‌شو می‌خوای؟ (ارسال repo یا راهنمای تصویری deploy)  
