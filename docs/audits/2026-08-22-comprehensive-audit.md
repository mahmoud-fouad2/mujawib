# MUJAWIB Comprehensive Audit

**التاريخ:** 2026-08-22
**النطاق:** الكود، قاعدة البيانات، الصوت، الأمان، تنظيم المشروع، الواجهة العامة، لوحة التحكم، الرحلات، والمكتبات.
**نوع المرحلة:** تقرير قبل الإصلاح. لم يتم تعديل كود المنتج أو قاعدة البيانات أثناء هذه المرحلة.

## الخلاصة التنفيذية

المشروع مبني على أساس حديث نسبيًا وينجح حاليًا في الفحص النوعي والبناء، كما أن عقود الصوت والخصوصية والوصول والتكاملات تمر بنجاح. لكنه لا يزال يحتاج مرحلة تثبيت هندسي قبل اعتباره Production-ready، وأهم أسباب ذلك: إعادة محاولة الكتابات غير الآمنة، غياب migrations أساسية قابلة للتتبع، عدم ذرية النشر والتهيئة، سباق idempotency في webhook الصوت، قبول المكالمة قبل حفظها، استمرار توجيه رقم معطل، وثغرات معروفة في نسخ Next.js وبعض الاعتماديات.

### الأدلة المنفذة

| الفحص | النتيجة |
| --- | --- |
| `pnpm typecheck` | ناجح |
| `pnpm lint` | ناجح على 216 ملفًا |
| `pnpm build` | ناجح، 29 صفحة ثابتة ومسارات API |
| `pnpm ux:smoke` | ناجح للواجهة العامة؛ فحوص الصفحات المحمية تم تجاوزها لعدم وجود جلسة دخول |
| فحوص SIP والصوت والخصوصية والـRealtime | ناجحة |
| فحوص call intelligence والتكاملات والمصادقة وسياسات الوصول | ناجحة |
| `pnpm audit --prod` | غير ناجح: 16 ثغرة، منها 8 مرتفعة و8 متوسطة |
| `knip` | اعتماد غير مستخدم، اعتماد غير معلن، وواجهات تصدير زائدة |
| `jscpd` | 22 تطابقًا، لكن التكرار الكلي منخفض: 0.82% |

---

