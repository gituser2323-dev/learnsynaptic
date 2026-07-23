/**
 * Centralized translation object for the /ai-generalist "AI for Business"
 * bootcamp page. One object, keyed by language — add a new language by
 * adding a new key here that satisfies the `Translation` shape below.
 * Brand/tool names (ChatGPT, WhatsApp, n8n, etc.) are treated as proper
 * nouns and kept in Latin script across all languages, matching how they
 * are actually referred to in Indian business conversation.
 */

export type Lang = "en" | "hi" | "mr";

export const SUPPORTED_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
];

export const DEFAULT_LANG: Lang = "en";
export const LANG_STORAGE_KEY = "aig-language";

interface AwarenessItem {
  headline: string;
  description: string;
}

interface WorkflowContent {
  label: string;
  why: string[];
}

interface AudienceItemContent {
  label: string;
  headline: string;
  description: string;
  outcome: string;
}

interface BonusItemContent {
  text: string;
  value: string;
}

interface DayContent {
  label: string;
  problem: string;
  solution: string;
  tech: string;
  project: string;
}

interface FaqItemContent {
  q: string;
  a: string;
}

export interface Translation {
  meta: {
    title: string;
    description: string;
    ogDescription: string;
  };
  hero: {
    badgePrefix: string;
    eyebrow: string;
    h1Line1: string;
    h1Line2: string;
    subhead: string;
    checklist: string[];
    ctaPrimary: string;
    ctaWhatsapp: string;
    note: string;
    badges: string[];
    founderCaption: string;
    founderTitle: string;
  };
  dates: {
    months: string[];
    saturday: string;
  };
  awareness: {
    headline: string;
    items: AwarenessItem[];
  };
  problem: {
    headline1: string;
    headline2: string;
    subcopy: string;
    mostLabel: string;
    mostCaption: string;
    smartLabel: string;
    smartCaption: string;
    buildQuestion: string;
    workflows: Record<string, WorkflowContent>;
    closingHeadline1: string;
    closingHeadline2: string;
    closingBody: string;
  };
  founder: {
    kicker: string;
    heading: string;
    subcopy: string;
    founderName: string;
    ctaHeadline: string;
    ctaSubcopy: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  audience: {
    headline: string;
    items: AudienceItemContent[];
    backwardsHeadline: string;
    traditionalLabel: string;
    traditionalItems: string[];
    modernLabel: string;
    modernItems: string[];
  };
  projects: {
    headline: string;
    subcopy: string;
    items: string[];
    curriculumHeadline: string;
    problemLabel: string;
    solutionLabel: string;
    techLabel: string;
    buildLabel: string;
    days: DayContent[];
  };
  bonuses: {
    quote: string;
    body: string;
    founderName: string;
    founderTitle: string;
    headline: string;
    subcopy: string;
    items: BonusItemContent[];
    totalLabel: string;
    totalValue: string;
    disclaimer: string;
    priceLabel: string;
    priceValue: string;
  };
  faq: {
    headline: string;
    items: FaqItemContent[];
    capHeadline: string;
    capBody: string;
    finalHeadline1: string;
    finalHeadline2: string;
    finalSubcopy: string;
    finalCta: string;
    finalCtaWhatsapp: string;
    finalFooter: string;
  };
  floatingCta: {
    title: string;
    cohortLabel: string;
    daysLabel: string;
    hrsLabel: string;
    minLabel: string;
    seatsSuffix: string;
    cta: string;
    timeLabel: string;
  };
  registration: {
    badge: string;
    heading1: string;
    heading2: string;
    subcopy: string;
    phonePlaceholder: string;
    namePlaceholder: string;
    submitIdle: string;
    submitting: string;
    errorMsg: string;
    disclaimer: string;
    phoneRequired: string;
    phoneInvalid: string;
    orDivider: string;
  };
  success: {
    greetingPrefix: string;
    greetingFallback: string;
    welcome: string;
    lastStepTitle: string;
    lastStepBody: string;
    benefits: string[];
    joinCta: string;
    laterCta: string;
  };
}

const en: Translation = {
  meta: {
    title: "FREE 7-Day AI for Business Bootcamp — LearnSynaptic",
    description:
      "AI is no longer optional. It's essential. Join LearnSynaptic's free 7-day live AI for Business Bootcamp and get back 10+ hours a week with zero coding.",
    ogDescription:
      "Most business owners consume AI content. Very few use it to run their business. This free 7-day live bootcamp helps you become one of them — zero coding required.",
  },
  hero: {
    badgePrefix: "FREE · AI FOR BUSINESS BOOTCAMP",
    eyebrow: "AI FOR BUSINESS ACADEMY",
    h1Line1: "AI Is No Longer Optional.",
    h1Line2: "It's Essential.",
    subhead:
      "Most business owners consume AI content. Very few use it to run their business. This free 7-day live bootcamp helps you become one of them.",
    checklist: [
      "Worth ₹10,000+ • Free This Cohort",
      "Zero Coding. Zero Jargon. Just Results.",
      "7 Real Business Automations You Keep",
    ],
    ctaPrimary: "Register Free",
    ctaWhatsapp: "Join Community",
    note: "No spam. Only AI resources, event reminders and bootcamp updates.",
    badges: ["AI For Business", "Built 20+ Business Automations", "ChatGPT • Claude • Gemini"],
    founderCaption: "- with Pratik S",
    founderTitle: "Co-Founder at LearnSynaptic | AI Business Mentor",
  },
  dates: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    saturday: "Saturday",
  },
  awareness: {
    headline: "Do you feel like AI is passing your business by?",
    items: [
      {
        headline: "Still Doing Everything Manually?",
        description:
          "You're spending hours every week on replies, content and admin that AI could finish in minutes.",
      },
      {
        headline: "Overwhelmed By AI Tools?",
        description:
          "ChatGPT, Claude, Gemini, automation apps — you don't know which ones actually move your business forward.",
      },
      {
        headline: "Watching Competitors Move Faster?",
        description:
          "Other businesses are already using AI to save time and close more deals. The gap grows every week you wait.",
      },
    ],
  },
  problem: {
    headline1: "We Don't Teach AI Tools.",
    headline2: "We Teach You To Run Your Business With AI.",
    subcopy:
      "Anyone can open ChatGPT and ask a question. Smart business owners use AI to save time, cut costs and grow revenue — every single day. LearnSynaptic teaches you exactly how.",
    mostLabel: "Most Business Owners",
    mostCaption: "Uses one AI for everything, then gives up when it doesn't fit their business.",
    smartLabel: "Smart Business Owners",
    smartCaption: "Chooses the right AI system for every part of their business.",
    buildQuestion: "What do you want to automate?",
    workflows: {
      marketing: {
        label: "Marketing",
        why: [
          "Drafts your first ideas and captions in seconds.",
          "Turns those ideas into on-brand marketing copy at scale.",
          "Generates the social graphics to go with it.",
          "Polishes the final post and gets it ready to publish.",
        ],
      },
      sales: {
        label: "Sales",
        why: [
          "Researches a prospect before you ever pick up the phone.",
          "Drafts a custom proposal in minutes, not hours.",
          "Turns that draft into a proposal deck that looks the part.",
          "Sends it out and gets it signed without the back-and-forth.",
        ],
      },
      support: {
        label: "Support",
        why: [
          "Where your customers are already messaging you.",
          "Answers the questions that repeat, day and night.",
          "Handles the judgment calls a script alone can't.",
          "Logs every conversation straight into your CRM.",
        ],
      },
      automation: {
        label: "Automation",
        why: [
          "Wires your apps together into one visual workflow.",
          "Handles the no-code automations n8n doesn't.",
          "Connects the tools you already use in a few clicks.",
          "Adds judgment — reading, deciding, writing — inside it.",
        ],
      },
      reporting: {
        label: "Reporting",
        why: [
          "Turns a messy week of updates into a clean summary.",
          "Keeps your SOPs and knowledge organized in one place.",
          "Tracks the numbers your business actually runs on.",
          "Turns that data into a report you can actually share.",
        ],
      },
    },
    closingHeadline1: "The biggest mistake business owners make?",
    closingHeadline2: "Trying to learn every AI tool.",
    closingBody:
      "In our bootcamp, you won't memorize 50 apps. You'll learn exactly which ones save you time — and how to plug them straight into your business.",
  },
  founder: {
    kicker: "That's Why We Created",
    heading: "The 7-Day AI for Business Bootcamp",
    subcopy:
      "Not just how to chat with AI — how to turn it into a system that saves you hours, cuts busywork, and helps your business grow.",
    founderName: "Pratik Sabale, Co-Founder",
    ctaHeadline: "Stop Guessing. Start Running Your Business With AI.",
    ctaSubcopy:
      "Master the tools that matter through real business projects — content, sales, support and operations. No fluff, no theory.",
    ctaPrimary: "Explore the AI for Business Bootcamp →",
    ctaSecondary: "See What You'll Automate",
  },
  audience: {
    headline: "Who is this Bootcamp for?",
    items: [
      {
        label: "Run a business?",
        headline: "Business Owners",
        description:
          "Stop trading hours for output. Use AI to handle content, replies and admin — so your time goes to the decisions only you can make.",
        outcome: "Get back 10+ hours a week",
      },
      {
        label: "Building something new?",
        headline: "Founders & Entrepreneurs",
        description:
          "You're doing five jobs at once. Hand the repetitive ones to AI, and put your energy into the parts only you can grow.",
        outcome: "Do more with a smaller team",
      },
      {
        label: "Chasing targets?",
        headline: "Sales & Marketing Teams",
        description:
          "Follow-ups, content, proposals, campaigns — automate the repetitive parts of the funnel and spend your energy closing deals.",
        outcome: "More output, same headcount",
      },
      {
        label: "Working solo?",
        headline: "Freelancers & Consultants",
        description:
          "Operate like a bigger team. Automate client communication, proposals and admin — and take on more clients without burning out.",
        outcome: "Scale without hiring",
      },
    ],
    backwardsHeadline: "You've Been Taught AI Backwards.",
    traditionalLabel: "Traditional Learning",
    traditionalItems: [
      "Bookmarked AI tutorials, never used them",
      "Copy-pasted prompts, no real system",
      "A different app every week",
      "No automation to show for it",
      "Still doing everything manually",
      "No idea where to even start",
    ],
    modernLabel: "LearnSynaptic",
    modernItems: [
      "Live, working automations every session",
      "Seven real business systems, shipped",
      "Built around your business from day one",
      "The workflows real business owners use",
      "Automations you keep running",
      "Built for your next stage of growth",
    ],
  },
  projects: {
    headline: "Eight Systems. Zero Guesswork.",
    subcopy: "Every one built for your business, working, and yours to keep running.",
    items: [
      "AI Sales Assistant",
      "AI Marketing Content Generator",
      "WhatsApp Business Assistant",
      "Customer Support Bot",
      "Proposal Generator",
      "Invoice Automation",
      "Email Automation System",
      "Meeting Notes Assistant",
    ],
    curriculumHeadline: "Seven Days. Seven Systems.",
    problemLabel: "Problem",
    solutionLabel: "Solution",
    techLabel: "What You'll Learn",
    buildLabel: "You'll Build",
    days: [
      {
        label: "Day 01",
        problem:
          "Everyone can open ChatGPT and ask a question. That's not what saves a business time anymore — knowing how to use AI on purpose is. Today you'll see exactly which parts of your business are ready to be automated.",
        solution:
          "Get the fundamentals first: ChatGPT vs Claude vs Gemini, how to prompt for business results (not generic answers), and a simple framework for spotting the repetitive tasks in your business worth automating.",
        tech: "AI for Business Basics, ChatGPT, Claude, Gemini, Business Prompt Engineering, Spotting Automation Opportunities",
        project: "Your First AI Business Assistant",
      },
      {
        label: "Day 02",
        problem:
          "Content eats hours every week — social posts, emails, ads — and most of it still starts from a blank page. That's time you could spend on the parts of the business only you can run.",
        solution:
          "Build your AI content engine: prompting for your brand voice, generating a week of social posts and ad copy in one sitting, and a content calendar AI keeps filled for you.",
        tech: "AI Content Writing, Brand Voice Prompting, Content Calendars, Ad Copy Generation, Marketing Prompts",
        project: "AI Marketing Content Generator",
      },
      {
        label: "Day 03",
        problem:
          "Your customers are messaging you on WhatsApp right now, asking the same five questions they always ask. Every one of those messages is time you're not spending on the work only you can do.",
        solution:
          "Build an AI WhatsApp assistant that answers FAQs, qualifies leads, and stays online 24/7 — so the repeat questions stop landing on your phone.",
        tech: "WhatsApp Automation, AI Customer Support, Chatbot Building, FAQ Automation, Lead Qualification",
        project: "WhatsApp Business Assistant",
      },
      {
        label: "Day 04",
        problem:
          "Deals go cold waiting on a follow-up. Proposals that should take twenty minutes take half a day. Every hour spent on the paperwork of selling is an hour not spent selling.",
        solution:
          "Build an AI sales assistant that qualifies leads and drafts a custom, on-brand proposal in minutes — so you follow up while the deal is still warm.",
        tech: "Sales Automation, AI Sales Assistant, Proposal Generation, Lead Scoring, Follow-Up Automation",
        project: "AI Sales Assistant + Proposal Generator",
      },
      {
        label: "Day 05",
        problem:
          "Invoices, emails, paperwork — the admin pile grows every week whether or not you have time for it. None of it grows your business; all of it costs your time.",
        solution:
          "Automate the paperwork end to end: invoice generation, email sequences that send themselves, and document templates that fill themselves in.",
        tech: "Invoice Automation, Email Automation, Document Automation, Template Systems, Approval Workflows",
        project: "Invoice & Email Automation System",
      },
      {
        label: "Day 06",
        problem:
          "A meeting ends and the notes go with it. An SOP lives in one person's head instead of your systems. None of that scales past you.",
        solution:
          "Build a meeting notes assistant that captures action items automatically, an SOP generator that turns 'how we do it' into a document anyone can follow, and a simple dashboard that shows what's happening at a glance.",
        tech: "Meeting Notes Automation, SOP Generation, Business Dashboards, HR Automation, Productivity Workflows",
        project: "Meeting Notes Assistant + SOP Generator",
      },
      {
        label: "Day 07",
        problem:
          "Tools without a system don't scale — they just become five more apps you have to remember to check. What actually compounds is a roadmap.",
        solution:
          "Walk away with a complete AI adoption roadmap for your business: how to systemize what you built this week, bring your team up to speed, and keep finding the next process worth automating.",
        tech: "AI Adoption Roadmap, Team Training, Systemizing Automations, Scaling With AI, Measuring ROI",
        project: "Your Complete AI Business System",
      },
    ],
  },
  bonuses: {
    quote:
      "\"I met too many business owners drowning in busywork they could have automated in an afternoon. So we built the cohort I wish existed for every founder I've mentored.\"",
    body: "No slide decks. No generic AI hype. Every class ends with a system you can turn on the same day.",
    founderName: "Pratik Sabale",
    founderTitle: "Founder · AI Business Mentor · Software Engineer",
    headline: "Everything You Need. Nothing You Don't.",
    subcopy: "Usually sold separately. Included here, free.",
    items: [
      { text: "7 Days of Live Sessions", value: "₹3,000" },
      { text: "1:1 Mentorship", value: "₹2,000" },
      { text: "Business Automation Toolkit", value: "₹2,000" },
      { text: "Prompt & Template Library", value: "₹1,000" },
      { text: "Community Access", value: "₹2,000" },
    ],
    totalLabel: "Estimated Learning Value",
    totalValue: "₹10,000",
    disclaimer:
      "Estimate based on typical market pricing for comparable live cohorts, templates and resources — shown for context, not a discount claim.",
    priceLabel: "Your Price Today",
    priceValue: "Free",
  },
  faq: {
    headline: "Frequently Asked Questions",
    items: [
      {
        q: "Do I need any coding or technical skills?",
        a: "None. Every tool we use is point-and-click — built for business owners, not developers.",
      },
      {
        q: "Is this beginner friendly?",
        a: "Yes. Built for business owners, founders and teams with zero AI experience.",
      },
      {
        q: "Will recordings be available?",
        a: "Yes — every session is recorded and posted in the WhatsApp community.",
      },
      {
        q: "Do we build real automations?",
        a: "Every day ends with a working system for your business — not a slide deck.",
      },
      {
        q: "How is this different from generic AI courses?",
        a: "A mentor reviews what you build. Generic courses don't.",
      },
    ],
    capHeadline: "Why We Cap Every Cohort",
    capBody:
      "Every automation gets reviewed live. Every question gets answered on the spot. That only works in a small room — so registration closes once the cohort fills. No countdown gimmicks. Just a simple fact: the sooner you join, the sooner Day 1 starts.",
    finalHeadline1: "The Best Time To Start Was Yesterday.",
    finalHeadline2: "The Next Best Time Is Today.",
    finalSubcopy: "Cohort starts {date}. Seats close when it's full.",
    finalCta: "Start Automating Free",
    finalCtaWhatsapp: "Join WhatsApp Community",
    finalFooter: "learnsynaptic.com · #AIForBusinessCohort",
  },
  floatingCta: {
    title: "7-Day AI for Business Bootcamp",
    cohortLabel: "Upcoming Live Cohort",
    daysLabel: "Days",
    hrsLabel: "Hrs",
    minLabel: "Min",
    seatsSuffix: "Seats Reserved",
    cta: "Reserve My Free Seat →",
    timeLabel: "8:30 PM Onwards",
  },
  registration: {
    badge: "FREE · 7-DAY AI FOR BUSINESS BOOTCAMP",
    heading1: "Claim My",
    heading2: "Free Seat",
    subcopy: "Enter your WhatsApp number and we'll send you everything you need for Day 1.",
    phonePlaceholder: "WhatsApp Number *",
    namePlaceholder: "Full Name (optional)",
    submitIdle: "Claim My Free Seat",
    submitting: "Submitting...",
    errorMsg:
      "Something went wrong sending your registration. Please try again — your details are still filled in.",
    disclaimer: "By continuing, you agree to receive bootcamp updates via WhatsApp.",
    phoneRequired: "WhatsApp number is required.",
    phoneInvalid: "Enter a valid Indian mobile number.",
    orDivider: "OR",
  },
  success: {
    greetingPrefix: "You're In,",
    greetingFallback: "Registration Successful",
    welcome: "You're all set!",
    lastStepTitle: "Next Step",
    lastStepBody: "Join our WhatsApp Community to receive:",
    benefits: ["Zoom Links", "Daily Resources", "Session Reminders", "Assignments", "Announcements"],
    joinCta: "Join Community",
    laterCta: "Maybe Later",
  },
};

