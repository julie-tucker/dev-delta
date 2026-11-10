// ============================================================
// Subscription Tracker - dev|delta
// one js file that all the pages share
// ============================================================

// figure out if we are inside the pages folder so the fetch paths work
const inPages = window.location.pathname.includes("/pages/");
const basePath = inPages ? "../" : "";

// this one object holds everything the app knows
let appState = {
  app: { name: "Subscription Tracker", version: "1.0" },
  user: { username: null, authenticated: false, role: null },
  data: [],
  session: { started: null }
};

// null = we are adding a new subscription, a number = we are editing that id
let editingId = null;


// ---------- helper functions ----------

// shows a bootstrap alert at the top of the page
function showMessage(text, type) {
  const area = document.getElementById("message-area");
  if (!area) return;
  area.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      <span id="message-text"></span>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
  document.getElementById("message-text").textContent = text;
}

// makes user typed text safe to put inside innerHTML
function cleanText(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMoney(number) {
  return "$" + Number(number).toFixed(2);
}

function formatDate(dateString) {
  const parts = dateString.split("-");
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status) {
  if (status === "Active") return "bg-success";
  if (status === "Review") return "bg-warning text-dark";
  return "bg-secondary";
}


// ---------- app state + sessionStorage ----------

function saveState() {
  try {
    sessionStorage.setItem("appState", JSON.stringify(appState));
    console.log("[SESSION] appState saved");
  } catch (error) {
    console.log("[SESSION] could not save appState", error);
    showMessage("Unable to save changes.", "danger");
  }
}

// fetch the starting json file and put it in appState
async function fetchStartingData() {
  const response = await fetch(basePath + "data/subscriptions.json");
  if (!response.ok) {
    throw new Error("bad response: " + response.status);
  }
  appState.data = await response.json();
  console.log(`[DATA] loaded ${appState.data.length} records from subscriptions.json`);
  saveState();
}

// use saved data if it exists, if not fetch the starting json
async function loadState() {
  const saved = sessionStorage.getItem("appState");
  if (saved) {
    try {
      appState = JSON.parse(saved);
      console.log(`[DATA] loaded ${appState.data.length} records from sessionStorage`);
      return;
    } catch (error) {
      console.log("[SESSION] saved state was broken, starting over", error);
    }
  }
  try {
    await fetchStartingData();
  } catch (error) {
    console.log("[DATA] could not load starting data", error);
    showMessage("Could not load starting data.", "danger");
  }
}


// ---------- authentication (who are you?) ----------

async function getUsers() {
  const response = await fetch(basePath + "data/users.json");
  if (!response.ok) {
    throw new Error("could not load users.json");
  }
  return await response.json();
}

// prints the test accounts in the console so they are easy to find
async function logTestAccounts() {
  try {
    const users = await getUsers();
    const admin = users.find(u => u.role === "admin");
    const regular = users.find(u => u.role === "user");
    console.log("[DEV] test credentials loaded");
    console.log(`
DEV TEST ACCOUNTS

ADMIN
username: ${admin.username}
password: ${admin.password}

USER
username: ${regular.username}
password: ${regular.password}
`);
  } catch (error) {
    console.log("[DEV] could not load test accounts", error);
  }
}

function signOut() {
  console.log(`[AUTH] user signed out: ${appState.user.username}`);
  appState.user = { username: null, authenticated: false, role: null };
  appState.session.started = null;
  saveState();
  window.location.href = basePath + "index.html";
}

function setupSignIn() {
  const signinForm = document.getElementById("signin-form");

  // already signed in? no need to show the form
  if (appState.user.authenticated) {
    signinForm.classList.add("d-none");
    showMessage("You are already signed in as " + appState.user.username + ".", "success");
    return;
  }

  signinForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("signin-username").value.trim();
    const password = document.getElementById("signin-password").value;

    if (username === "" || password === "") {
      showMessage("Please enter a username and a password.", "warning");
      return;
    }

    try {
      const users = await getUsers();
      const match = users.find(u => u.username === username && u.password === password);

      if (!match) {
        console.log(`[AUTH] sign in failed for: ${username}`);
        showMessage("Sign-in failed. Check your username and password.", "danger");
        return;
      }

      // save who is signed in (not the password)
      appState.user = { username: match.username, authenticated: true, role: match.role };
      appState.session.started = new Date().toISOString();
      saveState();
      console.log(`[AUTH] user authenticated: ${match.username}`);
      console.log(`[AUTHZ] role: ${match.role}`);
      window.location.href = "../index.html";
    } catch (error) {
      console.log("[AUTH] error while signing in", error);
      showMessage("Sign-in failed. Could not load the account data.", "danger");
    }
  });
}


