import type { Locale } from '@/lib/i18n'

/**
 * Copy for the standalone pages. Each page has its own shape rather than one
 * generic template — a pricing page and an FAQ answer different questions and
 * should not be rendered by the same component.
 */

type FaqItem = { q: string; a: string }

type PricingBand = {
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
    channels: { type: 'email' | 'phone' | 'whatsapp'; label: string; note: string }[]
    expect: { step: string; body: string }[]
    hours: string
  }
  pricing: {
    title: string
    lead: string
    bandsNote: string
    bands: PricingBand[]
    drivers: { title: string; body: string }[]
    driversTitle: string
    driversNote: string
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
  partners: {
    title: string
    lead: string
    stats: { num: string; label: string }[]
    tracksTitle: string
    tracks: { title: string; desc: string; forWho: string; features: string[] }[]
    benefitsTitle: string
    benefits: { title: string; desc: string }[]
    stepsTitle: string
    steps: { n: string; title: string; desc: string }[]
    faqTitle: string
    faq: { q: string; a: string }[]
    ctaTitle: string
    ctaBody: string
    ctaButton: string
  }
}

const ar: Pages = {
  contact: {
    title: 'تحدث مع مستشارينا.',
    lead: 'نقدم مُجاوِب كخدمة متكاملة ومُدارة بالكامل — تبدأ جلستنا الأولى بفهم طبيعة نشاطك وتحديات الاستقبال لديك لنبني لك الحل الأمثل.',
    channels: [
      {
        type: 'email',
        label: 'البريد الإلكتروني',
        note: 'نجيب على استفسارك خلال يوم عمل واحد.',
      },
      {
        type: 'phone',
        label: 'الهاتف المباشر',
        note: 'من الأحد إلى الخميس، 9:00 ص – 6:00 م بتوقيت الرياض.',
      },
      {
        type: 'whatsapp',
        label: 'واتساب',
        note: 'للاستفسارات السريعة وتنسيق المواعيد.',
      },
    ],
    expect: [
      {
        step: 'جلسة استكشافية أولى — 20 دقيقة',
        body: 'نستمع لاحتياجاتك بدقة: حجم المكالمات اليومي، آلية الاستقبال الحالية، وأكثر الطلبات تكرارًا.',
      },
      {
        step: 'خطة تشغيل مخصصة لنشاطك',
        body: 'نقدم لك سيناريو استقبال محدد، مع تقدير شفاف لحجم الاستخدام والتكلفة المتوقعة.',
      },
      {
        step: 'تجربة حية قبل اتخاذ القرار',
        body: 'نجهز الموظف الصوتي على سيناريو تجريبي من واقع عملك لتستمع إلى أدائه الطبيعي بنفسك.',
      },
    ],
    hours: 'الأحد – الخميس · 9:00 – 18:00 بتوقيت الرياض',
  },
  pricing: {
    title: 'استثمر في موظف يعمل 24/7 دون إجازات أو أعذار.',
    lead: 'تسعير شفاف وعادل يعتمد على حجم المكالمات المعالجة فعلياً، دون رسوم خفية، أو رسوم تأسيس معقدة، أو قيود على عدد مستخدمي فريقك في لوحة التحكم.',
    bandsNote:
      'ثلاثة نطاقات تشغيلية مرنة. اختر ما يناسب حجم أعمالك وسنوافيك بعرض سعر مخصص ودقيق يضمن لك أعلى عائد على الاستثمار.',
    bands: [
      {
        name: 'التأسيس والنمو',
        forWho: 'عيادة، مطعم، أو فرع واحد بطلبات محددة',
        volume: 'حتى 500 مكالمة شهريًا',
        includes: [
          'موظف صوتي واحد بنبرة ولهجة مختارة',
          'ربط مباشر للتقويم وتأكيد واتساب فوري',
          'رقم استقبال هاتفي مخصص (أرضي أو جوال)',
          'لوحة تشغيل وتقارير تفصيلية لحظية',
        ],
      },
      {
        name: 'التشغيل الاحترافي',
        forWho: 'عدة فروع أو سيناريوهات حجز متعددة',
        volume: '500 – 3,000 مكالمة شهريًا',
        includes: [
          'تعدد الموظفين الصوتيين واللهجات لكل فرع',
          'ربط أنظمة CRM وإدارة العملاء المتقدمة',
          'أرقام متعددة مع توجيه ذكي للفروع',
          'متابعة ومراجعة جودة أسبوعية من خبرائنا',
          'بوابة مخصصة ومستقلة لفريق عملك',
        ],
        featured: true,
      },
      {
        name: 'المؤسسات والشبكات الكبرى',
        forWho: 'شبكات الفروع، المستشفيات، والحجم المرتفع',
        volume: 'أكثر من 3,000 مكالمة شهريًا',
        includes: [
          'كافة الميزات الاحترافية بالكامل',
          'اتفاقية مستوى خدمة مخصصة (SLA) ملزمة',
          'سياسات متقدمة لحفظ البيانات وعزلها',
          'مدير حساب وتشغيل مخصص (Account Manager)',
        ],
      },
    ],
    driversTitle: 'كيف نحدد لك أفضل عرض سعر؟',
    drivers: [
      {
        title: 'حجم المكالمات الشهرية المتوقعة',
        body: 'العامل الأساسي للتسعير هو الاستخدام الفعلي. نعتمد متوسط آخر 3 أشهر لنشاطك لضمان تقديم سعر عادل وموفر يقضي على هدر توظيف الكول سنتر.',
      },
      {
        title: 'مدى تعقيد مسارات الخدمة والفروع',
        body: 'إعداد سيناريو حجز لعيادة واحدة يختلف جذرياً عن بناء شجرة توجيه ذكية تفهم طلب العميل وتوجهه لأحد 20 فرعاً بناءً على موقعه.',
      },
      {
        title: 'التكامل والربط التقني المتقدم',
        body: 'الربط الأساسي مع التقويم وواتساب مشمول مجاناً. أما الربط المتقدم مع أنظمة ERP أو CRM (مثل Salesforce أو Odoo) فيحتاج لعمل هندسي مخصص.',
      },
      {
        title: 'تخصيص الهوية الصوتية (Voice Branding)',
        body: 'بناء قواميس نطق خاصة بأسماء خدماتك، وأطبائك، وعلاماتك التجارية لضمان أن الموظف الصوتي يتحدث بلسانك وبلهجة تناسب جمهورك بنسبة 100%.',
      },
    ],
    driversNote:
      'بمجرد تواصلك معنا، نقوم بدراسة نموذج عملك ونرسل لك عرض سعر مفصل خلال يوم عمل واحد متضمناً كافة التفاصيل التشغيلية والتكلفة الشهرية بمنتهى الوضوح.',
    note: 'لا توجد رسوم تأسيس إضافية في السيناريو الأول. يشمل الاشتراك كافة عمليات الإعداد الهندسية، الربط التقني، والاختبار المستمر من قبل فريقنا (Done-for-you).',
    faq: [
      {
        q: 'هل توجد رسوم على عدد مستخدمي فريقي؟',
        a: 'لا، إطلاقًا. الاشتراك مرتبط فقط بحجم المكالمات المنجزة، ويمكنك إضافة من تشاء من موظفيك إلى لوحة التحكم مجانًا.',
      },
      {
        q: 'ماذا يحدث إذا تجاوز حجم الاتصالات باقتي؟',
        a: 'لا يتم إيقاف الخدمة ولا تنقطع أي مكالمة عن عملائك؛ بل نتواصل معك لتنسيق ترقية باقتك بسلاسة للشهر التالي.',
      },
      {
        q: 'هل يتطلب الاشتراك التزامًا سنويًا طويل الأجل؟',
        a: 'الاشتراك شهري مرن، وتستطيع إلغاءه بإشعار مسبق مدته 30 يومًا دون أي التزامات سنوية معقدة.',
      },
    ],
  },
  faq: {
    title: 'الإجابات الشافية لكل ما يتبادر لذهنك.',
    lead: 'جمعنا لك الاستفسارات الأكثر تكراراً من مديري العمليات ورواد الأعمال حول مُجاوِب وآلية تشغيله.',
    groups: [
      {
        title: 'عن الإعداد والتشغيل (Onboarding)',
        items: [
          {
            q: 'كم يستغرق تجهيز الموظف الصوتي وبدء التشغيل الفعلي؟',
            a: 'من أسبوع إلى ثلاثة أسابيع بناءً على حجم نشاطك وتعقيد الربط التقني المطلوب. وعادة ما تكون النسخة التجريبية الأولى جاهزة للاختبار خلال أسبوع من استلام متطلباتك.',
          },
          {
            q: 'هل أحتاج إلى فريق تقني أو مبرمجين من طرفي لإدارة الخدمة؟',
            a: 'لا على الإطلاق. أنت تزودنا بقوائم الخدمات، الأسعار، وأوقات العمل، ويتولى فريقنا الهندسي بناء النظام، تدريب الذكاء الاصطناعي، وربط التقويم والواتساب بالكامل.',
          },
          {
            q: 'هل سأضطر لتغيير أرقام الاتصال المعتمدة لشركتي؟',
            a: 'لست مضطراً لذلك. يمكن لـ "مُجاوِب" العمل مباشرة على رقمك الحالي عبر خاصية تحويل المكالمات (Call Forwarding)، أو يمكننا توفير أرقام هاتفية جديدة مخصصة لك.',
          },
        ],
      },
      {
        title: 'عن قدرات الذكاء الاصطناعي وجودة الصوت',
        items: [
          {
            q: 'هل سيكتشف العميل أنه يتحدث مع روبوت؟',
            a: 'بنسبة كبيرة لا. الصوت طبيعي جداً وانسيابي، وفترات الصمت (Latency) شبه معدومة. نبرمج النظام ليتنفس بأسلوب طبيعي ولا يتم إطلاقه إلا بعد اجتيازه لاختبارات صارمة في نطق الأسماء الخليجية والعربية.',
          },
          {
            q: 'ماذا لو قاطع العميل الموظف الصوتي أثناء حديثه؟',
            a: 'هذه إحدى أقوى ميزاتنا. يتوقف الموظف الصوتي فوراً ليستمع باهتمام لمتصلك (Full-duplex conversation)، ثم يستكمل الحوار بلباقة دون أي تكرار أو إعادة مزعجة للكلام.',
          },
          {
            q: 'هل يدعم الموظف الصوتي اللهجات المحلية (السعودية، الخليجية)؟',
            a: 'بالتأكيد. ندعم اللهجة السعودية، الخليجية، المصرية، والشامية، والفصحى المعاصرة. يمكن تخصيص النبرة (Tone) لتناسب هوية علامتك: رسمية جداً للبنوك، أو ودودة ودافئة للعيادات.',
          },
          {
            q: 'كيف يتعامل الموظف الصوتي مع الأسئلة التي لا يعرف إجابتها؟',
            a: 'لن يقدم إجابات عشوائية (No Hallucinations). إذا لم يكن السؤال ضمن صلاحياته أو لم يتضح له، سيعتذر بلباقة ويقوم فوراً بتحويل المكالمة لموظف بشري مع إرسال ملخص الحوار فوراً لتوفير وقت العميل.',
          },
        ],
      },
      {
        title: 'عن الأتمتة والمتابعة اليومية',
        items: [
          {
            q: 'هل يستطيع الموظف الصوتي إجراء حجوزات فعلية؟',
            a: 'نعم. يتحقق من الأوقات الشاغرة في نظام التقويم الخاص بك (Google Calendar, Calendly وغيرها) بشكل لحظي، يثبّت الموعد، ويرسل رسالة تأكيد للعميل عبر الواتساب في نفس المكالمة.',
          },
          {
            q: 'كيف أتابع تفاصيل ومجريات المكالمات الواردة؟',
            a: 'من خلال لوحة تحكم سحابية فورية، تحصل على سجل كامل لكل مكالمة يتضمن: الحوار محولاً لنص (Transcript)، تسجيل صوتي، الإجراءات المنفذة، والنتيجة النهائية مع تصنيف فوري للحالات المستعجلة.',
          },
          {
            q: 'هل أستطيع إيقاف الموظف الصوتي في أوقات محددة؟',
            a: 'نعم، بكل سهولة بضغطة زر. يمكنك أيضاً ضبط ساعات الدوام بحيث يستقبل المكالمات فقط خارج أوقات العمل الرسمية، أو تفعيله كمستقبل أولي في أوقات الذروة.',
          },
        ],
      },
    ],
  },
  about: {
    title: 'نحن لا نبني روبوتات، بل نصنع واجهة صوتية تليق بعلامتك التجارية.',
    lead: 'مُجاوِب ليس مجرد أداة برمجية صماء، بل شريك تشغيلي متكامل يطور ويختبر ويدير موظفك الصوتي لضمان تجربة اتصال استثنائية لعملائك تزيد من المبيعات وترفع مستوى الرضا.',
    story: [
      'الاستقبال الهاتفي هو الانطباع الأول والأهم لأي منشأة. لاحظنا أن معظم حلول الصوت في منطقتنا تُبنى بمجرد ترجمة حرفية لمنتجات أجنبية، فتنتج نبرة آلية مصطنعة تخطئ في نطق الأسماء العربية وتتلعثم في الأرقام، مما يسبب إحباطاً للمتصل وفقداناً للفرص البيعية.',
      'كما أن ترك إعداد الموظف الصوتي لـ "مربعات نص عشوائية" يؤدي إلى تضارب الردود، ضعف دقة الإجابات، وغياب الثقة التشغيلية المطلوبة في قطاع الأعمال.',
      'لذلك صممنا "مُجاوِب" بهندسة متقدمة مخصصة كلياً للعربية: طبقات توجيه متزنة للذكاء الاصطناعي، قواميس نطق حصرية لعلامتك التجارية، واختبارات جودة صارمة تضمن عدم إطلاق أي نسخة قبل التحقق التام من دقتها، لباقة ردودها، وقدرتها على تحويل المكالمة لمبيعات فعلية.',
    ],
    principles: [
      {
        title: 'المصداقية أولاً: لا تأكيد بلا تنفيذ حقيقي',
        body: 'الموظف الصوتي لا يعطي وعوداً وهمية ولا يؤكد أي حجز أو طلب للعميل إلا بعد تثبيته الفعلي في تقويمك وأنظمتك المعتمدة لحظياً.',
      },
      {
        title: 'الجودة: قياس واختبار دائم بلا هوادة',
        body: 'نعتمد على بوابات اختبار صارمة تحاكي الواقع، وتمنع نشر أي تعديل لا يحقق أعلى معايير الدقة والاحترافية.',
      },
      {
        title: 'خدمة مُدارة بالكامل من أجلك (Done-for-You)',
        body: 'نتولى الإعداد، هندسة الصوت، الربط التقني، المراقبة اليومية، والتحسين المستمر، لنوفر وقتك وجهدك للتركيز على نمو نشاطك.',
      },
      {
        title: 'أمان ومرونة مؤسسية كاملة',
        body: 'كل تحديث يحفظ في إصدار مستقل مع إمكانية استعادة أي نسخة سابقة فورًا، وضمان عزل وتشفير بيانات منشأتك بالكامل.',
      },
    ],
    stance: {
      title: 'مبادئنا ومسؤوليتنا تجاهك',
      body: 'نلتزم بالشفافية التامة في التسعير والأداء. لا ندعي أرقاماً لم نقسها، ولا نستخدم بيانات مكالماتك لتدريب أي نماذج عامة. وإذا وجدنا أثناء دراستنا أن الحل الصوتي غير مناسب لطبيعة نشاطك الحالي، سنخبرك بذلك بكل وضوح وصدق قبل أن نبدأ.',
    },
  },
  security: {
    title: 'أمان بياناتك ومكالمات عملائك خط أحمر.',
    lead: 'في قطاع الأعمال، السرية ليست ميزة إضافية بل أساس الثقة. نلتزم بحماية بياناتك بأعلى معايير التشفير والامتثال التنظيمي للأنظمة السعودية والخليجية.',
    intro: [
      'بيانات مكالمات منشأتك، وأرقام متصليك، وتفاصيل حجوزاتهم هي ملكية حصرية لك. نحن نعالجها سحابياً بأمان صارم لتشغيل الخدمة فقط، ولا نبيعها ولا نشاركها مع أي طرف ثالث مهما كان.',
      'على عكس المنصات المفتوحة، نؤكد التزامنا القانوني والتقني بعدم استخدام أي حرف من محتوى اتصالاتك في تدريب نماذج الذكاء الاصطناعي العامة نهائياً.',
    ],
    practices: [
      {
        title: 'عزل تام لبيانات المنشآت (Tenant Isolation)',
        body: 'تتمتع كل منشأة بمساحة عمل مشفرة ومعزولة كليًا على مستوى قاعدة البيانات (Database Level)، مما يجعل تداخل البيانات بين المنشآت مستحيلاً تماماً.',
      },
      {
        title: 'تشفير متقدم للمفاتيح وقواعد البيانات (AES-256 & TLS 1.3)',
        body: 'تُحفظ كافة مفاتيح الربط وسجلات المكالمات بتشفير قياسي معتمد مؤسسياً (AES-256 أثناء السكون وبروتوكول TLS 1.3 أثناء النقل)، ولا تظهر كنص مقروء لأي طرف غير مصرح له.',
      },
      {
        title: 'صلاحيات وصول دقيقة ومخصصة (RBAC)',
        body: 'نظام تحكم محكم بالأدوار يتيح للمدير العام إعطاء كل موظف في منشأتك (سواء كان مشرفاً أو محاسباً أو مراجعاً) حق الوصول للمعلومات التي يحتاجها لإنجاز مهامه فقط.',
      },
      {
        title: 'سجل تدقيق تشغيلي لا يمكن التلاعب به (Audit Logs)',
        body: 'نظام توثيق دقيق لكافة الإجراءات: متى تم نشر نسخة جديدة، من قام بتعديل الصلاحيات، ومتى تم استخراج التقارير، مع تسجيل دقيق لاسم المنفذ والتوقيت (Timestamp).',
      },
      {
        title: 'سياسة مرنة للاحتفاظ بالبيانات (Data Retention)',
        body: 'القرار بيدك تماماً. تتحكم بشكل كامل في فترات الاحتفاظ بالسجلات النصية والتسجيلات الصوتية للمكالمات (مثلاً: حذف تلقائي بعد 30 يوماً) بما يتوافق مع سياسات الجودة لمنشأتك.',
      },
      {
        title: 'استمرارية الأعمال والتحويل الفوري (Failover)',
        body: 'في حالات الطوارئ القصوى، يمكنك بضغطة زر واحدة إيقاف الموظف الصوتي، وتوجيه كافة المكالمات فوراً لفريقك البشري أو لبريد صوتي لضمان عدم انقطاع الخدمة.',
      },
    ],
    notClaimed:
      'لا نملك حتى الآن شهادات SOC 2 أو ISO 27001، ولن ندّعي خلاف ذلك. تسجيل المكالمات اختياري ويُفعَّل لكل منشأة بعد مراجعة الأنظمة المحلية، لأن قوانين التسجيل تختلف من دولة لأخرى.',
  },
  howItWorks: {
    title: 'رحلة الانطلاق مع مُجاوِب: من الفكرة إلى التشغيل الفعلي.',
    lead: 'أربع مراحل تشغيلية مدروسة بعناية، يقودها فريقنا الهندسي بالكامل لتضمن أن موظفك الصوتي الجديد مستعد تماماً للرد على عملائك باحترافية، دون أي جهد تقني من طرفك.',
    detail: [
      {
        n: '01',
        title: 'استكشاف وتوثيق نموذج عملك',
        body: 'جلسة استشارية مكثفة مع خبرائنا لفهم رحلة عميلك الحالية: نوعية الاتصالات، الأسئلة المتكررة، أوقات الذروة، ونقاط الاختناق التي تضيع بسببها المبيعات.',
        youDo: 'تزويدنا بقوائم الخدمات، الأسعار، سياسات الفروع، وأوقات العمل الرسمية.',
        weDo: 'هندسة مسارات المكالمات، صياغة سيناريوهات الرد الأمثل، وتحديد آلية التحويل لفريقك.',
      },
      {
        n: '02',
        title: 'بناء الذكاء الاصطناعي والربط التقني',
        body: 'نقوم بتلقين النظام تفاصيل عملك، ونقوم بالربط التقني المباشر (API) مع تقويمك (Google/Outlook)، وأنظمة إدارة العملاء (CRM)، وحساب واتساب لضمان أتمتة الإجراءات بالكامل.',
        youDo: 'اعتماد شاشات الربط التقني وإعطاء الصلاحيات اللازمة للأنظمة المطلوبة.',
        weDo: 'برمجة التوجيهات، تدريب نماذج النطق على مصطلحاتك الخاصة، واختبار الربط الخلفي.',
      },
      {
        n: '03',
        title: 'محاكاة الحالات المعقدة وضبط النبرة',
        body: 'نُخضع الموظف الصوتي لعشرات السيناريوهات المعقدة (مقاطعات، أسئلة مفاجئة، أرقام طويلة) للتأكد من لباقته وسرعة بديهته وعدم ارتباكه أبداً.',
        youDo: 'تجربة الاتصال برقم تجريبي، محاولة تحدي الموظف الصوتي، وتأكيد رضاك التام عن أدائه.',
        weDo: 'الضبط الدقيق للاستجابة بالمللي ثانية، تحسين مخارج الحروف، واعتماد النسخة الذهبية.',
      },
      {
        n: '04',
        title: 'الإطلاق، التشغيل، والمتابعة الاستباقية',
        body: 'بمجرد اعتمادك، نخصص رقم الهاتف لمنشأتك وتبدأ باستقبال المكالمات الحقيقية. لن نتركك هنا، بل سنراقب أداء النظام يومياً لضمان الجودة.',
        youDo: 'متابعة الصفقات والحجوزات وهي تتدفق إلى لوحة التحكم والتقويم الخاص بك.',
        weDo: 'صيانة مستمرة، تحديث مستمر للقواميس، وإرسال تقارير أداء دورية توضح لك العائد الفعلي.',
      },
    ],
    timeline:
      'المدة القياسية من الجلسة الأولى حتى إطلاق أول مكالمة حقيقية: من أسبوع إلى ثلاثة أسابيع حسب حجم الربط والسيناريوهات.',
  },
  partners: {
    title: 'برنامج شركاء مُجاوِب: ضاعف أرباحك بتقديم أول موظف استقبال صوتي ذكي لعملائك.',
    lead: 'انضم لبرنامج شركاء مُجاوِب واربح عمولات شهرية متكررة مستمرة تبدأ من 20%، أو أعد بيع الخدمة تحت مظلة وكالتك بهوامش ربحية مجزية، دون أن تتحمل أي أعباء برمجية أو هندسية. نحن نتولى تشغيل وضمان جودة الموظف الصوتي، وأنت تجني ثمار الشراكة.',
    stats: [
      {
        num: '20% – 30%',
        label: 'عمولة شهرية متكررة مستمرة طوال فترة اشتراك عميلك',
      },
      {
        num: 'صفر ريال',
        label: 'لا توجد رسوم انضمام، ولا اشتراكات مفروضة على الشركاء',
      },
      {
        num: '100% مُدار',
        label: 'مهندسو مُجاوِب يتكفلون بالتدريب، والربط، ومراقبة الجودة 24/7',
      },
      {
        num: 'Sandbox',
        label: 'حساب تجريبي حي لعرض مكالمات الذكاء الاصطناعي أمام عملائك',
      },
    ],
    tracksTitle: 'ثلاثة مسارات شراكة مرنة تناسب نموذج عملك',
    tracks: [
      {
        title: 'مسار شركاء الإحالة (Referral Partners)',
        desc: 'المسار الأسرع لتحقيق دخل سلبي متكرر. أوصِ بـ "مُجاوِب" لعملائك ومعارفك، ودع فريقنا يتولى إغلاق الصفقة وربط الخدمة، واستلم عمولتك الشهرية تلقائياً.',
        forWho: 'المستشارون الإداريون، صناع المحتوى، وخبراء أتمتة الأعمال',
        features: [
          'عمولة شهرية نقدية تبدأ من 20% لكل فاتورة يدفعها عميلك',
          'تتبع فوري وموثق للعملاء المحالين عبر لوحة مخصصة',
          'صفر دعم فني وصفر مسؤولية تشغيلية بعد الإحالة',
        ],
      },
      {
        title: 'مسار الوكالات وحلول الأعمال (Agency & Solution Partners)',
        desc: 'أضف حلول الاستقبال الصوتي المتقدمة كخدمة قيمة مضافة لعملائك. اشترِ باقات مُجاوِب بأسعار الجملة التفضيلية وأعد تسعيرها ودمجها ضمن عقود خدماتك المتكاملة.',
        forWho: 'وكالات التسويق الرقمي، شركات إدارة الحملات والـ Media Buying، ومطورو الويب',
        features: [
          'أسعار جملة تفضيلية بهوامش ربحية مجزية تحددها بنفسك لعملائك',
          'لوحة إدارة موحدة لمتابعة كافة عملاء وكالتك من شاشة واحدة',
          'حقيبة عروض تقديمية قابلة للتخصيص باسم وكالتك (Pitch Decks)',
          'أولوية مطلقة في هندسة المسارات المخصصة والربط التقني',
        ],
      },
      {
        title: 'مسار التكامل البرمجي والمنصات (Technology & ISV Partners)',
        desc: 'اربط نظامك أو منصتك السحابية بـ "مُجاوِب" عبر الـ APIs لتمكين مستخدميك من تشغيل موظف استقبال صوتي متصل مباشرة بقاعدة بياناتك وتقويم مواعيدك.',
        forWho: 'أنظمة إدارة العيادات والمراكز الطبية (EMR)، منصات حجز المطاعم، وأنظمة الـ CRM',
        features: [
          'ربط برمجي ثنائي الاتجاه (Two-way Native API Integration)',
          'تسويق مشترك وإدراج منصتك في دليل التكاملات الرسمي لدينا',
          'نموذج تقاسم إيرادات (Revenue Share) مخصص لحجم مستخدميك',
          'قناة تواصل هندسية مباشرة مع فريق تطوير مُجاوِب',
        ],
      },
    ],
    benefitsTitle: 'حقيبة تمكين الشريك: كل ما يلزمك لإغلاق الصفقات',
    benefits: [
      {
        title: 'أرباح نقدية شهرية متكررة',
        desc: 'استلم أرباحك وعمولاتك الشهرية بانتظام عبر تحويل بنكي مباشر، مع كشف حساب تفصيلي يوضح حجم واشتراك كل عميل.',
      },
      {
        title: 'حساب تجريبي حي (Live Demo Sandbox)',
        desc: 'لا تحتاج لبيع الفكرة بالكلام؛ اتصل برقم العرض التجريبي ودع عميلك يستمع لانسيابية الصوت باللهجة الخليجية بنفسه في الاجتماع.',
      },
      {
        title: 'حقيبة المبيعات والتسويق المتكاملة',
        desc: 'نوفر لك شرائح عرض احترافية، نصوص بيعية، دراسات حالة لقطاعات مختلفة، وحاسبة عائد الاستثمار لتسهيل الإقناع.',
      },
      {
        title: 'فريق تشغيل كامل في ظهرك',
        desc: 'نحن لا نبيع برمجيات ونتركك؛ مهندسو مُجاوِب يتولون كل شيء: هندسة النبرة، إعداد الـ APIs، والدعم الفني على مدار الساعة.',
      },
      {
        title: 'حماية وتوثيق العملاء (Deal Registration)',
        desc: 'سجل العميل المحتمل في نظامنا لضمان حفظ حقك في العمولة دون أي تضارب مع مبيعاتنا المباشرة.',
      },
      {
        title: 'جلسات تدريب وتطوير لفريقك',
        desc: 'ورش عمل دورية لشرح أحدث إمكانيات الذكاء الاصطناعي الصوتي وكيفية تحويل مكالمات العملاء لفرص مبيعات.',
      },
    ],
    stepsTitle: 'خطوات بدء الشراكة: من التسجيل إلى أول عمولة',
    steps: [
      {
        n: '01',
        title: 'تعبئة طلب الشراكة',
        desc: 'سجل بياناتك ونوع نشاطك ومسار الشراكة الذي تفضله عبر النموذج أدناه.',
      },
      {
        n: '02',
        title: 'مكالمة المواءمة التجارية (20 دقيقة)',
        desc: 'جلسة سريعة مع مدير الشراكات لشرح نسب العمولات، وتسليم حساب الـ Sandbox، واعتماد الاتفاقية.',
      },
      {
        n: '03',
        title: 'استلام حقيبة المواد وبدء الترويج',
        desc: 'احصل على روابطك الترويجية ومواد المبيعات وابدأ في عرض الخدمة على عملائك المستهدفين.',
      },
      {
        n: '04',
        title: 'استلام الأرباح والنمو المتصاعد',
        desc: 'بمجرد اشتراك عميلك، تبدأ العمولات الشهرية بالتدفق إلى حسابك مع كل دورة تجديد تلقائياً.',
      },
    ],
    faqTitle: 'الأسئلة الأكثر شيوعاً حول برنامج الشركاء',
    faq: [
      {
        q: 'كيف ومتى يتم دفع العمولات الشهرية؟',
        a: 'يتم احتساب العمولات مع بداية كل شهر ميلادي عن اشتراكات الشهر السابق، وتُحول مباشرة إلى حسابك البنكي المعتمد مع إشعار تفصيلي.',
      },
      {
        q: 'هل يشترط أن أكون خبيراً تقنياً لأصبح شريكاً؟',
        a: 'إطلاقاً. لا تحتاج لأي خبرة برمجية. دورك يقتصر على ربطنا بالعميل أو إقناعه بالفكرة، وفريقنا الهندسي يتولى كامل مراحل الإعداد التقني والتشغيل.',
      },
      {
        q: 'هل توجد شروط أو حد أدنى لعدد العملاء؟',
        a: 'لا يوجد أي حد أدنى. تبدأ في استحقاق عمولاتك فور انضمام أول عميل لك.',
      },
      {
        q: 'في مسار الوكالات، هل يمكنني إعادة بيع الخدمة بالسعر الذي أحدده؟',
        a: 'نعم بالتأكيد. نوفر لك أسعار الجملة التفضيلية، ولديك الحرية الكاملة في تسعير الخدمة ودمجها مع باقاتك التسويقية أو التشغيلية.',
      },
      {
        q: 'ماذا لو احتاج العميل إلى دعم فني أو واجه مشكلة في المكالمات؟',
        a: 'فريق دعم مُجاوِب مسؤول بالكامل عن مراقبة جودة المكالمات والدعم الفني 24/7. عميلك في أيدٍ أمينة ولن تضطر للتعامل مع مشاكله التشغيلية.',
      },
    ],
    ctaTitle: 'لنبدأ شراكة استثنائية ونبني قيمة حقيقية لعملائك',
    ctaBody:
      'سواء كنت ترغب في عمولات إحالة متكررة أو ترقية خدمات وكالتك، فريق الشراكات جاهز لمناقشة التفاصيل معك اليوم.',
    ctaButton: 'قدّم طلب الشراكة الآن',
  },
}

