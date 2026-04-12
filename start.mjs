// Wrapper that sets env vars and launches the server
// Set your credentials here or use environment variables
process.env.BAMBOOHR_API_KEY = process.env.BAMBOOHR_API_KEY || "";
process.env.BAMBOOHR_COMPANY_DOMAIN = process.env.BAMBOOHR_COMPANY_DOMAIN || "";
await import("./src/index.ts");