// ---------- authorization (what are you allowed to do?) ----------
// USER  = read, create, edit their own subscriptions
// ADMIN = everything a user can do + edit anything, delete, admin page

function isSignedIn() {
  return appState.user.authenticated === true;
}

function isAdmin() {
  return isSignedIn() && appState.user.role === "admin";
}

function canEdit(record) {
  return isAdmin() || (isSignedIn() && record.owner === appState.user.username);
}

function notAuthorized(action) {
  console.log(`[AUTHZ] denied: ${action} (user: ${appState.user.username}, role: ${appState.user.role})`);
  showMessage("You are not authorized to access this feature.", "danger");
  return false;
}


// ---------- nav bar ----------

function buildNav() {
  const nav = document.getElementById("main-nav");
  if (!nav) return;

  let html = `<a href="${basePath}index.html">Home</a>`;
  if (!isSignedIn()) {
    html += ` | <a href="${basePath}pages/signin.html">Sign In</a>`;
  }
  if (isAdmin()) {
    html += ` | <a href="${basePath}pages/admin.html">Admin</a>`;
  }
  if (isSignedIn()) {
    html += ` | <a href="#" id="signout-link">Sign Out</a>`;
    html += `<span class="nav-user">Signed in as ${cleanText(appState.user.username)} (${appState.user.role})</span>`;
  }
  nav.innerHTML = html;

  const signoutLink = document.getElementById("signout-link");
  if (signoutLink) {
    signoutLink.addEventListener("click", function (e) {
      e.preventDefault();
      signOut();
    });
  }
}


// ---------- CRUD ----------

function getNextId() {
  let highest = 0;
  appState.data.forEach(item => {
    if (item.id > highest) highest = item.id;
  });
  return highest + 1;
}

// CREATE
function createRecord(fields) {
  if (!isSignedIn()) return notAuthorized("create");

  const newRecord = {
    id: getNextId(),
    name: fields.name,
    cost: Number(fields.cost),
    category: fields.category,
    renewal: fields.renewal,
    status: fields.status,
    owner: appState.user.username
  };
  appState.data.push(newRecord);
  console.log(`[CREATE] record ${newRecord.id} added`);
  saveState();
  showMessage(`"${newRecord.name}" was added.`, "success");
  return true;
}

// UPDATE
function updateRecord(id, fields) {
  const record = appState.data.find(item => item.id === id);
  if (!record) {
    showMessage("That subscription could not be found.", "danger");
    return false;
  }
  if (!canEdit(record)) return notAuthorized(`update record ${id}`);

  record.name = fields.name;
  record.cost = Number(fields.cost);
  record.category = fields.category;
  record.renewal = fields.renewal;
  record.status = fields.status;
  console.log(`[UPDATE] record ${id} updated`);
  saveState();
  showMessage(`"${record.name}" was updated.`, "success");
  return true;
}

// DELETE (admin only)
function deleteRecord(id) {
  if (!isAdmin()) return notAuthorized(`delete record ${id}`);

  const index = appState.data.findIndex(item => item.id === id);
  if (index === -1) {
    showMessage("That subscription could not be found.", "danger");
    return false;
  }
  const removed = appState.data.splice(index, 1)[0];
  console.log(`[DELETE] record ${id} removed`);
  saveState();
  showMessage(`"${removed.name}" was deleted.`, "success");
  return true;
}

// puts the form back to "add" mode
function resetForm() {
  editingId = null;
  document.getElementById("add-form").reset();
  document.getElementById("form-title").textContent = "Add New Subscription";
  document.getElementById("form-submit-btn").textContent = "Add Subscription";
  document.getElementById("cancel-edit-btn").classList.add("d-none");
}