## 1. أهم 15 دينًا تقنيًا وهندسيًا

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P0 | `server/db/index.ts` يعيد كل الطلبات، بما فيها الكتابات، وقد يكرر mutation نجح في الخادم وفشل ردّه. | إعادة المحاولة لا تكرر أي أثر جانبي. | قصر retry على القراءات، واستخدام operation keys أو معاملات idempotent للكتابات. |
| 2 | P0 | مجلد `drizzle/` متجاهل في Git ولا توجد سلسلة migrations أساسية منشورة. | كل تغيير schema قابل للمراجعة والتطبيق والرجوع المنضبط. | اعتماد migrations مولدة ومتعقبة، ومنع تعديلات schema خارجها. |
| 3 | P0 | webhook يفحص وجود `externalCallId` ثم يقبل ويدرج دون قيد unique. | retry متزامن لن ينشئ مكالمتين ولن يقبل مرتين. | unique constraint وحجز ذري لسجل المكالمة قبل القبول. |
| 4 | P0 | OpenAI call accept يحدث قبل حفظ سجل المكالمة. | كل مكالمة مقبولة لها سجل قابل للاستكمال والتعافي. | إنشاء سجل `accepting` أولًا ثم القبول ثم الانتقال إلى `live`، مع reconciliation. |
| 5 | P0 | publish/rollback موزع على عدة تحديثات منفصلة. | نسخة منشورة واحدة صحيحة دائمًا. | transaction مع قيد قاعدة بيانات يمنع أكثر من Published version. |
| 6 | P0 | onboarding ينشئ المؤسسة والمساحة والوكيل والنسخة والتكاملات والرقم في عمليات منفصلة. | النجاح كامل أو لا يترك أي كيان نصف مكتمل. | transaction واحدة أو saga موثقة قابلة للاستئناف. |
| 7 | P0 | resolver لا يستبعد `sipStatus='disabled'`. | الرقم الموقوف لا يستقبل ولا يقبل مكالمات. | إدخال الحالة في query ورفض واضح مع audit event. |
| 8 | P1 | sideband والـpost-call jobs محفوظة في `globalThis` داخل عملية Next. | deploy أو restart أو تعدد instances لا يفقد العمل. | queue وstate store دائم مثل Redis/DB مع lease وretry. |
| 9 | P1 | إغلاق sideband غير الطبيعي قد يترك المكالمة `live` بلا `endedAt`. | كل مكالمة تصل إلى حالة نهائية صحيحة. | reconciler دوري وheartbeat وtimeout state machine. |
| 10 | P1 | `getAgents` ينفذ `getVersionTestGate` لكل وكيل، مع قوائم كبيرة غير paginated. | زمن ثابت نسبيًا وقوائم قابلة للتوسع. | batch queries، joins محسوبة، cursor pagination، وقياس query count. |
| 11 | P1 | حقول JSONB واسعة ومقروءة كـ`unknown` ثم cast في أماكن متعددة. | البيانات تتحقق عند حدود القراءة والكتابة. | schemas مركزية بـZod وsafe parsing مع versioned payloads. |
| 12 | P1 | علاقات مهمة بلا foreign keys وحالات منطقية مخزنة كنصوص. | قاعدة البيانات تفرض سلامة العلاقات والقيم. | FKs، enums/check constraints، وتحويل booleans النصية تدريجيًا. |
| 13 | P1 | الصفحة التسويقية مرتبطة بعدة استعلامات تشغيلية في كل request. | الموقع العام سريع ويظل متاحًا عند تعطل قاعدة التشغيل. | cache/revalidation، read model تسويقي، وfallback منشور وآمن. |
| 14 | P1 | `/api/health` يعيد 200 ثابتًا دون فحص DB أو إعداد الصوت. | health وreadiness يعكسان قدرة الخدمة الفعلية. | فصل liveness عن readiness وفحص DB/config بمهل قصيرة. |
| 15 | P1 | لا توجد CI كاملة، و`pnpm check` لا يجمع lint/build/audit/contract tests. | كل commit يخضع لبوابة جودة موحدة. | CI تشمل install frozen، typecheck، lint، tests، build، audit policy، وmigration check. |

## 2. أهم 15 مشكلة منطقية وتكرارًا فكريًا

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P0 | مفهوم حالة المكالمة موزع بين webhook وsideband والواجهة بلا state machine واحدة. | انتقالات حالات موحدة ومسموح بها صراحة. | تعريف domain state machine واستخدامها في كل writers. |
| 2 | P0 | مفهوم Published version موزع بين `liveVersionId` وحالة النسخة دون invariant ذري. | مصدر حقيقة واحد لا يقبل التناقض. | خدمة نشر domain واحدة مع transaction وconstraints. |
| 3 | P0 | إيقاف الهاتف موجود إداريًا لكنه غير مطبق في resolver الصوت. | كل قرار إداري يطبق في runtime نفسه. | policy resolver مركزية واختبار عقد end-to-end. |
| 4 | P1 | الوصول للعميل، إنشاء العميل، وإرسال الدعوة مسارات منفصلة بلا orchestration. | عملية provisioning واحدة مرئية الحالة. | workflow موحد بخطوات وحالات وتعويض failures. |
| 5 | P1 | اختيار التكامل قد يرجع أول candidate حتى إن كان غير متصل أو بلا endpoint المطلوب. | اختيار deterministic لتكامل صالح فقط. | capability-aware resolver مع أسباب رفض واضحة. |
| 6 | P1 | أداة الحجز تثق في ISO slot المرسل من النموذج. | لا يحجز إلا slot مثبت ومتاح ضمن نتيجة سابقة. | reservation token قصير العمر أو إعادة تحقق server-side قبل التنفيذ. |
| 7 | P1 | callback يقبل payload ضعيفًا وقد يسجل طلبًا ناقصًا. | كل طلب callback صالح وقابل للتنفيذ. | Zod schema وحقول مطلوبة وتطبيع الهاتف وdeduplication. |
| 8 | P1 | نجاح provider الخارجي وفشل الحفظ المحلي يترك execution معلقة. | النتيجة قابلة للمصالحة دون تكرار الحجز. | idempotency key خارجي وoutbox/reconciliation job. |
| 9 | P1 | الـpost-call intelligence مربوط بإغلاق sideband بدل حدث دائم مستقل. | التحليل يستأنف مهما تغيرت العملية. | durable event بعد إنهاء المكالمة وworker مستقل. |
| 10 | P1 | المحتوى التسويقي يقرأ كيانات تشغيلية مباشرة وقد يعرض أسماء عملاء دون طبقة موافقة. | references منشورة وموافق عليها فقط. | marketing publication model مع consent وdraft/published. |
| 11 | P2 | قائمة التكاملات تكرر العناصر ذاتها لملء marquee. | تمثيل واحد لكل تكامل دون تكرار دلالي. | CSS loop بصري aria-hidden للنسخ، ومصدر بيانات فريد. |
| 12 | P2 | المحتوى العربي والإنجليزي موزع في ملفات ضخمة وهياكل متوازية يدويًا. | مفاتيح موحدة تكشف النقص بين اللغتين آليًا. | typed message catalog واختبار parity وترجمة حسب المجال. |
| 13 | P2 | error/loading implementations متكررة بين root وconsole وportal. | سلوك موحد مع تخصيص بسيط للسياق. | shared error boundary وskeleton primitives مع variants. |
| 14 | P2 | أنماط الصفحات الجانبية تعيد نفس hero/formula مع تغيير النص والصورة. | لكل صفحة قصة ووظيفة واضحة داخل نظام واحد. | page archetypes محدودة: proof، workflow، trust، conversion. |
| 15 | P2 | CSS يعرّف نفس selectors عبر media blocks متباعدة، ما يجعل النتيجة ترتيبية وهشة. | responsive rules محلية ومتوقعة. | طبقات CSS واضحة أو CSS Modules، وتوحيد breakpoints/tokens. |

