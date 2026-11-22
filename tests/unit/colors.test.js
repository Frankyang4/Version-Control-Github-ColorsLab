const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the actual browser script; only the DOM and HTTP boundary are simulated
const source = fs.readFileSync(path.join(__dirname, "../../js/code.js"), "utf8");

function loadBrowser() {
  const elements = new Map();
  const requests = [];
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "" });
    return elements.get(id);
  };

  class XMLHttpRequest {
    constructor() {
      this.open = jest.fn();
      this.setRequestHeader = jest.fn();
      this.send = jest.fn();
      requests.push(this);
    }

    respond(body) {
      this.readyState = 4;
      this.status = 200;
      this.responseText = JSON.stringify(body);
      this.onreadystatechange();
    }
  }

  const context = vm.createContext({
    document: {
      getElementById: element,
      getElementsByTagName: () => [element("colorList")],
      cookie: "",
    },
    window: { location: { href: "" } },
    XMLHttpRequest,
  });
  vm.runInContext(source, context);
  return { element, requests, context, run: (code) => vm.runInContext(code, context) };
}

test("addColor sends the entered color and current user ID to the API", () => {
  const browser = loadBrowser();
  browser.element("colorText").value = "Purple";
  browser.run("userId = 7; addColor();");

  expect(browser.requests).toHaveLength(1);
  const request = browser.requests[0];
  expect(request.open).toHaveBeenCalledWith(
    "POST", "http://cop4331.xyz/LAMPAPI/AddColor.php", true,
  );
  expect(request.setRequestHeader).toHaveBeenCalledWith(
    "Content-type", "application/json; charset=UTF-8",
  );
  expect(JSON.parse(request.send.mock.calls[0][0])).toEqual({
    color: "Purple", userId: 7,
  });
});

test("searchColor displays all returned names on separate lines", () => {
  const browser = loadBrowser();
  browser.element("searchText").value = "Blue";
  browser.run("userId = 7; searchColor();");
  expect(JSON.parse(browser.requests[0].send.mock.calls[0][0])).toEqual({
    search: "Blue", userId: 7,
  });

  browser.requests[0].respond({ results: ["Blue", "Light Blue"], error: "" });
  expect(browser.element("colorList").innerHTML).toBe("Blue<br />\r\nLight Blue");
});

test("an unsuccessful login displays an error and keeps the login page open", () => {
  const browser = loadBrowser();
  browser.element("loginName").value = "unknown";
  browser.element("loginPassword").value = "wrong-password";
  browser.run("doLogin();");
  browser.requests[0].respond({ id: 0, firstName: "", lastName: "", error: "No Records Found" });

  expect(browser.element("loginResult").innerHTML).toBe("User/Password combination incorrect");
  expect(browser.context.window.location.href).toBe("");
  expect(browser.context.document.cookie).toBe("");
});
