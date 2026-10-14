/**
 * Standalone API Health Integration Check.
 * Completely decoupled from Next.js build compilation.
 * Run via: npm run test:api
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5248";

async function checkApiHealth() {
  console.log(`Connecting to backend API at: ${API_BASE_URL}/api/v1/health ...`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Backend returned HTTP status: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log("Backend Health Response:", JSON.stringify(data, null, 2));

    if (data.status === "Healthy") {
      console.log(">>> SUCCESS: Backend API is online, healthy, and accessible! <<<");
      process.exit(0);
    } else {
      console.error(`Unexpected health status: ${data.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to connect to backend API:", error.message);
    console.error("Make sure the backend is running at http://localhost:5248 via: dotnet run --project src/TrustedMarketplace.Api");
    process.exit(1);
  }
}

checkApiHealth();
