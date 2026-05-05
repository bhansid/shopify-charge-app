import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// simple memory store (ok for now)
const sessions = {};

// 👉 HOME
app.get("/", (req, res) => {
  res.send("App running 🚀");
});

// 👉 AUTH START
app.get("/auth", async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop");

    const redirectUri = `${process.env.HOST}/auth/callback`;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=${redirectUri}`;

    return res.redirect(installUrl);
  } catch (e) {
    console.error("AUTH START ERROR:", e);
    res.status(500).send("Auth start failed");
  }
});

// 👉 AUTH CALLBACK
app.get("/auth/callback", async (req, res) => {
  try {
    const { shop, code } = req.query;
    if (!shop || !code) {
      return res.status(400).send("Missing params");
    }

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (!data.access_token) {
      console.error("TOKEN ERROR:", data);
      return res.status(500).send("Token exchange failed");
    }

    sessions[shop] = {
      shop,
      accessToken: data.access_token,
    };

    return res.redirect(`/billing?shop=${shop}`);
  } catch (e) {
    console.error("AUTH CALLBACK ERROR:", e);
    res.status(500).send("Auth failed");
  }
});

// 👉 BILLING (NO SDK — direct GraphQL)
app.get("/billing", async (req, res) => {
  try {
    const { shop } = req.query;
    const session = sessions[shop];

    if (!session) {
      return res.redirect(`/auth?shop=${shop}`);
    }

    const returnUrl = `${process.env.HOST}/billing/success?shop=${shop}`;

    const query = {
      query: `
        mutation {
          appPurchaseOneTimeCreate(
            name: "Maintenance Fee",
            price: { amount: 20.0, currencyCode: USD },
            returnUrl: "${returnUrl}"
          ) {
            confirmationUrl
            userErrors {
              field
              message
            }
          }
        }
      `,
    };

    const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify(query),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("GRAPHQL ERROR:", data.errors);
      return res.status(500).send("GraphQL error");
    }

    const result = data.data.appPurchaseOneTimeCreate;

    if (result.userErrors && result.userErrors.length > 0) {
      console.error("USER ERRORS:", result.userErrors);
      return res.status(400).send(result.userErrors[0].message);
    }

    const url = result.confirmationUrl;

    if (!url) {
      console.error("NO CONFIRMATION URL:", data);
      return res.status(500).send("No confirmation URL");
    }

    return res.redirect(url);
  } catch (e) {
    console.error("BILLING ERROR:", e);
    res.status(500).send("Billing failed");
  }
});

// 👉 SUCCESS
app.get("/billing/success", (req, res) => {
  res.send("Payment successful 🎉");
});

// 👉 START
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});