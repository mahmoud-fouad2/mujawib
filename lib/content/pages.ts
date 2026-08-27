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
  partners: {
    title: string
    lead: string
    tracksTitle: string
    tracks: { title: string; desc: string; forWho: string }[]
    benefitsTitle: string
    benefits: { title: string; desc: string }[]
    stepsTitle: string
    steps: { n: string; title: string; desc: string }[]
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
            a: 'من أسبوعين إلى ثلاثة أسابيع بناءً على حجم نشاطك وتعقيد الربط التقني المطلوب. وعادة ما نطلق النسخة التجريبية الأولى لاختبارها خلال أيام من استلام متطلباتك.',
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
      'نلتزم بالامتثال للأنظمة المحلية لتنظيم الاتصالات وحماية البيانات (PDPL) في المملكة والخليج. يُترك خيار تفعيل رسالة "هذه المكالمة مسجلة لضمان الجودة" لقرارك وحسب سياسات منشأتك الداخلية.',
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
      'المدة القياسية من الجلسة الأولى حتى إطلاق أول مكالمة حقيقية: من 5 إلى 14 يوم عمل حسب حجم الربط والسيناريوهات.',
  },
  partners: {
    title: 'شركاء النجاح: معاً نصنع مستقبل الأعمال.',
    lead: 'نؤمن بقوة التعاون. إذا كنت وكالة تسويق، أو شركة استشارات، أو مزود حلول تقنية، دعنا نتعاون لتقديم تجربة اتصال استثنائية لعملائك ومضاعفة أرباحهم عبر حلول "مُجاوِب" للذكاء الاصطناعي الصوتي.',
    tracksTitle: 'مسارات الشراكة والتعاون',
    tracks: [
      {
        title: 'شريك الإحالة (Referral Partner)',
        desc: 'أوصِ بـ "مُجاوِب" لعملائك أو شبكة معارفك واحصل على نسبة عمولة شهرية مجزية ومستمرة طوال فترة اشتراك العميل.',
        forWho: 'المستشارون، وصناع المحتوى، وخبراء تحسين العمليات.',
      },
      {
        title: 'شريك الوكالات (Agency & Solutions)',
        desc: 'قدّم حلول الاستقبال الصوتي الذكي كخدمة مضافة لعملائك مع أسعار تفضيلية ودعم فني مخصص لتنفيذ مشاريعهم.',
        forWho: 'وكالات التسويق، شركات التحول الرقمي، ومطورو الحلول البرمجية.',
      },
      {
        title: 'شريك التكامل والتقنية (Technology Partner)',
        desc: 'اربط برمجياتك (CRM، أنظمة ERP، منصات إدارة العيادات والمطاعم) بـ "مُجاوِب" لتوفير استقبال صوتي فوري لعملائك.',
        forWho: 'شركات SaaS ومنصات إدارة المنشآت الطبية والتجارية.',
      },
    ],
    benefitsTitle: 'لماذا تنضم لبرنامج شركاء مُجاوِب؟',
    benefits: [
      {
        title: 'عوائد شهرية متكررة (Recurring Revenue)',
        desc: 'نموذج أرباح شفاف ومستمر ينمو شهرياً مع كل عميل يستمر في استخدام الخدمة.',
      },
      {
        title: 'بيئة تجريبية وأولوية في الدعم الفني',
        desc: 'حساب تجريبي (Sandbox) مجاني لعرض تجارب المكالمات الحية أمام عملائك، مع قناة دعم هندسي مباشرة.',
      },
      {
        title: 'مواد بيعية وتدريب مخصص',
        desc: 'نزودك بعروض توضيحية، دراسات حالة موثقة، وجلسات تدريبية لفريقك لمساعدتك في إغلاق الصفقات بسهولة.',
      },
      {
        title: 'خدمة مُدارة بالكامل (نحن نتولى التشغيل)',
        desc: 'أنت تكسب العميل وتبني العلاقة، ونحن نتكفل بالربط البرمجي، وهندسة الصوت، وضمان الجودة 24/7.',
      },
    ],
    stepsTitle: 'كيف تصبح شريكاً معنا؟',
    steps: [
      {
        n: '01',
        title: 'تقديم طلب الشراكة',
        desc: 'أرسل بياناتك ونبذة عن خدماتك وقاعدة عملائك عبر نموذج التواصل.',
      },
      {
        n: '02',
        title: 'جلسة التوافق وتحديد المسار',
        desc: 'مكالمة سريعة لمدة 20 دقيقة لتحديد مسار الشراكة المناسب ونسب العمولات.',
      },
      {
        n: '03',
        title: 'بدء التفعيل وتحقيق الأرباح',
        desc: 'استلم حسابك والمواد الترويجية وابدأ فوراً في ترشيح العملاء وتوليد العوائد.',
      },
    ],
    ctaTitle: 'جاهز لتقديم حلول الذكاء الصوتي لعملائك؟',
    ctaBody:
      'انضم لبرنامج الشركاء اليوم واجعل منشأتك في صدارة الشركات المقدمة لأحدث تقنيات الصوت في المنطقة.',
    ctaButton: 'قدّم طلب الانضمام للشركاء',
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
  partners: {
    title: 'Partners in Success: Shaping the Future of Business.',
    lead: 'We believe in the power of collaboration. Whether you are a marketing agency, a consulting firm, or a tech provider, let’s partner to deliver exceptional voice AI experiences to your clients and boost their revenue with Mujawib.',
    tracksTitle: 'Partnership Tracks',
    tracks: [
      {
        title: 'Referral Partner',
        desc: 'Recommend Mujawib to your clients and earn generous, recurring monthly commissions for the lifetime of their subscription.',
        forWho: 'Consultants, business advisors, and digital agencies.',
      },
      {
        title: 'Agency & Solution Partner',
        desc: 'Offer voice AI reception as an added-value service to your clients with preferred wholesale rates and dedicated technical support.',
        forWho: 'Marketing agencies, digital consultancies, and systems integrators.',
      },
      {
        title: 'Technology Partner',
        desc: 'Integrate your software (CRM, ERP, clinic and salon booking systems) with Mujawib to deliver seamless voice experiences to your users.',
        forWho: 'SaaS vendors and business management platforms.',
      },
    ],
    benefitsTitle: 'Why Partner with Mujawib?',
    benefits: [
      {
        title: 'Recurring Monthly Revenue',
        desc: 'A predictable, compounding revenue share model that grows as your referred clients scale.',
      },
      {
        title: 'Sandbox & Priority Support',
        desc: 'Free demo environments to showcase live AI calls to your prospects, backed by direct engineering support.',
      },
      {
        title: 'Co-marketing & Sales Enablement',
        desc: 'Access sales collateral, pitch decks, case studies, and partner training sessions to close deals faster.',
      },
      {
        title: '100% Done-for-You Delivery',
        desc: 'You bring the client relationship; our engineering team handles prompt tuning, API integration, and 24/7 quality assurance.',
      },
    ],
    stepsTitle: 'How to Get Started',
    steps: [
      {
        n: '01',
        title: 'Submit Application',
        desc: 'Tell us about your company, services, and current client base.',
      },
      {
        n: '02',
        title: 'Discovery & Alignment',
        desc: 'A brief 20-minute call to agree on commercial terms and choose the right partner track.',
      },
      {
        n: '03',
        title: 'Launch & Earn',
        desc: 'Receive your partner assets, start introducing clients, and earn recurring revenue.',
      },
    ],
    ctaTitle: 'Ready to deliver voice AI to your clients?',
    ctaBody: 'Join the Mujawib partner program today and stay ahead of the technology curve.',
    ctaButton: 'Apply for Partnership',
  },
}

const PAGES: Record<Locale, Pages> = { ar, en }

export function pagesFor(locale: Locale): Pages {
  return PAGES[locale] ?? PAGES.ar
}