## 3. أهم 15 مشكلة كود ميت وملفات وتنظيم

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P1 | 45 أصلًا داخل `public/` بلا أي مرجع كودي، بحجم يقارب 16.8MB. | `public/` يحتوي ما يشحن فعلًا فقط. | مراجعة قائمة الأصول ثم حذف المؤكد أو نقل source masters خارج `public/`. |
| 2 | P1 | صورتا screenshots كبيرتان متعقبتان في جذر repo. | الجذر نظيف من artifacts اليدوية. | نقل دليل التصميم إلى docs مضغوطًا أو حذفه بعد التحقق. |
| 3 | P1 | `drizzle-zod` مثبت وغير مستخدم. | dependency graph يطابق الاستخدام الحقيقي. | إزالته أو اعتماده فعليًا لتوليد schemas؛ لا يظل معلقًا. |
| 4 | P1 | `playwright` مستخدم في script لكنه غير معلن في `package.json`. | الفحص يعمل على أي جهاز من lockfile فقط. | إضافته devDependency وحذف مسارات Windows/Chrome الصلبة. |
| 5 | P2 | 18 export غير مستخدم بحسب `knip`. | API الداخلي أصغر وواضح. | إزالة export modifier أولًا، ثم حذف التنفيذ المؤكد عدم استخدامه. |
| 6 | P2 | 12 type export غير مستخدم. | أنواع المجال لا تحتوي واجهات قديمة مضللة. | جعلها داخلية أو حذفها بعد بحث الاستهلاك الخارجي. |
| 7 | P2 | ملفات `error.tsx` الثلاثة متطابقة تقريبًا. | مكوّن خطأ واحد مع labels/context props. | دمجها في shared boundary والإبقاء على wrappers رقيقة. |
| 8 | P2 | loading في console وportal مكرر. | skeleton system مشترك وشبيه بالشاشة الفعلية. | route-shaped skeleton primitives بدل نسخ عامة. |
| 9 | P2 | access page يكرر markup الجداول. | rendering موحد للأعضاء والدعوات والصلاحيات. | Table/List primitive محلي مع columns typed. |
| 10 | P2 | ملفات ضخمة: CSS حتى 1783 سطرًا وdata/action modules فوق 800-1300 سطر. | ownership واضح ووحدات قابلة للاختبار. | تقسيم حسب domain لا حسب حجم اعتباطي: calls، agents، access، landing. |
| 11 | P2 | `lib/content/site.ts` و`pages.ts` يجمعان محتوى وسلوكًا وتنسيقًا في ملفات ضخمة. | catalog منظم ومتحقق لكل route/locale. | فصل schemas، messages، page data، وformatters. |
| 12 | P2 | مجلد `services/` فارغ. | لا توجد حدود معمارية وهمية. | حذفه أو توثيق owner واستخدامه عند وجود خدمة فعلية فقط. |
| 13 | P2 | `pnpm-workspace.yaml` يحتوي placeholders نصية لـ`allowBuilds`. | سياسة build scripts صريحة وصحيحة. | استبدالها بقيم boolean موثقة واختبار clean install. |
| 14 | P2 | أصول hero/industry قديمة بصيغ PNG/JPG ثقيلة ومتعددة النسخ. | أصل واحد محسّن لكل استخدام وvariant. | AVIF/WebP responsive، manifest للأصول، وفحص أحجام في CI. |
| 15 | P3 | بعض helpers/constants مصدرة للاستخدام المستقبلي فقط مثل SEO وfilters وrealtime types. | لا توجد واجهات عامة بلا مستهلك. | قائمة deprecation قصيرة ثم حذف/دمج بعد اختبار imports الديناميكية. |

