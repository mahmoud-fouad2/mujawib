import { CONTACT, CONTACT_WHATSAPP_URL } from '@/lib/content/contact'
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
    channels: { label: string; value: string; href: string; note: string }[]
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
}

const ar: Pages = {
  contact: {
    title: 'تحدث مع مستشارينا.',
    lead: 'نقدم مُجاوِب كخدمة متكاملة ومُدارة بالكامل — تبدأ جلستنا الأولى بفهم طبيعة نشاطك وتحديات الاستقبال لديك لنبني لك الحل الأمثل.',
    channels: [
      {
        label: 'البريد الإلكتروني',
        value: CONTACT.email,
        href: `mailto:${CONTACT.email}`,
        note: 'نجيب على استفسارك خلال يوم عمل واحد.',
      },
      {
        label: 'الهاتف المباشر',
        value: CONTACT.phoneDisplay,
        href: `tel:${CONTACT.phoneE164}`,
        note: 'من الأحد إلى الخميس، 9:00 ص – 6:00 م بتوقيت الرياض.',
      },
      {
        label: 'واتساب',
        value: CONTACT.phoneDisplay,
        href: CONTACT_WHATSAPP_URL,
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
    title: 'باقات مرنة صُممت لتلائم حجم أعمالك.',
    lead: 'تسعير شفاف وعادل يعتمد على حجم المكالمات المعالجة دون رسوم خفية أو قيود على عدد مستخدمي فريقك في لوحة التحكم.',
    bandsNote: 'ثلاثة نطاقات تشغيلية مرنة. اختر ما يناسب حجم أعمالك وسنوافيك بعرض سعر مخصص ودقيق.',
    bands: [
      {
        name: 'البداية',
        forWho: 'فرع واحد أو سيناريو استقبال محدد',
        volume: 'حتى 500 مكالمة شهريًا',
        includes: [
          'موظف صوتي واحد بنبرة ولهجة مختارة',
          'ربط مباشر للتقويم وتأكيد واتساب',
          'رقم استقبال هاتفي مخصص',
          'لوحة تشغيل وتقارير تفصيلية',
        ],
      },
      {
        name: 'النمو والتشغيل',
        forWho: 'عدة فروع أو سيناريوهات متعددة',
        volume: '500 – 3,000 مكالمة شهريًا',
        includes: [
          'تعدد الموظفين الصوتيين واللهجات',
          'ربط أنظمة CRM وإدارة العملاء',
          'أرقام متعددة مع توجيه ذكي للفروع',
          'متابعة ومراجعة جودة أسبوعية',
          'بوابة مخصصة لفريق عملك',
        ],
        featured: true,
      },
      {
        name: 'المؤسسات والشبكات',
        forWho: 'شبكات الفروع الكبرى والحجم المرتفع',
        volume: 'أكثر من 3,000 مكالمة شهريًا',
        includes: [
          'كافة الميزات السابقة',
          'اتفاقية مستوى خدمة مخصصة (SLA)',
          'سياسات متقدمة لحفظ البيانات وعزلها',
          'مدير حساب وتشغيل مخصص لمنشأتك',
        ],
      },
    ],
    driversTitle: 'العوامل المحددة لعرض السعر بدقة',
    drivers: [
      {
        title: 'حجم المكالمات الشهرية المتوقعة',
        body: 'العامل الأساسي للتسعير، ونعتمده بناءً على متوسط آخر 3 أشهر لنشاطك لضمان أعلى كفاءة وتوفير.',
      },
      {
        title: 'عدد الفروع ومسارات الخدمة',
        body: 'إعداد مسار استقبال لفرع واحد يختلف عن إدارة وتوجيه الاتصالات لعدة فروع بأرقام متعددة.',
      },
      {
        title: 'التكامل والربط التقني المطلوب',
        body: 'ربط التقويم وواتساب مشمول دائمًا. أما التكامل مع أنظمة CRM مخصصة فيتولاه مهندسونا باحترافية.',
      },
      {
        title: 'تعدد اللهجات وتخصيص الأصوات',
        body: 'نوفر أصواتًا طبيعية متعددة، ويمكن تخصيص نبرات خاصة تماشي هوية علامتك التجارية.',
      },
    ],
    driversNote:
      'نرسل لك عرض السعر المفصل خلال يوم عمل واحد متضمنًا كافة التفاصيل التشغيلية والتكلفة الشهرية بوضوح.',
    note: 'يشمل الاشتراك كافة عمليات الإعداد والربط والاختبار المستمر من قبل فريقنا دون أي تكاليف إعداد إضافية في السيناريو الأول.',
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
    title: 'الأسئلة الشائعة وكل ما تود معرفته.',
    lead: 'إجابات واضحة ومباشرة لأبرز التساؤلات حول مُجاوِب وآلية تشغيله.',
    groups: [
      {
        title: 'عن الإعداد والتشغيل',
        items: [
          {
            q: 'كم يستغرق تجهيز وتشغيل الخدمة؟',
            a: 'من أسبوع إلى ثلاثة أسابيع بناءً على حجم نشاطك والربط المطلوب. وعادة ما يكون السيناريو الأول جاهزًا للاختبار خلال أسبوع.',
          },
          {
            q: 'هل أحتاج إلى فريق تقني أو مبرمجين من طرفي؟',
            a: 'لا على الإطلاق. نحتاج فقط معلومات خدماتك، أسعارك، فروعك، وأوقات العمل؛ ويتولى فريقنا الهندسي والتشغيلي كافة التفاصيل التقنية.',
          },
          {
            q: 'هل أحتاج إلى تغيير رقم هاتفي الحالي؟',
            a: 'لا، بل يعمل مُجاوِب مباشرة على رقمك الحالي عبر خاصية تحويل المكالمات، أو يمكننا توفير أرقام جديدة مخصصة.',
          },
        ],
      },
      {
        title: 'عن النبرة والصوت',
        items: [
          {
            q: 'هل يبدو الصوت طبيعيًا أم آليًا؟',
            a: 'الصوت طبيعي وانسيابي للغاية، ولا يتم إطلاقه إلا بعد اجتياز حزمة اختبارات عربية دقيقة تشمل الأسماء المركبة، الأرقام، والعبارات الدارجة.',
          },
          {
            q: 'كيف يتصرف الموظف الصوتي إذا قاطعه المتصل؟',
            a: 'يتوقف فورًا وبشكل طبيعي ليستمع لمتصلك، ثم يكمل الحوار بلباقة دون أي تكرار أو صمت مربك.',
          },
          {
            q: 'ما هي اللهجات المتاحة والمدعومة؟',
            a: 'ندعم اللهجات السعودية، الخليجية، المصرية، والفصحى المعاصرة، مع مرونة اختيار وتغيير النبرة حسب جمهورك المستهدف.',
          },
          {
            q: 'ماذا لو لم يتضح طلب المتصل للموظف الصوتي؟',
            a: 'يستوضح الموظف بلباقة، وإن استمر عدم الوضوح يقوم فورًا بتحويل المكالمة لموظف بشري مع تزويده بملخص الحوار.',
          },
        ],
      },
      {
        title: 'عن العمليات اليومية',
        items: [
          {
            q: 'هل يمكنه تثبيت المواعيد مباشرة في تقويمنا؟',
            a: 'نعم، يتحقق من الأوقات الشاغرة في Google Calendar أو Microsoft 365، يثبّت الموعد، ويرسل التأكيد للعميل عبر واتساب في نفس المكالمة.',
          },
          {
            q: 'ماذا يحدث في حال تعطل خدمة التقويم مؤقتًا؟',
            a: 'لا يعطي وعودًا غير مؤكدة، بل يسجل بيانات العميل بدقة ويطلب معاودة الاتصال، مع إشعارك فورًا في لوحة التحكم.',
          },
          {
            q: 'هل أستطيع إيقاف الموظف الصوتي أو تحويل الاتصالات؟',
            a: 'نعم، بكل سهولة وبضغطة زر واحدة من لوحة التحكم، حيث تتحول المكالمات مباشرة لفريقك البشري.',
          },
          {
            q: 'كيف أتابع تفاصيل ومجريات المكالمات الواردة؟',
            a: 'توفر لوحة التحكم سجلاً كاملاً لكل مكالمة: الحوار نصيًا وصوتيًا، الإجراءات المنفذة، والنتيجة النهائية مع تصنيف الحالات المستعجلة.',
          },
        ],
      },
    ],
  },
  about: {
    title: 'صنعنا مُجاوِب لنرتقي بتجربة الاتصال الصوتي العربي.',
    lead: 'لسنا مجرد أداة برمجية، بل شريك تشغيلي متكامل يطور ويختبر ويدير موظفك الصوتي لضمان تجربة اتصال استثنائية لعملائك.',
    story: [
      'لاحظنا أن معظم حلول الصوت في منطقتنا تُبنى بمجرد ترجمة حرفية لمنتجات أجنبية، فتنتج نبرة آلية مصطنعة تخطئ في نطق الأسماء العربية وتتلعثم في الأرقام وتسبب إحباطاً للمتصل.',
      'كما أن ترك إعداد الموظف الصوتي لمربعات نص عشوائية يؤدي إلى تضارب الردود وغياب الثقة التشغيلية.',
      'لذلك صممنا مُجاوِب بهندسة متقدمة مخصصة للعربية: طبقات توجيه متزنة، قواميس نطق حصرية لعلامتك، واختبارات جودة صارمة تضمن عدم إطلاق أي نسخة قبل التحقق التام من دقتها ولباقة ردودها.',
    ],
    principles: [
      {
        title: 'المصداقية أولاً: لا تأكيد بلا تنفيذ',
        body: 'الموظف الصوتي لا يؤكد أي حجز أو طلب للعميل إلا بعد تثبيته الفعلي في تقويمك وأنظمتك المعتمدة.',
      },
      {
        title: 'الجودة قياس واختبار دائم',
        body: 'نعتمد على بوابات اختبار صارمة تحاكي الواقع، وتمنع نشر أي تعديل لا يحقق أعلى معايير الدقة.',
      },
      {
        title: 'خدمة مُدارة بالكامل من أجلك',
        body: 'نتولى الإعداد والربط والمراقبة اليومية والتحسين المستمر، لنوفر وقتك وجهدك للتركيز على نمو نشاطك.',
      },
      {
        title: 'أمان ومرونة مؤسسية كاملة',
        body: 'كل تحديث يحفظ في إصدار مستقل مع إمكانية استعادة أي نسخة سابقة فورًا وضمان سرية وعزل بياناتك.',
      },
    ],
    stance: {
      title: 'مبادئنا ومسؤوليتنا',
      body: 'نلتزم بالشفافية التامة، ولا ندعي أرقاماً لم نقسها، ولا نستخدم بيانات مكالماتك لتدريب أي نماذج عامة. وإذا وجدنا أن الحل الصوتي لا يناسب حالتك، نخبرك بذلك بصدق قبل أن تبدأ.',
    },
  },
  security: {
    title: 'أنت تأتمننا على مكالمات عملائك.',
    lead: 'نلتزم بحماية بياناتك بأعلى معايير الأمان والسرية والشفافية التامة.',
    intro: [
      'بيانات مكالمات منشأتك والمتصلين بها ملكك بالكامل. نحن نعالجها بأمان لتشغيل الخدمة فقط، ولا نبيعها ولا نشاركها مع أي طرف ثالث.',
      'نؤكد التزامنا التام بعدم استخدام محتوى اتصالاتك في تدريب نماذج الذكاء الاصطناعي العامة نهائيًا.',
    ],
    practices: [
      {
        title: 'عزل تام لبيانات الشركات',
        body: 'تتمتع كل منشأة بمساحة عمل مشفرة ومعزولة كليًا على مستوى قاعدة البيانات، مما يمنع أي وصول غير مصرح به.',
      },
      {
        title: 'حماية وتشفير مفاتيح الربط',
        body: 'تُخزن مفاتيح الربط والأنظمة بصيغ مشفرة ومعقدة، ولا تظهر حتى لفريق التشغيل لدينا.',
      },
      {
        title: 'صلاحيات وصول دقيقة ومخصصة',
        body: 'تحكم محكم بالأدوار يتيح لكل عضو في فريقك الوصول للمعلومات التي يحتاجها لإنجاز مهامه فقط.',
      },
      {
        title: 'سجل تدقيق تشغيلي شامل',
        body: 'توثيق دقيق لكافة الإجراءات ونشر النسخ وتعديل الصلاحيات مع تسجيل اسم المنفذ والتوقيت.',
      },
      {
        title: 'سياسة مرنة للاحتفاظ بالبيانات',
        body: 'تتحكم بشكل كامل في فترات الاحتفاظ بالسجلات والتسجيلات الصوتية بما يتوافق مع سياسات منشأتك.',
      },
      {
        title: 'استمرارية الأعمال والتحويل الفوري',
        body: 'إمكانية إيقاف الموظف الصوتي بضغطة زر، وتوجيه المكالمات لفريقك البشري في حالات الطوارئ دون انقطاع.',
      },
    ],
    notClaimed:
      'نلتزم بأعلى معايير الحماية التقنية والامتثال للأنظمة المحلية لتنظيم الاتصالات وحماية البيانات في المملكة والخليج، ويكون تسجيل المكالمات اختياريًا وفق السياسات المعتمدة لمنشأتك.',
  },
  howItWorks: {
    title: 'رحلة الانطلاق مع مُجاوِب، خطوة بخطوة.',
    lead: 'أربع مراحل واضحة ومدروسة تضمن لك بدء استقبال المكالمات بأعلى درجات الموثوقية والاحترافية.',
    detail: [
      {
        n: '01',
        title: 'استكشاف نموذج عملك',
        body: 'جلسة استشارية نتعرف فيها على نوعية متصليك، أبرز الخدمات المطلوبة، وساعات العمل، وحالات التحويل لفريقك.',
        youDo: 'تزويدنا بمعلومات الخدمات والأسعار وساعات العمل والفروع.',
        weDo: 'صياغة خطة تشغيلية واضحة ومسارات محددة للمكالمات.',
      },
      {
        n: '02',
        title: 'بناء وتخصيص الموظف الصوتي',
        body: 'تجهيز القالب المخصص لقطاعك، تحميل المعرفة المنظمة، والربط مع التقويم وواتساب وأنظمتك المعتمدة.',
        youDo: 'اعتماد الربط التقني وصلاحيات الوصول للأنظمة.',
        weDo: 'هندسة الصوت، بناء التوجيهات، والربط المتكامل.',
      },
      {
        n: '03',
        title: 'الاختبار وضبط النبرة',
        body: 'إجراء اختبارات دقيقة على نطق الأسماء والأرقام والسيناريوهات الواقعية، مع تجربتك الحية له.',
        youDo: 'الاستماع لمكالمات تجريبية وتأكيد رضاك عن النبرة والأداء.',
        weDo: 'الضبط الدقيق للاستجابة والنطق حتى الوصول لأعلى جودة.',
      },
      {
        n: '04',
        title: 'الإطلاق والمتابعة المستمرة',
        body: 'ربط أرقامك وبدء استقبال المكالمات مع مراقبة يومية لجودة كل اتصال وتقديم تقارير دورية لأدائك.',
        youDo: 'متابعة الحجوزات والنتائج من لوحة التحكم الخاصة بك.',
        weDo: 'المراقبة المستمرة، ضمان الجودة، والتحسين الدوري.',
      },
    ],
    timeline:
      'المدة المعتادة من أول جلسة استشارية حتى بدء التشغيل الفعلي: من أسبوع إلى ثلاثة أسابيع.',
  },
}

const en: Pages = {
  contact: {
    title: 'Talk to the team.',
    lead: 'Mujawib is a managed service — we start with a call to understand your business, not a sign-up form. Pick whichever is easiest.',
    channels: [
      {
        label: 'Email',
        value: CONTACT.email,
        href: `mailto:${CONTACT.email}`,
        note: 'We reply within one working day.',
      },
      {
        label: 'Phone',
        value: CONTACT.phoneDisplay,
        href: `tel:${CONTACT.phoneE164}`,
        note: 'Sunday to Thursday, 9am – 6pm Riyadh time.',
      },
      {
        label: 'WhatsApp',
        value: CONTACT.phoneDisplay,
        href: CONTACT_WHATSAPP_URL,
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
}

const PAGES: Record<Locale, Pages> = { ar, en }

export function pagesFor(locale: Locale): Pages {
  return PAGES[locale] ?? PAGES.ar
}
