// AUTO-GENERATED from 'HAVAN ACADEMY study plan.docx' - do not edit by hand.

export interface PrepBlock {
  label: string
  minutes: number
  items: string[]
}

export interface PrepDay {
  day: number
  title: string
  focus: string
  blocks: PrepBlock[]
  allUniversities: boolean
  universities: string[]
}

export interface PrepModule {
  title: string
  dayRange: [number, number]
  days: PrepDay[]
}

export const HEALTH_TRACK_DAYS = [26, 27, 28]

export const PREP_MODULES: PrepModule[] = [
  {
    title: "Module 1: Foundation",
    dayRange: [1, 10],
    days: [
      {
        day: 1,
        title: "Communicative English Skills I",
        focus: "Grammar, sentence structure, comprehension",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Parts of speech", "Simple present, past, future tenses", "Practice: Write 10 sentences about yourself"] },
          { label: "Afternoon", minutes: 60, items: ["Reading comprehension: 1 passage + 5 questions", "Vocabulary: 10 new words"] },
          { label: "Review", minutes: 30, items: ["Review notes", "Write 5 sentences using new vocabulary"] },
          { label: "Practice", minutes: 30, items: ["10 grammar questions"] },
        ],
        allUniversities: true,
        universities: [],
      },
      {
        day: 2,
        title: "Applied Mathematics I",
        focus: "Algebra, equations, functions",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Linear equations and inequalities", "Solving for x", "Practice: 10 equations"] },
          { label: "Afternoon", minutes: 60, items: ["Functions and graphs", "Domain and range", "Practice: 5 function problems"] },
          { label: "Review", minutes: 30, items: ["Review formulas", "Redo wrong problems"] },
          { label: "Practice", minutes: 30, items: ["15 math problems"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "ASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Bahir Dar", "Dire Dawa", "Haramaya", "Jimma", "Mekelle", "Wachemo", "Welkite", "Wollega", "Wollo", "Civil Service", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Jigijiga", "Kotebe", "Meda Wellabu", "Mizan Tepi", "Oda Bultum", "Semera", "Unity", "St Marry"],
      },
      {
        day: 3,
        title: "Logic and Critical Thinking",
        focus: "Arguments, fallacies, reasoning",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Premises and conclusions", "Valid vs. invalid arguments"] },
          { label: "Afternoon", minutes: 60, items: ["Common fallacies", "Practice: Identify fallacies"] },
          { label: "Review", minutes: 30, items: ["Summarize fallacies", "Write 3 examples"] },
          { label: "Practice", minutes: 30, items: ["10 logic questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "ASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dembidollo", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Salale", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 4,
        title: "General Psychology",
        focus: "Introduction to psychology",
        blocks: [
          { label: "Morning", minutes: 60, items: ["What is psychology?", "Nature vs. nurture", "Branches of psychology"] },
          { label: "Afternoon", minutes: 60, items: ["Learning theories", "Memory and forgetting", "Practice: Summarize each theory"] },
          { label: "Review", minutes: 30, items: ["Review key terms", "Create a mind map"] },
          { label: "Practice", minutes: 30, items: ["10 psychology questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dembidollo", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Salale", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 5,
        title: "Geography",
        focus: "Physical and human geography",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Earth's structure and landforms", "Climate and weather"] },
          { label: "Afternoon", minutes: 60, items: ["Map reading", "Practice: Label a map of Ethiopia"] },
          { label: "Review", minutes: 30, items: ["Review key terms", "Summarize climate types"] },
          { label: "Practice", minutes: 30, items: ["10 geography questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dembidollo", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Salale", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 6,
        title: "Physical Fitness",
        focus: "Health, exercise, wellness",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Components of physical fitness", "Benefits of exercise"] },
          { label: "Afternoon", minutes: 60, items: ["Types of exercises", "Create a weekly exercise plan"] },
          { label: "Review", minutes: 30, items: ["Review notes", "Reflect on your fitness"] },
          { label: "Practice", minutes: 30, items: ["10 fitness questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Arsi", "Bahir Dar", "Debrebirhan", "Dire Dawa", "Dembidollo", "Haramaya", "Jigijiga", "Mekelle", "Wachemo", "Welkite", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry"],
      },
      {
        day: 7,
        title: "Review Day (Days 1–6)",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review all notes", "Redo wrong problems"] },
          { label: "Afternoon", minutes: 90, items: ["Mini practice test (30 questions)", "Check answersEvening (1 hour):", "Rest"] },
        ],
        allUniversities: false,
        universities: [],
      },
      {
        day: 8,
        title: "Communicative English Skills II",
        focus: "Writing, essays, advanced grammar",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Paragraph writing", "Topic sentences"] },
          { label: "Afternoon", minutes: 60, items: ["Essay structure", "Practice: Write a 200-word essay"] },
          { label: "Review", minutes: 30, items: ["Review essay", "Identify improvements"] },
          { label: "Practice", minutes: 30, items: ["10 writing prompts"] },
        ],
        allUniversities: true,
        universities: [],
      },
      {
        day: 9,
        title: "Applied Mathematics II",
        focus: "Geometry, trigonometry",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Angles, triangles, circles", "Area and volume formulas"] },
          { label: "Afternoon", minutes: 60, items: ["Trigonometric ratios", "Practice: 10 problems"] },
          { label: "Review", minutes: 30, items: ["Review formulas", "Create a formula sheet"] },
          { label: "Practice", minutes: 30, items: ["15 math problems"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "ASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Bahir Dar", "Dire Dawa", "Haramaya", "Jimma", "Mekelle", "Wachemo", "Welkite", "Wollega", "Wollo", "Civil Service", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Jigijiga", "Kotebe", "Meda Wellabu", "Mizan Tepi", "Oda Bultum", "Semera", "Unity", "St Marry"],
      },
      {
        day: 10,
        title: "Review Day (Days 8–9)",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review English and Math", "Practice weak areas"] },
          { label: "Afternoon", minutes: 90, items: ["Mini practice test (30 questions)", "Check answersEvening (1 hour):", "RestMODULE 2: CORE COURSES (DAYS 11–20)"] },
        ],
        allUniversities: false,
        universities: [],
      },
    ],
  },
  {
    title: "Module 2: Core Courses",
    dayRange: [11, 20],
    days: [
      {
        day: 11,
        title: "Introduction to Emerging Technologies",
        focus: "AI, IoT, blockchain, AR/VR",
        blocks: [
          { label: "Morning", minutes: 60, items: ["AI, IoT", "What are emerging technologies?"] },
          { label: "Afternoon", minutes: 60, items: ["Blockchain, AR/VR", "Practice: Summarize each technology"] },
          { label: "Review", minutes: 30, items: ["Review key terms", "Create a comparison chart"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 12,
        title: "Social Anthropology",
        focus: "Culture, society, human behaviour",
        blocks: [
          { label: "Morning", minutes: 60, items: ["What is anthropology?", "Culture and society", "Ethnocentrism vs. cultural relativism"] },
          { label: "Afternoon", minutes: 60, items: ["Marriage, family, kinship", "Religion and belief systems", "Practice: Compare two cultures"] },
          { label: "Review", minutes: 30, items: ["Review key concepts", "Summarize in your own words"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 13,
        title: "Moral and Civic Education",
        focus: "Ethics, citizenship, responsibility",
        blocks: [
          { label: "Morning", minutes: 60, items: ["What is civic education?", "Rights and responsibilities", "Democracy and governance"] },
          { label: "Afternoon", minutes: 60, items: ["Ethical theories", "Practice: Apply ethics to real-life situations"] },
          { label: "Review", minutes: 30, items: ["Review key terms", "Write a short reflection"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "ASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 14,
        title: "Entrepreneurship",
        focus: "Business ideas, planning, innovation",
        blocks: [
          { label: "Morning", minutes: 60, items: ["What is entrepreneurship?", "Characteristics of entrepreneurs", "Business plan basics"] },
          { label: "Afternoon", minutes: 60, items: ["Idea generation", "Marketing and finance basics", "Practice: Write a simple business idea"] },
          { label: "Review", minutes: 30, items: ["Review notes", "Refine your business idea"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 15,
        title: "Review Day (Days 11–14)",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review all Module 2 notes", "Practice weak areas"] },
          { label: "Afternoon", minutes: 90, items: ["Mini practice test (40 questions)", "Check answersEvening (1 hour):", "Rest"] },
        ],
        allUniversities: false,
        universities: [],
      },
      {
        day: 16,
        title: "Inclusiveness",
        focus: "Diversity, equity, inclusion",
        blocks: [
          { label: "Morning", minutes: 60, items: ["What is inclusiveness?", "Types of diversity"] },
          { label: "Afternoon", minutes: 60, items: ["Barriers to inclusion", "Creating inclusive environments", "Practice: Identify inclusion issues"] },
          { label: "Review", minutes: 30, items: ["Review notes", "Write a reflection"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 17,
        title: "Global Trends",
        focus: "Global issues, international relations",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Globalization", "Climate change and sustainability"] },
          { label: "Afternoon", minutes: 60, items: ["Human rights and international organizations", "Practice: Summarize a global issue"] },
          { label: "Review", minutes: 30, items: ["Review key terms", "Create a mind map"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 18,
        title: "History of Ethiopia and the Horn",
        focus: "Ethiopian history from ancient to modern times",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Ancient kingdoms (Axum, Lalibela)", "Medieval period"] },
          { label: "Afternoon", minutes: 60, items: ["Modern history (19th–20th century)", "Practice: Create a timeline"] },
          { label: "Review", minutes: 30, items: ["Review timeline", "Summarize key events"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 19,
        title: "Economics",
        focus: "Basic economic principles",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Supply and demand", "Market equilibrium"] },
          { label: "Afternoon", minutes: 60, items: ["GDP, inflation, unemployment", "Practice: Graph supply and demand"] },
          { label: "Review", minutes: 30, items: ["Review graphs", "Summarize key concepts"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Bonga", "Debrebirhan", "Debremarkos", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jigijiga", "Jimma", "Jinka", "Kotebe", "Meda Wellabu", "Mekelle", "Mizan Tepi", "Oda Bultum", "Semera", "Wachemo", "Welkite", "Werabe", "Wolayita Sodo", "Wollega", "Wollo", "Civil Service", "Sante", "St Marry", "Unity"],
      },
      {
        day: 20,
        title: "Review Day (Days 16–19)",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review all notes", "Practice weak areas"] },
          { label: "Afternoon", minutes: 90, items: ["Mini practice test (40 questions)", "Check answersEvening (1 hour):", "RestMODULE 3: ADVANCED &amp;"] },
        ],
        allUniversities: false,
        universities: [],
      },
    ],
  },
  {
    title: "Module 3: Advanced & Review",
    dayRange: [21, 30],
    days: [
      {
        day: 21,
        title: "Computer Programming (C++ / Python)",
        focus: "Basics of programming",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Variables, data types, operators"] },
          { label: "Afternoon", minutes: 60, items: ["Conditional statements (if/else)", "Loops (for, while)", "Practice: Write 3 simple programs"] },
          { label: "Review", minutes: 30, items: ["Review code", "Fix errors"] },
          { label: "Practice", minutes: 30, items: ["10 programming questions"] },
        ],
        allUniversities: false,
        universities: ["AASTU", "AAU", "Adigrat", "Ambo", "Arba Minch", "Arsi", "Assossa", "Axum", "Bahir Dar", "Debrebirhan", "Dilla", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Meda Wellabu", "Mekelle", "Wachemo", "Welkite", "Woldiya", "Wollega", "Wollo", "Civil Service", "St Marry", "Unity"],
      },
      {
        day: 22,
        title: "General Biology",
        focus: "Cell biology, genetics, ecology",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Cell structure and function", "DNA and genetics"] },
          { label: "Afternoon", minutes: 60, items: ["Ecosystems and biodiversity", "Practice: Draw and label a cell"] },
          { label: "Review", minutes: 30, items: ["Review diagrams", "Summarize key processes"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Adigrat", "Ambo", "Arba Minch", "Bahir Dar", "Bonga", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Mekelle", "Mizan Tepi", "Wachemo", "Welkite", "Wollega", "Wollo"],
      },
      {
        day: 23,
        title: "General Chemistry",
        focus: "Atomic structure, bonding, reactions",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Atomic structure and periodic table", "Chemical bonding"] },
          { label: "Afternoon", minutes: 60, items: ["Chemical reactions and equations", "Practice: Balance 5 equations"] },
          { label: "Review", minutes: 30, items: ["Review periodic table", "Summarize bonding types"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Adigrat", "Ambo", "Arba Minch", "Bahir Dar", "Bonga", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Mekelle", "Mizan Tepi", "Wachemo", "Welkite", "Wollega", "Wollo"],
      },
      {
        day: 24,
        title: "General Physics",
        focus: "Motion, forces, energy",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Newton's laws of motion", "Force and acceleration"] },
          { label: "Afternoon", minutes: 60, items: ["Work, energy, power", "Practice: Solve 5 physics problems"] },
          { label: "Review", minutes: 30, items: ["Review formulas", "Create a formula sheet"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Adigrat", "Ambo", "Arba Minch", "Bahir Dar", "Bonga", "Dire Dawa", "Gondar", "Haramaya", "Hawassa", "Jimma", "Jinka", "Mekelle", "Mizan Tepi", "Wachemo", "Welkite", "Wollega", "Wollo"],
      },
      {
        day: 25,
        title: "Review Day (Days 21–24)",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review all notes", "Practice weak areas"] },
          { label: "Afternoon", minutes: 90, items: ["Mini practice test (40 questions)", "Check answersEvening (1 hour):", "Rest"] },
        ],
        allUniversities: false,
        universities: [],
      },
      {
        day: 26,
        title: "Organic Chemistry (For Health/Medicine Students)",
        focus: "Carbon compounds and reactions",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Hydrocarbons (alkanes, alkenes, alkynes)", "Functional groups"] },
          { label: "Afternoon", minutes: 60, items: ["Reactions of organic compounds", "Practice: Name 10 organic compounds"] },
          { label: "Review", minutes: 30, items: ["Review functional groups", "Summarize reactions"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Bahir Dar", "Gondar", "Haramaya", "Jimma", "Mekelle", "Wachemo", "Welkite"],
      },
      {
        day: 27,
        title: "Human Anatomy and Physiology (For Health/Medicine Students)",
        focus: "Body systems",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Skeletal system", "Muscular system"] },
          { label: "Afternoon", minutes: 60, items: ["Circulatory system", "Respiratory system", "Practice: Label diagrams"] },
          { label: "Review", minutes: 30, items: ["Review diagrams", "Summarize each system"] },
          { label: "Practice", minutes: 30, items: ["10 questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Bahir Dar", "Gondar", "Haramaya", "Jimma", "Mekelle", "Wachemo", "Welkite"],
      },
      {
        day: 28,
        title: "COC Content",
        focus: "COC exam preparation",
        blocks: [
          { label: "Morning", minutes: 60, items: ["Review Grade 12 Biology and Chemistry", "Key concepts for COC"] },
          { label: "Afternoon", minutes: 60, items: ["Practice COC-style questions", "Review ethical questions"] },
          { label: "Review", minutes: 30, items: ["Review weak areas", "Summarize key topics"] },
          { label: "Practice", minutes: 30, items: ["15 COC questions"] },
        ],
        allUniversities: false,
        universities: ["AAU", "Bahir Dar", "Gondar", "Haramaya", "Jimma", "Mekelle", "Wachemo", "Welkite"],
      },
      {
        day: 29,
        title: "Full Review Day",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 120, items: ["Review all notes from Days 1–28", "Focus on weak areas"] },
          { label: "Afternoon", minutes: 120, items: ["Full practice test (60 questions)", "Check answersEvening (1 hour):", "Rest"] },
        ],
        allUniversities: false,
        universities: [],
      },
      {
        day: 30,
        title: "Final Review &amp; Preparation",
        focus: "",
        blocks: [
          { label: "Morning", minutes: 90, items: ["Review all formula sheets and key notes", "Practice weak areas"] },
          { label: "Afternoon", minutes: 90, items: ["Final practice test (60 questions)", "Check answersEvening (1 hour):", "Rest, relax, prepare mentally", "Write down your goals for university"] },
        ],
        allUniversities: false,
        universities: [],
      },
    ],
  },
]
