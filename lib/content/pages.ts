import type { Locale } from '@/lib/i18n'

/**
 * Copy for the standalone pages. Each page has its own shape rather than one
 * generic template — a pricing page and an FAQ answer different questions and
 * should not be rendered by the same component.
 */

export type FaqItem = { q: string; a: string }

export type PricingBand = {
  name: string
  forWho: string
  volume: string
  includes: string[]
  featured?: boolean
}

type Pages = {
  contact: {
    title: string
    lead: string
    channels: { label: string; value: string; href: string; note: string }[]
    expect: { step: string; body: string }[]
    hours: string
  }
  pricing: {
    title: string
    lead: string
    bands: PricingBand[]
    note: string
    faq: FaqItem[]
  }
  faq: {
    title: string
    lead: string
    groups: { title: string; items: FaqItem[] }[]
  }
  about: {
    title: string
    lead: string
    story: string[]
    principles: { title: string; body: string }[]
    stance: { title: string; body: string }
  }
  security: {
    title: string
    lead: string
    intro: string[]
    practices: { title: string; body: string }[]
    notClaimed: string
  }
  howItWorks: {
    title: string
    lead: string
    detail: { n: string; title: string; body: string; youDo: string; weDo: string }[]
    timeline: string
  }
}

const ar: Pages = {
  contact: {
    title: 'تحدّث مع الفريق.',
    lead: 'مُجاوِب خدمة مُدارة — نبدأ بمكالمة نفهم فيها عملك، لا بنموذج تسجيل. اختر الطريقة الأسهل لك.',
    channels: [
      {
        label: 'البريد',
        value: 'hello@mujawib.com',
        href: 'mailto:hello@mujawib.com',
        note: 'نرد خلال يوم عمل واحد.',
      },
      {
        label: 'الهاتف',
        value: '+966 920 012 130',
        href: 'tel:+966920012130',
        note: 'الأحد إلى الخميس، 9 صباحًا – 6 مساءً بتوقيت الرياض.',
      },
      {
        label: 'واتساب',
        value: '+966 920 012 130',
        href: 'https://wa.me/966920012130',
        note: 'للأسئلة السريعة قبل الاجتماع.',
      },
    ],
    expect: [
      {
        step: 'مكالمة أولى — 20 دقيقة',
        body: 'نسمع منك: كم مكالمة تصلك، من يرد عليها الآن، وأي طلب يتكرر أكثر من غيره.',
      },
      {
        step: 'عرض مبني على حالتك',
        body: 'نرجع لك بسيناريو واحد محدد نبدأ به، وتقدير للحجم والتكلفة — لا عرض عام.',
      },
      {
        step: 'تسمع النتيجة قبل التوقيع',
        body: 'نجهّز الموظف الصوتي على سيناريوك، وتسمع مكالمة تجريبية بنفسك.',
      },
    ],
    hours: 'الأحد – الخميس · 9:00 – 18:00 بتوقيت الرياض',
  },
  pricing: {
    title: 'السعر يتبع حجم مكالماتك.',
    lead: 'لا باقات جامدة ولا رسوم لكل مستخدم. نتفق على النطاق بعد أن ترى الموظف الصوتي يعمل على سيناريو من عملك.',
    bands: [
      {
        name: 'بداية',
        forWho: 'فرع واحد أو سيناريو واحد',
        volume: 'حتى 500 مكالمة شهريًا',
        includes: [
          'موظف صوتي واحد بلهجة واحدة',
          'ربط التقويم وواتساب',
          'رقم استقبال واحد',
          'لوحة تشغيل ومتابعة',
        ],
      },
      {
        name: 'تشغيل',
        forWho: 'عدة فروع أو أكثر من سيناريو',
        volume: '500 – 3,000 مكالمة شهريًا',
        includes: [
          'أكثر من موظف صوتي ولهجة',
          'ربط CRM ونظامك الخاص',
          'أرقام متعددة وتوجيه حسب الفرع',
          'مراجعة جودة أسبوعية',
          'بوابة عميل لفريقك',
        ],
        featured: true,
      },
      {
        name: 'مؤسسي',
        forWho: 'شبكة فروع أو حجم مرتفع',
        volume: 'أكثر من 3,000 مكالمة شهريًا',
        includes: [
          'كل ما سبق',
          'اتفاقية مستوى خدمة',
          'سياسة احتفاظ ومنطقة بيانات مخصصة',
          'مسؤول تشغيل مخصص',
        ],
      },
    ],
    note: 'الإعداد والتجهيز والاختبار يتولاه فريقنا بالكامل ضمن الاشتراك — لا رسوم إعداد منفصلة في أول سيناريو.',
    faq: [
      {
        q: 'هل أدفع لكل مستخدم في فريقي؟',
        a: 'لا. السعر مرتبط بعدد المكالمات المعالَجة. يمكنك إضافة من تشاء من فريقك للوحة دون تكلفة إضافية.',
      },
      {
        q: 'ماذا لو تجاوزت حجم خطتي؟',
        a: 'لا نوقف الخدمة ولا نقطع مكالمة. نتواصل معك لتعديل الخطة من الشهر التالي.',
      },
      {
        q: 'هل هناك عقد طويل؟',
        a: 'الاشتراك شهري قابل للإنهاء بإشعار 30 يومًا. لا نطلب التزامًا سنويًا للبدء.',
      },
    ],
  },
  faq: {
    title: 'أسئلة يسألها كل من يفكر في تشغيلنا.',
    lead: 'إن لم تجد إجابتك هنا، اسألنا مباشرة — نرد خلال يوم عمل.',
    groups: [
      {
        title: 'قبل التشغيل',
        items: [
          {
            q: 'كم يستغرق التشغيل من أول اتصال؟',
            a: 'من أسبوع إلى ثلاثة أسابيع حسب تعقيد عملك وسرعة ربط أنظمتك. السيناريو الأول عادة جاهز للاختبار خلال أسبوع.',
          },
          {
            q: 'هل أحتاج فريقًا تقنيًا؟',
            a: 'لا. نحتاج منك معلومات عملك — الخدمات، الأسعار، الفروع، ساعات العمل، ومتى يجب تحويل المكالمة لموظف. الباقي علينا.',
          },
          {
            q: 'هل أغيّر رقمي الحالي؟',
            a: 'لا. نربط رقمك الحالي عبر تحويل المكالمات، أو نوفّر رقمًا جديدًا يعمل بجانبه. القرار لك.',
          },
        ],
      },
      {
        title: 'عن الصوت',
        items: [
          {
            q: 'هل يبدو الصوت آليًا؟',
            a: 'لا يخرج للتشغيل قبل أن يمر على حزمة اختبار عربية: اسم مركّب، رقم من عشر خانات، سعر بالريال، وقت مثل «6:30 مساءً»، وجملة يخلط فيها المتصل الإنجليزية. إن لم يمر، لا يعمل.',
          },
          {
            q: 'ماذا لو قاطعه العميل؟',
            a: 'يتوقف فورًا ويكمل من حيث انتهى، دون صمت محرج أو إعادة الجملة من أولها.',
          },
          {
            q: 'هل يفهم اللهجات؟',
            a: 'ندعم السعودي والمصري والخليجي والفصحى. نختار اللهجة حسب جمهورك، ويمكن تغييرها لاحقًا.',
          },
          {
            q: 'ماذا لو لم يفهم الطلب؟',
            a: 'يستوضح مرة، فإن لم يتضح يحوّل لفريقك مع سياق المكالمة كاملًا — لا يخمّن ولا يترك المتصل معلّقًا.',
          },
        ],
      },
      {
        title: 'التشغيل اليومي',
        items: [
          {
            q: 'هل يمكنه الحجز في تقويمي؟',
            a: 'نعم — يقرأ المتاح من Google Calendar أو Microsoft 365، يثبّت الموعد، ويرسل التأكيد على واتساب أثناء المكالمة.',
          },
          {
            q: 'ماذا يحدث إذا تعطّل التقويم؟',
            a: 'لا يؤكد حجزًا لم يحدث. يسجّل طلب معاودة اتصال أو يحوّل لفريقك، ويظهر التعطّل في لوحتك فورًا.',
          },
          {
            q: 'هل أستطيع إيقافه؟',
            a: 'نعم، بضغطة واحدة. كل المكالمات تتحول مباشرة لرقم فريقك حتى تعيد تشغيله.',
          },
          {
            q: 'كيف أعرف ماذا حدث في المكالمات؟',
            a: 'كل مكالمة لها سجل: الحوار كاملًا، الأدوات التي نُفِّذت، والنتيجة. ولديك قائمة مرتّبة بما يحتاج انتباهك أولًا.',
          },
        ],
      },
    ],
  },
  about: {
    title: 'بنينا مُجاوِب لأن المكالمة العربية تستحق أفضل من ردّ آلي.',
    lead: 'لسنا أداة تبني بها روبوت محادثة. نحن فريق تشغيل يجهّز لك موظفًا صوتيًا، يختبره، ثم يبقى مسؤولًا عن جودته.',
    story: [
      'أغلب حلول الصوت العربي تُبنى بترجمة منتج إنجليزي. النتيجة صوت ينطق الأسماء خطأً، يتلعثم في رقم جوال، ويعطي المتصل وعدًا لم يحدث.',
      'المشكلة ليست في النموذج وحده — بل في أن الإعداد يُترك لمربع نص حر. كل من يعدّله ينتج شيئًا مختلفًا، ولا أحد يعرف لماذا تغيّر السلوك.',
      'فبنينا الأمر بالعكس: إعداد منظّم بطبقات ثابتة، حزمة اختبار عربية تحكم النشر، وسجل لكل مكالمة يمكن مراجعته. والأهم: لا تأكيد لعملية قبل نجاحها فعلًا.',
    ],
    principles: [
      {
        title: 'لا نَعِد بما لم يحدث',
        body: 'الموظف الصوتي لا يقول «تم الحجز» قبل أن يرجع نظامك بموعد مثبّت. هذه ليست ميزة — هي شرط.',
      },
      {
        title: 'الجودة اختبار لا انطباع',
        body: 'لا ننشر لأن الصوت «أعجبنا». ننشر لأنه اجتاز حزمة اختبار مكتوبة، وأي فشل حرج يوقف النشر.',
      },
      {
        title: 'خدمة مُدارة، لا أداة',
        body: 'لا نسلّمك لوحة ونتركك. نحن من نجهّز ونختبر ونتابع الأسبوع الأول ونحسّن من مكالماتك الحقيقية.',
      },
      {
        title: 'كل شيء قابل للتراجع',
        body: 'أي تغيير يُحفظ كنسخة. لم يعجبك السلوك الجديد؟ ترجع للسابق فورًا دون أن تتأثر مكالمة جارية.',
      },
    ],
    stance: {
      title: 'ما لا نفعله',
      body: 'لا نبيع تسجيلًا ذاتيًا بلا إعداد، ولا ندّعي أرقامًا لم نقسها، ولا نستخدم مكالمات عملائنا لتدريب أي نموذج. وإن لم يكن الصوت جاهزًا لعملك، نقولها قبل أن تدفع.',
    },
  },
  security: {
    title: 'أنت تسلّمنا مكالمات عملائك.',
    lead: 'هذه صفحة عمّا نفعله فعلًا لحماية تلك البيانات — وعمّا لا ندّعيه.',
    intro: [
      'مكالمات شركتك وبيانات المتصلين بها ملك لك. نحن نعالجها نيابةً عنك لتشغيل الخدمة فقط، ولا نبيعها ولا نشاركها مع أي جهة إعلانية.',
      'ولا نستخدم محتوى مكالماتك لتدريب نماذج ذكاء اصطناعي — لا نماذجنا ولا نماذج غيرنا.',
    ],
    practices: [
      {
        title: 'عزل كامل بين العملاء',
        body: 'لكل شركة مساحة عمل منفصلة على مستوى قاعدة البيانات. لا يمكن لمستخدم في شركة أن يصل لبيانات شركة أخرى بأي حال.',
      },
      {
        title: 'بيانات الاعتماد لا تُعرض',
        body: 'مفاتيح أنظمتك تُخزَّن مشفَّرة ولا تظهر في أي واجهة — لا لك ولا لفريق التشغيل لدينا.',
      },
      {
        title: 'صلاحيات حسب الدور',
        body: 'مراجع الجودة يرى المكالمات ولا يرى بيانات الربط. مدير الشركة يرى النتائج ولا يرى إعدادات النموذج.',
      },
      {
        title: 'سجل تدقيق لكل تغيير',
        body: 'كل نشر نسخة، تغيير توجيه، أو تعديل صلاحية يُسجَّل بمن نفّذه ومتى، وقابل للمراجعة.',
      },
      {
        title: 'مدة احتفاظ تحددها أنت',
        body: 'تختار كم تبقى السجلات والنصوص والتسجيلات. الافتراضي 180 يومًا للسجلات و30 للتسجيلات، وتُحذف آليًا بعدها.',
      },
      {
        title: 'إيقاف فوري ومسار بديل',
        body: 'زر واحد يوقف الموظف الصوتي ويحوّل كل المكالمات لفريقك. وإذا تعطّل أي نظام، المكالمة تصل لموظف بدل أن تسقط.',
      },
    ],
    notClaimed:
      'لا نحمل حتى الآن شهادة SOC 2 أو ISO 27001، ولن ندّعي غير ذلك. التسجيل الصوتي اختياري ويُفعَّل لكل شركة بعد مراجعة الأنظمة المحلية في بلدها، لأن قوانين تسجيل المكالمات تختلف من دولة لأخرى.',
  },
  howItWorks: {
    title: 'كيف نبدأ معك، خطوة بخطوة.',
    lead: 'أربع مراحل واضحة. في كل واحدة تعرف ما المطلوب منك بالضبط، وما الذي نتولاه نحن.',
    detail: [
      {
        n: '01',
        title: 'نفهم عملك',
        body: 'مكالمة قصيرة نسمع فيها: من يتصل بك، ماذا يطلب، من يرد الآن، ومتى يجب أن تصل المكالمة لموظف بشري.',
        youDo: 'ساعة واحدة من وقتك، ومعلومات خدماتك وفروعك.',
        weDo: 'نحوّل ذلك إلى خطة تشغيل مكتوبة توافق عليها.',
      },
      {
        n: '02',
        title: 'نبني الموظف الصوتي',
        body: 'نجهّزه من قالب قطاعك، نحمّله خدماتك وأسعارك وفروعك كمعرفة منظّمة، ونربطه بتقويمك وواتساب ونظامك.',
        youDo: 'الموافقة على ربط الأنظمة.',
        weDo: 'البناء والربط والإعداد بالكامل.',
      },
      {
        n: '03',
        title: 'نختبره وتسمعه',
        body: 'يمر على حزمة اختبار عربية وسيناريوهات حرجة من عملك. ثم تسمع مكالمات تجريبية بنفسك وتقول رأيك في النبرة.',
        youDo: 'تسمع وتوافق أو تطلب تعديلًا.',
        weDo: 'الاختبار والتعديل حتى ترضى.',
      },
      {
        n: '04',
        title: 'نشغّله ونتابع',
        body: 'نربط رقمك، ونراقب الأسبوع الأول مكالمة بمكالمة، ونحوّل كل ملاحظة إلى نسخة محسّنة.',
        youDo: 'تتابع النتائج من لوحتك.',
        weDo: 'المراقبة والتحسين المستمر.',
      },
    ],
    timeline: 'المدة المعتادة من أول مكالمة إلى التشغيل: من أسبوع إلى ثلاثة أسابيع.',
  },
}

