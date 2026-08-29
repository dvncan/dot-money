/**
 * Canadian cancellation & refund letter templates.
 *
 * These are consumer self-advocacy templates with references to the relevant
 * provincial consumer protection statutes. They are guidance, NOT legal advice —
 * the UI must surface that disclaimer wherever a letter is generated.
 */

export interface ProvinceInfo {
  code: string;
  name: string;
  statute: string;
  note: string;
}

export const PROVINCES: ProvinceInfo[] = [
  { code: "ON", name: "Ontario", statute: "Consumer Protection Act, 2002, S.O. 2002, c. 30, Sched. A", note: "Remote agreements can generally be cancelled where required disclosures were not made; refunds are due within 15 days of a valid cancellation." },
  { code: "BC", name: "British Columbia", statute: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2", note: "Continuing services contracts carry statutory cancellation rights; refunds are due within 15 days of cancellation notice." },
  { code: "QC", name: "Quebec", statute: "Consumer Protection Act, C.Q.L.R. c. P-40.1", note: "Distance contracts may be cancelled for missing disclosures; the merchant must refund within 15 days, and chargeback rights apply if they fail to." },
  { code: "AB", name: "Alberta", statute: "Consumer Protection Act, R.S.A. 2000, c. C-26.3", note: "Internet sales contracts may be cancelled where required information was not disclosed; refunds are due within 15 days." },
  { code: "MB", name: "Manitoba", statute: "The Consumer Protection Act, C.C.S.M. c. C200", note: "Retail sales and distance agreements carry cancellation and refund rights." },
  { code: "SK", name: "Saskatchewan", statute: "The Consumer Protection and Business Practices Act, S.S. 2013, c. C-30.2", note: "Statutory warranties and cancellation rights apply to consumer agreements." },
  { code: "NS", name: "Nova Scotia", statute: "Consumer Protection Act, R.S.N.S. 1989, c. 92", note: "Consumer agreements carry statutory cancellation and refund protections." },
  { code: "NB", name: "New Brunswick", statute: "Consumer Product Warranty and Liability Act, S.N.B. 1978, c. C-18.1", note: "Consumer product warranties and remedies apply." },
  { code: "NL", name: "Newfoundland and Labrador", statute: "Consumer Protection and Business Practices Act, S.N.L. 2009, c. C-31.1", note: "Consumer agreements carry statutory cancellation and refund protections." },
  { code: "PE", name: "Prince Edward Island", statute: "Consumer Protection Act, R.S.P.E.I. 1988, c. C-19", note: "Consumer agreements carry statutory protections." },
];

export interface LetterTemplate {
  id: string;
  name: string;
  kind: "cancellation" | "refund" | "dispute";
  description: string;
  responseDays: number;
  body: string; // {{placeholders}}
}

export const TEMPLATES: LetterTemplate[] = [
  {
    id: "cancel-subscription",
    name: "Subscription cancellation notice",
    kind: "cancellation",
    description: "Formal written notice cancelling a recurring subscription and revoking pre-authorized debit/charge consent.",
    responseDays: 15,
    body: `{{date}}

To: {{vendor}} — Customer Service / Billing Department

RE: Cancellation of subscription — account holder {{name}}

To whom it may concern,

This letter is my formal written notice that I am cancelling my subscription with {{vendor}}, effective immediately. Please treat this notice as:

1. Cancellation of the recurring agreement between us; and
2. Revocation of any consent to charge my payment card or debit my account for future billing periods.

I request written confirmation of this cancellation within 10 days. Any amount charged after the date of this notice will be an unauthorized charge, which I will dispute with my financial institution and, if necessary, report to the consumer protection authority of {{provinceName}}.

I rely on my rights under the {{statute}} and applicable federal law.

Please confirm to: {{email}}

Sincerely,
{{name}}`,
  },
  {
    id: "refund-demand",
    name: "Refund demand",
    kind: "refund",
    description: "Demand for a refund of charges after cancellation, or within a merchant's stated refund window.",
    responseDays: 15,
    body: `{{date}}

To: {{vendor}} — Billing Department

RE: Refund demand — {{name}}, amount: \${{amount}} CAD

To whom it may concern,

On {{cancellationDate}} I cancelled my subscription/agreement with {{vendor}}. Despite that cancellation, I was charged \${{amount}} CAD. I am formally demanding a full refund of this amount.

Under the {{statute}}, a supplier who receives a valid cancellation notice must refund payments received, generally within 15 days. {{provinceNote}}

If I do not receive the refund within 15 days of this letter, I will:
1. Initiate a chargeback with my card issuer;
2. File a complaint with the consumer protection authority of {{provinceName}}; and
3. Pursue any other remedies available to me.

Please confirm the refund to: {{email}}

Sincerely,
{{name}}`,
  },
  {
    id: "unauthorized-charge",
    name: "Unauthorized charge dispute",
    kind: "dispute",
    description: "Dispute of a charge you did not authorize, with notice to the merchant before a card-network chargeback.",
    responseDays: 10,
    body: `{{date}}

To: {{vendor}} — Billing Department

RE: Unauthorized charge dispute — {{name}}, amount: \${{amount}} CAD, date of charge: {{chargeDate}}

To whom it may concern,

My records show a charge of \${{amount}} CAD by {{vendor}} on {{chargeDate}}. I did not authorize this charge and there is no active agreement between us that permits it.

I demand that you reverse this charge within 10 days of this notice. If it is not reversed, I will dispute it with my financial institution as an unauthorized transaction and file a complaint with the consumer protection authority of {{provinceName}}, relying on my rights under the {{statute}}.

Please respond to: {{email}}

Sincerely,
{{name}}`,
  },
];

export interface LetterFields {
  name: string;
  email: string;
  vendor: string;
  province: string; // 2-letter code
  amount?: number;
  chargeDate?: string;
  cancellationDate?: string;
}

export function renderLetter(templateId: string, fields: LetterFields): { content: string; responseDeadline: string } {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  const province = PROVINCES.find((p) => p.code === fields.province) ?? PROVINCES[0]!;

  const map: Record<string, string> = {
    date: new Date().toISOString().slice(0, 10),
    name: fields.name,
    email: fields.email,
    vendor: fields.vendor,
    provinceName: province.name,
    statute: province.statute,
    provinceNote: province.note,
    amount: fields.amount != null ? fields.amount.toFixed(2) : "____",
    chargeDate: fields.chargeDate ?? "____",
    cancellationDate: fields.cancellationDate ?? "____",
  };

  const content = template.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? `{{${key}}}`);
  const deadline = new Date(Date.now() + template.responseDays * 86_400_000).toISOString().slice(0, 10);
  return { content, responseDeadline: deadline };
}