> ملاحظة: نتيجة `jscpd` لا تدعم ادعاء أن المشروع كله نسخ ولصق؛ التكرار النصي الكلي منخفض. المشكلة الأكبر هي تكرار المفاهيم والأنماط، لا عدد الأسطر المطابقة.

## 4. أهم 15 مشكلة في الواجهة العامة والتسويق

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P1 | الصفحة الرئيسية على الجوال بطول يقارب 10.6-11.9 ألف بكسل، وhero وحده قرابة 1397px. | قصة مركزة تصل للقيمة والدليل والتحويل بسرعة. | دمج الأقسام المتشابهة وخفض الصفحة إلى 5-6 فصول واضحة. |
| 2 | P1 | أول viewport داكن وواسع لكنه فارغ نسبيًا، والمرئي الأساسي transcript card. | المنتج والقيمة يظهران فورًا مع دليل استخدام حقيقي. | product scene قابل للفحص أو demo صوتي حقيقي مع CTA واضح. |
| 3 | P1 | عدة نصوص منخفضة التباين؛ بعض التركيبات بين 2.61 و4.24. | WCAG AA للنص الطبيعي والحالات والتفاعلات. | تعديل tokens لا مواضع منفردة، واختبار contrast آلي. |
| 4 | P1 | وعود مثل الإلغاء/النقل والحذف التلقائي والتحويل الفوري لا يثبتها runtime الحالي. | كل ادعاء قابل للإثبات أو موصوف بدقة. | claims inventory مرتبط بcapabilities واختبارات المنتج. |
| 5 | P1 | الشعار raster كبير المصدر وصغير العرض ويُفلتر للأبيض في الداكن، فيبدو لينًا ويفقد لونه. | شعار حاد ومتوازن في كل theme وحجم. | أصل SVG/retina مع variants معتمدة دون تغيير هوية الشعار. |
| 6 | P1 | الأرقام الحية قد تظهر أصفارًا أو تتغير مع DB التشغيلية. | proof ثابت ومفسر أو metrics حقيقية ذات سياق. | snapshot منشور مع فترة القياس، أو إخفاء القيم غير الناضجة. |
| 7 | P2 | صفحات About/How/Pricing/Security/FAQ/Contact تستخدم قالب hero متكررًا. | كل صفحة تؤدي مهمة شراء مختلفة. | إعادة بناء بنماذج سردية مختلفة داخل design system واحد. |
| 8 | P2 | النص الإنجليزي يحوي عبارات غير طبيعية مثل “customers calls” و“running us”. | لغة B2B أصلية ومقنعة لا ترجمة حرفية. | تحرير native copy واختبار رسائل حسب ICP والقطاع. |
| 9 | P2 | بعض النصوص تشرح التقنية بدل النتيجة، مثل prompts وSIP في مواضع البيع. | الرسالة تبدأ بالأثر التجاري والدليل ثم التفاصيل عند الطلب. | outcome-first hierarchy مع technical disclosure ثانوي. |
| 10 | P2 | تكاملات marquee مكررة بصريًا ودلاليًا. | صف نظيف قابل للمسح دون ضوضاء screen reader. | unique list، الحركة اختيارية، واحترام reduced motion. |
| 11 | P2 | صور القطاعات الأربع تُحمّل معًا حتى عند إظهار واحدة. | الوسائط المطلوبة فقط تُحمّل وبلا flash. | responsive image strategy وconditional rendering/preload محسوب. |
| 12 | P2 | صور بعض الصفحات جميلة لكنها generic ولا تثبت المنتج الفعلي. | المرئي يبرهن كيف يعمل MUJAWIB. | لقطات منتج موثوقة، مكالمة قابلة للاستماع، ونتيجة تشغيلية. |
| 13 | P2 | الفوتر على الجوال غير متوازن، والاعتماد القانوني وMa-Fo منخفضا الظهور. | footer مضغوط ومتزن وسهل المسح. | ترتيب brand/contact ثم روابط مجموعات ثم legal/credit بسطر واضح. |
| 14 | P2 | تغيير اللغة يعيد تحميل الصفحة بلا انتقال ملحوظ. | انتقال يحافظ على المكان ويشرح تغيير الاتجاه بهدوء. | locale routing client-aware مع View Transitions واحترام reduced motion. |
| 15 | P2 | 404 وerror/loading عربية فقط رغم وجود نسخة إنجليزية للموقع. | كل حالات النظام تحترم locale والاتجاه. | localized system pages واختبارات routes لكلا اللغتين. |

