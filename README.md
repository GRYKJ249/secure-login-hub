# Creative Hub & Cloud

نزل المشروع

بعدو

قم بتطوير وتنسيق واجهة التطبيق وتخزين السحاب وفق المتطلبات التالية:



1. إعادة تصميم الواجهة وإلغاء الأشكال البيضاوية (Clean SaaS Layout):

   - التخلص من البطاقات البيضاوية الضخمة وحواف الكبسولة المفرطة في لوحة التحكم (Dashboard) وباقي الصفحات.

   - اعتماد تصميم مستطيلي عصري وبسيط (Modern Cards with subtle rounded-lg/xl) مع توسيط المحتوى والنصوص بشكل أنيق وواضح ومريح للعين على الموبايل والديسكتوب.



2. إنشاء شريط جانبي موحد وشامل (Persistent Global Sidebar):

   - تحويل `_authenticated/route.tsx` إلى Layout عام يضم سايدبار احترافي يظهر في جميع الصفحات بعد تسجيل الدخول.

   - يضم السايدبار روابط التنقل السريع لجميع المهام:

     * المحادثات (Chat Workspace)

     * استوديو توليد الصور (Creative Studio)

     * بيئة الأكواد (Code Workspace)

     * الملف الشخصي ولوحة التحكم (Dashboard & Profile)

     * الأمان والإعدادات (Security & Settings)

   - يحتوي السايدبار في الأسفل على صورة المستخدم الحالية (Avatar)، اسمه، ومعرّف حسابه، وزر تسجيل الخروج.

   - يدعم الفتح والإغلاق بسلاسة (Drawer / Sheet) على الموبايل لعدم حجب مساحة الشاشة.



3. ضبط حفظ الصور في الكلاود (Cloud Storage & User Archive):

   - التأكد من رفع وتخزين أي صورة يتم إنشاؤها في الاستوديو داخل مخزن السحاب (Supabase storage `generations`) تحت مسار المستخدم `generations/{user.id}/{id}.png`.

   - تسجيل بيانات الصورة تلقائياً في جدول `generated_images` بربطها بـ `user_id` لتظهر دائماً في أرشيف المستخدم الشخصي.

   - تحسين معالجة أخطاء الـ Safety system بحيث تظهر رسالة تنبيه واضحة وأنيقة في حال رفض الذكاء الاصطناعي للمطالبة مع بقاء الواجهة مستقرة وجاهزة للمحاولة التالية.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/586722f9-dff0-4741-824c-fd7b4b366f5d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
