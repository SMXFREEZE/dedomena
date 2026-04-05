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
  emoji: string;
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
  emoji?: string;
  description: string;
  category: CategoryId;
  color: string;
  executionMode: ExecutionMode;
  fields: ConnectorField[];
  oauth?: OAuthConfig;
  popular?: boolean;
  tags?: string[];
}

export type CredentialMap = Record<string, string>;