## 5. أهم 15 مشكلة في لوحة التحكم والإدارة

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P1 | الصفحة الرئيسية ما زالت تبدأ بشريط metric cards يطغى على العمل المطلوب. | البداية تعرض المخاطر والمهام والاستثناءات. | operational queue أولًا، والمؤشرات كسطر ثانوي قابل للمقارنة. |
| 2 | P1 | معظم الصفحات داخل `Section` panels متتابعة، فتعود هيئة “كروت كثيرة”. | canvas عمل هادئ بمناطق مستمرة وحدود قليلة. | إزالة الحاويات الزخرفية والإبقاء على panels للأدوات المستقلة فقط. |
| 3 | P1 | لا يوجد workspace/client switcher واضح رغم تعدد المساحات. | السياق الحالي ظاهر وقابل للتبديل بأمان. | selector في topbar مع recent workspaces وpermissions. |
| 4 | P1 | لا يوجد profile/logout/account control واضح داخل shell. | هوية المستخدم والجلسة وإجراءاتها في مكان متوقع. | account menu موحد مع logout والأمان واللغة. |
| 5 | P1 | inspector يختفي بالكامل تحت 1400px. | التفاصيل متاحة دائمًا دون كسر مساحة العمل. | drawer قابل للفتح أو split view متكيف. |
| 6 | P1 | calls workbench تحت 1024px يضع قائمة 360px قبل التفاصيل. | المستخدم يصل للمكالمة والتفاصيل بأقل تمرير. | master-detail tabs أو route detail مستقل على الهاتف. |
| 7 | P1 | الجداول تعتمد horizontal scrolling على الشاشات الصغيرة. | أهم الحقول والإجراءات مقروءة بلمسة واحدة. | priority columns، row detail، وmobile list presentation. |
| 8 | P1 | 13 وجهة في sidebar دون grouping تدريجي كاف. | التنقل يعكس مهام التشغيل اليومية. | مجموعات تشغيل/جودة/إعداد، مع إظهار حسب الدور والاستخدام. |
| 9 | P2 | sidebar يطوى تلقائيًا ويعتمد على `title` لشرح الأيقونات. | حالة الطي مقصودة والأسماء متاحة للوصول. | toggle محفوظ وtooltip accessible حقيقي. |
| 10 | P2 | أيقونة Settings تتكرر للصوت والنظام. | كل وجهة لها رمز ومعنى مستقلان. | استخدام icons دلالية ثابتة من المكتبة الحالية. |
| 11 | P2 | topbar لا يوضح breadcrumbs أو client/agent context في العمليات العميقة. | مكان المستخدم وسياق التعديل واضحان. | breadcrumb مختصر وcontext chip غير زخرفي. |
| 12 | P2 | لا يوجد max-width عملي على ultrawide؛ كثافة القراءة تتدهور. | المحتوى يستفيد من العرض دون خطوط طويلة أو فراغ ضخم. | fluid grid مع حدود عرض خاصة بالجداول والتفاصيل. |
| 13 | P2 | low-contrast tokens تظهر في labels والحالات الكثيفة. | الحالات الثانوية تبقى مقروءة في light/dark. | semantic color tokens واختبار AA لكل status. |
| 14 | P2 | empty states غالبًا وصفية بلا next action حسب الصلاحية. | الفراغ يقود للمهمة التالية مباشرة. | CTA واحد contextual مع متطلبات readiness. |
| 15 | P2 | UX smoke يتجاوز console/portal عند غياب جلسة، فلا يحمي الواجهات الحرجة. | لقطات وتفاعلات authenticated لكل دور واتجاه وحجم. | test identities مع seeded DB وفحوص RTL/LTR بصرية في CI. |

