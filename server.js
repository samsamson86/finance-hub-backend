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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/exchange_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    ACCESS_TOKEN = response.data.access_token;
    res.json({ success: true });
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (_, res) => res.json({ status: "ok", connected: !!ACCESS_TOKEN }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
