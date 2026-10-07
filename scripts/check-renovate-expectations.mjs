#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

async function readJson(path, description) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${description} at ${path}: ${error.message}`);
  }
}

function requireString(value, field, index) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expectation ${index + 1} must define a non-empty ${field}`);
  }
}

function validateExpectation(expectation, index) {
  if (!expectation || typeof expectation !== "object" || Array.isArray(expectation)) {
    throw new Error(`Expectation ${index + 1} must be an object`);
  }

  requireString(expectation.manager, "manager", index);
  requireString(expectation.packageFile, "packageFile", index);
  requireString(expectation.depName, "depName", index);

  if (expectation.datasource !== undefined) {
    requireString(expectation.datasource, "datasource", index);
  }

  if (expectation.currentValue !== undefined) {
    requireString(expectation.currentValue, "currentValue", index);
  }

  if (expectation.currentValuePattern !== undefined) {
    requireString(expectation.currentValuePattern, "currentValuePattern", index);
    try {
      new RegExp(expectation.currentValuePattern);
    } catch (error) {
      throw new Error(
        `Expectation ${index + 1} has an invalid currentValuePattern: ${error.message}`,
      );
    }
  }

  if (
    expectation.currentValue !== undefined &&
    expectation.currentValuePattern !== undefined
  ) {
    throw new Error(
      `Expectation ${index + 1} cannot define both currentValue and currentValuePattern`,
    );
  }

  if (
    expectation.count !== undefined &&
    (!Number.isInteger(expectation.count) || expectation.count < 0)
  ) {
    throw new Error(`Expectation ${index + 1} count must be a non-negative integer`);
  }
}

function flattenDependencies(report) {
  const dependencies = [];

  for (const repository of Object.values(report.repositories ?? {})) {
    for (const [manager, packageFiles] of Object.entries(
      repository.packageFiles ?? {},
    )) {
      for (const packageFile of packageFiles ?? []) {
        for (const dependency of packageFile.deps ?? []) {
          dependencies.push({
            manager,
            packageFile: packageFile.packageFile,
            ...dependency,
          });
        }
      }
    }
  }

  return dependencies;
}

function matchesExpectation(dependency, expectation) {
  if (
    dependency.manager !== expectation.manager ||
    dependency.packageFile !== expectation.packageFile ||
    dependency.depName !== expectation.depName
  ) {
    return false;
  }

  if (
    expectation.datasource !== undefined &&
    dependency.datasource !== expectation.datasource
  ) {
    return false;
  }

  if (
    expectation.currentValue !== undefined &&
    dependency.currentValue !== expectation.currentValue
  ) {
    return false;
  }

  if (expectation.currentValuePattern !== undefined) {
    return (
      typeof dependency.currentValue === "string" &&
      new RegExp(expectation.currentValuePattern).test(dependency.currentValue)
    );
  }

  return true;
}

function describeExpectation(expectation) {
  const fields = [
    `manager=${JSON.stringify(expectation.manager)}`,
    `packageFile=${JSON.stringify(expectation.packageFile)}`,
    `depName=${JSON.stringify(expectation.depName)}`,
  ];

  if (expectation.datasource !== undefined) {
    fields.push(`datasource=${JSON.stringify(expectation.datasource)}`);
  }
  if (expectation.currentValue !== undefined) {
    fields.push(`currentValue=${JSON.stringify(expectation.currentValue)}`);
  }
  if (expectation.currentValuePattern !== undefined) {
    fields.push(
      `currentValuePattern=${JSON.stringify(expectation.currentValuePattern)}`,
    );
  }

  return fields.join(", ");
}

async function main() {
  const [reportPath, expectationsPath] = process.argv.slice(2);
  if (!reportPath || !expectationsPath) {
    throw new Error(
      "Usage: check-renovate-expectations.mjs <report.json> <expectations.json>",
    );
  }

  const report = await readJson(reportPath, "Renovate report");
  const contract = await readJson(expectationsPath, "expectations file");

  if (!Array.isArray(contract.expectations) || contract.expectations.length === 0) {
    throw new Error("The expectations file must contain a non-empty expectations array");
  }

  contract.expectations.forEach(validateExpectation);
  const dependencies = flattenDependencies(report);

  contract.expectations.forEach((expectation, index) => {
    const expectedCount = expectation.count ?? 1;
    const matches = dependencies.filter((dependency) =>
      matchesExpectation(dependency, expectation),
    );

    if (matches.length !== expectedCount) {
      fail(
        `Expectation ${index + 1} matched ${matches.length} dependencies; expected ` +
          `${expectedCount}. ${describeExpectation(expectation)}`,
      );
      return;
    }

    console.log(
      `✓ Expectation ${index + 1} matched ${matches.length} ` +
        `${matches.length === 1 ? "dependency" : "dependencies"}`,
    );
  });
}

main().catch((error) => {
  fail(error.message);
});
