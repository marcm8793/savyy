export interface ListTransactionsResponse {
  nextPageToken?: string;
  transactions: Transaction[];
}

export interface Transaction {
  accountId: string;
  amount: CurrencyDenominatedAmount;
  bookedDateTime?: string;
  categories?: Categories;
  counterparties?: Counterparties;
  dates: Dates;
  descriptions: Descriptions;
  id: string;
  identifiers?: Identifiers;
  merchantInformation?: MerchantInformation;
  providerMutability?: Mutability;
  reference?: string;
  status: Status;
  transactionDateTime?: string;
  types: Types;
  valueDateTime?: string;
}

export interface CurrencyDenominatedAmount {
  currencyCode: string;
  value: ExactNumber;
}

export interface ExactNumber {
  scale: string;
  unscaledValue: string;
}

export interface Categories {
  pfm?: PFMCategory;
}

export interface PFMCategory {
  id: string;
  name: string;
}

export interface Counterparties {
  payee?: CounterpartyInformation;
  payer?: CounterpartyInformation;
}

export interface CounterpartyInformation {
  identifiers?: Identifiers;
  name?: string;
}

export interface Identifiers {
  financialInstitution?: FinancialInstitution;
  providerTransactionId?: string;
}

export interface FinancialInstitution {
  accountNumber?: string;
}

export interface Dates {
  booked?: string;
  transaction?: string;
  value?: string;
}

export interface Descriptions {
  detailed?: TransactionInformation;
  display: string;
  original: string;
}

export interface TransactionInformation {
  unstructured?: string;
}

export interface MerchantInformation {
  merchantCategoryCode?: string;
  merchantName?: string;
}

export enum Mutability {
  MUTABILITY_UNDEFINED = 'MUTABILITY_UNDEFINED',
  MUTABLE = 'MUTABLE',
  IMMUTABLE = 'IMMUTABLE',
}

export enum Status {
  PENDING = 'PENDING',
  BOOKED = 'BOOKED',
}

export interface Types {
  financialInstitutionTypeCode?: string;
  type: Type;
}

export enum Type {
  UNDEFINED = 'UNDEFINED',
  CREDIT_CARD = 'CREDIT_CARD',
  PAYMENT = 'PAYMENT',
  WITHDRAWAL = 'WITHDRAWAL',
  DEFAULT = 'DEFAULT',
  TRANSFER = 'TRANSFER',
}