export const planLabels = [
  "Plan A", "Plan B", "Plan C", "Plan D", "Plan E", "Plan F",
  "Plan G", "Plan H", "Plan I", "Plan J", "Plan K", "Plan L",
] as const;

export type PlanLabel = (typeof planLabels)[number];
export const priorityKeys = ["passion", "familyApproval", "financialSecurity", "socialRecognition", "stability", "independence", "workLifeBalance", "accessibility"] as const;
export type PriorityKey = (typeof priorityKeys)[number];
export type PriorityPreference = { importance: number; confidence: number; confirmed: boolean; evidence: string[]; conflicts: string[]; updatedAt?: string };
export type PriorityPreferences = Partial<Record<PriorityKey, PriorityPreference>>;

export type Profile = {
  name: string; stage: string; goal: string; interests: string[]; values: string[]; skills: string[];
  budget: number; location: string; canRelocate: boolean; hoursWeekly: number; incomeDeadlineMonths: number;
  familyExpectation: string; peerInfluence: string; socialStatusExpectation: string; supports: string;
  supportMode: "student" | "guardian-supported"; priorities: PriorityPreferences;
};

export type ResearchSource = { label: string; url: string; retrievedAt?: string; supports?: string[] };
export type Opportunity = {
  id: string; title: string; route: string; focus: string; tags: string[]; durationMonths: number; estimatedCost: number;
  incomeMonths: number; locationMode: "local" | "hybrid" | "relocation"; weeklyHours: number; requirements: string[];
  sources: ResearchSource[]; dataStatus: "Starter catalogue - verify current details"; evidenceQuality: number;
  priorityFit: Partial<Record<PriorityKey, number>>;
};
export type Eligibility = { feasible: boolean; satisfied: string[]; blockers: string[]; assumptions: string[]; missingInformation: string[] };
export type ScoreBreakdown = { profileMatch: number; priorityCompatibility: number | null; feasibility: number; evidenceQuality: number; ranking: number };
export type Pathway = {
  id: string; plan: PlanLabel; title: string; focus: string; score: number; compatibilityScore: number | null; feasibilityScore: number;
  evidenceQuality: number; recommendationConfidence: number; scoreBreakdown: ScoreBreakdown; missingPriorityData: PriorityKey[];
  rationale: string; opportunity: Opportunity; eligibility: Eligibility; risks: string[]; milestones: string[]; conditionsToReconsider: string[];
};
export type Simulation = { changed: Array<{ label: string; before: string; after: string }>; previous: Pathway[]; updated: Pathway[]; newlyFeasible: string[]; newlyInfeasible: string[] };
export type ActionStatus = "not-started" | "in-progress" | "completed" | "blocked" | "postponed" | "skipped";
export type ActionItem = {
  id: string; title: string; reason: string; suggestedDay: number; estimatedMinutes: number; cost: number; documents: string[];
  sourceUrl?: string; status: ActionStatus; complete: boolean; notes?: string; revisedFromId?: string;
};
export type ReplanCategory = "financial" | "family" | "time" | "motivation" | "qualification" | "unknown";
export type ReplanProposal = { obstacle: string; categories: ReplanCategory[]; changedAssumptions: string[]; explanation: string; preservedTaskIds: string[]; revisedTasks: ActionItem[]; requiresConfirmation: true };

export const priorityLabels: Record<PriorityKey, string> = {
  passion: "Personal passion and interest", familyApproval: "Family approval", financialSecurity: "Financial security",
  socialRecognition: "Social recognition", stability: "Job stability", independence: "Personal independence",
  workLifeBalance: "Work-life balance", accessibility: "Accessibility and support fit",
};