## 6. أهم 15 خللًا في رحلة العميل والإدارة والمشروع

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P0 | onboarding يتطلب operator بصلاحية `client.manage`، فلا يستطيع العميل إكماله بنفسه. | تعريف واضح: managed onboarding أو self-serve، دون مسار هجين متناقض. | في V1 اجعله operator-led صراحة مع client review step. |
| 2 | P0 | إنشاء Client لا ينشئ أو يدعو هوية العميل تلقائيًا. | provisioning ينتهي بمالك عميل قادر على الدخول. | خطوة access invitation داخل workflow نفسه مع حالة واضحة. |
| 3 | P0 | لا توجد رحلة go-live واحدة من draft إلى اختبار ونشر وربط رقم. | checklist واحدة تمنع النشر قبل الجاهزية وتوضح المتبقي. | orchestration screen مبنية على readiness domain، لا checklist UI فقط. |
| 4 | P0 | لا يوجد مسار واضح لإنشاء أو clone نسخة Agent جديدة بعد v1. | كل تغيير يبدأ Draft جديدًا محفوظ التاريخ. | action رسمي `createVersionFromPublished` مع diff وownership. |
| 5 | P0 | portal يختار أول workspace أبجديًا بصمت. | المستخدم يختار ويعرف workspace النشط. | switcher وحفظ آخر اختيار والتحقق من membership. |
| 6 | P1 | نشر النسخة وربط الهاتف عمليتان منفصلتان يمكن أن تتناقضا. | route لا يشير إلا إلى Published version صالحة. | publish-and-route workflow ذري أو preflight + guarded activation. |
| 7 | P1 | readiness موزع بين صفحات integrations/agents/phones/test lab. | حالة واحدة قابلة للتفسير مع deep links للإصلاح. | readiness aggregate domain وتفاصيل blockers. |
| 8 | P1 | contact/demo لا يوفر حجزًا أو lifecycle للطلب. | lead يدخل مسارًا قابلًا للمتابعة والقياس. | form/booking مع consent، owner، status، وCRM handoff. |
| 9 | P1 | client operations لا تظهر بوضوح ما الذي يديره MUJAWIB وما الذي يوافق عليه العميل. | RACI واضح في كل تغيير حساس. | approval states للنشر والصوت والسياسات والتكاملات. |
| 10 | P1 | فشل خطوة provisioning قد يترك موارد متفرقة بلا استئناف. | المشغل يرى الخطوة الفاشلة ويعيدها دون duplication. | persisted workflow steps وresume/compensate actions. |
| 11 | P1 | disable route لا يمنع مكالمة جديدة حاليًا. | زر الإيقاف له أثر فوري ومؤكد. | runtime policy مشتركة واختبار اتصال بعد الإيقاف. |
| 12 | P2 | سجل الدخول يعرض قصة مكالمة تختلف تفاصيلها بين الحوار والنتيجة. | المثال متسق ويثق به المستخدم. | fixture واحدة typed تغذي النص والنتيجة والتوقيت. |
| 13 | P2 | صفحة الدخول تقول إن المثال فعلي من DB بينما الاستعلام يختار seed مخصصًا. | الوصف صادق: demo موثق أو مكالمة فعلية بموافقة. | تغيير الادعاء أو استخدام سجل منشور ومجهول الهوية. |
| 14 | P2 | الواجهة الإنجليزية لا تمتد إلى auth/dashboard/system states. | الرحلة كاملة في لغة المستخدم من التسويق إلى التشغيل. | locale coverage matrix وتنفيذ shell/messages قبل صفحات ثانوية. |
| 15 | P2 | لا توجد نقطة انتهاء واضحة لما بعد أول مكالمة: review، issue، tune، republish. | حلقة تحسين تشغيلية قابلة للقياس. | call review -> issue -> draft change -> test -> approval -> publish. |

