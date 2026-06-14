const express = require("express");
const cors = require("cors");
const { PlaidApi, PlaidEnvironments, Configuration } = require("plaid");

const app = express();
app.use(cors());
app.use(express.json());

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

let ACCESS_TOKEN = null;

// Plaid Link page — opens in browser
app.get("/connect", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "finance-hub-user" },
      client_name: "Finance Hub",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    const link_token = response.data.link_token;
    res.send(`<!DOCTYPE html>
<html>
<head><title>Connect Bank</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;background:#0b0d14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px;}
  button{background:#7c6aff;color:#fff;border:none;padding:16px 32px;border-radius:12px;font-size:16px;cursor:pointer;}
  p{color:#6b7280;font-size:14px;}
</style>
</head>
<body>
<h2>💸 Finance Hub</h2>
<p>Tap below to securely connect your bank via Plaid</p>
<button onclick="openPlaid()">🏦 Connect My Bank</button>
<p id="status"></p>
<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
<script>
function openPlaid(){
  document.getElementById("status").textContent = "Opening Plaid...";
  var handler = Plaid.create({
    token: "${link_token}",
    onSuccess: function(public_token) {
      document.getElementById("status").textContent = "Connecting...";
      fetch("/exchange", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({public_token: public_token})
      }).then(r=>r.json()).then(d=>{
     document.getElementById("status").textContent = "✅ Connected! Returning…";
setTimeout(()=>{ window.location.href = "/"; }, 1500);
        document.querySelector("button").textContent = "✅ Bank Connected!";
        document.querySelector("button").style.background = "#00d48a";
      });
    },
    onExit: function(){ document.getElementById("status").textContent = "Cancelled."; }
  });
  handler.open();
}
</script>
</body>
</html>`);
  } catch(e) {
    res.status(500).send("Error: " + e.message);
  }
});

app.post("/exchange", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    ACCESS_TOKEN = response.data.access_token;
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/create_link_token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "finance-hub-user" },
      client_name: "Finance Hub",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/transactions", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(401).json({ error: "Not connected" });
  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 90);
    const response = await plaidClient.transactionsGet({
      access_token: ACCESS_TOKEN,
      start_date: start.toISOString().split("T")[0],
      end_date: today.toISOString().split("T")[0],
      options: { count: 250 },
    });
    res.json({ transactions: response.data.transactions, accounts: response.data.accounts });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (_, res) => res.json({ status: "ok", connected: !!ACCESS_TOKEN }));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