export const defaultProfile: Profile = {
  name: "", stage: "", goal: "", interests: [], values: [], skills: [], budget: 0, location: "", canRelocate: false,
  hoursWeekly: 0, incomeDeadlineMonths: 0, familyExpectation: "", peerInfluence: "", socialStatusExpectation: "", supports: "", supportMode: "student", priorities: {},
};
export const exampleProfile: Profile = {
  ...defaultProfile, name: "Maya (example)", stage: "Class 12 / early career exploration", goal: "Build a creative and financially sustainable career",
  interests: ["music", "technology"], values: ["creative freedom", "financial stability"], skills: ["visual organisation", "structured problem solving"],
  budget: 60000, location: "Near home", hoursWeekly: 12, incomeDeadlineMonths: 12,
  familyExpectation: "A stable, respected career with a clear income path", peerInfluence: "Friends are preparing for conventional degree routes",
  socialStatusExpectation: "Engineering, medicine or government work are viewed as safest", supports: "No support needs recorded yet",
  priorities: {
    passion: { importance: 90, confidence: 90, confirmed: true, evidence: ["Creative career stated"], conflicts: [] },
    financialSecurity: { importance: 90, confidence: 85, confirmed: true, evidence: ["Financially sustainable goal stated"], conflicts: [] },
    familyApproval: { importance: 70, confidence: 70, confirmed: true, evidence: ["Stable path reported as a family expectation"], conflicts: [] },
  },
};

