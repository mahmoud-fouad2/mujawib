# MUJAWIB — حالة تنفيذ Product Bible

يُحدَّث مع كل دفعة عمل. المصدر: `MUJAWIB.txt`.
آخر تدقيق: 19 أغسطس 2026 — بفحص الكود، لا بالتقدير.

**المفتاح**: ✅ منفَّذ · 🟡 جزئي · ❌ غير منفَّذ

---

## الأقسام المنفَّذة

| § | البند | الحالة | أين |
|---|---|---|---|
| 4 | Design System (tokens، radius، motion، grid) | ✅ | `app/styles/tokens.css` |
| 5 | لوحتان منفصلتان: Operator + Client | ✅ | `app/console`, `app/portal` |
| 6 | App Shell + collapse + top bar محدود | ✅ | `components/console/shell.tsx` |
| 7 | Operator Home بترتيب البايبل | ✅ | `app/console/page.tsx` |
| 8 | Live Operations | ✅ | `app/console/live` |
| 9 | Calls Inbox (List→Preview→Inspector) | ✅ | `components/console/calls-workbench.tsx` |
| 10 | Call Detail (Timeline/Conversation/Inspector) | ✅ | نفس الملف |
| 12 | Prompt Compiler — الطبقات التسع | ✅ | `server/voice/prompt.ts` |
| 14 | Pronunciation Dictionary | ✅ | `app/console/voice-lab` |
| 16 | Industry Packs (4) | ✅ | `industry_template` |
| 20 | Client Portal — 8 شاشات | ✅ | `app/portal/*` |
| 22 | QA Center + Review Queue + أسباب | ✅ | `app/console/qa` |
| 24 | Analytics (chart يجيب سؤالًا فقط) | ✅ | `components/console/charts.tsx` |
| 26 | Core Data Model — كل الكيانات | ✅ | `server/db/schema` |
| 30 | Managed Onboarding — provisioning فعلي | ✅ | `server/actions/onboarding.ts` |
| 35 | UI Component Inventory | ✅ | `components/ui`, `components/console` |
| 36 | Microcopy & Tone | ✅ | نصوص عربية بلا مبالغة |
| 37 | Responsive & RTL + عزل الأرقام | ✅ | خصائص منطقية + `.mono` |
| 38 | Marketing Website | ✅ | `app/page.tsx` + 6 صفحات |

---

## الأقسام الجزئية

| § | البند | ما يعمل | ما ينقص |
|---|---|---|---|
| 11 | **Agent Factory** | عرض النسخ، النشر، الاسترجاع، الحواجز | **لا يوجد محرّر**: المراحل السبع (Identity→QA) تُقرأ ولا تُحرَّر من الواجهة. الإنشاء من الـwizard فقط |
| 13 | **Voice Lab** | ملفات اللهجات، القاموس، نتائج الاختبار | **لا تشغيل فعلي** للاختبارات — النتائج مقروءة من البذرة |
| 15 | **Conversation Flows** | تُقرأ وتُعرض، تُنشأ من القالب | **لا محرّر مراحل** ولا سحب/ترتيب |
| 17 | Custom Solution | REST API tool معرَّف | لا واجهة لتعريف أداة مخصّصة |
| 18 | **Integrations** | الصحة، الاختبار، الأثر، **والمنفّذات** | **لا OAuth** لأي مزوّد — لا Google ولا WhatsApp |
| 19 | Phone & Telephony | الأرقام، التوجيه، طلب اختبار | **لا Wizard** بثلاث حالات (PBX/موبايل/رقم جديد) |
| 21 | Change Requests | إنشاء، سحب، تقدّم، Timeline | لا إشعار عند تغيّر الحالة |
| 25 | **Roles & Permissions** | جلسة + حماية مسارات | **لا أدوار إطلاقًا** — كل من يدخل يرى كل شيء |
| 27 | Technical Architecture | Frontend, DB, Auth, **webhook + prompt + tools + handlers** | **لا sideband WebSocket منشور** |
| 29 | Security | عزل، سجل تدقيق، احتفاظ، تحقق توقيع | لا تشفير حقول، لا kill switch في الواجهة، لا PII masking في التصدير |

---

## الأقسام غير المنفَّذة

| § | البند | لماذا يهم |
|---|---|---|
| 23 | **Test Lab** | لا اختبار متصفح ولا هاتفي ولا دفعة سيناريوهات ولا regression ولا مقارنة نسختين. **هذا ما يجعل «بوابة النشر» ذات معنى** — بدونه الحواجز يدوية |
| 31 | **Notification System** | لا إشعارات إطلاقًا. تعطّل ربط أو انهيار مسار لا يُبلَّغ عنه — يُكتشف بالمصادفة |
| 32 | Knowledge structured editor | المعرفة تُنشأ من الـwizard والبوابة فقط، لا محرّر كامل |

---

## المسار الصوتي — تفصيل (§27)

| الخطوة | الحالة |
|---|---|
| 1–2 المتصل → المشغّل → SIP trunk | ❌ **يحتاجك**: لا trunk ولا رقم |
| 3 SIP → OpenAI Realtime | ❌ يحتاج توجيه الـtrunk |
| 4 webhook + تحديد الرقم | ✅ `app/api/voice/incoming` |
| 5 قبول المكالمة بإعدادات النسخة | ✅ `buildAcceptPayload` |
| 6 **sideband للأدوات والمراقبة** | 🟡 المنفّذات جاهزة (`server/voice/handlers.ts`) لكن **لا عملية دائمة تستقبل استدعاءات الأدوات** |
| 7 الأدوات → تقويم/CRM/واتساب | 🟡 المنطق جاهز، ينتظر OAuth وعناوين فعلية |
| 8 النتائج → قاعدة البيانات → اللوحة | ✅ |

> **الخلاصة**: الخطوة 6 هي الحاجز. تحتاج عملية Node دائمة تفتح
> `wss://api.openai.com/v1/realtime?call_id=…` وتستدعي `executeTool` عند كل
> `response.function_call_arguments.done`. الهيكل موجود في `services/realtime`
> وغير منشور.

---

## البيانات

قاعدة البيانات مبذورة ببيانات **مولَّدة** (`scripts/seed.ts`): 3,053 مكالمة عبر
5 مساحات عمل. هذه لتشغيل الواجهات، **وليست عملاء حقيقيين**.

⚠️ الموقع يعرض هذه الأرقام تحت عبارة «أرقام فعلية من المنصة». صحيح تقنيًا
(تُقرأ من قاعدة البيانات فعلًا) وغير دقيق تجاريًا. يجب تعديل العبارة أو
استبدال البيانات قبل أول عميل.
