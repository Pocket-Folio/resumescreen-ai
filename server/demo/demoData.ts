/**
 * DEMO DATA — fictional job profiles, candidates, screening results and HR notes so the app can
 * be explored without an API key. Every record is flagged isDemo and labelled in the UI.
 * All people, companies, emails and phone numbers are invented.
 */
import type { Store } from "../db";
import type {
  Candidate,
  CriterionAssessment,
  JobProfile,
  ScreeningCriterion,
  ScreeningRecord,
  ScreeningResult,
} from "../../shared/types";
import { screeningNeedsReview } from "../../shared/screeningUtils";
import { PROMPT_VERSION } from "../services/claude/prompts/screenCandidate";

const daysAgo = (d: number, h = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 15, 0, 0);
  return t.toISOString();
};

const c = (id: string, criterion: string, requirement: string, importance: ScreeningCriterion["importance"], category: ScreeningCriterion["category"]): ScreeningCriterion => ({
  id,
  criterion,
  requirement,
  importance,
  category,
});

// ─── Job profiles ────────────────────────────────────────────

const backendCriteria = [
  c("demo_c1", "Python", "5+ years of professional experience", "required", "technical_skill"),
  c("demo_c2", "REST API design", "Designed and operated production APIs", "required", "technical_skill"),
  c("demo_c3", "AWS", "Hands-on experience (e.g. EC2, Lambda, RDS)", "important", "technical_skill"),
  c("demo_c4", "PostgreSQL", "Production experience", "important", "technical_skill"),
  c("demo_c5", "Bachelor's degree", "Computer Science or related field, or equivalent experience", "important", "education"),
  c("demo_c6", "Kubernetes", "Experience deploying services", "preferred", "technical_skill"),
  c("demo_c7", "AWS certification", "Solutions Architect or Developer Associate", "preferred", "certification"),
  c("demo_c8", "Mentoring", "Experience mentoring other engineers", "preferred", "experience"),
];

const financeCriteria = [
  c("demo_f1", "Financial modeling", "3+ years building forecasting or valuation models", "required", "experience"),
  c("demo_f2", "Advanced Excel", "Pivot tables, lookups, scenario analysis", "required", "technical_skill"),
  c("demo_f3", "Bachelor's degree", "Finance, Accounting or Economics", "required", "education"),
  c("demo_f4", "FP&A / budgeting", "Experience supporting budgeting or forecasting cycles", "important", "experience"),
  c("demo_f5", "SQL", "Able to query data independently", "important", "technical_skill"),
  c("demo_f6", "CFA", "Level I or higher", "preferred", "certification"),
  c("demo_f7", "BI tools", "Power BI or Tableau", "preferred", "technical_skill"),
];

export const demoJobProfiles: JobProfile[] = [
  {
    id: "demo_job_backend",
    title: "Senior Backend Engineer",
    department: "Engineering",
    location: "Remote (US)",
    employmentType: "full_time",
    description:
      "We are looking for a Senior Backend Engineer to design, build and operate the Python services behind our customer platform. You will own APIs end to end, work closely with product and frontend teams, and help raise the engineering bar through code review and mentoring.",
    required: {
      education: "",
      certifications: "",
      skills: "Ownership of production services, code review",
      technicalSkills: "Python, REST API design, relational databases",
      yearsExperience: "5+ years of professional software engineering",
      industryExperience: "",
      languages: "English (professional working proficiency)",
    },
    preferred: {
      education: "Bachelor's degree in Computer Science or related field",
      skills: "Mentoring, technical writing",
      certifications: "AWS Solutions Architect or Developer Associate",
      experience: "Kubernetes, event-driven architectures",
      industryExperience: "B2B SaaS",
    },
    criteria: backendCriteria,
    screeningInstructions: "Treat equivalent practical experience as satisfying the degree criterion when the resume shows it clearly.",
    status: "active",
    isDemo: true,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(21),
  },
  {
    id: "demo_job_finance",
    title: "Financial Analyst",
    department: "Finance",
    location: "Chicago, IL (Hybrid)",
    employmentType: "full_time",
    description:
      "The Financial Analyst supports monthly forecasting, annual budgeting and ad-hoc analysis for business leaders. You will build and maintain financial models, prepare variance reports and turn data into clear recommendations.",
    required: {
      education: "Bachelor's degree in Finance, Accounting or Economics",
      certifications: "",
      skills: "Financial modeling, variance analysis, clear written communication",
      technicalSkills: "Advanced Excel",
      yearsExperience: "3+ years in a finance or analyst role",
      industryExperience: "",
      languages: "English",
    },
    preferred: {
      education: "",
      skills: "Stakeholder presentations",
      certifications: "CFA Level I or higher",
      experience: "FP&A in a multi-department organisation",
      industryExperience: "Manufacturing or logistics",
    },
    criteria: financeCriteria,
    screeningInstructions: "",
    status: "active",
    isDemo: true,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14),
  },
];

