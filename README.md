A Brief Description of the COLORS Application:
Colors application is running website that shows colors input by users and saves them accordingly to the account they registered.

Technologies Used
- Digital Ocean (Droplet)
- GoDaddy (Domain)
- VSCode (Frontend)
- Apache (Web Server Host)
- MySQL (Database)
- PHP (Backend)

High-level Setup Instructions
1. Install the LAMP STACK Components
2. Provision Ubuntu/Linux on Digital Ocean
3. Log into MySQL and implement database
4. Clone or upload the repository files into Apache web root directory
5. Connect database to LAMPAPI credentials (Local DB)

How to run and access the applicaiton:
Open a web browser and navigate to your configured domain. Login to access the content.

Assumptions, Limitations, or AI Usage:
Designed specifically as a lab project demonstrating basic operations. Does not have reset password or user authentication.

## Automated tests and CI

The `add-automated-tests` branch extends Assignment 4's existing workflow in
`.github/workflows/lint.yml`. Both pushes and pull requests run two jobs:

- `lint`: the existing HTMLHint, Stylelint, and ESLint checks.
- `test`: Jest unit tests and integration tests using PHP 8.3 with mysqli and
  a disposable MySQL 8.4 service.

### What the tests verify

| File | Tests | Boundary exercised |
| --- | --- | --- |
| `tests/unit/colors.test.js` | Color submission, search rendering, and rejected-login UI | Actual `js/code.js` functions with simulated DOM and HTTP requests |
| `tests/integration/api.test.js` | Successful login, rejected login, user-specific search, and adding then retrieving a color | Real HTTP requests to the PHP endpoints and a real test database |

Unit tests load the browser script in a Node VM, so the application does not need
to change its browser globals into Node exports. Integration tests prepare sample data directly in `beforeAll()`,
start a PHP HTTP server on an available loopback port, check status,
JSON content type, and response values, and stop the server afterward.

This supplies three front-end unit tests and four integration tests. A successful
login must return the seeded user's ID and name, so a database connection failure
cannot accidentally pass as a valid test result.

### Run the checks

Use Node 24 or a compatible newer version and run commands from the repository
root. After cloning, install the locked development dependencies:

```text
npm ci
npm run lint
npm run test:unit
```

The integration suite additionally requires PHP with mysqli and a running MySQL
server. GitHub Actions sets these up automatically. To run it locally, create a
dedicated database and account using a MySQL administrator connection:

```sql
CREATE DATABASE IF NOT EXISTS colorslab_test;
CREATE USER IF NOT EXISTS 'colors_test'@'%' IDENTIFIED BY 'colors_test_password';
GRANT ALL PRIVILEGES ON colorslab_test.* TO 'colors_test'@'%';
```

Configure the test connection in PowerShell:

```powershell
$env:COLORS_DB_HOST = '127.0.0.1'
$env:COLORS_DB_PORT = '3306'
$env:COLORS_DB_NAME = 'colorslab_test'
$env:COLORS_DB_USER = 'colors_test'
$env:COLORS_DB_PASSWORD = 'colors_test_password'
# If php is not on PATH, also set PHP_BINARY to your php.exe's full path.
npm test
```

`npm test` runs both suites; `npm run test:integration` runs just the API suite.
The `beforeAll()` hook in `tests/integration/api.test.js` resets the `Users`
and `Colors` tables in this
dedicated test database on every integration run. It refuses to run unless
`COLORS_DB_NAME` is explicitly `colorslab_test`. There is no separate fixtures file. Test credentials and rows are
synthetic and are separate from the deployed application's data.

The three endpoints accept `COLORS_DB_HOST`, `COLORS_DB_PORT`, `COLORS_DB_NAME`,
`COLORS_DB_USER`, and `COLORS_DB_PASSWORD`. When these variables are unset, they
retain the existing application connection defaults. The test schema is
only the minimal schema needed to exercise the supplied SQL, not a production
database migration.

### Debugging example

The new integration tests initially failed because `Login.php` had a blank line
before its opening PHP tag. That output prevented the JSON content-type header
from being sent when output buffering was disabled. Removing the leading blank
line fixed the response and made the checks pass. The tests continue to assert
the content type as well as parsing the JSON.

### Check the result on GitHub

1. Commit the workflow, dependency files, tests, ESLint configuration, endpoint
   connection changes, and README on the new branch.
2. Push the branch and open a pull request into `main`.
3. Open the repository's Actions tab and inspect the `CI` run for that commit.
4. Confirm both `lint` and `test` pass. The test log should show seven passing
   tests across the `unit` and `integration` projects.
5. If a job fails, expand the failed step, fix its reported issue, and push again.

A passing local run verifies the code on that machine; a passing Actions run
must be confirmed after the branch is pushed.
