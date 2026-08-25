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
    { label: 'القطاعات', href: '/#industries' },
    { label: 'الأمان', href: '/security' },
    { label: 'الأسعار', href: '/pricing' },
    { label: 'الشركاء', href: '/partners' },
    { label: 'الأسئلة الشائعة', href: '/faq' },
  ],
  hero: {
    eyebrow: 'استقبال هاتفي ذكي بالعربية · خدمة مُدارة بالكامل',
    title: 'استقبال هاتفي يتحدث بلهجتك،',
    titleMuted: 'ويثبّت مواعيد عملائك في اللحظة نفسها.',
    lead: 'مصمم للعيادات والشركات والمراكز التي تطمح لتقديم تجربة اتصال استثنائية دون تفويت أي عميل. يستقبل مُجاوِب المتصلين على مدار الساعة، يفهم اللهجات السعودية والخليجية والمصرية بانسيابية تامة، يثبّت الحجوزات في تقويمك ويرسل التأكيد عبر واتساب — مع تحويل ذكي وسلس لفريقك في الحالات المخصصة.',
    primary: 'احجز جلسة استشارية مع فريقنا',
    secondary: 'استمع إلى مكالمة كاملة',
    assurances: [
      'يعمل مباشرة على أرقامك الحالية دون تغيير',
      'تشغيل مُدار بالكامل دون الحاجة لفريق تقني من طرفك',
      'جاهزية تامة وتشغيل سريع خلال أيام معدودة',
    ],
    recordTitle: 'سيناريو تجريبي واقعي',
    recordMeta: 'مكالمة حجز موعد بالعربية — تجربة حية',
  },
  proofLabels: {
    calls: 'مكالمة رُدّ عليها بنجاح',
    bookings: 'موعدًا أُكِّد في التقويم',
    resolved: 'انتهت باحترافية دون تدخل بشري',
  },
  proofNote: 'أرقام تشغيلية فعلية من مكالمات عملائنا خلال آخر 30 يومًا.',
  assurances: [
    {
      title: 'إعداد واختبار دقيق',
      body: 'تجهيز كامل لمعلومات خدماتك، أسعارك، وفروعك قبل استقبال أول اتصال',
    },
    { title: 'تأكيد فوري وموثوق', body: 'ربط مباشر مع تقويمك لتثبيت الموعد دون أي تعارض أو أخطاء' },
    {
      title: 'تحكم ومرونة تامة',
      body: 'إمكانية تحويل المكالمات لفريقك البشري في أي لحظة وبضغطة زر',
    },
    { title: 'شفافية وتقارير شاملة', body: 'سجل تفصيلي فوري لكل مكالمة وما طُلب وما تم إنجازه' },
  ],
  assuranceNote: 'التزام تشغيلي صارم من اليوم الأول — دقة وشفافية تقاس بالأرقام.',
  demo: {
    label: 'سيناريوهات واقعية',
    title: 'استمع للمكالمة كاملة، وشاهد النتائج الفورية.',
    lead: 'نماذج حقيقية من قطاعات مختلفة: ما قاله المتصل، وكيف تجاوب مُجاوِب، والنتيجة المباشرة في النظام.',
  },
  can: {
    label: 'الإمكانات والميزات',
    title: 'إمكانات متقدمة تتجاوز مجرد الرد الآلي.',
    lead: 'موظف استقبال صوتي متكامل ينجز أعمالك اليومية بكفاءة واحترافية عالية.',
    items: [
      {
        title: 'نبرة عربية طبيعية ولهجات متعددة',
        body: 'يتحدث السعودية، الخليجية، المصرية، والفصحى بطلاقة، ويفهم المصطلحات الإنجليزية الدارجة دون ارتباك.',
      },
      {
        title: 'استماع تفاعلي وتجاوب ذكي',
        body: 'يتفاعل مع مقاطعة المتصل بسلاسة ويتوقف ليكمل الحوار بلباقة، تمامًا كأفضل موظفي الاستقبال المحترفين.',
      },
      {
        title: 'إدارة الحجوزات والعمليات',
        body: 'يتحقق من المواعيد المتاحة في تقويمك، يثبّت الحجز، ويرسل إشعار التأكيد الفوري للعميل على واتساب.',
      },
      {
        title: 'معرفة شاملة بنشاطك التجاري',
        body: 'يجيب بدقة عن الخدمات، الأسعار، الفروع، وأوقات العمل بناءً على بياناتك المعتمدة دون أي تخمين.',
      },
      {
        title: 'تصعيد ذكي للحالات الخاصة',
        body: 'يحوّل المكالمات التي تتطلب تدخلًا بشريًا لفريقك المختص مع تزويدهم بملخص ما دار في المكالمة.',
      },
      {
        title: 'لوحة متابعة وتحليلات دقيقة',
        body: 'سجل واضح وتفصيلي لكل مكالمة وحالة، يمنحك رؤية كاملة لأداء الاستقبال ورضا العملاء.',
      },
    ],
  },
  why: {
    label: 'العربية أولًا',
    title: 'هندسة صوتية بُنيت خصيصًا للمتصل العربي.',
    lead: 'الفارق الحقيقي يكمن في دقة فهم اللهجات المحلية والأسماء والأرقام المركبة وسياق الحديث الواقعي.',
    rows: [
      {
        key: 'اللهجة',
        title: 'يفهم متصلك كما يتحدث في واقعه اليومي',
        body: 'سواء تحدث العميل باللهجة السعودية أو الخليجية أو المصرية أو الفصحى، وحتى لو مزج كلمات دارجة مثل «أبغى موعد appointment بكرة الصباح»؛ يفهم المقصد فورًا دون طلب إعادة الكلام.',
        proof: [
          { term: 'تجاوب سريع بلا ارتباك', detail: 'يتوقف فور مقاطعة المتصل ويكمل بسلاسة' },
          {
            term: 'فهم العبارات المزدوجة',
            detail: 'يستوعب المصطلحات الإنجليزية الدارجة في الحديث',
          },
        ],
      },
      {
        key: 'التفاصيل',
        title: 'دقة متناهية في الأسماء، الأرقام، والمواعيد',
        body: 'الأسماء العربية المركبة مثل «عبدالرحمن بن سعود»، أرقام الهواتف المتسلسلة، العملات بالريال، ومصطلحات الوقت مثل «بعد صلاة المغرب» و«الأحد القادم». تُختبر بدقة فائقة قبل الإطلاق.',
        proof: [
          { term: 'قاموس نطق مخصص لعلامتك', detail: 'أسماء أطبائك، فروعك، وخدماتك الحصرية' },
          { term: 'بوابة اختبارات شاملة', detail: 'اجتياز سيناريوهات الجودة شرط أساسي للنشر' },
        ],
      },
      {
        key: 'التحكم',
        title: 'تحكم مؤسسي كامل ومرونة في النسخ والتحديث',
        body: 'كل تحسين يحفظ كنسخة مستقلة ومحمية، مما يتيح لك مراجعة وضبط الأداء، والرجوع لأي نسخة سابقة بضغطة زر دون أي انقطاع في الخدمة.',
        proof: [
          { term: 'استعادة فورية', detail: 'الرجوع لأي نسخة سابقة بضغطة زر واحدة' },
          { term: 'تحديثات آمنة معزولة', detail: 'المكالمات الجارية تكمل بثبات واستقرار تام' },
        ],
      },
    ],
  },
  results: {
    label: 'الأثر والنتائج',
    title: 'من اتصالات وفرص ضائعة، إلى استقبال دائم ومستمر.',
    lead: 'تحول جذري وملموس في كفاءة الاستقبال والرضا العام منذ الشهر الأول للتشغيل.',
    beforeTitle: 'قبل مُجاوِب',
    before: [
      'مكالمات فائتة بعد ساعات الدوام وفي العطلات والإجازات',
      'انشغال خطوط الاستقبال وتحول العملاء إلى المنافسين',
      'استنزاف وقت فريقك في تكرار الإجابة عن نفس الاستفسارات',
      'غياب الإحصائيات الدقيقة حول حجم الفرص والاتصالات المهدرة',
    ],
    afterTitle: 'مع مُجاوِب',
    after: [
      'رد فوري واستقبال راقٍ على مدار الساعة بلا توقف',
      'تثبيت المواعيد والطلبات مباشرة خلال المكالمة نفسها',
      'تفرغ فريقك لخدمة العملاء والمهام النوعية الأكثر أهمية',
      'تقارير ولوحة قياس واضحة تبين نمو الحجوزات وحجم النشاط',
    ],
    honesty: {
      title: 'شفافية كاملة وموثوقية نلتزم بها.',
      body: 'نحن نؤمن بأن الثقة تبدأ من الشفافية. ندعوك لتجربة مُجاوِب بنفسك عبر سيناريو مخصص لنشاطك والاستماع إلى النتائج قبل اتخاذ أي قرار.',
      cta: 'جرّبه الآن على سيناريو من عملك',
    },
  },
  failure: {
    label: 'التعامل الذكي مع المواقف الخاصة',
    title: 'التعامل الذكي والآمن مع الحالات غير المتوقعة.',
    lead: 'الاحترافية الحقيقية تظهر في كيفية معالجة الاستفسارات المعقدة وسرعة توجيهها للمسار الصحيح.',
    rows: [
      {
        situation: 'استفسار يحتاج توضيحًا إضافيًا',
        handling:
          'يستوضح بلباقة بسؤال مباشر، وإن استمر الغموض يحول المكالمة إلى موظفك المختص فورًا.',
      },
      {
        situation: 'تعذر الوصول للتقويم مؤقتًا',
        handling:
          'لا يعطي وعودًا غير مؤكدة، بل يسجل بيانات العميل بدقة ويطلب معاودة الاتصال مع إشعارك فورًا.',
      },
      {
        situation: 'نظام إدارة العملاء (CRM) غير متاح',
        handling:
          'يكمل المكالمة ويحفظ بيانات العميل محليًا بأمان، ثم يُعيد مزامنتها تلقائيًا فور عودة النظام.',
      },
      {
        situation: 'سؤال خارج نطاق البيانات المعتمدة',
        handling:
          'يعتذر بلباقة ويوجه العميل للشخص المعني أو يسجل طلبه للمتابعة، دون أي اجتهاد أو تخمين.',
      },
      {
        situation: 'طلب التحدث مع موظف بشري',
        handling:
          'يتم التحويل المباشر بسلاسة، مع تزويد الموظف بسياق المكالمة ليتابع مع العميل دون الحاجة لإعادة الشرح.',
      },
      {
        situation: 'اتصال خارج أوقات العمل الرسمية',
        handling:
          'يستقبل العميل ويرتب طلبه أو حجزه ويسجل بياناته لتجدها جاهزة ومنظمة في بداية يوم العمل.',
      },
    ],
    note: 'تُضبط هذه القواعد الموجهة بالتعاون معكم أثناء الإعداد، ويمكن تعديلها في أي وقت.',
  },
  industries: {
    label: 'حلول مخصصة للقطاعات',
    title: 'مصمّم خصيصًا لطبيعة نشاطك التجاري.',
    lead: 'لكل قطاع احتياجاته وسيناريوهاته الخاصة. اختر قطاعك لاستكشاف مسار الخدمة المصمم لك.',
    packs: {
      medical: {
        title: 'العيادات والمراكز الطبية',
        body: 'حجز وتأجيل المواعيد، تذكير المرضى، والإجابة عن الخدمات والأطباء والأسعار دون إشغال موظفي الاستقبال.',
        moment: 'اللحظة الحاسمة: تثبيت الموعد بدقة قبل إنهاء المتصل للمكالمة.',
      },
      realestate: {
        title: 'التطوير والتسويق العقاري',
        body: 'الاستفسار عن الميزانية والموقع ونوع العقار، تنسيق مواعيد المعاينة، وتأهيل العملاء الجادين لمستشاري المبيعات.',
        moment: 'اللحظة الحاسمة: اغتنام اهتمام العميل فور اتصاله وتوثيق رغبته.',
      },
      auto: {
        title: 'مراكز صيانة وخدمات السيارات',
        body: 'حجز مواعيد الصيانة الدورية، الاستعلام عن حالة المركبة، وتحديد أوقات الاستلام وقطع الغيار.',
        moment: 'اللحظة الحاسمة: تحويل الاستفسار العاجل إلى موعد مؤكد في الورشة.',
      },
      reception: {
        title: 'خدمة العملاء والشركات',
        body: 'فرز المكالمات الواردة، توجيه المتصل للإدارة المختصة، وتصعيد الطلبات المستعجلة مع تفاصيلها الكاملة.',
        moment: 'اللحظة الحاسمة: إنهاء انتظار المتصل وتقديم إجابة حاسمة وسريعة.',
      },
    },
  },
  integrations: {
    label: 'التكامل والربط التقني',
    title: 'من مجرد محادثة إلى إنجاز فوري.',
    lead: 'يرتبط مُجاوِب مباشرة بأنظمتك الحالية — يفحص التقويم، يرسل رسائل التأكيد عبر واتساب، ويسجل البيانات في نظام CRM لديك.',
    note: 'يخضع كل ربط تقني لفحوصات أمان واتصال دورية مع خطة طوارئ بديلة.',
    flowEnd: 'تم إنجاز وتأكيد الطلب',
  },
  security: {
    label: 'الأمان والموثوقية',
    title: 'بنية مؤسسية مصممة لأعلى معايير الأمان والخصوصية.',
    lead: 'ندرك أهمية وحساسية بيانات مكالمات عملائك، ونلتزم بحمايتها وفق أفضل الممارسات المعتمدة.',
    items: [
      {
        title: 'عزل تام لبيانات المنشآت',
        body: 'بيانات شركتك معزولة ومشفرة بالكامل، ولا تُستخدم إطلاقًا لتدريب أي نماذج عامة.',
      },
      {
        title: 'صلاحيات وأدوار محددة',
        body: 'تحكم دقيق بصلاحيات فريقك لمنح كل مستخدم ما يحتاجه فقط وفق مهامه.',
      },
      {
        title: 'سجل تدقيق شامل',
        body: 'توثيق كامل لكافة التعديلات والإجراءات التشغيلية مع تحديد المنفذ والتوقيت.',
      },
      {
        title: 'سياسة مخصصة للاحتفاظ بالبيانات',
        body: 'إمكانية تحديد مدد حفظ السجلات والتسجيلات بما يتوافق مع سياسات منشأتك.',
      },
      {
        title: 'إيقاف فوري بنقرة واحدة',
        body: 'تحكم مباشر لإيقاف الموظف الصوتي وتحويل المكالمات لفريقك البشري فورًا.',
      },
      {
        title: 'استمرارية الأعمال ومسارات الطوارئ',
        body: 'في حال تعطل أي نظام خارجي، تضمن المنظومة وصول المكالمة لفريقك دون انقطاع.',
      },
    ],
  },
  console: {
    label: 'لوحة التحكم والتحليلات',
    title: 'رؤية تشغيلية شاملة لكافة مكالماتك.',
    lead: 'شاشة تحكم متكاملة تمنحك تفاصيل ما أنجزه الموظف الصوتي وما يتطلب متابعة فريقك في واجهة موحدة.',
    points: [
      'استعراض تفاصيل المكالمات ونتائجها والحوار الكامل في مكان واحد',
      'قائمة ذكية تنظم وتبرز الحالات التي تتطلب مراجعة فريقك أولًا',
      'مؤشرات حية لحالة الأرقام والتكاملات ومعدلات إنجاز الحجوزات',
    ],
    cta: 'الدخول إلى لوحة التحكم',
  },
  cta: {
    title: 'ابدأ بالسيناريو الأكثر تأثيرًا في نشاطك.',
    body: 'نبدأ باختيار سيناريو أساسي من واقع عملك، نجهزه ونختبره، لتسمع الأداء بنفسك قبل الانطلاق الكامل.',
    note: 'تشغيل مُدار بالكامل دون متطلبات تقنية من طرفك.',
    primary: 'احجز جلسة استشارية (20 دقيقة)',
    secondary: 'أرسل لنا تفاصيل نشاطك',
  },
  footer: {
    tagline: 'استقبال هاتفي أذكى · عملاء أكثر رضاً · فريق أعلى إنتاجية.',
    description:
      'مُجاوِب هو موظفك الصوتي الذكي لاستقبال مكالمات منشأتك بالعربية على مدار الساعة وتثبيت الحجوزات بدقة.',
    columns: [
      {
        title: 'الخدمات والحلول',
        links: [
          { label: 'نماذج المكالمات', href: '/#calls' },
          { label: 'الإمكانات والميزات', href: '/#can' },
          { label: 'المواقف الخاصة', href: '/#failure' },
          { label: 'التكاملات والربط', href: '/#integrations' },
          { label: 'حلول القطاعات', href: '/#industries' },
        ],
      },
      {
        title: 'عن مُجاوِب',
        links: [
          { label: 'من نحن', href: '/about' },
          { label: 'كيف نبدأ معك', href: '/how-it-works' },
          { label: 'الأسعار والباقات', href: '/pricing' },
          { label: 'الأمان والخصوصية', href: '/security' },
          { label: 'الأسئلة الشائعة', href: '/faq' },
          { label: 'برنامج الشركاء', href: '/partners' },
          { label: 'تواصل معنا', href: '/contact' },
        ],
      },
    ],
    rights: 'جميع الحقوق محفوظة © مُجاوِب 2026.',
    privacy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
  },
  common: {
    signIn: 'تسجيل الدخول',
    bookDemo: 'احجز مكالمة تجريبية',
    menu: 'القائمة',
    close: 'إغلاق',
    theme: 'تبديل المظهر',
    langSwitch: 'English',
  },
}

const en: Copy = {
  nav: [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Industries', href: '/#industries' },
    { label: 'Security', href: '/security' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Partners', href: '/partners' },
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
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Full call replays', href: '/#calls' },
          { label: 'Capabilities', href: '/#can' },
          { label: 'When a call goes wrong', href: '/#failure' },
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
          { label: 'Partners program', href: '/partners' },
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