const starterStatus = "Starter catalogue - verify current details" as const;
export const opportunityCatalogue: Opportunity[] = [
  {
    id: "music-tech", title: "Music technology portfolio route", route: "Foundation course -> portfolio -> local internship / freelance work", focus: "Music + technology",
    tags: ["music", "technology", "audio", "creative", "portfolio"], durationMonths: 9, estimatedCost: 18000, incomeMonths: 9, locationMode: "hybrid", weeklyHours: 10,
    requirements: ["A regular practice schedule", "A portfolio of original or assisted work"], sources: [{ label: "National Career Service", url: "https://www.ncs.gov.in/" }, { label: "Skill India Digital", url: "https://www.skillindiadigital.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { passion: 88, financialSecurity: 65, socialRecognition: 55, stability: 58, independence: 82, workLifeBalance: 68 },
  },
  {
    id: "music-education", title: "Music education and performance route", route: "Local training -> teaching assistant / performances -> teaching portfolio", focus: "Music education + performance",
    tags: ["music", "teaching", "performance", "local", "creative"], durationMonths: 12, estimatedCost: 12000, incomeMonths: 6, locationMode: "local", weeklyHours: 8,
    requirements: ["Demonstrated musical practice", "Comfort working with learners"], sources: [{ label: "National Career Service", url: "https://www.ncs.gov.in/" }, { label: "National Scholarship Portal", url: "https://scholarships.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { passion: 84, familyApproval: 62, financialSecurity: 70, socialRecognition: 65, stability: 68, accessibility: 72 },
  },
  {
    id: "ui-design", title: "UI / digital design foundation", route: "Short course -> three case studies -> junior design applications", focus: "Digital design",
    tags: ["technology", "design", "visual", "portfolio", "creative"], durationMonths: 8, estimatedCost: 22000, incomeMonths: 10, locationMode: "hybrid", weeklyHours: 10,
    requirements: ["Three case studies", "Basic digital access"], sources: [{ label: "Skill India Digital", url: "https://www.skillindiadigital.gov.in/" }, { label: "National Career Service", url: "https://www.ncs.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { passion: 72, financialSecurity: 68, socialRecognition: 65, stability: 64, independence: 76, workLifeBalance: 66 },
  },
  {
    id: "it-support", title: "IT support and workplace technology", route: "Entry certification -> help-desk practice -> apprenticeships / junior roles", focus: "IT support",
    tags: ["technology", "problem solving", "stability", "systems"], durationMonths: 7, estimatedCost: 9000, incomeMonths: 8, locationMode: "local", weeklyHours: 9,
    requirements: ["Basic computer access", "Comfort with structured troubleshooting"], sources: [{ label: "National Career Service", url: "https://www.ncs.gov.in/" }, { label: "Skill India Digital", url: "https://www.skillindiadigital.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { passion: 45, familyApproval: 82, financialSecurity: 80, socialRecognition: 70, stability: 85, accessibility: 70 },
  },
  {
    id: "community-media", title: "Community media and communications", route: "Local projects -> writing / media samples -> internships", focus: "Media and communications",
    tags: ["media", "creative", "storytelling", "local", "technology"], durationMonths: 6, estimatedCost: 5000, incomeMonths: 7, locationMode: "local", weeklyHours: 7,
    requirements: ["A small sample portfolio", "Reliable weekly time"], sources: [{ label: "National Career Service", url: "https://www.ncs.gov.in/" }, { label: "Skill India Digital", url: "https://www.skillindiadigital.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { passion: 75, financialSecurity: 55, socialRecognition: 52, stability: 50, independence: 78, workLifeBalance: 70 },
  },
  {
    id: "degree-bridge", title: "Degree bridge with funded learning search", route: "Eligibility review -> scholarship search -> degree / diploma applications", focus: "Formal qualification pathway",
    tags: ["degree", "stability", "qualification", "technology"], durationMonths: 24, estimatedCost: 75000, incomeMonths: 24, locationMode: "relocation", weeklyHours: 18,
    requirements: ["Formal admission requirements", "Funding evidence", "Relocation planning"], sources: [{ label: "National Scholarship Portal", url: "https://scholarships.gov.in/" }, { label: "University Grants Commission", url: "https://www.ugc.gov.in/" }],
    dataStatus: starterStatus, evidenceQuality: 35, priorityFit: { familyApproval: 82, financialSecurity: 75, socialRecognition: 80, stability: 74, independence: 58, workLifeBalance: 45 },
  },
];

const normalize = (value: string) => value.toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const overlap = (values: string[], tags: string[]) => values.reduce((total, value) => total + (tags.some((tag) => normalize(value).includes(tag) || tag.includes(normalize(value))) ? 1 : 0), 0);
const profilePriorities = (profile: Profile): PriorityPreferences => profile.priorities ?? {};

export function evaluateEligibility(profile: Profile, opportunity: Opportunity): Eligibility {
  const satisfied: string[] = []; const blockers: string[] = []; const assumptions: string[] = []; const missingInformation: string[] = [];
  if (profile.budget >= opportunity.estimatedCost) satisfied.push(`Estimated starter cost (INR ${opportunity.estimatedCost.toLocaleString("en-IN")}) fits the recorded budget.`);
  else blockers.push(`Estimated starter cost is INR ${opportunity.estimatedCost.toLocaleString("en-IN")}, above the recorded INR ${profile.budget.toLocaleString("en-IN")} budget.`);
  if (opportunity.locationMode !== "relocation" || profile.canRelocate) satisfied.push(opportunity.locationMode === "local" ? "Can be explored close to home." : "Location setup is currently compatible.");
  else blockers.push("This route currently assumes relocation, which is not available in the recorded profile.");
  if (profile.hoursWeekly >= opportunity.weeklyHours) satisfied.push(`The route asks for about ${opportunity.weeklyHours} hours each week; ${profile.hoursWeekly} are available.`);
  else blockers.push(`The route needs about ${opportunity.weeklyHours} hours each week; only ${profile.hoursWeekly} are currently available.`);
  if (profile.incomeDeadlineMonths > 0 && profile.incomeDeadlineMonths >= opportunity.incomeMonths) satisfied.push(`The estimated first-income window (${opportunity.incomeMonths} months) fits the recorded deadline.`);
  else if (profile.incomeDeadlineMonths > 0) assumptions.push(`First-income timing is estimated at ${opportunity.incomeMonths} months and may miss the ${profile.incomeDeadlineMonths}-month income need.`);
  else missingInformation.push("No income deadline has been confirmed.");
  if (!profile.stage) missingInformation.push("Education or career stage has not been confirmed.");
  if (!profile.goal) missingInformation.push("Personal direction has not been confirmed.");
  assumptions.push("Course fees, admissions, scholarships and vacancies must be verified from official sources before committing.");
  return { feasible: blockers.length === 0, satisfied, blockers, assumptions, missingInformation };
}

function weightedCompatibility(profile: Profile, opportunity: Opportunity) {
  const preferences = profilePriorities(profile);
  const confirmed = priorityKeys.flatMap((key) => {
    const preference = preferences[key]; const fit = opportunity.priorityFit[key];
    return preference?.confirmed && typeof fit === "number" ? [{ importance: clamp(preference.importance), fit }] : [];
  });
  const missingPriorityData = priorityKeys.filter((key) => !preferences[key]?.confirmed);
  if (!confirmed.length) return { score: null, missingPriorityData };
  const denominator = confirmed.reduce((total, item) => total + item.importance, 0);
  if (!denominator) return { score: null, missingPriorityData };
  return { score: clamp(confirmed.reduce((total, item) => total + item.importance * item.fit, 0) / denominator), missingPriorityData };
}

function profileMatch(profile: Profile, opportunity: Opportunity) {
  const goalText = `${profile.goal} ${profile.values.join(" ")} ${profile.skills.join(" ")}`;
  return clamp(28 + overlap([...profile.interests, goalText], opportunity.tags) * 14);
}
function scoreOpportunity(profile: Profile, opportunity: Opportunity, eligibility: Eligibility): ScoreBreakdown & { missingPriorityData: PriorityKey[]; recommendationConfidence: number } {
  const compatibility = weightedCompatibility(profile, opportunity); const match = profileMatch(profile, opportunity);
  const feasibility = clamp(eligibility.feasible ? 100 - eligibility.assumptions.length * 5 : 45 - eligibility.blockers.length * 12);
  const evidenceQuality = opportunity.evidenceQuality; const ranking = clamp((compatibility.score ?? match) * 0.55 + feasibility * 0.3 + evidenceQuality * 0.15);
  const profileCoverage = 100 - Math.min(55, eligibility.missingInformation.length * 18 + compatibility.missingPriorityData.length * 5);
  return { profileMatch: match, priorityCompatibility: compatibility.score, feasibility, evidenceQuality, ranking, missingPriorityData: compatibility.missingPriorityData, recommendationConfidence: clamp(Math.min(profileCoverage, evidenceQuality + 35)) };
}
function pathwayFrom(profile: Profile, opportunity: Opportunity, plan: PlanLabel): Pathway {
  const eligibility = evaluateEligibility(profile, opportunity); const scored = scoreOpportunity(profile, opportunity, eligibility); const aspirationMatch = overlap(profile.interests, opportunity.tags) > 0;
  return {
    id: opportunity.id, plan, title: opportunity.title, focus: opportunity.focus, score: scored.ranking,
    compatibilityScore: scored.priorityCompatibility, feasibilityScore: scored.feasibility, evidenceQuality: scored.evidenceQuality, recommendationConfidence: scored.recommendationConfidence,
    scoreBreakdown: { profileMatch: scored.profileMatch, priorityCompatibility: scored.priorityCompatibility, feasibility: scored.feasibility, evidenceQuality: scored.evidenceQuality, ranking: scored.ranking },
    missingPriorityData: scored.missingPriorityData, opportunity, eligibility,
    rationale: aspirationMatch ? `Connects your recorded interests with ${opportunity.focus.toLowerCase()} while checking cost, time and location.` : "A different route that keeps recorded constraints visible rather than assuming one career must solve every priority.",
    risks: [eligibility.feasible ? "Competition and local availability can change." : "There are current hard-constraint blockers to resolve.", "Starter-catalogue fees, admissions and funding are not live-verified."],
    milestones: ["Week 1: verify entry requirements and local availability", `Month ${Math.max(1, Math.ceil(opportunity.durationMonths / 2))}: build evidence of learning`, `Month ${opportunity.incomeMonths}: begin supported applications or income experiments`],
    conditionsToReconsider: ["A verified cost or eligibility requirement differs from this starter record.", "Your confirmed budget, time, location or income deadline changes.", "You revise a priority after reviewing the trade-offs."],
  };
}

export function buildPathways(profile: Profile, maxPathways = planLabels.length): Pathway[] {
  const ranked = opportunityCatalogue.map((opportunity) => { const eligibility = evaluateEligibility(profile, opportunity); return { opportunity, score: scoreOpportunity(profile, opportunity, eligibility).ranking }; })
    .sort((a, b) => b.score - a.score || a.opportunity.estimatedCost - b.opportunity.estimatedCost).slice(0, Math.min(maxPathways, planLabels.length));
  return ranked.map(({ opportunity }, index) => pathwayFrom(profile, opportunity, planLabels[index]));
}
export function compareSimulation(baseline: Profile, scenario: Profile): Simulation {
  const previous = buildPathways(baseline); const updated = buildPathways(scenario);
  const previousFeasible = new Set(previous.filter((path) => path.eligibility.feasible).map((path) => path.opportunity.id)); const updatedFeasible = new Set(updated.filter((path) => path.eligibility.feasible).map((path) => path.opportunity.id));
  const changed = [
    baseline.budget !== scenario.budget && { label: "Budget", before: `INR ${baseline.budget.toLocaleString("en-IN")}`, after: `INR ${scenario.budget.toLocaleString("en-IN")}` },
    baseline.location !== scenario.location && { label: "Location", before: baseline.location || "Not confirmed", after: scenario.location || "Not confirmed" },
    baseline.canRelocate !== scenario.canRelocate && { label: "Relocation", before: baseline.canRelocate ? "Available" : "Not available", after: scenario.canRelocate ? "Available" : "Not available" },
    baseline.hoursWeekly !== scenario.hoursWeekly && { label: "Weekly time", before: `${baseline.hoursWeekly} hours`, after: `${scenario.hoursWeekly} hours` },
    baseline.incomeDeadlineMonths !== scenario.incomeDeadlineMonths && { label: "Income deadline", before: `${baseline.incomeDeadlineMonths} months`, after: `${scenario.incomeDeadlineMonths} months` },
  ].filter(Boolean) as Simulation["changed"];
  return { changed, previous, updated, newlyFeasible: [...updatedFeasible].filter((id) => !previousFeasible.has(id)), newlyInfeasible: [...previousFeasible].filter((id) => !updatedFeasible.has(id)) };
}
export function createActionPlan(pathway: Pathway): ActionItem[] {
  const [firstSource] = pathway.opportunity.sources;
  const task = (id: string, title: string, reason: string, suggestedDay: number, estimatedMinutes: number, documents: string[], sourceUrl?: string): ActionItem => ({ id: `${pathway.id}-${id}`, title, reason, suggestedDay, estimatedMinutes, cost: 0, documents, sourceUrl, status: "not-started", complete: false });
  return [
    task("verify", "Verify the route details", "Starter records are not live commitments. Confirm current cost, dates and entry requirements first.", 2, 40, ["A short note of questions to ask"], firstSource?.url),
    task("requirements", "Map your current qualifications", "Separate confirmed qualifications from requirements that still need evidence.", 5, 35, ["Current education records only if you choose to use them"]),
    task("portfolio", "Make one small proof of skill", "A tangible sample helps test your interest and supports later training or applications.", 10, 90, ["A photo, link or file of the work"]),
    task("funding", "Check funding and support options", "Funding eligibility can change whether this route is genuinely affordable.", 16, 45, ["Identity or education documents only if a verified application asks for them"], "https://scholarships.gov.in/"),
    task("conversation", "Have a route conversation with a trusted adult", "Share both your aspiration and practical plan; record real concerns rather than guessing them.", 23, 30, ["Your one-page pathway comparison"]),
    task("review", "Review evidence and choose the next milestone", "Compare verified information with the assumptions in this plan before investing more time or money.", 30, 30, ["Your verified notes and completed task evidence"], firstSource?.url),
  ];
}
function identifyObstacleCategories(obstacle: string): ReplanCategory[] {
  const text = normalize(obstacle); const matches: ReplanCategory[] = [];
  if (/(cost|money|budget|fee|afford|expense|scholarship)/.test(text)) matches.push("financial");
  if (/(family|parent|guardian|relative|approval|pressure)/.test(text)) matches.push("family");
  if (/(time|hour|busy|workload|responsibilit|schedule)/.test(text)) matches.push("time");
  if (/(motivat|comfortable|confidence|doubt|interest|enjoy)/.test(text)) matches.push("motivation");
  if (/(qualification|exam|admission|eligib|audition|degree)/.test(text)) matches.push("qualification");
  return matches.length ? matches : ["unknown"];
}
export function proposeReplan(pathway: Pathway, tasks: ActionItem[], obstacle: string): ReplanProposal {
  const categories = identifyObstacleCategories(obstacle); const preservedTaskIds = tasks.filter((task) => task.status === "completed" || task.complete).map((task) => task.id);
  const revisedTasks = tasks.map((task) => {
    if (preservedTaskIds.includes(task.id)) return { ...task, status: "completed" as const, complete: true };
    if (categories.includes("time")) return { ...task, suggestedDay: Math.min(30, task.suggestedDay + 3), status: task.status === "blocked" ? "blocked" as const : task.status, revisedFromId: task.id };
    if (categories.includes("financial") && task.id.endsWith("-funding")) return { ...task, title: "Verify lower-cost and funding alternatives", reason: "The reported financial obstacle needs verified options before this pathway is continued.", status: "in-progress" as const, revisedFromId: task.id };
    return task;
  });
  const additions: ActionItem[] = [];
  if (categories.includes("financial")) additions.push({ id: `${pathway.id}-replan-financial`, title: "Record the verified cost gap", reason: "Compare a confirmed cost with your available budget before changing the pathway.", suggestedDay: 3, estimatedMinutes: 30, cost: 0, documents: ["Verified fee or expense details"], status: "not-started", complete: false });
  if (categories.includes("family")) additions.push({ id: `${pathway.id}-replan-family`, title: "Clarify the family concern", reason: "Separate income, safety, reputation and location concerns so the plan can respond to the real issue.", suggestedDay: 4, estimatedMinutes: 30, cost: 0, documents: ["Notes you choose to keep"], status: "not-started", complete: false });
  if (categories.includes("motivation")) additions.push({ id: `${pathway.id}-replan-reflection`, title: "Run a small, low-risk route test", reason: "One difficult day does not decide a future. Use a bounded activity to gather clearer feedback.", suggestedDay: 5, estimatedMinutes: 60, cost: 0, documents: ["Your own reflection"], status: "not-started", complete: false });
  if (categories.includes("qualification")) additions.push({ id: `${pathway.id}-replan-eligibility`, title: "Verify the missing requirement", reason: "Confirm the exact rule from an official source before changing direction.", suggestedDay: 4, estimatedMinutes: 35, cost: 0, documents: ["Official eligibility note"], sourceUrl: pathway.opportunity.sources[0]?.url, status: "not-started", complete: false });
  const changedAssumptions = [
    categories.includes("financial") && "The original cost assumption may not fit the current budget.", categories.includes("family") && "The original family-support assumption needs a direct conversation, not a guess.",
    categories.includes("time") && "The original weekly-time assumption may be too high.", categories.includes("qualification") && "A qualification or entry-rule assumption needs official verification.",
    categories.includes("motivation") && "Comfort with the route needs more user-confirmed evidence.",
  ].filter(Boolean) as string[];
  return { obstacle, categories, changedAssumptions, explanation: "Completed work is preserved. This proposal changes only future work and requires your confirmation before it replaces the active roadmap.", preservedTaskIds, revisedTasks: [...revisedTasks, ...additions], requiresConfirmation: true };
}
export function aspirationPressureSummary(profile: Profile) {
  const goal = profile.goal || "No personal aspiration confirmed yet"; const family = profile.familyExpectation || "No family expectation recorded"; const peers = profile.peerInfluence || "No peer influence recorded"; const society = profile.socialStatusExpectation || "No social-status expectation recorded";
  const alignment = normalize(family).includes("stable") && profile.values.some((value) => normalize(value).includes("stability"));
  return { goal, family, peers, society, alignment: alignment ? "Financial stability appears in both your values and the recorded family expectation." : "No automatic alignment is assumed; review the wording together.", conflict: `${goal} may not be identical to ${family.toLowerCase()}. PATHWISE keeps both visible; it does not choose on your behalf.`, openQuestion: "Which parts of each expectation feel non-negotiable, flexible, or still uncertain?" };
}
