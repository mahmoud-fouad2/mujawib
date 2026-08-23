# MUJAWIB

## التطوير المحلي

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm db:migrate
corepack pnpm dev
```

يفتح التطبيق على [http://localhost:3000](http://localhost:3000).
يتطلب المشروع Node.js `24.19.x` وpnpm `11.22.x` كما هو مثبت في
`.node-version` و`packageManager`.

## تأسيس الوصول لأول مرة

الهوية لا تمنح أي صلاحية تلقائيًا. بعد تجهيز قاعدة البيانات:

```bash
corepack pnpm db:migrate
corepack pnpm user:create owner@example.com "a-long-private-password" "Platform Owner"
corepack pnpm access:bootstrap owner@example.com
```

`db:migrate` هو المسار الوحيد المعتمد لتغييرات المخطط. لا توجد إجراءات schema
جانبية أو أوامر `push` ضمن مسار النشر.

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

## استعادة التحقق بخطوتين

لوحة التشغيل تشترط تحققًا بخطوتين، فإذا تعطّل الإعداد يفقد المالك الوصول لحسابه
دون أي مخرج من المتصفح. هذه الأوامر تُشغَّل من Shell الخاص بالخدمة على Render
(أو محليًا مع `.env.local`)، وتحتاج نفس `DATABASE_URL` و`BETTER_AUTH_SECRET`
اللذين يعمل بهما التطبيق:

```bash
pnpm 2fa:status owner@example.com   # ماذا يرى الخادم، وأي رمز يتوقعه الآن
pnpm 2fa:unlock owner@example.com   # يرفع القفل بعد المحاولات الفاشلة دون فقد الإعداد
pnpm 2fa:reset  owner@example.com   # يحذف الإعداد ليدخل الحساب بكلمة المرور ويُسجّل من جديد
```

ابدأ دائمًا بـ `2fa:status`، لأن رسالة «الرمز غير صحيح» تخفي ثلاثة أسباب مختلفة:

| ما يظهره `2fa:status` | السبب | الحل |
| --- | --- | --- |
| `CANNOT BE DECRYPTED` | تغيّر `BETTER_AUTH_SECRET` بعد التسجيل، فلا يمكن لأي رمز أن ينجح | `2fa:reset` ثم إعادة المسح |
| `locked until …` | عشر محاولات فاشلة متتالية تقفل الحساب ربع ساعة | `2fa:unlock` |
| رمز متوقع يختلف عمّا يعرضه التطبيق | ساعة الجهاز منحرفة، أو التطبيق يحمل تسجيلًا أقدم | ضبط الوقت تلقائيًا، أو `2fa:reset` |

> `BETTER_AUTH_SECRET` في `render.yaml` مضبوط على `generateValue: true`. إعادة
> إنشاء الخدمة من الـ Blueprint تولّد قيمة جديدة، وهو ما يُبطل كل تسجيلات
> التحقق بخطوتين المخزّنة. ثبّت القيمة في لوحة Render قبل أي إعادة إنشاء.

الرموز الاحتياطية التي تظهر مرة واحدة عند التفعيل هي المخرج الوحيد من المتصفح؛
صفحة `/two-factor` تعرضها كخيار ثانٍ دائمًا، ولا تعود إلى طريق مسدود عند انتهاء
صلاحية المحاولة.

## مسار المكالمة وما بعدها

يستخدم مسار الصوت `OPENAI_API_KEY` و`OPENAI_WEBHOOK_SECRET` و`DATA_ENCRYPTION_KEY`.
بعد الإغلاق النظيف
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