## 7. أهم 10 مشكلات أمان وحداثة

| # | الأولوية | قبل الإصلاح | بعد الإصلاح المطلوب | الإجراء المقترح |
| --- | --- | --- | --- | --- |
| 1 | P0 | Next.js 15.5.19 متأثر بثغرات DoS وSSRF وتسريبات متوسطة. | نسخة مصححة ضمن نفس الفرع أولًا. | التحديث الفوري إلى 15.5.23 واختبار البناء والصوت قبل التفكير في v16. |
| 2 | P0 | `sharp` 0.34.5 التابع متأثر بثغرات libvips مرتفعة. | `sharp >=0.35.0` عبر شجرة سليمة. | تحديث Next/overrides بحذر ثم إعادة `pnpm audit`. |
| 3 | P0 | `postcss` و`nanoid` واعتماد esbuild تابع تحمل تنبيهات أمنية. | لا ثغرات مرتفعة في production graph. | تحديث مباشر/غير مباشر مع frozen lock والتحقق من provenance. |
| 4 | P0 | `safeReturnTo` و`safeNext` يمنعان `//` فقط؛ backslash قد يتحول إلى origin خارجي. | كل redirect داخلي same-origin مهما كان الترميز. | parser مركزي باستخدام `new URL` ومقارنة origin ثم اختبارات bypass. |
| 5 | P0 | فحص SSRF يحل DNS ثم `fetch` يعيد الحل، ما يترك DNS rebinding/TOCTOU. | الاتصال يتم إلى العنوان الذي تم التحقق منه أو عبر egress policy. | dispatcher يثبت IP مع Host/TLS صحيح، أو allowlist/proxy شبكي. |
| 6 | P1 | لا توجد headers مركزية مثل CSP وHSTS وframe-ancestors وReferrer Policy. | baseline متين لكل public/authenticated routes. | إعداد headers في Next مع CSP تدريجي وreport-only أولًا. |
| 7 | P1 | transcripts وأرقام وهوية عميل وSIP metadata مخزنة بلا تشفير حقلي تطبيقي. | البيانات الأعلى حساسية مشفرة ومحدودة الوصول. | envelope encryption، key rotation، وتقليل البيانات المخزنة. |
| 8 | P1 | retention مجرد إعداد/نص بلا purge job مثبت. | الحذف ينفذ ويُدقق ويمكن إثباته. | scheduled deletion worker مع legal hold وaudit metrics. |
| 9 | P1 | حسابات managed لا تفرض تحقق البريد أو تغيير كلمة المرور أو MFA/step-up للإدارة. | الوصول الحساس يتطلب هوية مؤكدة ومصادقة أقوى. | invitation-first، first-login reset، MFA، وstep-up للعمليات الحرجة. |
| 10 | P1 | webhook يعتمد replay window دون سجل webhook ID/حجز unique. | إعادة إرسال الحدث لا تعيد الأثر حتى داخل النافذة. | event receipt table بunique ID/hash وحالة processing/complete. |

## 8. حداثة المكتبات وقرار التحديث

تمت مقارنة النسخ المثبتة مع السجلات الرسمية بتاريخ التقرير. القاعدة المقترحة: لا نطارد كل major جديد؛ نعالج الأمن أولًا، ثم نحدّث majors في فروع منفصلة مع migrations واختبارات.

