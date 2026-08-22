import type { Locale } from '@/lib/i18n'

/**
 * Marketing copy for both locales.
 *
 * Voice: speak to a business owner losing calls, not to an engineer. Say what
 * changes for them; keep the mechanism out of the sentence unless it is the
 * reason to believe.
 */

type NavItem = { label: string; href: string }
type FooterColumn = { title: string; links: NavItem[] }

type Copy = {
  nav: NavItem[]
  hero: {
    eyebrow: string
    title: string
    titleMuted: string
    lead: string
    primary: string
    secondary: string
    note: string
    recordTitle: string
    recordMeta: string
  }
  proofLabels: { calls: string; bookings: string; resolved: string; response: string }
  proofNote: string
  trust: { label: string; caption: string }
  demo: { label: string; title: string; lead: string }
  can: {
    label: string
    title: string
    lead: string
    items: { title: string; body: string }[]
  }
  why: {
    label: string
    title: string
    lead: string
    rows: { key: string; title: string; body: string; proof: { term: string; detail: string }[] }[]
  }
  results: {
    label: string
    title: string
    lead: string
    beforeTitle: string
    before: string[]
    afterTitle: string
    after: string[]
    quote: string
    quoteBy: string
  }
  deployment: {
    label: string
    title: string
    lead: string
    steps: { n: string; title: string; body: string; output: string }[]
  }
  industries: {
    label: string
    title: string
    lead: string
    packs: Record<string, { title: string; body: string; moment: string }>
  }
  integrations: { label: string; title: string; lead: string; note: string; flowEnd: string }
  security: {
    label: string
    title: string
    lead: string
    items: { title: string; body: string }[]
  }
  pricing: {
    label: string
    title: string
    lead: string
    points: string[]
    primary: string
    secondary: string
  }
  console: { label: string; title: string; lead: string; points: string[]; cta: string }
  cta: { title: string; body: string; note: string; primary: string; secondary: string }
  footer: {
    tagline: string
    description: string
    email: string
    phone: string
    columns: FooterColumn[]
    rights: string
    privacy: string
    terms: string
  }
  common: {
    signIn: string
    bookDemo: string
    menu: string
    close: string
    theme: string
    langSwitch: string
  }
}

