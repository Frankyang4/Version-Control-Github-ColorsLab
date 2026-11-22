const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const root = path.join(__dirname, "../..");
const php = process.env.PHP_BINARY || "php";
let server;
let baseUrl;
let serverLog = "";

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

beforeAll(async () => {
  // Require an explicit test database; does not default to the app's normal database
  if (process.env.COLORS_DB_NAME !== "colorslab_test") {
    throw new Error("Set COLORS_DB_NAME=colorslab_test and configure the test MySQL connection. See README.md.");
  }

  const environment = {
    ...process.env,
    COLORS_DB_HOST: process.env.COLORS_DB_HOST || "127.0.0.1",
    COLORS_DB_USER: process.env.COLORS_DB_USER || "colors_test",
    COLORS_DB_PASSWORD: process.env.COLORS_DB_PASSWORD || "colors_test_password",
    COLORS_DB_PORT: process.env.COLORS_DB_PORT || "3306",
  };
  const setup = spawnSync(php, [], {
    // Run database preparation inline through PHP standard input.
    input: `<?php
// Reset only the dedicated, disposable test database.
if (getenv('COLORS_DB_NAME') !== 'colorslab_test') {
    fwrite(STDERR, "Set COLORS_DB_NAME=colorslab_test before running integration tests.\\n");
    exit(1);
}

$conn = new mysqli(
    getenv('COLORS_DB_HOST') ?: '127.0.0.1',
    getenv('COLORS_DB_USER') ?: 'colors_test',
    getenv('COLORS_DB_PASSWORD') ?: 'colors_test_password',
    'colorslab_test',
    (int)(getenv('COLORS_DB_PORT') ?: 3306)
);

$conn->query('CREATE TABLE IF NOT EXISTS Users (
    ID INT PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    Login VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(100) NOT NULL
)');
$conn->query('CREATE TABLE IF NOT EXISTS Colors (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    Name VARCHAR(100) NOT NULL
)');
$conn->query('DELETE FROM Colors');
$conn->query('DELETE FROM Users');
$conn->query("INSERT INTO Users (ID,firstName,lastName,Login,Password) VALUES
    (1,'Test','User','ci-user','ci-password'),
    (2,'Other','User','other-user','other-password')");
$conn->query("INSERT INTO Colors (UserId,Name) VALUES
    (1,'Blue'), (2,'Other Blue')");
$conn->close();
echo "Test database initialized.\\n";
`,
    env: environment, encoding: "utf8", timeout: 10000,
  });
  if (setup.error || setup.status !== 0) {
    throw new Error(`Could not initialize the test database. Check PHP with mysqli and MySQL.\n${setup.error?.message || setup.stderr || setup.stdout}`);
  }

  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(php, ["-S", `127.0.0.1:${port}`, "-t", root], {
    env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  let startupError;
  server.on("error", (error) => { startupError = error; });
  server.stdout.on("data", (data) => { serverLog += data; });
  server.stderr.on("data", (data) => { serverLog += data; });

  for (let attempt = 0; attempt < 50; attempt++) {
    if (startupError) throw startupError;
    if (server.exitCode !== null) throw new Error(`PHP server exited.\n${serverLog}`);
    const response = await fetch(`${baseUrl}/index.html`, {
      signal: AbortSignal.timeout(500),
    }).catch(() => null);
    if (response?.ok) return;
    await delay(100);
  }
  throw new Error(`PHP server did not become ready.\n${serverLog}`);
}, 20000);

afterAll(async () => {
  if (server && server.exitCode === null && server.pid) {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill();
    });
  }
});

async function post(endpoint, body) {
  const response = await fetch(`${baseUrl}/LAMPAPI/${endpoint}.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  return response.json();
}

test("Login.php returns the seeded user's ID and name as JSON", async () => {
  const result = await post("Login", { login: "ci-user", password: "ci-password" });
  expect(result).toEqual({ id: 1, firstName: "Test", lastName: "User", error: "" });
});

test("Login.php rejects the wrong password with its documented error response", async () => {
  const result = await post("Login", { login: "ci-user", password: "wrong-password" });
  expect(result).toEqual({ id: 0, firstName: "", lastName: "", error: "No Records Found" });
});

test("SearchColors.php filters matching colors by user ID", async () => {
  const result = await post("SearchColors", { search: "Blue", userId: 1 });
  expect(result).toEqual({ results: ["Blue"], error: "" });
});

test("a color added through AddColor.php can be found through SearchColors.php", async () => {
  expect(await post("AddColor", { color: "CI Purple", userId: 1 })).toEqual({ error: "" });
  expect(await post("SearchColors", { search: "CI Purple", userId: 1 })).toEqual({
    results: ["CI Purple"], error: "",
  });
});
