/**
 * Server-side OAuth provider configs.
 * Each entry maps a provider ID → the auth/token endpoints and which env vars
 * hold the app's client credentials.
 *
 * Imported ONLY in server routes (api/oauth/*).
 * Client code uses ManagedOAuthOption from types.ts (provider ID + scopes only).
 */

export interface OAuthProviderConfig {
  authUrl:         string;
  tokenUrl:        string;
  clientIdEnv:     string;
  clientSecretEnv: string;
  additionalParams?: Record<string, string>;
  /** Some providers (e.g. Notion) need Basic auth for token exchange */
  tokenAuthMethod?: 'body' | 'basic';
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {

  // ── Google ──────────────────────────────────────────────────────────────────
  google: {
    authUrl:         'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:        'https://oauth2.googleapis.com/token',
    clientIdEnv:     'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    additionalParams: { access_type: 'offline', prompt: 'consent' },
  },

  // ── Microsoft ────────────────────────────────────────────────────────────────
  microsoft: {
    authUrl:         'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl:        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientIdEnv:     'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    additionalParams: { prompt: 'select_account' },
  },

  // ── GitHub ───────────────────────────────────────────────────────────────────
  github: {
    authUrl:         'https://github.com/login/oauth/authorize',
    tokenUrl:        'https://github.com/login/oauth/access_token',
    clientIdEnv:     'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },

  // ── Slack ────────────────────────────────────────────────────────────────────
  slack: {
    authUrl:         'https://slack.com/oauth/v2/authorize',
    tokenUrl:        'https://slack.com/api/oauth.v2.access',
    clientIdEnv:     'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    tokenAuthMethod: 'basic',
  },

  // ── Notion ───────────────────────────────────────────────────────────────────
  notion: {
    authUrl:         'https://api.notion.com/v1/oauth/authorize',
    tokenUrl:        'https://api.notion.com/v1/oauth/token',
    clientIdEnv:     'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    additionalParams: { owner: 'user', response_type: 'code' },
    tokenAuthMethod: 'basic',
  },

  // ── Salesforce ───────────────────────────────────────────────────────────────
  salesforce: {
    authUrl:         'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl:        'https://login.salesforce.com/services/oauth2/token',
    clientIdEnv:     'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET',
  },

  // ── HubSpot ──────────────────────────────────────────────────────────────────
  hubspot: {
    authUrl:         'https://app.hubspot.com/oauth/authorize',
    tokenUrl:        'https://api.hubapi.com/oauth/v1/token',
    clientIdEnv:     'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
  },

  // ── Databricks ───────────────────────────────────────────────────────────────
  databricks: {
    authUrl:         'https://login.databricks.com/oauth2/v2/authorize',
    tokenUrl:        'https://login.databricks.com/oauth2/v2/token',
    clientIdEnv:     'DATABRICKS_CLIENT_ID',
    clientSecretEnv: 'DATABRICKS_CLIENT_SECRET',
  },

  // ── Dropbox ──────────────────────────────────────────────────────────────────
  dropbox: {
    authUrl:         'https://www.dropbox.com/oauth2/authorize',
    tokenUrl:        'https://api.dropboxapi.com/oauth2/token',
    clientIdEnv:     'DROPBOX_CLIENT_ID',
    clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
    additionalParams: { token_access_type: 'offline' },
  },

  // ── Box ──────────────────────────────────────────────────────────────────────
  box: {
    authUrl:         'https://account.box.com/api/oauth2/authorize',
    tokenUrl:        'https://api.box.com/oauth2/token',
    clientIdEnv:     'BOX_CLIENT_ID',
    clientSecretEnv: 'BOX_CLIENT_SECRET',
  },

  // ── Airtable ─────────────────────────────────────────────────────────────────
  airtable: {
    authUrl:         'https://airtable.com/oauth2/v1/authorize',
    tokenUrl:        'https://airtable.com/oauth2/v1/token',
    clientIdEnv:     'AIRTABLE_CLIENT_ID',
    clientSecretEnv: 'AIRTABLE_CLIENT_SECRET',
    tokenAuthMethod: 'basic',
  },

  // ── Linear ───────────────────────────────────────────────────────────────────
  linear: {
    authUrl:         'https://linear.app/oauth/authorize',
    tokenUrl:        'https://api.linear.app/oauth/token',
    clientIdEnv:     'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
  },

  // ── Figma ────────────────────────────────────────────────────────────────────
  figma: {
    authUrl:         'https://www.figma.com/oauth',
    tokenUrl:        'https://www.figma.com/api/oauth/token',
    clientIdEnv:     'FIGMA_CLIENT_ID',
    clientSecretEnv: 'FIGMA_CLIENT_SECRET',
  },

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  zoom: {
    authUrl:         'https://zoom.us/oauth/authorize',
    tokenUrl:        'https://zoom.us/oauth/token',
    clientIdEnv:     'ZOOM_CLIENT_ID',
    clientSecretEnv: 'ZOOM_CLIENT_SECRET',
    tokenAuthMethod: 'basic',
  },

  // ── Atlassian / Jira / Confluence ────────────────────────────────────────────
  atlassian: {
    authUrl:         'https://auth.atlassian.com/authorize',
    tokenUrl:        'https://auth.atlassian.com/oauth/token',
    clientIdEnv:     'ATLASSIAN_CLIENT_ID',
    clientSecretEnv: 'ATLASSIAN_CLIENT_SECRET',
    additionalParams: { audience: 'api.atlassian.com', prompt: 'consent' },
  },

  // ── Asana ────────────────────────────────────────────────────────────────────
  asana: {
    authUrl:         'https://app.asana.com/-/oauth_authorize',
    tokenUrl:        'https://app.asana.com/-/oauth_token',
    clientIdEnv:     'ASANA_CLIENT_ID',
    clientSecretEnv: 'ASANA_CLIENT_SECRET',
  },

  // ── Monday.com ───────────────────────────────────────────────────────────────
  monday: {
    authUrl:         'https://auth.monday.com/oauth2/authorize',
    tokenUrl:        'https://auth.monday.com/oauth2/token',
    clientIdEnv:     'MONDAY_CLIENT_ID',
    clientSecretEnv: 'MONDAY_CLIENT_SECRET',
  },

  // ── Shopify ──────────────────────────────────────────────────────────────────
  // Note: auth/token URLs are templated – replace [shop] at runtime
  shopify: {
    authUrl:         'https://[shop].myshopify.com/admin/oauth/authorize',
    tokenUrl:        'https://[shop].myshopify.com/admin/oauth/access_token',
    clientIdEnv:     'SHOPIFY_CLIENT_ID',
    clientSecretEnv: 'SHOPIFY_CLIENT_SECRET',
  },

  // ── Stripe Connect ───────────────────────────────────────────────────────────
  stripe: {
    authUrl:         'https://connect.stripe.com/oauth/authorize',
    tokenUrl:        'https://connect.stripe.com/oauth/token',
    clientIdEnv:     'STRIPE_CLIENT_ID',
    clientSecretEnv: 'STRIPE_SECRET_KEY',
  },

  // ── Twitter / X ──────────────────────────────────────────────────────────────
  twitter: {
    authUrl:         'https://twitter.com/i/oauth2/authorize',
    tokenUrl:        'https://api.twitter.com/2/oauth2/token',
    clientIdEnv:     'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    additionalParams: { code_challenge_method: 'S256' },
    tokenAuthMethod: 'basic',
  },

  // ── Discord ──────────────────────────────────────────────────────────────────
  discord: {
    authUrl:         'https://discord.com/api/oauth2/authorize',
    tokenUrl:        'https://discord.com/api/oauth2/token',
    clientIdEnv:     'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
  },

  // ── LinkedIn ─────────────────────────────────────────────────────────────────
  linkedin: {
    authUrl:         'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl:        'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv:     'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
  },

  // ── Spotify ──────────────────────────────────────────────────────────────────
  spotify: {
    authUrl:         'https://accounts.spotify.com/authorize',
    tokenUrl:        'https://accounts.spotify.com/api/token',
    clientIdEnv:     'SPOTIFY_CLIENT_ID',
    clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
    tokenAuthMethod: 'basic',
  },

  // ── Zendesk ──────────────────────────────────────────────────────────────────
  zendesk: {
    authUrl:         'https://[subdomain].zendesk.com/oauth/authorizations/new',
    tokenUrl:        'https://[subdomain].zendesk.com/oauth/tokens',
    clientIdEnv:     'ZENDESK_CLIENT_ID',
    clientSecretEnv: 'ZENDESK_CLIENT_SECRET',
  },

  // ── Intercom ─────────────────────────────────────────────────────────────────
  intercom: {
    authUrl:         'https://app.intercom.com/oauth',
    tokenUrl:        'https://api.intercom.io/auth/eagle/token',
    clientIdEnv:     'INTERCOM_CLIENT_ID',
    clientSecretEnv: 'INTERCOM_CLIENT_SECRET',
  },

  // ── Typeform ─────────────────────────────────────────────────────────────────
  typeform: {
    authUrl:         'https://api.typeform.com/oauth/authorize',
    tokenUrl:        'https://api.typeform.com/oauth/token',
    clientIdEnv:     'TYPEFORM_CLIENT_ID',
    clientSecretEnv: 'TYPEFORM_CLIENT_SECRET',
  },

  // ── Webflow ──────────────────────────────────────────────────────────────────
  webflow: {
    authUrl:         'https://webflow.com/oauth/authorize',
    tokenUrl:        'https://api.webflow.com/oauth/access_token',
    clientIdEnv:     'WEBFLOW_CLIENT_ID',
    clientSecretEnv: 'WEBFLOW_CLIENT_SECRET',
  },

  // ── Plaid ────────────────────────────────────────────────────────────────────
  // Plaid uses a different Link Token flow — handled separately via /api/plaid/*
  plaid: {
    authUrl:         '__plaid_link__',   // special marker — handled by PlaidLinkButton
    tokenUrl:        '/api/plaid/exchange',
    clientIdEnv:     'PLAID_CLIENT_ID',
    clientSecretEnv: 'PLAID_SECRET',
  },
};