const ar: Copy = {
  nav: [
    { label: 'كيف يعمل', href: '/how-it-works' },
    { label: 'القطاعات', href: '#industries' },
    { label: 'الموثوقية', href: '/security' },
    { label: 'الأسعار', href: '/pricing' },
    { label: 'الأسئلة', href: '/faq' },
  ],
  hero: {
    eyebrow: 'تجربة مكالمة، لحظة بلحظة',
    title: 'كل مكالمة تُردّ.',
    titleMuted: 'وكل طلب يُنجَز.',
    lead: 'عميلك يتصل، فيجد ردًا عربيًا فورًا في أي وقت — يفهم ما يريد، يحجز له الموعد، ويرسل التأكيد. أنت تصحو على نتائج، لا على مكالمات فائتة.',
    primary: 'احجز عرضًا',
    secondary: 'شاهد مكالمة كاملة',
    note: 'نجهّز لك الموظف الصوتي ونختبره قبل أن يرد على أول عميل.',
    recordTitle: 'سيناريو تجريبي',
    recordMeta: 'مسار حجز نموذجي',
  },
  proofLabels: {
    calls: 'مكالمة وصلت للمنصة',
    bookings: 'موعدًا حُجز تلقائيًا',
    resolved: 'انتهت دون تدخل موظف',
    response: 'متوسط زمن الرد',
  },
  proofNote: 'بيانات التشغيل المباشر — آخر 30 يومًا.',
  trust: {
    label: 'يشتغل اليوم مع',
    caption: 'شركات تعتمد على المكالمة كقناة بيع وخدمة أساسية.',
  },
  demo: {
    label: 'سيناريوهات واقعية',
    title: 'اسمع كيف تنتهي المكالمة، لا كيف تبدأ.',
    lead: 'ثلاثة سيناريوهات من قطاعات مختلفة توضّح الحوار والنتيجة المتوقعة.',
  },
  can: {
    label: 'الإمكانات',
    title: 'أكثر من مجرد الرد على الهاتف.',
    lead: 'ما الذي يستطيع موظفك الصوتي فعله فعليًا في يوم عمل عادي.',
    items: [
      {
        title: 'يتكلم عربي طبيعي',
        body: 'سعودي، مصري، خليجي أو فصحى — ويفهم العميل حتى لو خلط كلمة إنجليزية في جملته.',
      },
      {
        title: 'يسمع المقاطعة ويتوقف',
        body: 'إذا قاطعه العميل توقف فورًا وأكمل من حيث انتهى، بدون صمت محرج أو إعادة من البداية.',
      },
      {
        title: 'يحجز ويعدّل ويلغي',
        body: 'يفتح تقويمك، يعرض المتاح، يثبّت الموعد، ويرسل التأكيد على واتساب.',
      },
      {
        title: 'يعرف عملك بالتفصيل',
        body: 'الأسعار، الفروع، ساعات العمل، وأسماء فريقك — يجيب منها ولا يخترع إجابة.',
      },
      {
        title: 'يحوّل لموظف عند اللزوم',
        body: 'الحالات الحسّاسة تصل لفريقك مع سياق المكالمة كاملًا، لا من الصفر.',
      },
      {
        title: 'يترك لك سجلًا واضحًا',
        body: 'من اتصل، ماذا أراد، وماذا حدث — في صفحة واحدة يقرأها أي شخص في فريقك.',
      },
    ],
  },
  why: {
    label: 'لماذا يختلف',
    title: 'الفرق أنه لا يَعِد بشيء لم يحدث.',
    lead: 'ثلاثة أشياء تفصل بين موظف صوتي تثق به في شركتك، وبين تجربة تبدو جيدة في العرض فقط.',
    rows: [
      {
        key: 'الوعد',
        title: 'لا يقول «تم الحجز» قبل أن يتم فعلًا',
        body: 'التأكيد لا يخرج من فمه إلا بعد أن يرجع التقويم بموعد مثبّت. وإذا تعذّر، يسجّل طلب معاودة اتصال أو يحوّل لفريقك — ولا يترك عميلك بوعد لم يحدث.',
        proof: [
          { term: 'لكل حالة فشل بديل', detail: 'تعطّل التقويم لا يُنتج حجزًا وهميًا' },
          { term: 'كل خطوة مسجّلة', detail: 'تعرف ما حدث بالضبط ومتى' },
        ],
      },
      {
        key: 'الصوت',
        title: 'يُختبر على عربي حقيقي قبل أن يرد على عميلك',
        body: 'اسم مركّب، رقم جوال من عشر خانات، سعر بالريال، «الساعة ٦:٣٠ مساءً»، وعميل يصحّح رقمه في منتصف الجملة. يمر على هذه كلها أولًا — أو لا يعمل.',
        proof: [
          { term: 'قاموس نطق خاص بك', detail: 'أسماء الأطباء والفروع والعلامات' },
          { term: 'لا تشغيل قبل النجاح', detail: 'الاختبار شرط، ليس خطوة اختيارية' },
        ],
      },
      {
        key: 'التحكم',
        title: 'أي تعديل يمكن التراجع عنه في لحظة',
        body: 'كل تغيير يُحفظ كنسخة مستقلة. جرّبت أسلوبًا جديدًا ولم يعجبك؟ ترجع للنسخة السابقة فورًا، دون أن تتأثر مكالمة واحدة جارية.',
        proof: [
          { term: 'رجوع فوري', detail: 'أي نسخة سابقة تعود بضغطة' },
          { term: 'لا تعديل على الهواء', detail: 'المكالمات الجارية لا تتأثر' },
        ],
      },
    ],
  },
  results: {
    label: 'الأثر',
    title: 'من مكالمات تضيع، إلى استقبال لا ينام.',
    lead: 'هذا ما يتغيّر عمليًا في الشهر الأول من التشغيل.',
    beforeTitle: 'قبل',
    before: [
      'مكالمات تضيع بعد الدوام وفي الإجازات',
      'الاستقبال مشغول فيتحوّل العميل لمنافس',
      'نفس السؤال يُجاب عليه عشرات المرات يوميًا',
      'لا أحد يعرف كم فرصة ضاعت أمس',
    ],
    afterTitle: 'بعد',
    after: [
      'رد خلال ثوانٍ في أي ساعة',
      'الموعد يُحجز أثناء المكالمة نفسها',
      'فريقك يتفرّغ للحالات التي تحتاجه فعلًا',
      'تقرير يومي بما حدث وما يحتاج تدخلك',
    ],
    quote: 'المكالمة اللي كانت بتضيع بعد السادسة، بقت موعد مؤكد في التقويم.',
    quoteBy: 'مدير تشغيل — قطاع العيادات',
  },
  deployment: {
    label: 'كيف نبدأ',
    title: 'من أول مكالمة معك، إلى أول عميل يُخدَم.',
    lead: 'لا تحتاج فريقًا تقنيًا ولا إعدادات معقّدة. نحن نبني ونختبر، وأنت تراجع وتوافق.',
    steps: [
      {
        n: '01',
        title: 'نفهم عملك',
        body: 'نسمع منك: من يتصل، وماذا يطلب، ومتى يجب أن يصل لموظف.',
        output: 'خطة تشغيل واضحة',
      },
      {
        n: '02',
        title: 'نبني الموظف',
        body: 'نجهّزه بخدماتك وأسعارك وفروعك، ونربطه بتقويمك وأنظمتك.',
        output: 'نسخة جاهزة للتجربة',
      },
      {
        n: '03',
        title: 'نختبره معك',
        body: 'تسمع مكالمات تجريبية بنفسك وتقول: هذه نبرة شركتي، أو غيّروها.',
        output: 'موافقتك قبل التشغيل',
      },
      {
        n: '04',
        title: 'نشغّله ونتابع',
        body: 'نربط رقمك، ونراقب الأسبوع الأول، ونحسّن حسب مكالمات حقيقية.',
        output: 'تحسين مستمر',
      },
    ],
  },
  industries: {
    label: 'القطاعات',
    title: 'مصمّم لطبيعة عملك.',
    lead: 'لكل قطاع مكالمته ولحظته الحاسمة. اختر قطاعك لترى المسار كما يجري فعلًا.',
    packs: {
      medical: {
        title: 'العيادات',
        body: 'يحجز ويؤجّل المواعيد، يذكّر المريض قبل موعده، ويجيب عن الأسئلة المتكررة دون إشغال الاستقبال.',
        moment: 'اللحظة الحاسمة: تثبيت الموعد قبل أن يغلق المتصل السماعة.',
      },
      realestate: {
        title: 'العقارات',
        body: 'يسأل عن الميزانية والمنطقة، يرتّب المعاينة، ولا يشغل مستشار المبيعات إلا بعميل جاد.',
        moment: 'اللحظة الحاسمة: التقاط الاهتمام قبل أن ينتقل لإعلان آخر.',
      },
      auto: {
        title: 'خدمات السيارات',
        body: 'يحجز مواعيد الصيانة، يخبر العميل بحالة سيارته، ويحدّد له موعد الاستلام.',
        moment: 'اللحظة الحاسمة: تحويل الاستفسار إلى موعد في الورشة.',
      },
      reception: {
        title: 'خدمة العملاء',
        body: 'يفرز الطلبات المتكررة، يوجّه المتصل للقسم الصحيح، ويصعّد المستعجل بسياق كامل.',
        moment: 'اللحظة الحاسمة: ألا يعود المتصل إلى قائمة انتظار.',
      },
    },
  },
  integrations: {
    label: 'التكاملات',
    title: 'من الحديث إلى الإنجاز.',
    lead: 'الموظف الصوتي لا يكتفي بالكلام — يفتح تقويمك، يرسل التأكيد، ويسجّل العميل في نظامك أثناء المكالمة.',
    note: 'كل ربط له اختبار اتصال وخطة بديلة عند التعطّل.',
    flowEnd: 'تم تنفيذ الطلب',
  },
  security: {
    label: 'الموثوقية',
    title: 'مبني ليعمل على أرقام شركتك الحقيقية.',
    lead: 'أنت تسلّمنا مكالمات عملائك — وهذه مسؤولية نتعامل معها بجدية.',
    items: [
      {
        title: 'عزل بيانات كل عميل',
        body: 'بيانات شركتك منفصلة تمامًا، ولا تُستخدم لتدريب أي نموذج.',
      },
      { title: 'صلاحيات محدّدة', body: 'كل شخص في فريقك يرى ما يخصّه فقط، ولا يصل لبيانات الربط.' },
      { title: 'سجل لكل تغيير', body: 'من غيّر ماذا ومتى — قابل للمراجعة في أي وقت.' },
      { title: 'سياسة احتفاظ تتحكم بها', body: 'تحدّد مدة حفظ التسجيلات والنصوص حسب سياسة شركتك.' },
      { title: 'إيقاف فوري', body: 'زر واحد يوقف الموظف الصوتي ويحوّل كل المكالمات لفريقك.' },
      { title: 'خطة بديلة دائمًا', body: 'إذا تعطّل أي نظام، المكالمة تصل لموظف بدل أن تسقط.' },
    ],
  },
  pricing: {
    label: 'الأسعار',
    title: 'خطتك تُحدَّد حسب حجم مكالماتك.',
    lead: 'لا باقات جامدة ولا مفاجآت. نبدأ بسيناريو واحد من عملك، ونتفق على الخطة بعد أن ترى النتيجة.',
    points: [
      'إعداد وتجهيز واختبار — يتولاه فريقنا بالكامل',
      'السعر مرتبط بعدد المكالمات، لا بعدد المستخدمين',
      'تبدأ بقطاع أو فرع واحد، وتوسّع حسب النتائج',
    ],
    primary: 'احجز عرضًا',
    secondary: 'تحدّث مع المبيعات',
  },
  console: {
    label: 'لوحتك',
    title: 'ماذا حدث اليوم، ومن يحتاج تدخلك.',
    lead: 'شاشة واحدة تخبرك بما أنجزه الصوت وما يحتاج قرارك — بدون أن تفتح عشر تبويبات.',
    points: [
      'كل مكالمة بحوارها ونتيجتها في مكان واحد',
      'قائمة مرتّبة بما يحتاج مراجعتك أولًا',
      'حالة كل ربط ورقم أمامك مباشرة',
    ],
    cta: 'ادخل اللوحة',
  },
  cta: {
    title: 'ابدأ بالمكالمة الأكثر أهمية.',
    body: 'نأخذ سيناريو واحدًا من عملك، نجهّزه، وتسمع نتيجته بنفسك قبل أن تقرر التوسّع.',
    note: 'بدون إعداد تقني من طرفك.',
    primary: 'احجز عرضًا',
    secondary: 'تحدّث مع الفريق',
  },
  footer: {
    tagline: 'مكالمة أفضل. عميل أقرب. فريق أسرع.',
    description:
      'مُجاوِب يرد على مكالمات شركتك بالعربية على مدار الساعة، ويحوّل كل اتصال إلى نتيجة مسجّلة.',
    email: 'hello@mujawib.com',
    phone: '+966 920 012 130',
    columns: [
      {
        title: 'المنتج',
        links: [
          { label: 'كيف يعمل', href: '#calls' },
          { label: 'الإمكانات', href: '#can' },
          { label: 'لوحة التشغيل', href: '#console' },
          { label: 'التكاملات', href: '#integrations' },
        ],
      },
      {
        title: 'القطاعات',
        links: [
          { label: 'العيادات', href: '#industries' },
          { label: 'العقارات', href: '#industries' },
          { label: 'خدمات السيارات', href: '#industries' },
          { label: 'خدمة العملاء', href: '#industries' },
        ],
      },
      {
        title: 'الشركة',
        links: [
          { label: 'من نحن', href: '/about' },
          { label: 'كيف نبدأ', href: '/how-it-works' },
          { label: 'الموثوقية', href: '/security' },
          { label: 'الأسعار', href: '/pricing' },
          { label: 'الأسئلة الشائعة', href: '/faq' },
          { label: 'تواصل معنا', href: '/contact' },
        ],
      },
    ],
    rights: 'جميع الحقوق محفوظة.',
    privacy: 'الخصوصية',
    terms: 'الشروط',
  },
  common: {
    signIn: 'تسجيل الدخول',
    bookDemo: 'احجز عرضًا',
    menu: 'القائمة',
    close: 'إغلاق',
    theme: 'تبديل الوضع',
    langSwitch: 'EN',
  },
}