// ─── Resumes ─────────────────────────────────────────────────

const RESUMES = {
  priya: `Priya Raman
Austin, TX | priya.raman@example.com | (555) 010-2231 | linkedin.com/in/priya-raman-demo

SUMMARY
Backend engineer with 8 years of experience building Python services and APIs for B2B SaaS products. Led the migration of a monolith to AWS-hosted microservices.

PROFESSIONAL EXPERIENCE
Staff Software Engineer — Northwind Analytics (Jan 2021 – Present)
- Lead engineer for the public REST API (Python, FastAPI) serving 1,200+ enterprise customers.
- Designed versioning and pagination standards adopted across 14 services.
- Migrated core services to AWS (ECS, Lambda, RDS PostgreSQL); reduced p95 latency by 38%.
- Mentor four engineers; run the backend guild's weekly design review.

Software Engineer — Bluebird Logistics Software (Jun 2017 – Dec 2020)
- Built Django REST Framework APIs for shipment tracking.
- Maintained PostgreSQL schemas and query performance for a 2 TB database.
- Introduced Kubernetes (EKS) deployments for three services.

EDUCATION
B.S. Computer Science — University of Texas at Austin (2013 – 2017)

CERTIFICATIONS
AWS Certified Solutions Architect – Associate (2022)

SKILLS
Python, FastAPI, Django, PostgreSQL, Redis, AWS (ECS, Lambda, RDS, SQS), Kubernetes, Terraform, OpenAPI, Git
Languages: English (native), Spanish (conversational)`,

  marcus: `MARCUS OYELARAN
Denver, CO • marcus.o@example.com • 555-014-7788 • github.com/marcus-o-demo

EXPERIENCE
Backend Developer, Summit Health Tech — 2021 to present
• Develop Python microservices (Flask) for appointment scheduling.
• Built internal REST endpoints consumed by mobile apps.
• Deploy services on AWS Lambda and API Gateway.
• Participated in on-call rotation.

Junior Developer, Crestline Digital — 2019 to 2021
• Wrote PHP and JavaScript for client websites.
• Automated reporting scripts in Python.
• Worked with MySQL databases.

EDUCATION
Coding Bootcamp Certificate — Front Range Code Academy, 2019
Coursework in Information Systems, Metro State (no degree listed)

CERTIFICATIONS
AWS Developer (in progress)

SKILLS
Python, Flask, AWS Lambda, API Gateway, DynamoDB, MySQL, Docker, JavaScript, PHP, Jira`,

  elena: `Elena Sokolova
Seattle, WA — elena.sokolova@example.com — (555) 019-4410

Senior Software Engineer with 10 years of experience across Python and Go backends.

EXPERIENCE
Senior Software Engineer, Cascade Payments (2019 – Present)
- Own the ledger service (Go, PostgreSQL) processing 3M transactions per day.
- Designed gRPC and REST interfaces for partner integrations.
- Mentored new hires and led the backend interview loop.

Software Engineer, Rainier Media (2014 – 2019)
- Python (Django) content APIs and background workers.
- Moved batch jobs from cron servers to Kubernetes CronJobs on GCP.

EDUCATION
M.S. Computer Science, University of Washington (2014)
B.S. Mathematics, Western Washington University (2012)

SKILLS
Python, Go, Django, PostgreSQL, Kafka, Kubernetes, GCP, Terraform`,

  daniel: `Daniel Park
Evanston, IL | daniel.park@example.com | (555) 012-9043

PROFESSIONAL EXPERIENCE
Senior Financial Analyst — Lakeshore Manufacturing Co. (Mar 2021 – Present)
- Own the monthly rolling forecast model (Excel) for a $450M business unit.
- Lead annual budget consolidation across 6 departments.
- Build variance reports and present findings to the VP of Finance.
- Query ERP data with SQL; built a Power BI dashboard for plant managers.

Financial Analyst — Great Lakes Freight (Jul 2018 – Feb 2021)
- Built three-statement and unit-economics models for new routes.
- Maintained Excel models using INDEX/MATCH, pivot tables and data tables for scenario analysis.

EDUCATION
B.S. Finance, University of Illinois Urbana-Champaign (2014 – 2018)

CERTIFICATIONS
CFA Level II Candidate

SKILLS
Financial modeling, Advanced Excel, SQL, Power BI, Budgeting, Forecasting, Variance analysis`,

  aisha: `Aisha Mensah
aisha.mensah@example.com

Analyst with experience in reporting and spreadsheets.

Work
Analyst – Brightline Consulting
Prepared client reports and spreadsheets. Helped with budget reviews.

Operations Associate – Harbor Retail
Tracked inventory and sales numbers in Excel.

Education
Economics coursework, DePaul University

Skills: Excel, PowerPoint, data entry, reporting`,
};

// ─── Screening results ───────────────────────────────────────

