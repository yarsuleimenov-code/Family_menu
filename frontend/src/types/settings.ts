export interface AppSettings {
  weeklyBudget: number;
  peopleCount: number;
  forbiddenProducts: string[];
  dataSource: 'mock' | 'googleSheets';
  appsScriptEndpoint?: string;
  apiToken?: string;
  language: 'ru';
}