// fills the form with a record so it can be edited
function startEdit(id) {
  const record = appState.data.find(item => item.id === id);
  if (!record) {
    showMessage("That subscription could not be found.", "danger");
    return;
  }
  if (!canEdit(record)) {
    notAuthorized(`update record ${id}`);
    return;
  }

  editingId = id;
  document.getElementById("sub-name").value = record.name;
  document.getElementById("sub-name-cost").value = record.cost;
  document.getElementById("sub-category").value = record.category;
  document.getElementById("sub-renewal").value = record.renewal;
  document.getElementById("sub-status").value = record.status;
  document.getElementById("form-title").textContent = "Edit Subscription";
  document.getElementById("form-submit-btn").textContent = "Save Changes";
  document.getElementById("cancel-edit-btn").classList.remove("d-none");
  document.getElementById("add-form").scrollIntoView();
}

// hooks up the add/edit form. afterChange = function that redraws the page
function setupRecordForm(afterChange) {
  const addForm = document.getElementById("add-form");

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const fields = {
      name: document.getElementById("sub-name").value.trim(),
      cost: document.getElementById("sub-name-cost").value,
      category: document.getElementById("sub-category").value,
      renewal: document.getElementById("sub-renewal").value,
      status: document.getElementById("sub-status").value
    };

    // simple checks before saving
    if (fields.name === "" || fields.renewal === "") {
      showMessage("Please fill out the name and the renewal date.", "warning");
      return;
    }
    if (fields.cost === "" || isNaN(Number(fields.cost)) || Number(fields.cost) < 0) {
      showMessage("Monthly cost must be a number that is 0 or more.", "warning");
      return;
    }

    let worked;
    if (editingId === null) {
      worked = createRecord(fields);
    } else {
      worked = updateRecord(editingId, fields);
    }

    if (worked) {
      resetForm();
      afterChange();
    }
  });

  document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);
}

// one click handler for all the edit / delete buttons
function makeClickHandler(afterChange) {
  return function (e) {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);

    if (button.dataset.action === "edit") {
      startEdit(id);
    }
    if (button.dataset.action === "delete") {
      if (deleteRecord(id)) afterChange();
    }
  };
}


// ---------- home page ----------

function renderCards() {
  const list = document.getElementById("subscription-list");
  const search = document.getElementById("search-input").value.toLowerCase();
  const category = document.getElementById("filter-category").value;

  // only keep the records that match the search + category
  const matches = appState.data.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(search);
    const categoryMatch = category === "" || item.category === category;
    return nameMatch && categoryMatch;
  });

  if (matches.length === 0) {
    list.innerHTML = `<p class="text-muted">No records found.</p>`;
  } else {
    let html = "";
    matches.forEach(item => {
      // edit button: admin or the owner. delete button: admin only
      let buttons = "";
      if (canEdit(item)) {
        buttons += `<button class="btn btn-outline-success btn-sm" data-action="edit" data-id="${item.id}">Edit</button> `;
      }
      if (isAdmin()) {
        buttons += `<button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${item.id}">Delete</button>`;
      }

      html += `
        <div class="col-md-4 mb-3">
          <div class="card h-100">
            <div class="card-body">
              <h5 class="card-title">${cleanText(item.name)}</h5>
              <h6 class="card-subtitle mb-2 text-muted">${cleanText(item.category)}</h6>
              <p class="card-text">${formatMoney(item.cost)} per month</p>
              <p class="card-text"><small>Next renewal: ${formatDate(item.renewal)}</small></p>
              <span class="badge ${statusBadge(item.status)}">${cleanText(item.status)}</span>
              <span class="badge bg-light text-dark border">owner: ${cleanText(item.owner)}</span>
              <div class="mt-3">${buttons}</div>
            </div>
          </div>
        </div>`;
    });
    list.innerHTML = html;
  }

  // total cost of everything that is not cancelled
  let total = 0;
  appState.data.forEach(item => {
    if (item.status !== "Cancelled") total += Number(item.cost);
  });
  document.getElementById("cost-summary").textContent =
    `Showing ${matches.length} of ${appState.data.length} subscriptions. Monthly total (not cancelled): ${formatMoney(total)}`;
}