const en: Copy = {
  nav: [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Industries', href: '#industries' },
    { label: 'Reliability', href: '/security' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
  ],
  hero: {
    eyebrow: 'A call scenario, moment by moment',
    title: 'Every call answered.',
    titleMuted: 'Every request done.',
    lead: 'Your customer calls and gets a natural Arabic answer at any hour — it understands what they want, books the appointment, and sends the confirmation. You wake up to results, not missed calls.',
    primary: 'Book a demo',
    secondary: 'Watch a full call',
    note: 'We build and test your voice agent before it answers a single customer.',
    recordTitle: 'Demo scenario',
    recordMeta: 'sample booking path',
  },
  proofLabels: {
    calls: 'calls received by the platform',
    bookings: 'appointments booked automatically',
    resolved: 'ended without a human',
    response: 'average response time',
  },
  proofNote: 'Live operations data — last 30 days.',
  trust: {
    label: 'Working today with',
    caption: 'Businesses where the phone is a primary sales and service channel.',
  },
  demo: {
    label: 'Realistic scenarios',
    title: 'Hear how the call ends, not how it opens.',
    lead: 'Three sector scenarios showing the expected conversation and outcome.',
  },
  can: {
    label: 'Capabilities',
    title: 'More than answering the phone.',
    lead: 'What your voice agent actually does in an ordinary working day.',
    items: [
      {
        title: 'Speaks natural Arabic',
        body: 'Saudi, Egyptian, Gulf or MSA — and still follows the customer when they drop an English word mid-sentence.',
      },
      {
        title: 'Stops when interrupted',
        body: 'If the caller cuts in, it stops immediately and picks up where it left off — no awkward silence, no starting over.',
      },
      {
        title: 'Books, moves and cancels',
        body: 'Opens your calendar, offers what is free, locks the slot, and sends the confirmation on WhatsApp.',
      },
      {
        title: 'Knows your business',
        body: 'Prices, branches, opening hours and your team — it answers from those and never invents one.',
      },
      {
        title: 'Hands over when it should',
        body: 'Sensitive cases reach your team with the full context of the call, not from scratch.',
      },
      {
        title: 'Leaves a clear record',
        body: 'Who called, what they wanted, what happened — on one page anyone on your team can read.',
      },
    ],
  },
  why: {
    label: 'What differs',
    title: 'It never promises something that did not happen.',
    lead: 'Three things separate a voice agent you trust in your business from one that only demos well.',
    rows: [
      {
        key: 'The promise',
        title: 'It never says "booked" before it is',
        body: 'The confirmation only leaves its mouth after your calendar returns a locked slot. If that fails, it logs a callback or hands over to your team — it never leaves your customer with a promise that did not happen.',
        proof: [
          {
            term: 'A fallback for every failure',
            detail: 'A calendar outage never fakes a booking',
          },
          { term: 'Every step recorded', detail: 'You know exactly what happened, and when' },
        ],
      },
      {
        key: 'The voice',
        title: 'Tested on real Arabic before it answers you',
        body: 'A compound name, a ten-digit mobile number, a price in riyals, "6:30 in the evening", and a customer correcting their number mid-sentence. It clears all of these first — or it does not go live.',
        proof: [
          { term: 'Your own pronunciation list', detail: 'Doctors, branches, brand names' },
          { term: 'No launch without a pass', detail: 'Testing is the gate, not a nice-to-have' },
        ],
      },
      {
        key: 'Control',
        title: 'Any change can be undone in a moment',
        body: 'Every change is saved as its own version. Tried a new tone and did not like it? You are back on the previous one instantly, without disturbing a single call in progress.',
        proof: [
          { term: 'Instant rollback', detail: 'Any earlier version returns in one click' },
          { term: 'Never edited live', detail: 'Calls in progress are untouched' },
        ],
      },
    ],
  },
  results: {
    label: 'Impact',
    title: 'From calls that vanish, to a front desk that never sleeps.',
    lead: 'What actually changes in the first month.',
    beforeTitle: 'Before',
    before: [
      'Calls lost after hours and on weekends',
      'Reception busy, so the customer calls a competitor',
      'The same question answered dozens of times a day',
      'Nobody knows how many chances were missed yesterday',
    ],
    afterTitle: 'After',
    after: [
      'Answered within seconds, any hour',
      'The slot is booked during the call itself',
      'Your team is free for the cases that need them',
      'A daily read on what happened and what needs you',
    ],
    quote: 'The call that used to disappear after six is now a confirmed slot in the calendar.',
    quoteBy: 'Operations manager — clinics',
  },
  deployment: {
    label: 'How we start',
    title: 'From our first call, to your first customer served.',
    lead: 'No technical team and no complex setup. We build and test; you review and approve.',
    steps: [
      {
        n: '01',
        title: 'We learn your business',
        body: 'Who calls, what they ask for, and when it must reach a person.',
        output: 'A clear plan',
      },
      {
        n: '02',
        title: 'We build the agent',
        body: 'Loaded with your services, prices and branches, connected to your calendar and systems.',
        output: 'A version to try',
      },
      {
        n: '03',
        title: 'We test it with you',
        body: 'You hear trial calls yourself and say: that is my brand voice — or change it.',
        output: 'Your sign-off',
      },
      {
        n: '04',
        title: 'We launch and watch',
        body: 'We connect your number, watch week one, and improve from real calls.',
        output: 'Continuous improvement',
      },
    ],
  },
  industries: {
    label: 'Industries',
    title: 'Built for how your business actually runs.',
    lead: 'Every sector has its own call and its own decisive moment. Pick yours to see the real path.',
    packs: {
      medical: {
        title: 'Clinics',
        body: 'Books and moves appointments, reminds patients before their slot, and answers the repeat questions without tying up reception.',
        moment: 'Decisive moment: locking the slot before the caller hangs up.',
      },
      realestate: {
        title: 'Real estate',
        body: 'Asks about budget and area, arranges the viewing, and only occupies a sales consultant with a serious buyer.',
        moment: 'Decisive moment: catching intent before they call another listing.',
      },
      auto: {
        title: 'Auto service',
        body: 'Books service slots, tells the customer where their car is, and confirms the pickup time.',
        moment: 'Decisive moment: turning an enquiry into a workshop slot.',
      },
      reception: {
        title: 'Customer service',
        body: 'Sorts repeat requests, routes callers to the right department, and escalates the urgent with full context.',
        moment: 'Decisive moment: never sending the caller back to a queue.',
      },
    },
  },
  integrations: {
    label: 'Integrations',
    title: 'From conversation to completion.',
    lead: 'The agent does not just talk — it opens your calendar, sends the confirmation, and logs the customer in your system during the call.',
    note: 'Every connection has a test and a fallback plan when it fails.',
    flowEnd: 'Request completed',
  },
  security: {
    label: 'Reliability',
    title: 'Built to run on your real business numbers.',
    lead: 'You are handing us your customers’ calls — we treat that seriously.',
    items: [
      {
        title: 'Each client isolated',
        body: 'Your data is fully separated and never used to train any model.',
      },
      {
        title: 'Scoped permissions',
        body: 'Everyone on your team sees only their part, never the connection credentials.',
      },
      {
        title: 'A log for every change',
        body: 'Who changed what and when — reviewable at any time.',
      },
      {
        title: 'Retention you control',
        body: 'You set how long recordings and transcripts are kept.',
      },
      {
        title: 'Instant stop',
        body: 'One switch pauses the agent and routes every call to your team.',
      },
      {
        title: 'Always a fallback',
        body: 'If a system fails, the call reaches a person instead of dropping.',
      },
    ],
  },
  pricing: {
    label: 'Pricing',
    title: 'Your plan follows your call volume.',
    lead: 'No rigid tiers, no surprises. We start with one scenario from your business and agree the plan once you have seen the result.',
    points: [
      'Setup, build and testing — handled entirely by our team',
      'Priced on calls handled, not on seats',
      'Start with one branch or sector, expand on results',
    ],
    primary: 'Book a demo',
    secondary: 'Talk to sales',
  },
  console: {
    label: 'Your console',
    title: 'What happened today, and who needs you.',
    lead: 'One screen that tells you what the voice completed and what needs your decision — without opening ten tabs.',
    points: [
      'Every call with its conversation and outcome in one place',
      'A list ordered by what needs reviewing first',
      'The state of every connection and number in front of you',
    ],
    cta: 'Open the console',
  },
  cta: {
    title: 'Start with the call that matters most.',
    body: 'We take one scenario from your business, build it, and you hear the result yourself before deciding to expand.',
    note: 'No technical setup on your side.',
    primary: 'Book a demo',
    secondary: 'Talk to the team',
  },
  footer: {
    tagline: 'Better calls. Closer customers. A faster team.',
    description:
      'Mujawib answers your business calls in Arabic around the clock, and turns every one into a recorded outcome.',
    email: 'hello@mujawib.com',
    phone: '+966 920 012 130',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'How it works', href: '#calls' },
          { label: 'Capabilities', href: '#can' },
          { label: 'Console', href: '#console' },
          { label: 'Integrations', href: '#integrations' },
        ],
      },
      {
        title: 'Industries',
        links: [
          { label: 'Clinics', href: '#industries' },
          { label: 'Real estate', href: '#industries' },
          { label: 'Auto service', href: '#industries' },
          { label: 'Customer service', href: '#industries' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'How we start', href: '/how-it-works' },
          { label: 'Reliability', href: '/security' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Contact', href: '/contact' },
        ],
      },
    ],
    rights: 'All rights reserved.',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  common: {
    signIn: 'Sign in',
    bookDemo: 'Book a demo',
    menu: 'Menu',
    close: 'Close',
    theme: 'Toggle theme',
    langSwitch: 'عربي',
  },
}

const COPY: Record<Locale, Copy> = { ar, en }

export function copyFor(locale: Locale): Copy {
  return COPY[locale] ?? COPY.ar
}

export type SiteCopy = Copy
