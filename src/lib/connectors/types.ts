export type FieldType = 'text' | 'password' | 'url' | 'number' | 'select' | 'textarea' | 'oauth_button';

export interface SelectOption { value: string; label: string; }

export interface ConnectorField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: SelectOption[];
  dependsOn?: { field: string; value: string };
}

export type CategoryId =
  | 'databases' | 'warehouses' | 'storage' | 'crm' | 'marketing'
  | 'productivity' | 'communication' | 'analytics' | 'devtools'
  | 'finance' | 'ecommerce' | 'custom';

export interface Category {
  id: CategoryId;
  label: string;
}

export type ExecutionMode = 'client' | 'server';

export interface OAuthConfig {
  authUrl: string;
  scopes: string[];
  clientIdField?: string;
  additionalParams?: Record<string, string>;
}

export interface Connector {
  id: string;
  name: string;
  iconSlug?: string;
  description: string;
  category: CategoryId;
  color: string;
  executionMode: ExecutionMode;
  fields: ConnectorField[];
  oauth?: OAuthConfig;
  managedOAuth?: ManagedOAuthOption[];
  popular?: boolean;
  tags?: string[];
}

export type CredentialMap = Record<string, string>;

// ── Managed OAuth (uses app-level env var credentials, no client ID from user) ──
export interface ManagedOAuthOption {
  provider:  string;        // 'google' | 'microsoft' | 'github' | 'slack' | etc.
  label:     string;        // "Sign in with Google"
  scopes:    string[];      // OAuth scopes to request
  iconSlug?: string;        // simple-icons slug for the button icon
  color?:    string;        // button accent color
  /** If the connector needs a user-supplied value before OAuth (e.g. Shopify store domain),
   *  list the field key here. The UI will show that field first, then the OAuth button. */
  requiresField?: string;
}