type A = Omit<CriterionAssessment, "criterion" | "importance" | "requirement">;
const assess = (crit: ScreeningCriterion, a: A): CriterionAssessment => ({
  criterion: crit.criterion,
  importance: crit.importance,
  requirement: crit.requirement,
  ...a,
});

const DEMO_MODEL = "claude-opus-5";

function priyaResult(at: string): ScreeningResult {
  const k = backendCriteria;
  return {
    candidateProfile: {
      currentRole: "Staff Software Engineer — Northwind Analytics",
      experience: [
        {
          company: "Northwind Analytics",
          position: "Staff Software Engineer",
          startDate: "Jan 2021",
          endDate: "Present",
          duration: "Approximately 4 years 8 months",
          responsibilities: ["Lead engineer for public REST API (FastAPI)", "Migrated core services to AWS", "Mentors four engineers"],
        },
        {
          company: "Bluebird Logistics Software",
          position: "Software Engineer",
          startDate: "Jun 2017",
          endDate: "Dec 2020",
          duration: "Approximately 3 years 7 months",
          responsibilities: ["Built Django REST Framework APIs", "Maintained PostgreSQL schemas", "Introduced Kubernetes (EKS) deployments"],
        },
      ],
      education: [{ institution: "University of Texas at Austin", degree: "B.S.", field: "Computer Science", dates: "2013 – 2017" }],
      skills: {
        technical: ["Python", "FastAPI", "Django", "PostgreSQL", "Redis", "OpenAPI"],
        soft: ["Mentoring", "Design review facilitation"],
        tools: ["AWS (ECS, Lambda, RDS, SQS)", "Kubernetes", "Terraform", "Git"],
        languages: ["English (native)", "Spanish (conversational)"],
        certifications: ["AWS Certified Solutions Architect – Associate (2022)"],
      },
    },
    candidateSummary:
      "Backend engineer with roughly eight years of stated experience building Python services and REST APIs for B2B SaaS and logistics software. Currently a Staff Software Engineer leading a public API and a migration to AWS. Resume lists PostgreSQL, Kubernetes and an AWS Solutions Architect certification, and describes mentoring four engineers.",
    matchedSkills: ["Python", "REST API design", "AWS", "PostgreSQL", "Kubernetes", "Mentoring", "Code review"],
    partiallyMatchedSkills: [],
    skillsNotFound: ["Technical writing", "Event-driven architectures"],
    additionalSkills: ["Terraform", "Redis", "OpenAPI", "FastAPI"],
    experienceAnalysis: {
      totalApparentExperience: "Approximately 8 years (Jun 2017 – present), based on listed roles",
      relevantExperience: "Approximately 8 years of Python backend work",
      industryExperience: "B2B SaaS (Northwind Analytics, stated as serving enterprise customers) and logistics software",
      notes: "Durations are calculated from the month/year ranges stated in the resume. Based on information available in the resume.",
    },
    relevantExperience: [
      {
        company: "Northwind Analytics",
        role: "Staff Software Engineer",
        dates: "Jan 2021 – Present",
        relevance: "Directly relevant to Python, REST API design, AWS, PostgreSQL and mentoring criteria.",
        responsibilities: ["Public REST API for 1,200+ enterprise customers", "API versioning standards", "AWS migration (ECS, Lambda, RDS PostgreSQL)"],
        evidenceType: "explicit",
      },
      {
        company: "Bluebird Logistics Software",
        role: "Software Engineer",
        dates: "Jun 2017 – Dec 2020",
        relevance: "Relevant to Python, REST APIs, PostgreSQL and Kubernetes criteria.",
        responsibilities: ["Django REST Framework APIs", "PostgreSQL performance on 2 TB database", "Kubernetes (EKS) deployments"],
        evidenceType: "explicit",
      },
    ],
    educationAssessment: [
      {
        item: "B.S. Computer Science — University of Texas at Austin",
        requirement: "Bachelor's degree in Computer Science or related field (preferred)",
        status: "meets",
        evidence: "Education section lists B.S. Computer Science, University of Texas at Austin (2013 – 2017).",
        source: "Education",
        needsVerification: false,
      },
    ],
    certificationAssessment: [
      {
        item: "AWS Certified Solutions Architect – Associate",
        requirement: "AWS Solutions Architect or Developer Associate (preferred)",
        status: "meets",
        evidence: "Certifications section lists AWS Certified Solutions Architect – Associate (2022).",
        source: "Certifications",
        needsVerification: true,
      },
    ],
    criteria: [
      assess(k[0], {
        status: "meets",
        evidence: "Python work described in both roles: FastAPI (Jan 2021 – Present) and Django REST Framework (Jun 2017 – Dec 2020), about 8 years in total.",
        source: "Professional Experience",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[1], {
        status: "meets",
        evidence: "\"Lead engineer for the public REST API … serving 1,200+ enterprise customers\" and \"Designed versioning and pagination standards adopted across 14 services.\"",
        source: "Professional Experience — Northwind Analytics",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[2], {
        status: "meets",
        evidence: "\"Migrated core services to AWS (ECS, Lambda, RDS PostgreSQL)\".",
        source: "Professional Experience — Northwind Analytics",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[3], {
        status: "meets",
        evidence: "\"Maintained PostgreSQL schemas and query performance for a 2 TB database\"; RDS PostgreSQL in current role.",
        source: "Professional Experience",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[4], {
        status: "meets",
        evidence: "B.S. Computer Science, University of Texas at Austin (2013 – 2017).",
        source: "Education",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[5], {
        status: "meets",
        evidence: "\"Introduced Kubernetes (EKS) deployments for three services.\"",
        source: "Professional Experience — Bluebird Logistics Software",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[6], {
        status: "meets",
        evidence: "AWS Certified Solutions Architect – Associate (2022) is listed.",
        source: "Certifications",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Associate-level AWS certifications expire after three years; confirm it is current.",
      }),
      assess(k[7], {
        status: "meets",
        evidence: "\"Mentor four engineers; run the backend guild's weekly design review.\"",
        source: "Professional Experience — Northwind Analytics",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
    ],
    missingInformation: ["No examples of technical writing or documentation work are mentioned."],
    verificationItems: ["Confirm the AWS Solutions Architect – Associate certification (2022) is still valid."],
    questionsForHR: [
      "Can the candidate describe a significant API design decision they made and its trade-offs?",
      "Is the AWS certification current, and can the candidate provide the credential ID?",
    ],
    limitations: [],
    overallAssessment: "strong_alignment",
    overallRationale:
      "Both required criteria (Python 5+ years and REST API design) are met with explicit evidence from two roles. All important criteria (AWS, PostgreSQL, degree) are also met. The AWS certification should be verified as current.",
    generatedAt: at,
    model: DEMO_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

function marcusResult(at: string): ScreeningResult {
  const k = backendCriteria;
  return {
    candidateProfile: {
      currentRole: "Backend Developer — Summit Health Tech",
      experience: [
        {
          company: "Summit Health Tech",
          position: "Backend Developer",
          startDate: "2021",
          endDate: "Present",
          duration: null,
          responsibilities: ["Python (Flask) microservices", "Internal REST endpoints for mobile apps", "AWS Lambda and API Gateway deployments"],
        },
        {
          company: "Crestline Digital",
          position: "Junior Developer",
          startDate: "2019",
          endDate: "2021",
          duration: null,
          responsibilities: ["PHP and JavaScript for client websites", "Python reporting scripts", "MySQL databases"],
        },
      ],
      education: [
        { institution: "Front Range Code Academy", degree: "Coding Bootcamp Certificate", field: null, dates: "2019" },
        { institution: "Metro State", degree: null, field: "Information Systems (coursework)", dates: null },
      ],
      skills: {
        technical: ["Python", "Flask", "JavaScript", "PHP", "MySQL", "DynamoDB"],
        soft: [],
        tools: ["AWS Lambda", "API Gateway", "Docker", "Jira"],
        languages: [],
        certifications: ["AWS Developer (in progress)"],
      },
    },
    candidateSummary:
      "Backend developer currently building Python (Flask) microservices and REST endpoints deployed on AWS Lambda at a health-tech company, since 2021. Previously a junior developer working mainly in PHP and JavaScript, with some Python scripting. Education consists of a coding bootcamp certificate and Information Systems coursework.",
    matchedSkills: ["Python", "AWS"],
    partiallyMatchedSkills: ["REST API design", "Code review"],
    skillsNotFound: ["PostgreSQL", "Kubernetes", "Mentoring", "Technical writing"],
    additionalSkills: ["DynamoDB", "Docker", "Flask"],
    experienceAnalysis: {
      totalApparentExperience: "Approximately 5–6 years (2019 – present), based on year-only dates",
      relevantExperience: "Approximately 3–4 years of primarily-Python backend work (2021 – present); earlier Python use was limited to scripts",
      industryExperience: "Health technology and digital agency work; no B2B SaaS stated",
      notes: "The resume gives years without months, so durations are approximate. Based on information available in the resume.",
    },
    relevantExperience: [
      {
        company: "Summit Health Tech",
        role: "Backend Developer",
        dates: "2021 – present",
        relevance: "Relevant to Python, REST APIs and AWS criteria.",
        responsibilities: ["Python (Flask) microservices", "REST endpoints for mobile apps", "AWS Lambda / API Gateway"],
        evidenceType: "explicit",
      },
      {
        company: "Crestline Digital",
        role: "Junior Developer",
        dates: "2019 – 2021",
        relevance: "Partially relevant: Python reporting scripts; mostly PHP/JavaScript web work.",
        responsibilities: ["Python reporting automation", "MySQL"],
        evidenceType: "explicit",
      },
    ],
    educationAssessment: [
      {
        item: "Coding Bootcamp Certificate; Information Systems coursework (no degree listed)",
        requirement: "Bachelor's degree in Computer Science or related field, or equivalent experience",
        status: "partially_meets",
        evidence: "Education lists a bootcamp certificate (2019) and coursework at Metro State with no degree listed.",
        source: "Education",
        needsVerification: true,
      },
    ],
    certificationAssessment: [
      {
        item: "AWS Developer (in progress)",
        requirement: "AWS Solutions Architect or Developer Associate (preferred)",
        status: "partially_meets",
        evidence: "Certifications section states \"AWS Developer (in progress)\".",
        source: "Certifications",
        needsVerification: true,
      },
    ],
    criteria: [
      assess(k[0], {
        status: "partially_meets",
        evidence: "Python microservices since 2021 (about 3–4 years); earlier role mentions only \"Automated reporting scripts in Python\" (2019 – 2021).",
        source: "Professional Experience",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Year-only dates; the extent of Python use in the 2019 – 2021 role is unclear.",
      }),
      assess(k[1], {
        status: "partially_meets",
        evidence: "\"Built internal REST endpoints consumed by mobile apps.\" No mention of designing public APIs or API standards.",
        source: "Professional Experience — Summit Health Tech",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[2], {
        status: "meets",
        evidence: "\"Deploy services on AWS Lambda and API Gateway.\"",
        source: "Professional Experience — Summit Health Tech",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[3], {
        status: "not_found",
        evidence: "PostgreSQL is not mentioned. The resume lists MySQL and DynamoDB.",
        source: null,
        evidenceType: "absent",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[4], {
        status: "partially_meets",
        evidence: "No bachelor's degree listed; bootcamp certificate and Information Systems coursework. Around 5–6 years of development experience may count as equivalent experience under the profile's instructions.",
        source: "Education",
        evidenceType: "inferred",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Whether experience counts as equivalent is an HR judgement.",
      }),
      assess(k[5], {
        status: "not_found",
        evidence: "Kubernetes is not mentioned. Docker is listed in skills.",
        source: null,
        evidenceType: "absent",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[6], {
        status: "partially_meets",
        evidence: "\"AWS Developer (in progress)\" — not yet obtained according to the resume.",
        source: "Certifications",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: true,
        verificationReason: "Confirm current status and expected completion date.",
      }),
      assess(k[7], {
        status: "not_found",
        evidence: "No mention of mentoring or leading other engineers.",
        source: null,
        evidenceType: "absent",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
    ],
    missingInformation: [
      "Exact start and end months for both roles (only years are given).",
      "PostgreSQL or other relational database experience beyond MySQL.",
      "Any mentoring or code review experience.",
      "Spoken/written language proficiency is not specified.",
    ],
    verificationItems: [
      "Confirm total years of professional Python experience.",
      "Confirm status of the AWS Developer certification.",
      "Clarify whether Information Systems coursework led to a degree.",
    ],
    questionsForHR: [
      "How much of the 2019 – 2021 role involved Python development?",
      "Has the candidate designed APIs used outside their own team?",
      "Does the candidate have experience with PostgreSQL specifically?",
    ],
    limitations: ["Dates are given as years only, so experience durations are approximate."],
    overallAssessment: "moderate_alignment",
    overallRationale:
      "Both required criteria are partially met: Python backend work is explicit since 2021 but may fall short of five years, and REST API work is shown without evidence of API design ownership. AWS is met; PostgreSQL, Kubernetes and mentoring are not mentioned. Several items need verification because dates are year-only.",
    generatedAt: at,
    model: DEMO_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

function danielResult(at: string): ScreeningResult {
  const k = financeCriteria;
  return {
    candidateProfile: {
      currentRole: "Senior Financial Analyst — Lakeshore Manufacturing Co.",
      experience: [
        {
          company: "Lakeshore Manufacturing Co.",
          position: "Senior Financial Analyst",
          startDate: "Mar 2021",
          endDate: "Present",
          duration: "Approximately 4 years 6 months",
          responsibilities: ["Monthly rolling forecast model", "Annual budget consolidation across 6 departments", "SQL queries and Power BI dashboard"],
        },
        {
          company: "Great Lakes Freight",
          position: "Financial Analyst",
          startDate: "Jul 2018",
          endDate: "Feb 2021",
          duration: "Approximately 2 years 8 months",
          responsibilities: ["Three-statement and unit-economics models", "Scenario analysis in Excel"],
        },
      ],
      education: [{ institution: "University of Illinois Urbana-Champaign", degree: "B.S.", field: "Finance", dates: "2014 – 2018" }],
      skills: {
        technical: ["Financial modeling", "Advanced Excel", "SQL", "Variance analysis"],
        soft: ["Presenting to senior leadership"],
        tools: ["Power BI", "ERP systems"],
        languages: [],
        certifications: ["CFA Level II Candidate"],
      },
    },
    candidateSummary:
      "Finance professional with about seven years of stated analyst experience in manufacturing and freight. Currently owns a rolling forecast model and leads budget consolidation for a manufacturing business unit. Lists SQL and Power BI, a B.S. in Finance, and CFA Level II candidacy.",
    matchedSkills: ["Financial modeling", "Advanced Excel", "Variance analysis", "SQL", "Power BI", "Budgeting"],
    partiallyMatchedSkills: [],
    skillsNotFound: ["Written communication (not directly evidenced)"],
    additionalSkills: ["Unit-economics modeling"],
    experienceAnalysis: {
      totalApparentExperience: "Approximately 7 years (Jul 2018 – present), based on listed roles",
      relevantExperience: "Approximately 7 years of financial modeling and analysis",
      industryExperience: "Manufacturing (Lakeshore Manufacturing Co.) and logistics (Great Lakes Freight), as stated",
      notes: "Based on information available in the resume.",
    },
    relevantExperience: [
      {
        company: "Lakeshore Manufacturing Co.",
        role: "Senior Financial Analyst",
        dates: "Mar 2021 – Present",
        relevance: "Relevant to financial modeling, FP&A/budgeting, SQL and BI criteria.",
        responsibilities: ["Rolling forecast model for $450M unit", "Budget consolidation", "Variance reporting to VP Finance"],
        evidenceType: "explicit",
      },
      {
        company: "Great Lakes Freight",
        role: "Financial Analyst",
        dates: "Jul 2018 – Feb 2021",
        relevance: "Relevant to financial modeling and Excel criteria.",
        responsibilities: ["Three-statement models", "Scenario analysis with data tables"],
        evidenceType: "explicit",
      },
    ],
    educationAssessment: [
      {
        item: "B.S. Finance — University of Illinois Urbana-Champaign",
        requirement: "Bachelor's degree in Finance, Accounting or Economics",
        status: "meets",
        evidence: "Education lists B.S. Finance (2014 – 2018).",
        source: "Education",
        needsVerification: false,
      },
    ],
    certificationAssessment: [
      {
        item: "CFA Level II Candidate",
        requirement: "CFA Level I or higher (preferred)",
        status: "meets",
        evidence: "\"CFA Level II Candidate\" implies Level I has been passed, but the resume does not state this directly.",
        source: "Certifications",
        needsVerification: true,
      },
    ],
    criteria: [
      assess(k[0], {
        status: "meets",
        evidence: "Rolling forecast model (Mar 2021 – Present) and three-statement models (Jul 2018 – Feb 2021): about 7 years.",
        source: "Professional Experience",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[1], {
        status: "meets",
        evidence: "\"Maintained Excel models using INDEX/MATCH, pivot tables and data tables for scenario analysis.\"",
        source: "Professional Experience — Great Lakes Freight",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[2], {
        status: "meets",
        evidence: "B.S. Finance, University of Illinois Urbana-Champaign.",
        source: "Education",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[3], {
        status: "meets",
        evidence: "\"Lead annual budget consolidation across 6 departments.\"",
        source: "Professional Experience — Lakeshore Manufacturing Co.",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[4], {
        status: "meets",
        evidence: "\"Query ERP data with SQL.\"",
        source: "Professional Experience — Lakeshore Manufacturing Co.",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: false,
        verificationReason: null,
      }),
      assess(k[5], {
        status: "meets",
        evidence: "\"CFA Level II Candidate\" — being a Level II candidate normally requires having passed Level I.",
        source: "Certifications",
        evidenceType: "inferred",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Confirm Level I has been passed (inferred from Level II candidacy).",
      }),
      assess(k[6], {
        status: "meets",
        evidence: "\"Built a Power BI dashboard for plant managers.\"",
        source: "Professional Experience — Lakeshore Manufacturing Co.",
        evidenceType: "explicit",
        confidence: "high",
        needsVerification: false,
        verificationReason: null,
      }),
    ],
    missingInformation: ["No direct examples of written reports or memos, beyond variance reports."],
    verificationItems: ["Confirm CFA Level I has been passed."],
    questionsForHR: ["Can the candidate walk through the structure of their rolling forecast model?", "What is the expected timing of the CFA Level II exam?"],
    limitations: [],
    overallAssessment: "strong_alignment",
    overallRationale:
      "All three required criteria are met with explicit evidence, as are the important FP&A and SQL criteria. The CFA criterion is met by inference from Level II candidacy and should be verified.",
    generatedAt: at,
    model: DEMO_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

function aishaResult(at: string): ScreeningResult {
  const k = financeCriteria;
  const absent = (crit: ScreeningCriterion, evidence: string): CriterionAssessment =>
    assess(crit, { status: "not_found", evidence, source: null, evidenceType: "absent", confidence: "high", needsVerification: false, verificationReason: null });
  return {
    candidateProfile: {
      currentRole: "Analyst — Brightline Consulting (dates not stated)",
      experience: [
        { company: "Brightline Consulting", position: "Analyst", startDate: null, endDate: null, duration: null, responsibilities: ["Prepared client reports and spreadsheets", "Helped with budget reviews"] },
        { company: "Harbor Retail", position: "Operations Associate", startDate: null, endDate: null, duration: null, responsibilities: ["Tracked inventory and sales numbers in Excel"] },
      ],
      education: [{ institution: "DePaul University", degree: null, field: "Economics (coursework)", dates: null }],
      skills: { technical: ["Excel", "Reporting"], soft: [], tools: ["PowerPoint"], languages: [], certifications: [] },
    },
    candidateSummary:
      "Candidate describes analyst and operations roles involving reports, spreadsheets and budget reviews. The resume is brief and gives no dates, so the length of experience cannot be determined. Education lists Economics coursework at DePaul University without stating a degree.",
    matchedSkills: [],
    partiallyMatchedSkills: ["Advanced Excel", "Budgeting"],
    skillsNotFound: ["Financial modeling", "Variance analysis", "SQL", "Power BI / Tableau"],
    additionalSkills: ["PowerPoint"],
    experienceAnalysis: {
      totalApparentExperience: null,
      relevantExperience: null,
      industryExperience: "Consulting and retail, as stated",
      notes: "No employment dates are provided, so experience cannot be calculated. Based on information available in the resume.",
    },
    relevantExperience: [
      {
        company: "Brightline Consulting",
        role: "Analyst",
        dates: null,
        relevance: "Possibly relevant to budgeting and Excel criteria; responsibilities are described only briefly.",
        responsibilities: ["Client reports and spreadsheets", "Budget reviews"],
        evidenceType: "explicit",
      },
    ],
    educationAssessment: [
      {
        item: "Economics coursework — DePaul University",
        requirement: "Bachelor's degree in Finance, Accounting or Economics",
        status: "unclear",
        evidence: "Resume lists \"Economics coursework, DePaul University\" without a degree or dates.",
        source: "Education",
        needsVerification: true,
      },
    ],
    certificationAssessment: [
      { item: "CFA", requirement: "CFA Level I or higher (preferred)", status: "not_found", evidence: "No certifications are listed.", source: null, needsVerification: false },
    ],
    criteria: [
      absent(k[0], "Financial modeling is not mentioned. The resume refers to reports and spreadsheets only."),
      assess(k[1], {
        status: "unclear",
        evidence: "Excel is listed and used for tracking inventory and sales numbers, but no advanced features (pivot tables, lookups, scenario analysis) are described.",
        source: "Skills; Work — Harbor Retail",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Level of Excel proficiency is not described.",
      }),
      assess(k[2], {
        status: "unclear",
        evidence: "\"Economics coursework, DePaul University\" — it is not stated whether a degree was completed.",
        source: "Education",
        evidenceType: "explicit",
        confidence: "medium",
        needsVerification: true,
        verificationReason: "Degree completion not stated.",
      }),
      assess(k[3], {
        status: "partially_meets",
        evidence: "\"Helped with budget reviews\" at Brightline Consulting; scope and duration are not described.",
        source: "Work — Brightline Consulting",
        evidenceType: "explicit",
        confidence: "low",
        needsVerification: true,
        verificationReason: "Extent of budgeting involvement is unclear.",
      }),
      absent(k[4], "SQL is not mentioned."),
      absent(k[5], "No CFA or other certification is listed."),
      absent(k[6], "Power BI and Tableau are not mentioned."),
    ],
    missingInformation: [
      "Employment dates for all roles — years of experience cannot be determined.",
      "Whether a bachelor's degree was completed.",
      "Any description of financial modeling work.",
      "Level of Excel proficiency.",
      "Phone number and location are not listed (not required for screening).",
    ],
    verificationItems: ["Confirm degree status at DePaul University.", "Confirm dates and scope of the Brightline Consulting analyst role."],
    questionsForHR: [
      "Can the candidate provide dates for each role?",
      "Has the candidate built financial models? Can they describe one?",
      "Which Excel features does the candidate use regularly?",
    ],
    limitations: ["The resume is very short and lacks dates, which limits the reliability of this screening."],
    overallAssessment: "insufficient_information",
    overallRationale:
      "None of the three required criteria can be confirmed from the resume: financial modeling is not mentioned, Excel proficiency level is unclear, and degree completion is not stated. This reflects missing information rather than evidence that the candidate lacks these qualifications.",
    generatedAt: at,
    model: DEMO_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

// ─── Loader ──────────────────────────────────────────────────

interface DemoCandidateSpec {
  id: string;
  job: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  resume: string;
  fileName: string;
  createdDaysAgo: number;
  screening?: (at: string) => ScreeningResult;
  screenedDaysAgo?: number;
  review?: Candidate["hrReview"];
}

export function loadDemoData(store: Store): { jobProfiles: number; candidates: number; screenings: number } {
  // Reloading replaces previous demo records instead of duplicating them.
  store.deleteDemoData();
  for (const j of demoJobProfiles) store.saveJobProfile(j);

  const specs: DemoCandidateSpec[] = [
    {
      id: "demo_cand_priya",
      job: "demo_job_backend",
      name: "Priya Raman",
      email: "priya.raman@example.com",
      phone: "(555) 010-2231",
      location: "Austin, TX",
      links: ["linkedin.com/in/priya-raman-demo"],
      resume: RESUMES.priya,
      fileName: "Priya_Raman_Resume.pdf",
      createdDaysAgo: 9,
      screening: priyaResult,
      screenedDaysAgo: 8,
      review: {
        reviewer: "Jordan Lee (Demo)",
        status: "completed",
        notes: "Resume evidence matches the AI assessment. Verified API ownership claims against LinkedIn profile summary.",
        followUpQuestions: "Ask about the monolith-to-microservices migration and how API versioning was rolled out.",
        verificationRequired: "Request AWS certification credential ID.",
        decision: "continue_review",
        updatedAt: daysAgo(7),
      },
    },
    {
      id: "demo_cand_marcus",
      job: "demo_job_backend",
      name: "Marcus Oyelaran",
      email: "marcus.o@example.com",
      phone: "555-014-7788",
      location: "Denver, CO",
      links: ["github.com/marcus-o-demo"],
      resume: RESUMES.marcus,
      fileName: "Marcus_Oyelaran_CV.docx",
      createdDaysAgo: 6,
      screening: marcusResult,
      screenedDaysAgo: 5,
    },
    {
      id: "demo_cand_elena",
      job: "demo_job_backend",
      name: "Elena Sokolova",
      email: "elena.sokolova@example.com",
      phone: "(555) 019-4410",
      location: "Seattle, WA",
      links: [],
      resume: RESUMES.elena,
      fileName: "Elena_Sokolova.txt",
      createdDaysAgo: 1,
    },
    {
      id: "demo_cand_daniel",
      job: "demo_job_finance",
      name: "Daniel Park",
      email: "daniel.park@example.com",
      phone: "(555) 012-9043",
      location: "Evanston, IL",
      links: [],
      resume: RESUMES.daniel,
      fileName: "Daniel_Park_Resume.pdf",
      createdDaysAgo: 4,
      screening: danielResult,
      screenedDaysAgo: 3,
      review: {
        reviewer: "Sam Rivera (Demo)",
        status: "in_progress",
        notes: "Strong evidence on modeling and budgeting. Waiting on hiring manager availability.",
        followUpQuestions: "Confirm CFA Level I pass date.",
        verificationRequired: "CFA Level I status.",
        decision: "hold_for_review",
        updatedAt: daysAgo(2),
      },
    },
    {
      id: "demo_cand_aisha",
      job: "demo_job_finance",
      name: "Aisha Mensah",
      email: "aisha.mensah@example.com",
      phone: "",
      location: "",
      links: [],
      resume: RESUMES.aisha,
      fileName: "Aisha_Mensah_Resume.docx",
      createdDaysAgo: 3,
      screening: aishaResult,
      screenedDaysAgo: 2,
    },
  ];

  let screenings = 0;
  for (const s of specs) {
    const created = daysAgo(s.createdDaysAgo, 9);
    const ext = s.fileName.split(".").pop() as "pdf" | "docx" | "txt";
    let cand: Candidate = {
      id: s.id,
      jobProfileId: s.job,
      name: s.name,
      email: s.email,
      phone: s.phone,
      location: s.location,
      links: s.links,
      resumeText: s.resume,
      file: { name: s.fileName, size: Buffer.byteLength(s.resume) * 12, type: ext, uploadedAt: created },
      extraction: { status: "success", error: null, warnings: [] },
      screeningStatus: "not_screened",
      hrReview: s.review ?? null,
      latestScreeningId: null,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    };
    store.saveCandidate(cand);
    if (s.screening && s.screenedDaysAgo !== undefined) {
      const at = daysAgo(s.screenedDaysAgo, 11);
      const profile = demoJobProfiles.find((j) => j.id === s.job)!;
      const record: ScreeningRecord = {
        id: `demo_scr_${s.id.slice(10)}`,
        candidateId: s.id,
        jobProfileId: s.job,
        jobProfileSnapshot: profile,
        model: DEMO_MODEL,
        promptVersion: PROMPT_VERSION,
        result: s.screening(at),
        redaction: { contactInfo: true, name: true },
        usage: null,
        durationMs: 0,
        isDemo: true,
        createdAt: at,
      };
      store.insertScreening(record);
      screenings++;
      cand = {
        ...cand,
        latestScreeningId: record.id,
        screeningStatus: screeningNeedsReview(record) ? "needs_review" : "screened",
        updatedAt: at,
      };
      store.saveCandidate(cand);
    }
  }
  return { jobProfiles: demoJobProfiles.length, candidates: specs.length, screenings };
}