| الحزمة/البيئة | الحالي | الأحدث/المستقر المرصود | القرار |
| --- | --- | --- | --- |
| Node.js | 24.16.0 | 24.19.0 LTS؛ 26.7.0 Current | البقاء على LTS وتحديث patch إلى 24.19.0. لا استخدام Node 26 للإنتاج الآن. |
| pnpm | 11.19.0 | 11.22.0 | تحديث منخفض المخاطر ثم clean install. |
| Next.js | 15.5.19 | 15.5.23 في نفس الفرع؛ 16.3.2 أحدث major | P0 إلى 15.5.23، ثم مشروع مستقل لـNext 16 بسبب تغييرات build/middleware. |
| React / React DOM | 19.2.8 | 19.2.8 | حديث؛ لا تغيير. |
| Better Auth | 1.6.28 | 1.7.1 | تحديث مخطط له فقط؛ دليل 1.7 يتطلب مراجعة schema/data migration. |
| Drizzle ORM | 0.45.2 | 0.45.2 | حديث؛ أصلح استراتيجية migrations بدل تبديل المكتبة. |
| drizzle-kit | 0.31.10 مثبت | 0.31.10 | توحيد manifest والنسخة المثبتة وتفعيل migrations المتعقبة. |
| Zod | 4.4.3 | 4.4.3 | حديث؛ استثماره في حدود JSONB والـtools. |
| TanStack Query | 5.101.4 | 5.101.4 | حديث؛ لا تغيير. |
| Neon serverless | 1.1.0 | 1.1.0 | حديث؛ أصلح retry policy حوله. |
| Biome | 2.5.8 | 2.5.10 | تحديث patch منخفض المخاطر. |
| TypeScript | 5.9.3 | 7.0.2 major | عدم القفز الآن؛ تقييم منفصل بعد استقرار Next والأدوات. |
| `@types/node` | 22.20.1 | فرع 24 متاح | مطابقته مع Node 24 بدل القفز إلى types 26. |
| lucide-react | 1.31.0 | 1.33.0 | تحديث minor بعد visual regression check. |

### مصادر رسمية

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [TypeScript official site](https://www.typescriptlang.org/)
- [Better Auth 1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- [Biome changelog](https://biomejs.dev/internals/changelog/)
- [Next.js DoS advisory](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)
- [Next.js SSRF advisory](https://github.com/advisories/GHSA-89xv-2m56-2m9x)
- [sharp/libvips advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)

## ترتيب التنفيذ المقترح

### المرحلة P0: منع فقد البيانات والثغرات

1. تحديث Next.js إلى 15.5.23 وإغلاق ثغرات dependency graph المرتفعة.
2. إصلاح open redirect وSSRF DNS rebinding وإضافة اختبارات أمنية.
3. إيقاف retry غير الآمن للكتابات.
4. إنشاء migrations حقيقية وقيود unique/FK اللازمة.
5. جعل webhook receipt/accept/persistence idempotent وقابلًا للمصالحة.
6. جعل publish والonboarding ذريين، ومنع أرقام `disabled` في runtime.

### المرحلة P1: موثوقية التشغيل ورحلة go-live

1. نقل sideband/post-call إلى durable jobs وإضافة reconciler للمكالمات العالقة.
2. بناء go-live workflow وversion creation وworkspace switching.
3. تقوية invariants للحجز والتكاملات وcallbacks.
4. تطبيق retention فعلي، وتشفير البيانات الحساسة، وتقوية حسابات الإدارة.

### المرحلة P2: تجربة المنتج والواجهة

1. اختصار الصفحة العامة وإعادة كتابة الرسائل حسب القدرات المثبتة.
2. رفع التباين، تحسين الشعار والأصول، وتوحيد اللغة لكل حالات النظام.
3. تحويل dashboard من panel/card stack إلى operational workbench.
4. إضافة فحوص بصرية authenticated لكل دور وRTL/LTR والجوال.

### المرحلة P3: التنظيف والتحديثات الكبرى

1. تنظيف الأصول والكود والتصديرات بعد اختبار الاستخدام.
2. تقسيم الوحدات الكبيرة حسب domain وتثبيت design/content systems.
3. ترقية Better Auth وNext 16 وTypeScript major كلٌ في تغيير مستقل.

## قرار الجاهزية

**الحكم الحالي:** صالح للتطوير والعرض المحلي، وغير جاهز بعد للنشر التشغيلي واسع النطاق أو للاعتماد على سلامة المكالمات والبيانات دون تنفيذ P0.
**ما لم يحدث:** لم يُحذف أي ملف، ولم تُحدّث أي مكتبة، ولم يُغيّر schema أو runtime أو UI. هذا التقرير هو نقطة الاتفاق قبل بدء الإصلاحات.
