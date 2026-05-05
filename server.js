import express from "express";
import dotenv from "dotenv";
import { shopify } from "./shopify.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// simple memory store
const sessions = {};

// 👉 HOME (Render health check)
app.get("/", (req, res) => {
  res.send("App running 🚀");
});

// 👉 AUTH START (correct for Render)
app.get("/auth", async (req, res) => {
  const { shop } = req.query;

  if (!shop) return res.send("Missing shop");

  const redirectUri = `${process.env.HOST}/auth/callback`;

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=${redirectUri}`;

  return res.redirect(installUrl);
});

// 👉 AUTH CALLBACK
app.get("/auth/callback", async (req, res) => {
  try {
    const { shop, code } = req.query;

    if (!shop || !code) {
      return res.send("Missing params");
    }

    // 🔥 Exchange code for access token
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    const data = await response.json();

    // 🔥 store session manually
    sessions[shop] = {
      shop,
      accessToken: data.access_token,
    };

    res.send("Auth successful ✅");
  } catch (error) {
    console.error(error);
    res.status(500).send("Auth failed");
  }
});

app.get("/billing", async (req, res) => {
  const { shop } = req.query;

  const session = sessions[shop];

  // 🔥 if no session → re-auth
  if (!session) {
    return res.redirect(`/auth?shop=${shop}`);
  }

  const client = new shopify.clients.Graphql({
  session: {
    shop: shop,
    accessToken: session.accessToken,
  },
});
  const returnUrl = `${process.env.HOST}/billing/success`;

  const mutation = `
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
  `;

  const response = await client.query({ data: mutation });

  const url =
    response.body.data.appPurchaseOneTimeCreate.confirmationUrl;

  return res.redirect(url);
});

app.get("/billing/success", (req, res) => {
  res.send("Payment successful 🎉");
});

// 👉 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});