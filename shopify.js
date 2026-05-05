import "@shopify/shopify-api/adapters/node";
import { shopifyApi } from "@shopify/shopify-api";
import dotenv from "dotenv";

dotenv.config();

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: process.env.HOST.replace(/^https:\/\//, ""),
  apiVersion: "2024-01", // hardcoded version (stable)
  customShopDomains: [],
  isEmbeddedApp: false,
});