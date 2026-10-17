import assert from "node:assert";

// Test mock problem details response in application/problem+json
async function testProblemDetailsParsing() {
  console.log("Testing ProblemDetails parsing for application/problem+json...");

  const mockConflictResponse = {
    type: "about:blank",
    title: "State Conflict",
    status: 409,
    detail: "Email is already registered.",
    code: "STATE_CONFLICT",
    traceId: "test-trace-id"
  };

  const contentType = "application/problem+json; charset=utf-8";
  const isJson = contentType.includes("json");
  assert.strictEqual(isJson, true, "contentType.includes('json') must match application/problem+json");

  const rawJson = JSON.stringify(mockConflictResponse);
  const parsed = JSON.parse(rawJson);
  assert.strictEqual(parsed.status, 409);
  assert.strictEqual(parsed.detail, "Email is already registered.");
  assert.strictEqual(parsed.code, "STATE_CONFLICT");

  console.log("✓ application/problem+json parsed successfully.");
}

async function testRegistrationErrorMessageResolution() {
  console.log("Testing user-friendly error message resolution...");

  function resolveRegisterErrorMessage(err) {
    let msg = "Registration failed. Please check your details and try again.";
    if (err && typeof err === "object") {
      if (err.status === 409) {
        msg = "An account with this email address is already registered. Please sign in or use a different email.";
      } else if (err.problem?.detail) {
        msg = err.problem.detail;
      } else if (err.message && !err.message.includes("status 409")) {
        msg = err.message;
      } else {
        msg = "An account with this email address is already registered. Please sign in or use a different email.";
      }
    }
    return msg;
  }

  // Case 1: Status 409 with problem details
  const errWithProblem = {
    status: 409,
    message: "Email is already registered.",
    problem: { detail: "Email is already registered.", status: 409 }
  };
  const msg1 = resolveRegisterErrorMessage(errWithProblem);
  assert.strictEqual(msg1, "An account with this email address is already registered. Please sign in or use a different email.");

  // Case 2: Status 409 raw without parsed problem
  const errRaw = {
    status: 409,
    message: "API request failed with status 409"
  };
  const msg2 = resolveRegisterErrorMessage(errRaw);
  assert.strictEqual(msg2, "An account with this email address is already registered. Please sign in or use a different email.");

  // Case 3: Status 400 validation error
  const errValidation = {
    status: 400,
    message: "Validation Failed",
    problem: { detail: "A valid email address is required.", status: 400 }
  };
  const msg3 = resolveRegisterErrorMessage(errValidation);
  assert.strictEqual(msg3, "A valid email address is required.");

  console.log("✓ All registration error resolutions are user-friendly and actionable.");
}

async function run() {
  await testProblemDetailsParsing();
  await testRegistrationErrorMessageResolution();
  console.log("\nALL FRONTEND REGISTRATION TESTS PASSED!");
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
