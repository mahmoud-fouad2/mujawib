# MUJAWIB

## التطوير المحلي

```bash
pnpm install
pnpm dev
```

يفتح التطبيق على [http://localhost:3000](http://localhost:3000).

## تأسيس الوصول لأول مرة

الهوية لا تمنح أي صلاحية تلقائيًا. بعد تجهيز قاعدة البيانات:

```bash
pnpm db:access-schema
pnpm db:notification-schema
pnpm user:create owner@example.com "a-long-private-password" "Platform Owner"
pnpm access:bootstrap owner@example.com
```

بعد تسجيل الدخول، يدعو المالك فريق التشغيل والعملاء من `/console/access`.
الرابط أحادي الاستخدام، صالح لسبعة أيام، ولا يُخزّن رمزه الخام. يقبل المستخدم
الدعوة بالحساب الذي يحمل البريد المدعو، أو ينشئ حسابًا جديدًا من داخل الدعوة
نفسها. التسجيل العام مغلق، ومسار الدعوة وحده ينشئ الهوية والصلاحية معًا.
الأسرار وكلمات المرور لا تُحفظ في إعدادات Workspace.

بعد الدخول يمر المستخدم عبر `/auth/continue`: فريق التشغيل يذهب إلى Console،
والعميل إلى Portal، والحساب غير المرتبط يرى صفحة انتظار واضحة بدل أي fallback.
استعادة كلمة المرور تحتاج `RESEND_API_KEY` و`EMAIL_FROM`، وتلغي الجلسات القديمة
بعد نجاح التغيير.

للتحقق من عقد الصلاحيات وحالة القاعدة:

```bash
pnpm access:verify-policy
pnpm access:verify-invitations
pnpm access:verify-db
```

## مسار المكالمة وما بعدها

يستخدم مسار الصوت `OPENAI_API_KEY` و`OPENAI_WEBHOOK_SECRET`. بعد الإغلاق النظيف
يُنشئ السيرفر ملخصًا تشغيليًا من النص المحفوظ عبر Structured Output، من دون
تغيير نتيجة المكالمة أو اعتبار كلام النموذج دليل تنفيذ. يمكن تثبيت نموذج هذه
الخطوة مستقلًا عبر `OPENAI_POST_CALL_MODEL`؛ الافتراضي موثق في `.env.example`.

للتحقق من عقود العرض والتلخيص من دون إجراء اتصال خارجي:

```bash
pnpm calls:verify-presentation
pnpm calls:verify-intelligence
```

### خطأ `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`

يحدث عادة بسبب cache تالف في `.next` أو تشغيل أكثر من سيرفر dev.

**الحل:**

```powershell
# Windows — أوقف المنافذ 3000-3003 ثم احذف الـ cache
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force .next
pnpm dev
```

أو استخدم:

```bash
pnpm dev:clean
```

> السكربت الافتراضي `pnpm dev` يستخدم webpack (بدون turbopack) لاستقرار أفضل على Windows. للتجربة مع turbopack: `pnpm dev:turbo`.
