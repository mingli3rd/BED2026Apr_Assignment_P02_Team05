const swaggerAutogen = require("swagger-autogen")();

const outputFile = "./swagger-output.json"; // Output file for the spec
const routes = ["./app.js"]; // Path to your API route files

const doc = {
  info: {
    title: "SG Hawker Hub API",
    description: "REST API for the SG Hawker Hub vendor/patron ordering platform.",
    version: "1.0.0",
  },
  host: "localhost:3000",
  basePath: "/",
  schemes: ["http"],
  securityDefinitions: {
    cookieAuth: {
      type: "apiKey",
      in: "cookie",
      name: "token",
      description: "JWT issued on login (POST /api/auth/login), sent automatically as an HTTP-only cookie named 'token'.",
    },
  },
};

swaggerAutogen(outputFile, routes, doc).then(() => {
  console.log("Swagger file generated at", outputFile);
});