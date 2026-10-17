import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPathways,
  compareSimulation,
  createActionPlan,
  evaluateEligibility,
  exampleProfile,
  opportunityCatalogue,
  proposeReplan,
} from "../src/lib/pathway-engine.js";

test("generates differentiated labelled pathways", () => {
  const pathways = buildPathways(exampleProfile);
  assert.deepEqual(pathways.map((pathway) => pathway.plan), ["Plan A", "Plan B", "Plan C", "Plan D", "Plan E", "Plan F"]);
  assert.equal(new Set(pathways.map((pathway) => pathway.opportunity.id)).size, pathways.length);
  assert.ok(pathways.every((pathway) => pathway.scoreBreakdown.ranking === pathway.score));
  assert.ok(pathways.every((pathway) => pathway.compatibilityScore !== null));
});

test("does not let a route exceed the recorded budget without a blocker", () => {
  const lowBudgetProfile = { ...exampleProfile, budget: 5000, canRelocate: false };
  const degreeBridge = opportunityCatalogue.find((item) => item.id === "degree-bridge");
  assert.ok(degreeBridge);
  const eligibility = evaluateEligibility(lowBudgetProfile, degreeBridge);
  assert.equal(eligibility.feasible, false);
  assert.ok(eligibility.blockers.some((item) => item.includes("above the recorded")));
  assert.ok(eligibility.blockers.some((item) => item.includes("relocation")));
});

test("recalculates a structured scenario without mutating the confirmed profile", () => {
  const scenario = { ...exampleProfile, budget: 5000, hoursWeekly: 6, canRelocate: false };
  const simulation = compareSimulation(exampleProfile, scenario);
  assert.equal(exampleProfile.budget, 60000);
  assert.equal(scenario.budget, 5000);
  assert.ok(simulation.changed.some((change) => change.label === "Budget"));
  assert.ok(simulation.updated.some((pathway) => pathway.opportunity.estimatedCost <= 5000));
});

test("creates trackable action tasks from a selected pathway", () => {
  const pathway = buildPathways(exampleProfile)[0];
  const tasks = createActionPlan(pathway);
  assert.equal(tasks.length, 6);
  assert.ok(tasks.every((task) => task.complete === false));
  assert.ok(tasks.every((task) => task.status === "not-started"));
  assert.ok(tasks.every((task) => task.suggestedDay >= 1 && task.suggestedDay <= 30));
});

test("keeps completed tasks while a financial obstacle proposes a revision", () => {
  const pathway = buildPathways(exampleProfile)[0];
  const tasks = createActionPlan(pathway).map((task, index) => index === 0 ? { ...task, complete: true, status: "completed" as const } : task);
  const proposal = proposeReplan(pathway, tasks, "The course fee is more than I can afford and my budget dropped.");
  assert.equal(proposal.requiresConfirmation, true);
  assert.ok(proposal.categories.includes("financial"));
  assert.ok(proposal.preservedTaskIds.includes(tasks[0].id));
  assert.equal(proposal.revisedTasks.find((task) => task.id === tasks[0].id)?.status, "completed");
  assert.ok(proposal.revisedTasks.some((task) => task.id.includes("replan-financial")));
});
