import { CONTACT } from '@/lib/content/contact'
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
    assurances: string[]
    recordTitle: string
    recordMeta: string
  }
  proofLabels: { calls: string; bookings: string; resolved: string }
  /** Shown once live volume is meaningful; below that the assurances run instead. */
  proofNote: string
  assurances: { title: string; body: string }[]
  assuranceNote: string
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
    honesty: { title: string; body: string; cta: string }
  }
  failure: {
    label: string
    title: string
    lead: string
    rows: { situation: string; handling: string }[]
    note: string
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
    // Anchors are written against the home page: a bare `#industries` is a
    // dead click from /pricing or /faq, which is where most visitors are.
    { label: 'القطاعات', href: '/#industries' },
    { label: 'الأمان', href: '/security' },
    { label: 'الأسعار', href: '/pricing' },
    { label: 'الأسئلة', href: '/faq' },
  ],
  hero: {
    eyebrow: 'استقبال هاتفي بالعربية · خدمة مُدارة',
    title: 'موظف استقبال يرد بالعربية،',
    titleMuted: 'ويحجز الموعد في نفس المكالمة.',
    lead: 'للعيادات والمعارض والشركات التي تصلها مكالمات أكثر مما يستوعبه الاستقبال. يرد مُجاوِب في أي ساعة، يفهم الطلب حتى بلهجة المتصل، يثبّت الموعد في تقويمك ويرسل التأكيد على واتساب — ويحوّل المكالمة لفريقك في الحالات التي تحددها أنت.',
    primary: 'احجز مكالمة مع الفريق',
    secondary: 'شاهد مكالمة كاملة',
    assurances: [
      'يعمل على رقمك الحالي',
      'بدون فريق تقني من طرفك',
      'من أسبوع إلى ثلاثة حتى التشغيل',
    ],
    recordTitle: 'سيناريو تجريبي',
    recordMeta: 'مكالمة حجز بالعربية — سيناريو تجريبي',
  },
  proofLabels: {
    calls: 'مكالمة رُدّ عليها',
    bookings: 'موعدًا ثُبّت في التقويم',
    resolved: 'انتهت دون تدخل موظف',
  },
  proofNote: 'أرقام فعلية من مكالمات عملائنا خلال آخر 30 يومًا.',
  assurances: [
    { title: 'نجهّزه ونختبره', body: 'على خدماتك وأسعارك وفروعك، قبل أول مكالمة' },
    { title: 'لا تأكيد بلا تنفيذ', body: 'لا يقول «تم الحجز» قبل أن يرجع تقويمك بموعد' },
    { title: 'إيقاف بضغطة', body: 'كل المكالمات تتحوّل لفريقك فورًا' },
    { title: 'سجل لكل مكالمة', body: 'الحوار، ما نُفِّذ، والنتيجة' },
  ],
  assuranceNote: 'ما نلتزم به من أول يوم تشغيل — لا أرقام قبل أن نقيسها.',
  demo: {
    label: 'سيناريوهات واقعية',
    title: 'شاهد المكالمة كاملة، والنتيجة التي خرجت منها.',
    lead: 'ثلاثة سيناريوهات من قطاعات مختلفة: ما قاله المتصل، وما نفّذه مُجاوِب، وأين انتهت المكالمة.',
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
    label: 'العربية أولًا',
    title: 'العربية هنا ليست ترجمة فوق منتج إنجليزي.',
    lead: 'ثلاثة أشياء تفصل بين موظف صوتي يصلح لعميل سعودي، وبين واحد يبدو جيدًا في العرض فقط.',
    rows: [
      {
        key: 'اللهجة',
        title: 'يفهم المتصل كما يتكلم، لا كما نتمنى أن يتكلم',
        body: 'سعودي، خليجي، مصري أو فصحى. يقاطعه العميل فيتوقف ويكمل من حيث انتهى، ويخلط كلمة إنجليزية في نص الجملة فيمشي معه — «أبغى appointment بكرة الصبح» تُفهم كما هي.',
        proof: [
          { term: 'مقاطعة بلا ارتباك', detail: 'يتوقف فورًا ويلتقط الخيط' },
          { term: 'عربي وإنجليزي في جملة', detail: 'لا يطلب من العميل يعيد كلامه' },
        ],
      },
      {
        key: 'التفاصيل',
        title: 'الأسماء والأرقام والمواعيد كما تُقال فعلًا',
        body: 'اسم مركّب مثل «عبدالرحمن آل سعيد»، رقم جوال من عشر خانات يقوله العميل مرتين ويصحّحه في المنتصف، سعر بالريال، و«الساعة ٦:٣٠ مساء» و«بعد المغرب» و«يوم الأحد الجاي». يمر على هذه كلها في الاختبار — أو لا يعمل.',
        proof: [
          { term: 'قاموس نطق خاص بك', detail: 'أسماء الأطباء والفروع والعلامات التجارية' },
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
    honesty: {
      title: 'لن تجد هنا شعارات عملاء ولا نسبًا لم نقسها.',
      body: 'مُجاوِب في بداية تشغيله التجاري. حين تصبح لدينا نتائج من شركات حقيقية سنعرضها باسمها وأرقامها وبإذنها، لا قبل ذلك. حتى تلك اللحظة، احكم عليه من مكالمة تسمعها بنفسك على سيناريو من عملك أنت.',
      cta: 'جرّبه على سيناريو من عملك',
    },
  },
  failure: {
    label: 'حين لا تسير المكالمة كما يجب',
    title: 'أهم شيء تعرفه: ماذا يفعل حين يفشل.',
    lead: 'كل موظف صوتي ينجح في العرض. الفرق يظهر في المكالمة التي لا تسير كما خُطّط لها.',
    rows: [
      {
        situation: 'لم يفهم ما يريده المتصل',
        handling: 'يستوضح مرة واحدة بسؤال محدد. إن لم يتضح، يحوّل المكالمة لفريقك بدل أن يخمّن.',
      },
      {
        situation: 'التقويم لا يستجيب',
        handling:
          'لا يقول «تم الحجز». يسجّل طلب معاودة اتصال أو يحوّل المكالمة، ويظهر التعطّل في لوحتك في نفس اللحظة.',
      },
      {
        situation: 'نظام إدارة العملاء لديك غير متاح',
        handling:
          'يكمل المكالمة ويحفظ بيانات العميل عندنا، ثم يُعيد إرسالها لنظامك تلقائيًا عند عودته.',
      },
      {
        situation: 'السؤال خارج ما يعرفه',
        handling: 'يقول إنه لا يملك الإجابة ويحوّل للمختص. لا يؤلّف سعرًا ولا موعدًا ولا سياسة.',
      },
      {
        situation: 'المتصل طلب موظفًا بشريًا',
        handling:
          'يحوّل مباشرة، ويصل الموظف وقد قرأ ما دار في المكالمة — فلا يعيد العميل كلامه من أوله.',
      },
      {
        situation: 'خارج الدوام ولا أحد يرد',
        handling:
          'ينهي ما يستطيع إنهاءه، ويترك الباقي في قائمة مرتّبة تجدها صباحًا مع رقم كل متصل وسبب اتصاله.',
      },
    ],
    note: 'هذه القواعد تُكتب معك في الإعداد، وتقدر تغيّرها في أي وقت.',
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
    primary: 'احجز مكالمة 20 دقيقة',
    secondary: 'أرسل تفاصيل حالتك',
  },
  footer: {
    tagline: 'مكالمة أفضل. عميل أقرب. فريق أسرع.',
    description:
      'مُجاوِب يرد على مكالمات شركتك بالعربية على مدار الساعة، ويحوّل كل اتصال إلى نتيجة مسجّلة.',
    email: CONTACT.email,
    phone: CONTACT.phoneDisplay,
    columns: [
      {
        title: 'المنتج',
        links: [
          { label: 'مكالمات كاملة', href: '/#calls' },
          { label: 'الإمكانات', href: '/#can' },
          { label: 'عند تعذّر التنفيذ', href: '/#failure' },
          { label: 'التكاملات', href: '/#integrations' },
          { label: 'القطاعات', href: '/#industries' },
        ],
      },
      {
        title: 'الشركة',
        links: [
          { label: 'من نحن', href: '/about' },
          { label: 'كيف نبدأ', href: '/how-it-works' },
          { label: 'الأمان والخصوصية', href: '/security' },
          { label: 'الأسعار', href: '/pricing' },
          { label: 'الأسئلة الشائعة', href: '/faq' },
          { label: 'تواصل معنا', href: '/contact' },
        ],
      },
      {
        title: 'الحساب',
        links: [
          { label: 'تسجيل الدخول', href: '/sign-in' },
          { label: 'سياسة الخصوصية', href: '/privacy' },
          { label: 'شروط الاستخدام', href: '/terms' },
        ],
      },
    ],
    rights: 'جميع الحقوق محفوظة.',
    privacy: 'الخصوصية',
    terms: 'الشروط',
  },
  common: {
    signIn: 'تسجيل الدخول',
    bookDemo: 'احجز مكالمة',
    menu: 'القائمة',
    close: 'إغلاق',
    theme: 'تبديل الوضع',
    langSwitch: 'EN',
  },
}

const en: Copy = {
  nav: [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Industries', href: '/#industries' },
    { label: 'Security', href: '/security' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
  ],
  hero: {
    eyebrow: 'Arabic phone reception · managed service',
    title: 'A receptionist that answers in Arabic,',
    titleMuted: 'and books the slot on the same call.',
    lead: 'For clinics, showrooms and businesses taking more calls than a front desk can absorb. Mujawib answers at any hour, follows the request in the caller’s own dialect, locks the slot in your calendar and sends the WhatsApp confirmation — and hands the call to your team in the cases you decide.',
    primary: 'Book a call with the team',
    secondary: 'Watch a full call',
    assurances: [
      'Works with your existing number',
      'No technical team on your side',
      'One to three weeks to go live',
    ],
    recordTitle: 'Demo scenario',
    // The transcript below stays in Arabic: it is the product, not an
    // untranslated string. Say so, so an English reader knows what they see.
    recordMeta: 'A booking call in Arabic — demo scenario',
  },
  proofLabels: {
    calls: 'calls answered',
    bookings: 'slots locked in a calendar',
    resolved: 'closed without a human',
  },
  proofNote: 'Real figures from client calls over the last 30 days.',
  assurances: [
    { title: 'Built and tested', body: 'On your services, prices and branches, before call one' },
    {
      title: 'No confirmation without the action',
      body: 'Never “booked” until your calendar says so',
    },
    { title: 'One switch to stop', body: 'Every call routes to your team immediately' },
    { title: 'A record per call', body: 'The conversation, what ran, and the outcome' },
  ],
  assuranceNote: 'What we commit to from day one — no figures before we have measured them.',
  demo: {
    label: 'Realistic scenarios',
    title: 'Watch the whole call, and the outcome it produced.',
    lead: 'Three sector scenarios: what the caller said, what Mujawib carried out, and where the call landed.',
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
    label: 'Arabic first',
    title: 'The Arabic here is not a translation layer over an English product.',
    lead: 'Three things separate a voice agent that works for a Saudi caller from one that only demos well.',
    rows: [
      {
        key: 'Dialect',
        title: 'It follows the caller as they speak, not as we wish they spoke',
        body: 'Saudi, Gulf, Egyptian or MSA. Cut in and it stops and picks the thread back up. Drop an English word mid-sentence and it keeps going — "أبغى appointment بكرة الصبح" lands as one request.',
        proof: [
          { term: 'Interruption without confusion', detail: 'It stops at once and resumes' },
          {
            term: 'Arabic and English in one sentence',
            detail: 'The caller never repeats themselves',
          },
        ],
      },
      {
        key: 'Detail',
        title: 'Names, numbers and times the way they are actually said',
        body: 'A compound name, a ten-digit mobile said twice and corrected halfway through, a price in riyals, and "6:30 in the evening", "after Maghrib", "this coming Sunday". It clears all of these in testing — or it does not go live.',
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
    honesty: {
      title: 'You will not find customer logos or unmeasured percentages here.',
      body: 'Mujawib is early in commercial operation. When we have results from real businesses we will publish them by name, with their numbers and their permission — not before. Until then, judge it on a call you hear yourself, built on a scenario from your own business.',
      cta: 'Try it on one of your scenarios',
    },
  },
  failure: {
    label: 'When a call goes wrong',
    title: 'The part that matters: what it does when it fails.',
    lead: 'Every voice agent looks good in a demo. The difference shows in the call that does not go to plan.',
    rows: [
      {
        situation: 'It did not understand the caller',
        handling:
          'It asks one specific clarifying question. If that does not settle it, the call goes to your team rather than to a guess.',
      },
      {
        situation: 'The calendar does not respond',
        handling:
          'It never says “booked”. It logs a callback or transfers the call, and the outage shows in your console the same moment.',
      },
      {
        situation: 'Your CRM is unreachable',
        handling:
          'It finishes the call and holds the customer record with us, then pushes it to your system automatically once it is back.',
      },
      {
        situation: 'The question is outside what it knows',
        handling:
          'It says it does not have the answer and routes to someone who does. It does not invent a price, a slot or a policy.',
      },
      {
        situation: 'The caller asks for a person',
        handling:
          'It transfers straight away, and your colleague picks up already knowing what was said — the caller does not start over.',
      },
      {
        situation: 'Out of hours, nobody to transfer to',
        handling:
          'It closes what it can and leaves the rest in a ranked list you find in the morning, with every number and every reason for calling.',
      },
    ],
    note: 'These rules are written with you during setup, and you can change them at any time.',
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
    primary: 'Book a 20-minute call',
    secondary: 'Send us your case',
  },
  footer: {
    tagline: 'Better calls. Closer customers. A faster team.',
    description:
      'Mujawib answers your business calls in Arabic around the clock, and turns every one into a recorded outcome.',
    email: CONTACT.email,
    phone: CONTACT.phoneDisplay,
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Full call replays', href: '/#calls' },
          { label: 'Capabilities', href: '/#can' },
          { label: 'When it cannot complete', href: '/#failure' },
          { label: 'Integrations', href: '/#integrations' },
          { label: 'Industries', href: '/#industries' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'How we start', href: '/how-it-works' },
          { label: 'Security and privacy', href: '/security' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Contact', href: '/contact' },
        ],
      },
      {
        title: 'Account',
        links: [
          { label: 'Sign in', href: '/sign-in' },
          { label: 'Privacy policy', href: '/privacy' },
          { label: 'Terms of use', href: '/terms' },
        ],
      },
    ],
    rights: 'All rights reserved.',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  common: {
    signIn: 'Sign in',
    bookDemo: 'Book a call',
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