const en: Pages = {
  contact: {
    title: 'Talk to the team.',
    lead: 'Mujawib is a managed service — we start with a call to understand your business, not a sign-up form. Pick whichever is easiest.',
    channels: [
      {
        label: 'Email',
        value: 'hello@mujawib.com',
        href: 'mailto:hello@mujawib.com',
        note: 'We reply within one working day.',
      },
      {
        label: 'Phone',
        value: '+966 920 012 130',
        href: 'tel:+966920012130',
        note: 'Sunday to Thursday, 9am – 6pm Riyadh time.',
      },
      {
        label: 'WhatsApp',
        value: '+966 920 012 130',
        href: 'https://wa.me/966920012130',
        note: 'For quick questions before a meeting.',
      },
    ],
    expect: [
      {
        step: 'First call — 20 minutes',
        body: 'We listen: how many calls you get, who answers them now, and which request repeats most.',
      },
      {
        step: 'A proposal built on your case',
        body: 'We come back with one specific scenario to start from, plus a volume and cost estimate — not a generic quote.',
      },
      {
        step: 'You hear it before you sign',
        body: 'We build the agent on your scenario and you listen to a trial call yourself.',
      },
    ],
    hours: 'Sunday – Thursday · 9:00 – 18:00 Riyadh time',
  },
  pricing: {
    title: 'Pricing follows your call volume.',
    lead: 'No rigid tiers and no per-seat fees. We agree scope after you have seen the agent work on a scenario from your business.',
    bands: [
      {
        name: 'Start',
        forWho: 'One branch or one scenario',
        volume: 'Up to 500 calls a month',
        includes: [
          'One agent, one dialect',
          'Calendar and WhatsApp',
          'One inbound number',
          'Console and reporting',
        ],
      },
      {
        name: 'Operate',
        forWho: 'Several branches or scenarios',
        volume: '500 – 3,000 calls a month',
        includes: [
          'Multiple agents and dialects',
          'CRM and your own systems',
          'Multiple numbers, routing per branch',
          'Weekly quality review',
          'Client portal for your team',
        ],
        featured: true,
      },
      {
        name: 'Enterprise',
        forWho: 'Branch networks or high volume',
        volume: 'Over 3,000 calls a month',
        includes: [
          'Everything above',
          'Service level agreement',
          'Custom retention and data region',
          'A named operations lead',
        ],
      },
    ],
    note: 'Setup, build and testing are handled entirely by our team inside the subscription — no separate setup fee for the first scenario.',
    faq: [
      {
        q: 'Do I pay per team member?',
        a: 'No. Pricing follows calls handled. Add as many of your team to the console as you like at no extra cost.',
      },
      {
        q: 'What if I exceed my plan?',
        a: 'We never cut a call or suspend the service. We contact you to adjust the plan from the following month.',
      },
      {
        q: 'Is there a long contract?',
        a: 'Monthly, cancellable with 30 days notice. We do not ask for an annual commitment to start.',
      },
    ],
  },
  faq: {
    title: 'Questions everyone asks before running us.',
    lead: 'If your answer is not here, ask us directly — we reply within a working day.',
    groups: [
      {
        title: 'Before launch',
        items: [
          {
            q: 'How long does it take to go live?',
            a: 'One to three weeks depending on how complex your business is and how quickly we can connect your systems. The first scenario is usually ready to test within a week.',
          },
          {
            q: 'Do I need a technical team?',
            a: 'No. We need your business information — services, prices, branches, hours, and when a call must reach a person. The rest is on us.',
          },
          {
            q: 'Do I have to change my number?',
            a: 'No. We connect your existing number by call forwarding, or provide a new one that runs alongside it. Your choice.',
          },
        ],
      },
      {
        title: 'About the voice',
        items: [
          {
            q: 'Does it sound robotic?',
            a: 'It does not go live until it clears an Arabic test pack: a compound name, a ten-digit number, a price in riyals, a time like "6:30 in the evening", and a caller mixing in English. If it fails, it does not run.',
          },
          {
            q: 'What if the caller interrupts?',
            a: 'It stops immediately and continues from where it left off — no awkward silence, no restarting the sentence.',
          },
          {
            q: 'Does it handle dialects?',
            a: 'Saudi, Egyptian, Gulf and MSA. We pick based on your audience, and it can be changed later.',
          },
          {
            q: 'What if it does not understand?',
            a: 'It clarifies once; if that does not resolve it, it hands over to your team with the full context. It never guesses and never leaves the caller hanging.',
          },
        ],
      },
      {
        title: 'Day to day',
        items: [
          {
            q: 'Can it book into my calendar?',
            a: 'Yes — it reads availability from Google Calendar or Microsoft 365, locks the slot, and sends the WhatsApp confirmation during the call.',
          },
          {
            q: 'What happens if the calendar fails?',
            a: 'It never confirms a booking that did not happen. It logs a callback or hands over to your team, and the outage appears in your console immediately.',
          },
          {
            q: 'Can I switch it off?',
            a: 'Yes, in one click. Every call routes straight to your team until you turn it back on.',
          },
          {
            q: 'How do I know what happened?',
            a: 'Every call has a record: the full conversation, the tools that ran, and the outcome. Plus a list ranked by what needs your attention first.',
          },
        ],
      },
    ],
  },
  about: {
    title: 'We built Mujawib because an Arabic call deserves better than a robotic reply.',
    lead: 'We are not a tool you build a chatbot with. We are an operations team that builds your voice agent, tests it, and stays accountable for its quality.',
    story: [
      'Most Arabic voice products are an English product in translation. The result mispronounces names, stumbles over a mobile number, and gives the caller a promise that never happened.',
      'The model is not the whole problem — the setup is left to a free-text box. Everyone who edits it produces something different, and nobody knows why the behaviour changed.',
      'So we built it the other way round: structured setup in fixed layers, an Arabic test pack that gates release, and a record of every call you can review. Above all: no confirmation before a real success.',
    ],
    principles: [
      {
        title: 'We do not promise what did not happen',
        body: 'The agent never says "booked" before your system returns a locked slot. That is not a feature — it is a condition.',
      },
      {
        title: 'Quality is a test, not an impression',
        body: 'We do not ship because the voice sounded nice. We ship because it cleared a written test pack, and any critical failure blocks release.',
      },
      {
        title: 'A managed service, not a tool',
        body: 'We do not hand you a console and leave. We build, test, watch week one, and improve from your real calls.',
      },
      {
        title: 'Everything is reversible',
        body: 'Every change is a version. Do not like the new behaviour? You are back on the previous one instantly, without disturbing a call in progress.',
      },
    ],
    stance: {
      title: 'What we do not do',
      body: 'We do not sell self-signup with no setup, we do not quote numbers we have not measured, and we never use our clients calls to train any model. If the voice is not ready for your business, we say so before you pay.',
    },
  },
  security: {
    title: 'You are handing us your customers calls.',
    lead: 'This page is about what we actually do to protect that data — and what we do not claim.',
    intro: [
      'Your calls and your callers data belong to you. We process them on your behalf to run the service only, and never sell or share them with any advertising party.',
      'We do not use your call content to train AI models — not ours, not anyone else’s.',
    ],
    practices: [
      {
        title: 'Full tenant isolation',
        body: 'Every business has a separate workspace at the database level. A user in one company cannot reach another company’s data under any circumstance.',
      },
      {
        title: 'Credentials are never displayed',
        body: 'Your system keys are stored encrypted and appear in no interface — not yours, and not our operations team’s.',
      },
      {
        title: 'Role-scoped access',
        body: 'A quality reviewer sees calls but not connection credentials. A company admin sees outcomes but not model settings.',
      },
      {
        title: 'An audit log for every change',
        body: 'Every version published, route changed or permission edited is recorded with who did it and when, and is reviewable.',
      },
      {
        title: 'Retention you set',
        body: 'You choose how long records, transcripts and recordings are kept. Default is 180 days for records and 30 for recordings, deleted automatically after.',
      },
      {
        title: 'Instant stop and a fallback path',
        body: 'One switch pauses the agent and routes every call to your team. And if any system fails, the call reaches a person instead of dropping.',
      },
    ],
    notClaimed:
      'We do not yet hold SOC 2 or ISO 27001, and we will not claim otherwise. Call recording is optional and enabled per business after reviewing local regulations, because recording law differs by country.',
  },
  howItWorks: {
    title: 'How we start with you, step by step.',
    lead: 'Four clear stages. In each one you know exactly what is asked of you and what we handle.',
    detail: [
      {
        n: '01',
        title: 'We learn your business',
        body: 'A short call where we hear: who calls you, what they ask for, who answers now, and when a call must reach a person.',
        youDo: 'One hour of your time, plus your services and branches.',
        weDo: 'We turn it into a written plan you approve.',
      },
      {
        n: '02',
        title: 'We build the agent',
        body: 'Built from your industry pack, loaded with your services, prices and branches as structured knowledge, and connected to your calendar, WhatsApp and systems.',
        youDo: 'Approve the system connections.',
        weDo: 'All of the building, connecting and setup.',
      },
      {
        n: '03',
        title: 'We test it and you hear it',
        body: 'It clears an Arabic test pack and the critical scenarios from your business. Then you listen to trial calls and judge the tone yourself.',
        youDo: 'Listen and approve, or ask for changes.',
        weDo: 'Testing and revision until you are happy.',
      },
      {
        n: '04',
        title: 'We launch and watch',
        body: 'We connect your number, watch week one call by call, and turn every finding into an improved version.',
        youDo: 'Follow the results in your console.',
        weDo: 'Monitoring and continuous improvement.',
      },
    ],
    timeline: 'Typical time from first call to going live: one to three weeks.',
  },
}

const PAGES: Record<Locale, Pages> = { ar, en }

export function pagesFor(locale: Locale): Pages {
  return PAGES[locale] ?? PAGES.ar
}

export type PagesCopy = Pages