const hi: Translation = {
  meta: {
    title: "फ्री 7-दिन का AI फॉर बिज़नेस बूटकैंप — LearnSynaptic",
    description:
      "अब AI एक विकल्प नहीं, अनिवार्य है। LearnSynaptic के फ्री 7-दिन लाइव AI फॉर बिज़नेस बूटकैंप से जुड़ें और बिना कोडिंग के हफ़्ते में 10+ घंटे वापस पाएं।",
    ogDescription:
      "ज़्यादातर बिज़नेस ओनर्स सिर्फ़ AI कंटेंट देखते हैं। बहुत कम लोग इसे अपने बिज़नेस में इस्तेमाल करते हैं। यह फ्री 7-दिन का लाइव बूटकैंप आपको उनमें से एक बनाता है — बिना किसी कोडिंग के।",
  },
  hero: {
    badgePrefix: "फ्री · AI फॉर बिज़नेस बूटकैंप",
    eyebrow: "AI फॉर बिज़नेस अकैडमी",
    h1Line1: "AI अब कोई विकल्प नहीं है।",
    h1Line2: "यह अनिवार्य है।",
    subhead:
      "ज़्यादातर बिज़नेस ओनर्स सिर्फ़ AI के बारे में पढ़ते हैं। बहुत कम लोग इसे अपने बिज़नेस में इस्तेमाल करते हैं। यह फ्री 7-दिन का लाइव बूटकैंप आपको उनमें से एक बनाता है।",
    checklist: [
      "₹10,000+ की वैल्यू • इस बैच के लिए फ्री",
      "ज़ीरो कोडिंग। ज़ीरो जार्गन। सिर्फ़ रिज़ल्ट।",
      "7 असली बिज़नेस ऑटोमेशन, जो आपके पास रहेंगे",
    ],
    ctaPrimary: "मेरी फ्री सीट पक्की करें",
    ctaWhatsapp: "कम्युनिटी जॉइन करें",
    note: "कोई स्पैम नहीं। सिर्फ़ AI रिसोर्स, इवेंट रिमाइंडर और बूटकैंप अपडेट।",
    badges: ["AI फॉर बिज़नेस", "20+ बिज़नेस ऑटोमेशन बनाए", "ChatGPT • Claude • Gemini"],
    founderCaption: "- with Pratik S",
    founderTitle: "Co-Founder, LearnSynaptic | AI बिज़नेस मेंटर",
  },
  dates: {
    months: [
      "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
      "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    ],
    saturday: "शनिवार",
  },
  awareness: {
    headline: "क्या आपको लगता है कि AI आपके बिज़नेस को पीछे छोड़ रहा है?",
    items: [
      {
        headline: "अभी भी सब कुछ मैन्युअली कर रहे हैं?",
        description: "आप हर हफ़्ते रिप्लाई, कंटेंट और एडमिन के काम में घंटों लगा रहे हैं, जो AI मिनटों में कर सकता है।",
      },
      {
        headline: "AI टूल्स से कन्फ्यूज़ हैं?",
        description:
          "ChatGPT, Claude, Gemini, ऑटोमेशन ऐप्स — आपको नहीं पता कि कौन-सा वाकई आपके बिज़नेस को आगे बढ़ाता है।",
      },
      {
        headline: "देख रहे हैं कि प्रतिस्पर्धी आगे निकल रहे हैं?",
        description:
          "बाकी बिज़नेस पहले से AI से समय बचा रहे हैं और ज़्यादा डील्स क्लोज़ कर रहे हैं। हर हफ़्ते इंतज़ार करने पर यह फ़र्क़ बढ़ता ही जाता है।",
      },
    ],
  },
  problem: {
    headline1: "हम AI टूल्स नहीं सिखाते।",
    headline2: "हम आपको AI से बिज़नेस चलाना सिखाते हैं।",
    subcopy:
      "कोई भी ChatGPT खोलकर सवाल पूछ सकता है। समझदार बिज़नेस ओनर्स हर दिन AI से समय बचाते हैं, खर्च घटाते हैं और रेवेन्यू बढ़ाते हैं। LearnSynaptic आपको बिल्कुल यही सिखाता है।",
    mostLabel: "ज़्यादातर बिज़नेस ओनर्स",
    mostCaption: "एक ही AI से सब कुछ करने की कोशिश करते हैं, फिर जब वह उनके बिज़नेस के लिए काम नहीं करता तो छोड़ देते हैं।",
    smartLabel: "स्मार्ट बिज़नेस ओनर्स",
    smartCaption: "अपने बिज़नेस के हर हिस्से के लिए सही AI सिस्टम चुनते हैं।",
    buildQuestion: "आप क्या ऑटोमेट करना चाहते हैं?",
    workflows: {
      marketing: {
        label: "मार्केटिंग",
        why: [
          "सेकंड्स में आपके पहले आइडिया और कैप्शन तैयार करता है।",
          "उन आइडिया को बड़े पैमाने पर आपके ब्रांड जैसी मार्केटिंग कॉपी में बदलता है।",
          "उसके साथ जाने वाली सोशल मीडिया ग्राफ़िक्स बनाता है।",
          "फ़ाइनल पोस्ट को पॉलिश करके पब्लिश के लिए तैयार करता है।",
        ],
      },
      sales: {
        label: "सेल्स",
        why: [
          "आपके फ़ोन उठाने से पहले ही प्रॉस्पेक्ट के बारे में रिसर्च कर लेता है।",
          "घंटों नहीं, मिनटों में कस्टम प्रपोज़ल का ड्राफ़्ट तैयार करता है।",
          "उस ड्राफ़्ट को एक प्रोफ़ेशनल दिखने वाले प्रपोज़ल डेक में बदलता है।",
          "बिना बार-बार आगे-पीछे किए उसे भेजकर साइन करवाता है।",
        ],
      },
      support: {
        label: "सपोर्ट",
        why: [
          "जहाँ आपके कस्टमर्स पहले से ही मैसेज कर रहे हैं।",
          "बार-बार पूछे जाने वाले सवालों के जवाब दिन-रात देता है।",
          "उन फ़ैसलों को संभालता है जो सिर्फ़ स्क्रिप्ट से नहीं हो सकते।",
          "हर बातचीत को सीधे आपके CRM में दर्ज करता है।",
        ],
      },
      automation: {
        label: "ऑटोमेशन",
        why: [
          "आपके सारे ऐप्स को एक विज़ुअल वर्कफ़्लो में जोड़ता है।",
          "जो ऑटोमेशन n8n नहीं कर पाता, वह Make संभालता है।",
          "आपके मौजूदा टूल्स को कुछ ही क्लिक में कनेक्ट करता है।",
          "इसके अंदर सही फ़ैसला लेने, पढ़ने और लिखने की समझ जोड़ता है।",
        ],
      },
      reporting: {
        label: "रिपोर्टिंग",
        why: [
          "हफ़्ते भर के अपडेट्स को एक साफ़ समरी में बदलता है।",
          "आपके SOP और जानकारी को एक जगह व्यवस्थित रखता है।",
          "उन नंबरों को ट्रैक करता है जिन पर आपका बिज़नेस चलता है।",
          "उस डेटा को एक ऐसी रिपोर्ट में बदलता है जिसे आप शेयर कर सकें।",
        ],
      },
    },
    closingHeadline1: "बिज़नेस ओनर्स की सबसे बड़ी गलती?",
    closingHeadline2: "हर AI टूल सीखने की कोशिश करना।",
    closingBody:
      "हमारे बूटकैंप में आपको 50 ऐप्स रटने नहीं पड़ेंगे। आप सीखेंगे कि कौन-से टूल्स वाकई आपका समय बचाते हैं — और उन्हें सीधे अपने बिज़नेस में कैसे जोड़ें।",
  },
  founder: {
    kicker: "इसीलिए हमने बनाया",
    heading: "7-दिन का AI फॉर बिज़नेस बूटकैंप",
    subcopy:
      "सिर्फ़ AI से बात करना नहीं — बल्कि इसे एक ऐसा सिस्टम बनाना जो आपके घंटे बचाए, बेकार का काम कम करे, और आपके बिज़नेस को बढ़ाए।",
    founderName: "प्रतीक साबले, को-फ़ाउंडर",
    ctaHeadline: "अंदाज़ा लगाना बंद करें। AI से अपना बिज़नेस चलाना शुरू करें।",
    ctaSubcopy:
      "असली बिज़नेस प्रोजेक्ट्स के ज़रिए ज़रूरी टूल्स सीखें — कंटेंट, सेल्स, सपोर्ट और ऑपरेशंस। न कोई फ़्लफ़, न कोई थ्योरी।",
    ctaPrimary: "AI फॉर बिज़नेस बूटकैंप देखें →",
    ctaSecondary: "देखें आप क्या ऑटोमेट करेंगे",
  },
  audience: {
    headline: "यह बूटकैंप किसके लिए है?",
    items: [
      {
        label: "बिज़नेस चलाते हैं?",
        headline: "बिज़नेस ओनर्स",
        description:
          "घंटों को आउटपुट के बदले देना बंद करें। कंटेंट, रिप्लाई और एडमिन के लिए AI का इस्तेमाल करें — ताकि आपका समय सिर्फ़ उन फ़ैसलों में लगे जो सिर्फ़ आप ले सकते हैं।",
        outcome: "हफ़्ते में 10+ घंटे वापस पाएं",
      },
      {
        label: "कुछ नया बना रहे हैं?",
        headline: "फ़ाउंडर्स और एंटरप्रेन्योर्स",
        description:
          "आप एक साथ पाँच काम संभाल रहे हैं। रिपीट होने वाले काम AI को सौंपें, और अपनी एनर्जी उन हिस्सों में लगाएं जिन्हें सिर्फ़ आप बढ़ा सकते हैं।",
        outcome: "छोटी टीम से ज़्यादा काम करें",
      },
      {
        label: "टारगेट पीछे भाग रहे हैं?",
        headline: "सेल्स और मार्केटिंग टीम्स",
        description:
          "फ़ॉलो-अप, कंटेंट, प्रपोज़ल, कैंपेन — फ़नल के रिपीट होने वाले हिस्सों को ऑटोमेट करें और अपनी एनर्जी डील क्लोज़ करने में लगाएं।",
        outcome: "वही टीम, ज़्यादा आउटपुट",
      },
      {
        label: "अकेले काम करते हैं?",
        headline: "फ़्रीलांसर्स और कंसल्टेंट्स",
        description:
          "बड़ी टीम की तरह काम करें। क्लाइंट कम्युनिकेशन, प्रपोज़ल और एडमिन ऑटोमेट करें — और बिना बर्नआउट हुए ज़्यादा क्लाइंट्स लें।",
        outcome: "बिना हायरिंग के स्केल करें",
      },
    ],
    backwardsHeadline: "आपको AI उल्टा तरीके से सिखाया गया है।",
    traditionalLabel: "पारंपरिक तरीका",
    traditionalItems: [
      "AI ट्यूटोरियल्स सेव किए, कभी इस्तेमाल नहीं किए",
      "प्रॉम्प्ट कॉपी-पेस्ट किए, कोई असली सिस्टम नहीं",
      "हर हफ़्ते एक नया ऐप",
      "दिखाने के लिए कोई ऑटोमेशन नहीं",
      "अभी भी सब कुछ मैन्युअली",
      "शुरुआत कहाँ से करें, यह भी पता नहीं",
    ],
    modernLabel: "LearnSynaptic",
    modernItems: [
      "हर सेशन में लाइव, काम करने वाला ऑटोमेशन",
      "सात असली बिज़नेस सिस्टम, बनाकर तैयार",
      "पहले दिन से आपके बिज़नेस के हिसाब से बनाया गया",
      "वही वर्कफ़्लो जो असली बिज़नेस ओनर्स इस्तेमाल करते हैं",
      "ऐसे ऑटोमेशन जो आप चलाते रहेंगे",
      "आपकी अगली ग्रोथ स्टेज के लिए बनाया गया",
    ],
  },
  projects: {
    headline: "आठ सिस्टम। ज़ीरो अंदाज़ा।",
    subcopy: "हर एक आपके बिज़नेस के लिए बनाया गया, काम करने वाला, और हमेशा के लिए आपका।",
    items: [
      "AI सेल्स असिस्टेंट",
      "AI मार्केटिंग कंटेंट जनरेटर",
      "व्हाट्सएप बिज़नेस असिस्टेंट",
      "कस्टमर सपोर्ट बॉट",
      "प्रपोज़ल जनरेटर",
      "इनवॉइस ऑटोमेशन",
      "ईमेल ऑटोमेशन सिस्टम",
      "मीटिंग नोट्स असिस्टेंट",
    ],
    curriculumHeadline: "सात दिन। सात सिस्टम।",
    problemLabel: "समस्या",
    solutionLabel: "समाधान",
    techLabel: "आप क्या सीखेंगे",
    buildLabel: "आप बनाएंगे",
    days: [
      {
        label: "दिन 01",
        problem:
          "कोई भी ChatGPT खोलकर सवाल पूछ सकता है। अब यह बिज़नेस का समय नहीं बचाता — जान-बूझकर AI इस्तेमाल करना बचाता है। आज आप देखेंगे कि आपके बिज़नेस का कौन-सा हिस्सा ऑटोमेट होने के लिए तैयार है।",
        solution:
          "पहले बेसिक्स सीखें: ChatGPT बनाम Claude बनाम Gemini, बिज़नेस रिज़ल्ट के लिए प्रॉम्प्ट कैसे लिखें (सिर्फ़ जनरल जवाब नहीं), और अपने बिज़नेस में रिपीट होने वाले उन कामों को पहचानने का एक आसान तरीका जो ऑटोमेट करने लायक हैं।",
        tech: "AI फॉर बिज़नेस बेसिक्स, ChatGPT, Claude, Gemini, बिज़नेस प्रॉम्प्ट इंजीनियरिंग, ऑटोमेशन के मौके पहचानना",
        project: "आपका पहला AI बिज़नेस असिस्टेंट",
      },
      {
        label: "दिन 02",
        problem:
          "कंटेंट हर हफ़्ते घंटों खा जाता है — सोशल पोस्ट, ईमेल, विज्ञापन — और ज़्यादातर आज भी खाली पेज से शुरू होता है। यह वह समय है जो आप बिज़नेस के उस हिस्से में लगा सकते थे जिसे सिर्फ़ आप चला सकते हैं।",
        solution:
          "अपना AI कंटेंट इंजन बनाएं: अपनी ब्रांड वॉइस के लिए प्रॉम्प्टिंग, एक ही बैठक में एक हफ़्ते के सोशल पोस्ट और एड कॉपी तैयार करना, और एक कंटेंट कैलेंडर जिसे AI खुद भरता रहे।",
        tech: "AI कंटेंट राइटिंग, ब्रांड वॉइस प्रॉम्प्टिंग, कंटेंट कैलेंडर, एड कॉपी जनरेशन, मार्केटिंग प्रॉम्प्ट्स",
        project: "AI मार्केटिंग कंटेंट जनरेटर",
      },
      {
        label: "दिन 03",
        problem:
          "अभी इसी वक़्त आपके कस्टमर्स व्हाट्सएप पर मैसेज कर रहे हैं, वही पाँच सवाल बार-बार पूछ रहे हैं। हर मैसेज वह समय है जो आप उस काम में नहीं लगा पा रहे जो सिर्फ़ आप कर सकते हैं।",
        solution:
          "एक AI व्हाट्सएप असिस्टेंट बनाएं जो FAQ का जवाब दे, लीड्स को क्वालिफ़ाई करे, और 24/7 ऑनलाइन रहे — ताकि रिपीट होने वाले सवाल आपके फ़ोन तक पहुँचना बंद हो जाएँ।",
        tech: "व्हाट्सएप ऑटोमेशन, AI कस्टमर सपोर्ट, चैटबॉट बिल्डिंग, FAQ ऑटोमेशन, लीड क्वालिफ़िकेशन",
        project: "व्हाट्सएप बिज़नेस असिस्टेंट",
      },
      {
        label: "दिन 04",
        problem:
          "फ़ॉलो-अप के इंतज़ार में डील ठंडी पड़ जाती है। जो प्रपोज़ल बीस मिनट में बन जाना चाहिए, वह आधा दिन ले लेता है। सेलिंग के पेपरवर्क में लगा हर घंटा, सेलिंग में न लगा घंटा है।",
        solution:
          "एक AI सेल्स असिस्टेंट बनाएं जो लीड्स को क्वालिफ़ाई करे और मिनटों में एक कस्टम, आपके ब्रांड जैसा प्रपोज़ल तैयार करे — ताकि आप डील गरम रहते हुए ही फ़ॉलो-अप कर सकें।",
        tech: "सेल्स ऑटोमेशन, AI सेल्स असिस्टेंट, प्रपोज़ल जनरेशन, लीड स्कोरिंग, फ़ॉलो-अप ऑटोमेशन",
        project: "AI सेल्स असिस्टेंट + प्रपोज़ल जनरेटर",
      },
      {
        label: "दिन 05",
        problem:
          "इनवॉइस, ईमेल, पेपरवर्क — एडमिन का ढेर हर हफ़्ते बढ़ता है, चाहे आपके पास समय हो या न हो। इससे आपका बिज़नेस नहीं बढ़ता, सिर्फ़ आपका समय खर्च होता है।",
        solution:
          "पेपरवर्क को पूरी तरह ऑटोमेट करें: इनवॉइस जनरेशन, ईमेल सीक्वेंस जो खुद भेजे जाएँ, और डॉक्यूमेंट टेम्पलेट जो खुद भर जाएँ।",
        tech: "इनवॉइस ऑटोमेशन, ईमेल ऑटोमेशन, डॉक्यूमेंट ऑटोमेशन, टेम्पलेट सिस्टम, अप्रूवल वर्कफ़्लो",
        project: "इनवॉइस और ईमेल ऑटोमेशन सिस्टम",
      },
      {
        label: "दिन 06",
        problem:
          "मीटिंग ख़त्म होते ही नोट्स भी ख़त्म हो जाते हैं। SOP किसी एक इंसान के दिमाग़ में रहता है, आपके सिस्टम में नहीं। इनमें से कुछ भी आपसे आगे स्केल नहीं होता।",
        solution:
          "एक मीटिंग नोट्स असिस्टेंट बनाएं जो एक्शन आइटम्स ख़ुद कैप्चर करे, एक SOP जनरेटर जो 'हम यह कैसे करते हैं' को किसी के भी समझने लायक डॉक्यूमेंट में बदले, और एक आसान डैशबोर्ड जो एक नज़र में सब कुछ दिखाए।",
        tech: "मीटिंग नोट्स ऑटोमेशन, SOP जनरेशन, बिज़नेस डैशबोर्ड, HR ऑटोमेशन, प्रोडक्टिविटी वर्कफ़्लो",
        project: "मीटिंग नोट्स असिस्टेंट + SOP जनरेटर",
      },
      {
        label: "दिन 07",
        problem:
          "बिना सिस्टम के टूल्स स्केल नहीं होते — वे बस पाँच और ऐप्स बन जाते हैं जिन्हें याद रखकर चेक करना पड़ता है। जो वाकई कंपाउंड होता है, वह है एक रोडमैप।",
        solution:
          "अपने बिज़नेस के लिए एक पूरा AI अडॉप्शन रोडमैप लेकर जाएँ: इस हफ़्ते जो बनाया उसे सिस्टम में कैसे बदलें, अपनी टीम को कैसे तैयार करें, और अगला ऑटोमेट करने लायक प्रोसेस कैसे ढूँढते रहें।",
        tech: "AI अडॉप्शन रोडमैप, टीम ट्रेनिंग, ऑटोमेशन सिस्टमाइज़ेशन, AI से स्केलिंग, ROI मापना",
        project: "आपका पूरा AI बिज़नेस सिस्टम",
      },
    ],
  },
  bonuses: {
    quote:
      "\"मैंने बहुत से बिज़नेस ओनर्स को ऐसे बेकार के काम में डूबा देखा जिसे वे एक दोपहर में ऑटोमेट कर सकते थे। इसलिए हमने वह बैच बनाया जो मैं चाहता था कि हर उस फ़ाउंडर के लिए हो जिसे मैंने मेंटर किया।\"",
    body: "कोई स्लाइड डेक नहीं। कोई जनरल AI हाइप नहीं। हर क्लास एक ऐसे सिस्टम के साथ ख़त्म होती है जिसे आप उसी दिन चालू कर सकते हैं।",
    founderName: "प्रतीक साबले",
    founderTitle: "फ़ाउंडर · AI बिज़नेस मेंटर · सॉफ़्टवेयर इंजीनियर",
    headline: "जो चाहिए वह सब कुछ। जो नहीं चाहिए वह कुछ नहीं।",
    subcopy: "आमतौर पर अलग-अलग बेचा जाता है। यहाँ सब कुछ शामिल है, फ्री।",
    items: [
      { text: "7 दिन के लाइव सेशन", value: "₹3,000" },
      { text: "1:1 मेंटरशिप", value: "₹2,000" },
      { text: "बिज़नेस ऑटोमेशन टूलकिट", value: "₹2,000" },
      { text: "प्रॉम्प्ट और टेम्पलेट लाइब्रेरी", value: "₹1,000" },
      { text: "कम्युनिटी एक्सेस", value: "₹2,000" },
    ],
    totalLabel: "अनुमानित लर्निंग वैल्यू",
    totalValue: "₹10,000",
    disclaimer:
      "यह अनुमान बाज़ार में मिलते-जुलते लाइव बैच, टेम्पलेट और रिसोर्स की सामान्य कीमत पर आधारित है — सिर्फ़ जानकारी के लिए, यह कोई डिस्काउंट क्लेम नहीं है।",
    priceLabel: "आज आपकी कीमत",
    priceValue: "फ्री",
  },
  faq: {
    headline: "अक्सर पूछे जाने वाले सवाल",
    items: [
      {
        q: "क्या मुझे कोडिंग या टेक्निकल स्किल्स चाहिए?",
        a: "बिल्कुल नहीं। हम जो भी टूल इस्तेमाल करते हैं वे पॉइंट-एंड-क्लिक हैं — डेवलपर्स के लिए नहीं, बिज़नेस ओनर्स के लिए बनाए गए हैं।",
      },
      {
        q: "क्या यह बिगिनर्स के लिए ठीक है?",
        a: "हाँ। यह बिज़नेस ओनर्स, फ़ाउंडर्स और टीम्स के लिए बनाया गया है जिन्हें AI का ज़ीरो अनुभव है।",
      },
      {
        q: "क्या रिकॉर्डिंग मिलेगी?",
        a: "हाँ — हर सेशन रिकॉर्ड होकर व्हाट्सएप कम्युनिटी में डाला जाता है।",
      },
      {
        q: "क्या हम असली ऑटोमेशन बनाते हैं?",
        a: "हर दिन आपके बिज़नेस के लिए एक काम करने वाले सिस्टम के साथ ख़त्म होता है — कोई स्लाइड डेक नहीं।",
      },
      {
        q: "यह जनरल AI कोर्सेज़ से कैसे अलग है?",
        a: "एक मेंटर आपका बनाया हुआ काम रिव्यू करता है। जनरल कोर्सेज़ ऐसा नहीं करते।",
      },
    ],
    capHeadline: "हम हर बैच को सीमित क्यों रखते हैं",
    capBody:
      "हर ऑटोमेशन को लाइव रिव्यू किया जाता है। हर सवाल का जवाब मौके पर ही मिलता है। यह सिर्फ़ एक छोटे ग्रुप में ही मुमकिन है — इसलिए बैच भरते ही रजिस्ट्रेशन बंद हो जाता है। कोई काउंटडाउन गिमिक नहीं। बस एक सीधी बात: जितनी जल्दी आप जुड़ेंगे, उतनी जल्दी दिन 1 शुरू होगा।",
    finalHeadline1: "शुरू करने का सबसे अच्छा समय कल था।",
    finalHeadline2: "दूसरा सबसे अच्छा समय आज है।",
    finalSubcopy: "बैच {date} से शुरू। सीटें भरते ही बंद।",
    finalCta: "फ्री में ऑटोमेट करना शुरू करें",
    finalCtaWhatsapp: "वकम्युनिटी जॉइन करें",
    finalFooter: "learnsynaptic.com · #AIForBusinessCohort",
  },
  floatingCta: {
    title: "7-दिन का AI फॉर बिज़नेस बूटकैंप",
    cohortLabel: "अगला लाइव बैच",
    daysLabel: "दिन",
    hrsLabel: "घंटे",
    minLabel: "मिनट",
    seatsSuffix: "सीटें बुक हो चुकी हैं",
    cta: "मेरी फ्री सीट बुक करें →",
    timeLabel: "रात 8:30 बजे से",
  },
  registration: {
    badge: "फ्री · 7-दिन का AI फॉर बिज़नेस बूटकैंप",
    heading1: "मेरी",
    heading2: "फ्री सीट पक्की करें",
    subcopy: "अपना व्हाट्सएप नंबर डालें, हम आपको दिन 1 के लिए ज़रूरी सब कुछ भेज देंगे।",
    phonePlaceholder: "व्हाट्सएप नंबर *",
    namePlaceholder: "पूरा नाम (वैकल्पिक)",
    submitIdle: "मेरी फ्री सीट पक्की करें",
    submitting: "भेजा जा रहा है...",
    errorMsg: "आपका रजिस्ट्रेशन भेजने में कुछ गड़बड़ हुई। कृपया दोबारा कोशिश करें — आपकी जानकारी अभी भी भरी हुई है।",
    disclaimer: "आगे बढ़कर, आप व्हाट्सएप पर बूटकैंप अपडेट पाने के लिए सहमत होते हैं।",
    phoneRequired: "व्हाट्सएप नंबर ज़रूरी है।",
    phoneInvalid: "एक सही भारतीय मोबाइल नंबर डालें।",
    orDivider: "या",
  },
  success: {
    greetingPrefix: "आप शामिल हो गए हैं,",
    greetingFallback: "रजिस्ट्रेशन सफल",
    welcome: "आप बिल्कुल तैयार हैं!",
    lastStepTitle: "अगला कदम",
    lastStepBody: "यह पाने के लिए हमारी व्हाट्सएप कम्युनिटी से जुड़ें:",
    benefits: ["ज़ूम लिंक", "रोज़ के रिसोर्स", "सेशन रिमाइंडर", "असाइनमेंट्स", "अनाउंसमेंट्स"],
    joinCta: "कम्युनिटी जॉइन करें",
    laterCta: "बाद में",
  },
};

const mr: Translation = {
  meta: {
    title: "फ्री 7-दिवसांचा AI फॉर बिझनेस बूटकॅम्प — LearnSynaptic",
    description:
      "AI आता पर्याय राहिलेला नाही, तो अत्यावश्यक आहे. LearnSynaptic च्या फ्री 7-दिवसांच्या लाइव्ह AI फॉर बिझनेस बूटकॅम्पमध्ये सामील व्हा आणि कोडिंगशिवाय दर आठवड्याला 10+ तास परत मिळवा.",
    ogDescription:
      "बहुतेक बिझनेस ओनर्स फक्त AI बद्दलचा कंटेंट बघतात. फार कमी लोक तो प्रत्यक्ष बिझनेससाठी वापरतात. हा फ्री 7-दिवसांचा लाइव्ह बूटकॅम्प तुम्हाला त्यापैकी एक बनवतो — कोडिंगची गरज नाही.",
  },
  hero: {
    badgePrefix: "फ्री · AI फॉर बिझनेस बूटकॅम्प",
    eyebrow: "AI फॉर बिझनेस अकॅडमी",
    h1Line1: "AI आता पर्याय राहिलेला नाही.",
    h1Line2: "तो अत्यावश्यक आहे.",
    subhead:
      "बहुतेक बिझनेस ओनर्स फक्त AI बद्दल वाचतात. फार कमी लोक तो प्रत्यक्ष बिझनेससाठी वापरतात. हा फ्री 7-दिवसांचा लाइव्ह बूटकॅम्प तुम्हाला त्यापैकी एक बनवतो.",
    checklist: [
      "₹10,000+ किंमतीचा • या बॅचसाठी फ्री",
      "झिरो कोडिंग. झिरो जार्गन. फक्त रिझल्ट.",
      "7 खरे बिझनेस ऑटोमेशन्स, जे तुमच्याकडेच राहतील",
    ],
    ctaPrimary: "माझी फ्री सीट बुक करा",
    ctaWhatsapp: "व्हॉट्सअ‍ॅप कम्युनिटी जॉईन करा",
    note: "स्पॅम नाही. फक्त AI रिसोर्सेस, इव्हेंट रिमाइंडर्स आणि बूटकॅम्प अपडेट्स.",
    badges: ["AI फॉर बिझनेस", "20+ बिझनेस ऑटोमेशन्स तयार", "ChatGPT • Claude • Gemini"],
    founderCaption: "- प्रतीक एस सोबत",
    founderTitle: "Co-Founder, LearnSynaptic | AI बिझनेस मेंटर",
  },
  dates: {
    months: [
      "जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून",
      "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर",
    ],
    saturday: "शनिवार",
  },
  awareness: {
    headline: "तुमचा बिझनेस AI च्या मागे राहतोय असं वाटतंय का?",
    items: [
      {
        headline: "अजूनही सगळं मॅन्युअली करताय?",
        description: "तुम्ही दर आठवड्याला रिप्लाय, कंटेंट आणि अ‍ॅडमिनच्या कामात तास घालवताय, जे AI काही मिनिटांत करू शकतं.",
      },
      {
        headline: "AI टूल्समुळे गोंधळलात?",
        description: "ChatGPT, Claude, Gemini, ऑटोमेशन अ‍ॅप्स — कोणतं खरंच तुमचा बिझनेस पुढे नेतं हे तुम्हाला माहीत नाही.",
      },
      {
        headline: "स्पर्धक पुढे जाताना दिसताहेत?",
        description:
          "इतर बिझनेस आधीच AI वापरून वेळ वाचवत आहेत आणि जास्त डील्स क्लोज करत आहेत. जितकी वाट पाहाल, तितकं हे अंतर वाढत जातं.",
      },
    ],
  },
  problem: {
    headline1: "आम्ही AI टूल्स शिकवत नाही.",
    headline2: "आम्ही तुम्हाला AI ने बिझनेस चालवायला शिकवतो.",
    subcopy:
      "कोणीही ChatGPT उघडून प्रश्न विचारू शकतं. हुशार बिझनेस ओनर्स रोज AI वापरून वेळ वाचवतात, खर्च कमी करतात आणि रेव्हेन्यू वाढवतात. LearnSynaptic तुम्हाला नेमकं हेच शिकवतं.",
    mostLabel: "बहुतेक बिझनेस ओनर्स",
    mostCaption: "सगळ्यासाठी एकच AI वापरतात, आणि तो त्यांच्या बिझनेसला जुळत नाही म्हणून सोडून देतात.",
    smartLabel: "स्मार्ट बिझनेस ओनर्स",
    smartCaption: "बिझनेसच्या प्रत्येक भागासाठी योग्य AI सिस्टम निवडतात.",
    buildQuestion: "तुम्हाला काय ऑटोमेट करायचंय?",
    workflows: {
      marketing: {
        label: "मार्केटिंग",
        why: [
          "काही सेकंदात तुमच्या पहिल्या कल्पना आणि कॅप्शन तयार करतं.",
          "त्या कल्पनांना मोठ्या प्रमाणात तुमच्या ब्रँडसारखी मार्केटिंग कॉपी बनवतं.",
          "त्यासोबत जाणारे सोशल मीडिया ग्राफिक्स तयार करतं.",
          "अंतिम पोस्ट पॉलिश करून पब्लिशसाठी तयार करतं.",
        ],
      },
      sales: {
        label: "सेल्स",
        why: [
          "तुम्ही फोन उचलण्याआधीच प्रॉस्पेक्टबद्दल रिसर्च करतं.",
          "तासांऐवजी मिनिटांत कस्टम प्रपोझलचा ड्राफ्ट तयार करतं.",
          "त्या ड्राफ्टला दिसायला उठावदार अशा प्रपोझल डेकमध्ये बदलतं.",
          "पुन्हा-पुन्हा मागे-पुढे न करता तो पाठवून सही करून घेतं.",
        ],
      },
      support: {
        label: "सपोर्ट",
        why: [
          "जिथे तुमचे ग्राहक आधीच मेसेज करत आहेत.",
          "वारंवार विचारल्या जाणाऱ्या प्रश्नांची उत्तरं दिवसरात्र देतं.",
          "फक्त स्क्रिप्टने न होणारे निर्णय हाताळतं.",
          "प्रत्येक संभाषण थेट तुमच्या CRM मध्ये नोंदवतं.",
        ],
      },
      automation: {
        label: "ऑटोमेशन",
        why: [
          "तुमची सगळी अ‍ॅप्स एका व्हिज्युअल वर्कफ्लोमध्ये जोडतं.",
          "n8n जे करू शकत नाही ते ऑटोमेशन Make हाताळतं.",
          "तुम्ही आधीपासून वापरत असलेली टूल्स काही क्लिकमध्ये जोडतं.",
          "आत निर्णय घेण्याची, वाचण्याची आणि लिहिण्याची समज जोडतं.",
        ],
      },
      reporting: {
        label: "रिपोर्टिंग",
        why: [
          "आठवडाभराच्या अपडेट्सचं एका नीटनेटक्या सारांशात रूपांतर करतं.",
          "तुमचे SOP आणि माहिती एका ठिकाणी व्यवस्थित ठेवतं.",
          "तुमचा बिझनेस ज्या आकड्यांवर चालतो ते ट्रॅक करतं.",
          "त्या डेटाला तुम्ही शेअर करू शकाल अशा रिपोर्टमध्ये बदलतं.",
        ],
      },
    },
    closingHeadline1: "बिझनेस ओनर्सची सर्वात मोठी चूक?",
    closingHeadline2: "प्रत्येक AI टूल शिकण्याचा प्रयत्न करणे.",
    closingBody:
      "आमच्या बूटकॅम्पमध्ये तुम्हाला 50 अ‍ॅप्स पाठ करावे लागणार नाहीत. तुम्ही शिकाल की कोणती टूल्स खरंच तुमचा वेळ वाचवतात — आणि ती थेट तुमच्या बिझनेसमध्ये कशी जोडायची.",
  },
  founder: {
    kicker: "म्हणूनच आम्ही तयार केलं",
    heading: "7-दिवसांचा AI फॉर बिझनेस बूटकॅम्प",
    subcopy:
      "फक्त AI शी बोलणं नाही — तर तो एक असा सिस्टम बनवणं जो तुमचे तास वाचवेल, फालतू काम कमी करेल आणि तुमचा बिझनेस वाढवेल.",
    founderName: "प्रतीक साबळे, Co-Founder",
    ctaHeadline: "अंदाज बांधणं थांबवा. AI ने बिझनेस चालवायला सुरुवात करा.",
    ctaSubcopy:
      "खऱ्या बिझनेस प्रोजेक्ट्सद्वारे महत्त्वाची टूल्स शिका — कंटेंट, सेल्स, सपोर्ट आणि ऑपरेशन्स. फ्लफ नाही, थियरी नाही.",
    ctaPrimary: "AI फॉर बिझनेस बूटकॅम्प बघा →",
    ctaSecondary: "तुम्ही काय ऑटोमेट कराल ते बघा",
  },
  audience: {
    headline: "हा बूटकॅम्प कोणासाठी आहे?",
    items: [
      {
        label: "बिझनेस चालवता?",
        headline: "बिझनेस ओनर्स",
        description:
          "तासांच्या बदल्यात आउटपुट देणं थांबवा. कंटेंट, रिप्लाय आणि अ‍ॅडमिनसाठी AI वापरा — जेणेकरून तुमचा वेळ फक्त तुम्हीच घेऊ शकता अशा निर्णयांसाठी वापरला जाईल.",
        outcome: "दर आठवड्याला 10+ तास परत मिळवा",
      },
      {
        label: "काहीतरी नवीन उभं करताय?",
        headline: "फाउंडर्स आणि एंटरप्रेन्युअर्स",
        description:
          "तुम्ही एकाच वेळी पाच कामं करताय. रिपीट होणारी कामं AI कडे सोपवा, आणि फक्त तुम्हीच वाढवू शकता अशा भागांवर लक्ष द्या.",
        outcome: "छोट्या टीमसह जास्त काम करा",
      },
      {
        label: "टार्गेट्सच्या मागे धावताय?",
        headline: "सेल्स आणि मार्केटिंग टीम्स",
        description:
          "फॉलो-अप्स, कंटेंट, प्रपोझल्स, कॅम्पेन्स — फनलमधील रिपीट होणारे भाग ऑटोमेट करा आणि तुमची एनर्जी डील्स क्लोज करण्यात लावा.",
        outcome: "तेवढीच टीम, जास्त आउटपुट",
      },
      {
        label: "एकट्याने काम करता?",
        headline: "फ्रीलान्सर्स आणि कन्सल्टंट्स",
        description:
          "मोठ्या टीमसारखं काम करा. क्लायंट कम्युनिकेशन, प्रपोझल्स आणि अ‍ॅडमिन ऑटोमेट करा — आणि बर्नआउट न होता जास्त क्लायंट्स घ्या.",
        outcome: "हायरिंगशिवाय स्केल करा",
      },
    ],
    backwardsHeadline: "तुम्हाला AI उलट्या पद्धतीने शिकवलं गेलं आहे.",
    traditionalLabel: "पारंपरिक शिकवण",
    traditionalItems: [
      "AI ट्युटोरियल्स सेव्ह केले, कधी वापरलेच नाहीत",
      "प्रॉम्प्ट्स कॉपी-पेस्ट केले, खरी सिस्टम नाही",
      "दर आठवड्याला वेगळं अ‍ॅप",
      "दाखवायला एकही ऑटोमेशन नाही",
      "अजूनही सगळं मॅन्युअली",
      "सुरुवात कुठून करायची हेच माहीत नाही",
    ],
    modernLabel: "LearnSynaptic",
    modernItems: [
      "प्रत्येक सेशनमध्ये लाइव्ह, काम करणारं ऑटोमेशन",
      "सात खरी बिझनेस सिस्टम्स, तयार करून",
      "पहिल्या दिवसापासून तुमच्या बिझनेसनुसार तयार",
      "खऱ्या बिझनेस ओनर्सनी वापरलेले वर्कफ्लोज",
      "तुम्ही चालू ठेवाल असे ऑटोमेशन्स",
      "तुमच्या पुढच्या ग्रोथ टप्प्यासाठी तयार",
    ],
  },
  projects: {
    headline: "आठ सिस्टम्स. झिरो अंदाज.",
    subcopy: "प्रत्येक सिस्टम तुमच्या बिझनेससाठी तयार, काम करणारं आणि कायमचं तुमचं.",
    items: [
      "AI सेल्स असिस्टंट",
      "AI मार्केटिंग कंटेंट जनरेटर",
      "व्हॉट्सअ‍ॅप बिझनेस असिस्टंट",
      "कस्टमर सपोर्ट बॉट",
      "प्रपोझल जनरेटर",
      "इनव्हॉइस ऑटोमेशन",
      "ईमेल ऑटोमेशन सिस्टम",
      "मीटिंग नोट्स असिस्टंट",
    ],
    curriculumHeadline: "सात दिवस. सात सिस्टम्स.",
    problemLabel: "समस्या",
    solutionLabel: "उपाय",
    techLabel: "तुम्ही काय शिकाल",
    buildLabel: "तुम्ही तयार कराल",
    days: [
      {
        label: "दिवस 01",
        problem:
          "कोणीही ChatGPT उघडून प्रश्न विचारू शकतं. आता यातून बिझनेसचा वेळ वाचत नाही — जाणीवपूर्वक AI वापरण्यातून वाचतो. आज तुम्ही बघाल की तुमच्या बिझनेसचा कोणता भाग ऑटोमेट होण्यासाठी तयार आहे.",
        solution:
          "आधी बेसिक्स शिका: ChatGPT विरुद्ध Claude विरुद्ध Gemini, बिझनेस रिझल्टसाठी प्रॉम्प्ट कसा लिहायचा (फक्त सर्वसाधारण उत्तर नाही), आणि तुमच्या बिझनेसमध्ये रिपीट होणारी, ऑटोमेट करण्यायोग्य कामं ओळखण्याची सोपी पद्धत.",
        tech: "AI फॉर बिझनेस बेसिक्स, ChatGPT, Claude, Gemini, बिझनेस प्रॉम्प्ट इंजिनिअरिंग, ऑटोमेशनच्या संधी ओळखणे",
        project: "तुमचा पहिला AI बिझनेस असिस्टंट",
      },
      {
        label: "दिवस 02",
        problem:
          "कंटेंट दर आठवड्याला तास खातो — सोशल पोस्ट्स, ईमेल्स, जाहिराती — आणि तरीही बहुतेक वेळा रिकाम्या पानापासूनच सुरुवात होते. हा वेळ तुम्ही बिझनेसच्या त्या भागात घालवू शकला असता जो फक्त तुम्हीच चालवू शकता.",
        solution:
          "तुमचं AI कंटेंट इंजिन तयार करा: तुमच्या ब्रँड व्हॉइससाठी प्रॉम्प्टिंग, एकाच बैठकीत आठवडाभराचे सोशल पोस्ट्स आणि जाहिरात कॉपी तयार करणे, आणि AI स्वतः भरत राहील असं कंटेंट कॅलेंडर.",
        tech: "AI कंटेंट रायटिंग, ब्रँड व्हॉइस प्रॉम्प्टिंग, कंटेंट कॅलेंडर्स, अ‍ॅड कॉपी जनरेशन, मार्केटिंग प्रॉम्प्ट्स",
        project: "AI मार्केटिंग कंटेंट जनरेटर",
      },
      {
        label: "दिवस 03",
        problem:
          "याच क्षणी तुमचे ग्राहक व्हॉट्सअ‍ॅपवर मेसेज करत आहेत, तेच पाच प्रश्न वारंवार विचारत आहेत. प्रत्येक मेसेज म्हणजे तो वेळ आहे जो तुम्ही फक्त तुम्हीच करू शकता अशा कामात घालवू शकत नाही.",
        solution:
          "एक AI व्हॉट्सअ‍ॅप असिस्टंट तयार करा जो FAQ ला उत्तर देईल, लीड्स क्वालिफाय करेल, आणि 24/7 ऑनलाइन राहील — जेणेकरून रिपीट प्रश्न तुमच्या फोनपर्यंत पोहोचणं थांबेल.",
        tech: "व्हॉट्सअ‍ॅप ऑटोमेशन, AI कस्टमर सपोर्ट, चॅटबॉट बिल्डिंग, FAQ ऑटोमेशन, लीड क्वालिफिकेशन",
        project: "व्हॉट्सअ‍ॅप बिझनेस असिस्टंट",
      },
      {
        label: "दिवस 04",
        problem:
          "फॉलो-अपची वाट बघता बघता डील थंड पडते. जो प्रपोझल वीस मिनिटांत तयार व्हायला हवा, त्याला अर्धा दिवस लागतो. सेलिंगच्या पेपरवर्कमध्ये गेलेला प्रत्येक तास हा सेलिंगमध्ये न गेलेला तास असतो.",
        solution:
          "एक AI सेल्स असिस्टंट तयार करा जो लीड्स क्वालिफाय करेल आणि मिनिटांत कस्टम, तुमच्या ब्रँडसारखा प्रपोझल तयार करेल — जेणेकरून डील गरम असतानाच तुम्ही फॉलो-अप करू शकाल.",
        tech: "सेल्स ऑटोमेशन, AI सेल्स असिस्टंट, प्रपोझल जनरेशन, लीड स्कोअरिंग, फॉलो-अप ऑटोमेशन",
        project: "AI सेल्स असिस्टंट + प्रपोझल जनरेटर",
      },
      {
        label: "दिवस 05",
        problem:
          "इनव्हॉइस, ईमेल्स, पेपरवर्क — अ‍ॅडमिनचा ढीग दर आठवड्याला वाढतो, तुमच्याकडे वेळ असो वा नसो. यातलं काहीही तुमचा बिझनेस वाढवत नाही; फक्त तुमचा वेळ खर्च करतं.",
        solution:
          "पेपरवर्क पूर्णपणे ऑटोमेट करा: इनव्हॉइस जनरेशन, स्वतःहून पाठवले जाणारे ईमेल सिक्वेन्स, आणि स्वतःहून भरले जाणारे डॉक्युमेंट टेम्प्लेट्स.",
        tech: "इनव्हॉइस ऑटोमेशन, ईमेल ऑटोमेशन, डॉक्युमेंट ऑटोमेशन, टेम्प्लेट सिस्टम्स, अप्रूव्हल वर्कफ्लोज",
        project: "इनव्हॉइस आणि ईमेल ऑटोमेशन सिस्टम",
      },
      {
        label: "दिवस 06",
        problem:
          "मीटिंग संपली की नोट्सही संपतात. SOP एका माणसाच्या डोक्यात राहतो, तुमच्या सिस्टममध्ये नाही. यातलं काहीही तुमच्या पलीकडे स्केल होत नाही.",
        solution:
          "एक मीटिंग नोट्स असिस्टंट तयार करा जो अ‍ॅक्शन आयटम्स आपोआप टिपेल, एक SOP जनरेटर जो 'आम्ही हे कसं करतो' याला कोणालाही समजेल असा डॉक्युमेंट बनवेल, आणि एक साधा डॅशबोर्ड जो एका नजरेत सगळं दाखवेल.",
        tech: "मीटिंग नोट्स ऑटोमेशन, SOP जनरेशन, बिझनेस डॅशबोर्ड्स, HR ऑटोमेशन, प्रोडक्टिव्हिटी वर्कफ्लोज",
        project: "मीटिंग नोट्स असिस्टंट + SOP जनरेटर",
      },
      {
        label: "दिवस 07",
        problem:
          "सिस्टमशिवाय टूल्स स्केल होत नाहीत — ती फक्त लक्षात ठेवून तपासावी लागणारी आणखी पाच अ‍ॅप्स बनतात. खरं कंपाउंड होतं ते म्हणजे रोडमॅप.",
        solution:
          "तुमच्या बिझनेससाठी एक संपूर्ण AI अ‍ॅडॉप्शन रोडमॅप घेऊन जा: या आठवड्यात जे तयार केलं ते सिस्टीममध्ये कसं बदलायचं, तुमच्या टीमला कसं तयार करायचं, आणि पुढचं ऑटोमेट करण्यायोग्य प्रोसेस कसं शोधत राहायचं.",
        tech: "AI अ‍ॅडॉप्शन रोडमॅप, टीम ट्रेनिंग, ऑटोमेशन सिस्टिमॅटायझेशन, AI ने स्केलिंग, ROI मोजणे",
        project: "तुमची संपूर्ण AI बिझनेस सिस्टम",
      },
    ],
  },
  bonuses: {
    quote:
      "\"मी असे अनेक बिझनेस ओनर्स बघितले जे एका दुपारीत ऑटोमेट करता येईल असं फालतू काम करत बुडत होते. म्हणून मी मेंटर केलेल्या प्रत्येक फाउंडरसाठी हवा असलेला बॅच आम्ही तयार केला.\"",
    body: "स्लाइड डेक नाही. सर्वसाधारण AI हाईप नाही. प्रत्येक क्लास अशा सिस्टमने संपते जी तुम्ही त्याच दिवशी सुरू करू शकता.",
    founderName: "प्रतीक साबळे",
    founderTitle: "Founder · AI बिझनेस मेंटर · सॉफ्टवेअर इंजिनिअर",
    headline: "जे हवं ते सगळं. जे नको ते काहीच नाही.",
    subcopy: "साधारणपणे वेगवेगळं विकलं जातं. इथे सगळं समाविष्ट, फ्री.",
    items: [
      { text: "7 दिवसांचे लाइव्ह सेशन्स", value: "₹3,000" },
      { text: "1:1 मेंटरशिप", value: "₹2,000" },
      { text: "बिझनेस ऑटोमेशन टूलकिट", value: "₹2,000" },
      { text: "प्रॉम्प्ट आणि टेम्प्लेट लायब्ररी", value: "₹1,000" },
      { text: "कम्युनिटी अ‍ॅक्सेस", value: "₹2,000" },
    ],
    totalLabel: "अंदाजित लर्निंग व्हॅल्यू",
    totalValue: "₹10,000",
    disclaimer:
      "हा अंदाज बाजारातील तत्सम लाइव्ह बॅचेस, टेम्प्लेट्स आणि रिसोर्सेसच्या सर्वसाधारण किमतीवर आधारित आहे — फक्त माहितीसाठी, हा कोणताही डिस्काउंट क्लेम नाही.",
    priceLabel: "आजची तुमची किंमत",
    priceValue: "फ्री",
  },
  faq: {
    headline: "वारंवार विचारले जाणारे प्रश्न",
    items: [
      {
        q: "मला कोडिंग किंवा टेक्निकल स्किल्स लागतील का?",
        a: "अजिबात नाही. आम्ही वापरत असलेली प्रत्येक टूल पॉइंट-अँड-क्लिक आहे — डेव्हलपर्ससाठी नाही, बिझनेस ओनर्ससाठी तयार केली आहे.",
      },
      {
        q: "हे बिगिनर्ससाठी योग्य आहे का?",
        a: "हो. हे बिझनेस ओनर्स, फाउंडर्स आणि टीम्ससाठी तयार केलं आहे ज्यांना AI चा अजिबात अनुभव नाही.",
      },
      {
        q: "रेकॉर्डिंग मिळेल का?",
        a: "हो — प्रत्येक सेशन रेकॉर्ड होऊन व्हॉट्सअ‍ॅप कम्युनिटीत टाकलं जातं.",
      },
      {
        q: "आम्ही खरे ऑटोमेशन तयार करतो का?",
        a: "प्रत्येक दिवस तुमच्या बिझनेससाठी काम करणाऱ्या सिस्टमने संपतो — स्लाइड डेकने नाही.",
      },
      {
        q: "हे सर्वसाधारण AI कोर्सेसपेक्षा कसं वेगळं आहे?",
        a: "एक मेंटर तुम्ही तयार केलेलं काम रिव्ह्यू करतो. सर्वसाधारण कोर्सेस असं करत नाहीत.",
      },
    ],
    capHeadline: "आम्ही प्रत्येक बॅच मर्यादित का ठेवतो",
    capBody:
      "प्रत्येक ऑटोमेशन लाइव्ह रिव्ह्यू केलं जातं. प्रत्येक प्रश्नाचं उत्तर लगेच दिलं जातं. हे फक्त लहान ग्रुपमध्येच शक्य आहे — म्हणून बॅच भरला की रजिस्ट्रेशन बंद होतं. कोणतंही काउंटडाउन गिमिक नाही. फक्त एक साधी गोष्ट: जितक्या लवकर तुम्ही सामील व्हाल, तितक्या लवकर दिवस 1 सुरू होईल.",
    finalHeadline1: "सुरुवात करण्याची सर्वोत्तम वेळ काल होती.",
    finalHeadline2: "दुसरी सर्वोत्तम वेळ आज आहे.",
    finalSubcopy: "बॅच {date} पासून सुरू. सीट्स भरल्या की बंद.",
    finalCta: "फ्रीमध्ये ऑटोमेट करायला सुरुवात करा",
    finalCtaWhatsapp: "व्हॉट्सअ‍ॅप कम्युनिटी जॉईन करा",
    finalFooter: "learnsynaptic.com · #AIForBusinessCohort",
  },
  floatingCta: {
    title: "7-दिवसांचा AI फॉर बिझनेस बूटकॅम्प",
    cohortLabel: "पुढील लाइव्ह बॅच",
    daysLabel: "दिवस",
    hrsLabel: "तास",
    minLabel: "मिनिट",
    seatsSuffix: "सीट्स बुक झाल्या",
    cta: "माझी फ्री सीट बुक करा →",
    timeLabel: "रात्री 8:30 पासून",
  },
  registration: {
    badge: "फ्री · 7-दिवसांचा AI फॉर बिझनेस बूटकॅम्प",
    heading1: "माझी",
    heading2: "फ्री सीट बुक करा",
    subcopy: "तुमचा व्हॉट्सअ‍ॅप नंबर टाका, आम्ही तुम्हाला दिवस 1 साठी लागणारं सगळं पाठवू.",
    phonePlaceholder: "व्हॉट्सअ‍ॅप नंबर *",
    namePlaceholder: "पूर्ण नाव (ऐच्छिक)",
    submitIdle: "माझी फ्री सीट बुक करा",
    submitting: "पाठवत आहे...",
    errorMsg: "तुमचं रजिस्ट्रेशन पाठवताना काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा — तुमची माहिती अजूनही भरलेली आहे.",
    disclaimer: "पुढे जाऊन, तुम्ही व्हॉट्सअ‍ॅपवर बूटकॅम्प अपडेट्स मिळवण्यास सहमती देता.",
    phoneRequired: "व्हॉट्सअ‍ॅप नंबर आवश्यक आहे.",
    phoneInvalid: "एक वैध भारतीय मोबाइल नंबर टाका.",
    orDivider: "किंवा",
  },
  success: {
    greetingPrefix: "तुम्ही सामील झालात,",
    greetingFallback: "रजिस्ट्रेशन यशस्वी",
    welcome: "तुम्ही पूर्णपणे तयार आहात!",
    lastStepTitle: "पुढचं पाऊल",
    lastStepBody: "हे मिळवण्यासाठी आमच्या व्हॉट्सअ‍ॅप कम्युनिटीत सामील व्हा:",
    benefits: ["झूम लिंक्स", "रोजचे रिसोर्सेस", "सेशन रिमाइंडर्स", "असाइनमेंट्स", "अनाउन्समेंट्स"],
    joinCta: "व्हॉट्सअ‍ॅप कम्युनिटी जॉईन करा",
    laterCta: "नंतर",
  },
};

export const translations: Record<Lang, Translation> = { en, hi, mr };