function setupHomePage() {
  // people who are not signed in only see the sign in notice
  if (!isSignedIn()) {
    document.getElementById("guest-notice").classList.remove("d-none");
    return;
  }
  document.getElementById("app-content").classList.remove("d-none");

  renderCards();
  setupRecordForm(renderCards);

  document.getElementById("search-btn").addEventListener("click", renderCards);
  document.getElementById("search-input").addEventListener("input", renderCards);
  document.getElementById("filter-category").addEventListener("change", renderCards);
  document.getElementById("subscription-list").addEventListener("click", makeClickHandler(renderCards));

  // welcome back toast
  const toastEl = document.getElementById("status-toast");
  if (toastEl) {
    document.getElementById("toast-body").textContent = "Welcome back, " + appState.user.username + "!";
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  }
}


// ---------- admin page ----------

function renderAdminPage() {
  // current user + session
  document.getElementById("admin-user").innerHTML = `
    <li>Username: <strong>${cleanText(appState.user.username)}</strong></li>
    <li>Authenticated: <strong>${appState.user.authenticated}</strong></li>
    <li>Role: <strong>${appState.user.role}</strong></li>
    <li>Session started: <strong>${new Date(appState.session.started).toLocaleString()}</strong></li>`;

  // app data table with edit + delete buttons
  document.getElementById("admin-count").textContent = appState.data.length + " records";
  const tableBody = document.getElementById("admin-data");
  if (appState.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-muted">No records found.</td></tr>`;
  } else {
    let rows = "";
    appState.data.forEach(item => {
      rows += `
        <tr>
          <td>${item.id}</td>
          <td>${cleanText(item.name)}</td>
          <td>${cleanText(item.category)}</td>
          <td>${formatMoney(item.cost)}</td>
          <td>${cleanText(item.status)}</td>
          <td>${cleanText(item.owner)}</td>
          <td>
            <button class="btn btn-outline-success btn-sm" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${item.id}">Delete</button>
          </td>
        </tr>`;
    });
    tableBody.innerHTML = rows;
  }

  // what is in sessionStorage right now
  let storageHtml = "";
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    storageHtml += `<li><code>${cleanText(key)}</code> (${sessionStorage.getItem(key).length} characters)</li>`;
  }
  document.getElementById("admin-storage").innerHTML = storageHtml;

  // the whole app state as json
  document.getElementById("app-state-output").textContent = JSON.stringify(appState, null, 2);

  // extra info the browser can give us
  document.getElementById("admin-debug").innerHTML = `
    <li>Current time: ${new Date().toLocaleString()}</li>
    <li>Current page: ${cleanText(window.location.href)}</li>
    <li>Browser: ${cleanText(navigator.userAgent)}</li>
    <li>Number of records: ${appState.data.length}</li>`;
}

function setupAdminPage() {
  // check the role before showing anything
  if (!isAdmin()) {
    notAuthorized("open admin page");
    return;
  }
  document.getElementById("admin-area").classList.remove("d-none");

  renderAdminPage();
  setupRecordForm(renderAdminPage);
  document.getElementById("admin-data").addEventListener("click", makeClickHandler(renderAdminPage));

  // put the starting data back
  document.getElementById("reset-data-btn").addEventListener("click", async function () {
    try {
      await fetchStartingData();
      renderAdminPage();
      showMessage("Starting data was loaded again.", "success");
    } catch (error) {
      console.log("[DATA] could not reload starting data", error);
      showMessage("Could not load starting data.", "danger");
    }
  });

  // copy the json to the clipboard
  document.getElementById("copy-state-btn").addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(JSON.stringify(appState, null, 2));
      showMessage("App state copied.", "success");
    } catch (error) {
      showMessage("Could not copy. Select the text and copy it yourself.", "warning");
    }
  });
}


// ---------- start everything when the page loads ----------

document.addEventListener("DOMContentLoaded", async function () {
  await loadState();
  logTestAccounts();
  buildNav();
  console.log("[STATE] appState:", appState);

  // only run the code for the page we are on
  if (document.getElementById("subscription-list")) setupHomePage();
  if (document.getElementById("signin-form")) setupSignIn();
  if (document.getElementById("admin-area")) setupAdminPage();
});