const en: Pages = {
  contact: {
    title: 'Talk to the team.',
    lead: 'Mujawib is a managed service — we start with a call to understand your business, not a sign-up form. Pick whichever is easiest.',
    channels: [
      {
        type: 'email',
        label: 'Email',
        note: 'We reply within one working day.',
      },
      {
        type: 'phone',
        label: 'Phone',
        note: 'Sunday to Thursday, 9am – 6pm Riyadh time.',
      },
      {
        type: 'whatsapp',
        label: 'WhatsApp',
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
    lead: 'No rigid tiers and no per-seat fees. The figures below are usage bands, not prices: we set the price once we know your volume and your systems, and send it within one working day.',
    bandsNote:
      'Three usage bands. Pick the one closest to your volume and we come back with a quote built on it.',
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
    driversTitle: 'What actually sets your number',
    drivers: [
      {
        title: 'How many calls a month',
        body: 'The largest factor. We estimate from your last three months average, not your busiest month.',
      },
      {
        title: 'How many scenarios and branches',
        body: 'Booking for one branch is simpler than booking, rescheduling and order chasing across five branches on separate numbers.',
      },
      {
        title: 'Which systems we connect',
        body: 'Calendar and WhatsApp are in every plan. An in-house or non-standard system takes extra work, charged once.',
      },
      {
        title: 'How many voices and dialects',
        body: 'One voice in one dialect covers most cases. Several raises the build and testing effort.',
      },
    ],
    driversNote:
      'The quote arrives within one working day of the first call, with the volume estimate and the monthly cost in writing — never a number over the phone.',
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
  partners: {
    title: 'Mujawib Partner Program: Compounding Revenue with Arabic Voice AI.',
    lead: 'Whether you are a digital agency looking to increase client LTV, a management consultant recommending operational efficiency, or an ISV wanting to offer voice reception to your users — the Mujawib Partner Program delivers recurring revenue and enterprise-grade voice AI without adding technical overhead to your team.',
    stats: [
      {
        num: '20% – 30%',
        label: 'Recurring monthly commissions for the lifetime of your client',
      },
      {
        num: '$0 Cost',
        label: 'Zero signup fees and no partner maintenance commitments',
      },
      {
        num: '100% Managed',
        label: 'Mujawib engineering handles prompt tuning, integrations, and 24/7 QA',
      },
      {
        num: 'Sandbox',
        label: 'Dedicated demo environment to run live trial calls during client meetings',
      },
    ],
    tracksTitle: 'Three Partnership Tracks Tailored to Your Business',
    tracks: [
      {
        title: 'Referral Partners',
        desc: 'The easiest way to generate recurring passive revenue. Introduce Mujawib to your business network, and let our sales and engineering team close the deal and deliver the setup.',
        forWho: 'Consultants, advisors, business coaches, and fractional executives',
        features: [
          'Monthly recurring commission starting at 20% of invoice value',
          'Transparent deal tracking via dedicated partner dashboard',
          'Zero post-sale involvement or technical maintenance required',
        ],
      },
      {
        title: 'Agency & Solution Partners',
        desc: 'Add AI voice reception to your agency offering. Purchase wholesale usage tiers at preferred partner margins and package them into your retainer services.',
        forWho: 'Digital marketing agencies, CRM consultants, and systems integrators',
        features: [
          'Substantial wholesale discounts with flexible client pricing',
          'Consolidated client management workspace in the portal',
          'Customizable co-branded pitch decks and ROI calculators',
          'Priority SLA in the engineering deployment queue',
        ],
      },
      {
        title: 'Technology & ISV Partners',
        desc: 'Integrate your SaaS platform (clinic management, restaurant booking, CRM) with Mujawib to provide native voice reception to your entire user base.',
        forWho: 'SaaS vendors, vertical ERPs, and appointment platforms',
        features: [
          'Bidirectional native REST & Webhook integrations',
          'Co-marketing and featured listing in our integrations directory',
          'Custom volume-based revenue share agreements',
          'Dedicated developer sandbox and direct engineering channel',
        ],
      },
    ],
    benefitsTitle: 'Partner Enablement Toolkit',
    benefits: [
      {
        title: 'Compounding Recurring Income',
        desc: 'Receive your partner earnings every month via direct wire transfer, backed by detailed per-client reporting.',
      },
      {
        title: 'Live Demo Sandbox',
        desc: 'No theoretical pitching required; dial into a live demo number and let clients experience natural Arabic voice AI firsthand.',
      },
      {
        title: 'Full Sales & Marketing Assets',
        desc: 'Access pitch decks, battle cards, localized case studies, and ROI calculators designed to close deals quickly.',
      },
      {
        title: 'Done-for-You Technical Delivery',
        desc: 'We take full responsibility: dialect engineering, API integrations, and 24/7 call quality monitoring.',
      },
      {
        title: 'Protected Deal Registration',
        desc: 'Register client leads in our partner portal to protect your commission rights with zero channel conflict.',
      },
      {
        title: 'Sales Enablement & Training',
        desc: 'Regular product updates and sales coaching for your team to identify the best call automation opportunities.',
      },
    ],
    stepsTitle: 'How to Get Started in 4 Simple Steps',
    steps: [
      {
        n: '01',
        title: 'Submit Partner Inquiry',
        desc: 'Fill out the application form with your company details and target client profile.',
      },
      {
        n: '02',
        title: 'Commercial Alignment (20 mins)',
        desc: 'A quick discovery call with our partnership lead to align on tracks, terms, and handover materials.',
      },
      {
        n: '03',
        title: 'Access Toolkit & Start Outreach',
        desc: 'Receive your sandbox access, sales enablement kit, and unique referral tracking.',
      },
      {
        n: '04',
        title: 'Close Clients & Scale Revenue',
        desc: 'Watch your clients launch their voice reception while monthly recurring revenue builds.',
      },
    ],
    faqTitle: 'Partner Program FAQ',
    faq: [
      {
        q: 'How and when are commissions paid?',
        a: 'Commissions are calculated on the 1st of each month for the previous billing period, and wired directly to your verified bank account.',
      },
      {
        q: 'Do I need technical or AI engineering expertise?',
        a: 'None at all. You provide the client relationship; our specialized engineering team handles all prompt engineering, system connections, and call tuning.',
      },
      {
        q: 'Is there a minimum client volume requirement?',
        a: 'No minimums. You start earning recurring revenue from your very first referred client.',
      },
      {
        q: 'Can agencies bundle and rebrand the service?',
        a: 'Yes. In the Agency track you can bundle Mujawib into your own retainers and price the service however best serves your market.',
      },
      {
        q: 'Who is responsible for customer support and call quality?',
        a: 'Mujawib operations handles 24/7 system health, failovers, and latency monitoring. Your clients are completely supported by our team.',
      },
    ],
    ctaTitle: 'Ready to deliver voice AI to your clients?',
    ctaBody: 'Join our partner program today and start building compounding recurring revenue.',
    ctaButton: 'Apply for Partnership',
  },
}

const PAGES: Record<Locale, Pages> = { ar, en }

export function pagesFor(locale: Locale): Pages {
  return PAGES[locale] ?? PAGES.ar
}
