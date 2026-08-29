# Canadian Personal Finance Advocate App - Development Plan
## Project Name: "dotmoney" (or similar branding)

---

## 1. PROJECT OVERVIEW

### Mission
Create a personal financial comptroller application for Canadian users that acts as their financial advocate, helping them manage subscriptions, reduce spending, audit expenses, and negotiate better rates—all while connecting securely to Canadian banking institutions.

### Target Users
- Canadian individuals aged 18-65
- Primary: Users frustrated with Rocket Money's unavailability in Canada
- Secondary: Budget-conscious consumers, subscription overload sufferers, people seeking refunds

### Key Differentiators
1. Native Canadian bank integration
2. Legal advocacy (templates + guidance for cancellations)
3. Refund pursuit automation
4. Proactive financial optimization
5. Spending audit and negotiation services

---

## 2. CORE FEATURES

### 2.1 Subscription Management Module
**Objective:** Identify, track, and help cancel duplicate/unused subscriptions

**Features:**
- Automatic subscription detection via transaction analysis
- Subscription categorization (streaming, productivity, fitness, etc.)
- Duplicate detection algorithm (same vendor/service across accounts)
- Cost aggregation and trend analysis
- "Subscription Health Score" (healthy vs. waste)
- One-click or guided cancellation flow
- Refund tracking and history

**Success Metrics:**
- Average subscriptions identified per user
- Cancellation completion rate
- Total savings identified

### 2.2 Legal Cancellation Templates & Guidance
**Objective:** Provide users with legal frameworks to cancel subscriptions and pursue refunds

**Features:**
- Pre-built cancellation letter templates (compliant with Canadian consumer law)
- Vendor-specific cancellation procedures database
- Guided workflow to draft personalized cancellation letters
- Integration with email/mail API to send letters
- Template library for:
  - Subscription cancellations
  - Refund demands (30/60/90 day policies)
  - Unauthorized charge disputes
  - Consumer rights assertions (Competition Act, provincial consumer protection)
- Tracking of sent cancellation requests and response deadlines
- Legal guidance tooltips (tied to provincial regulations)

**Compliance Considerations:**
- Ensure templates comply with Canadian Consumer Protection Act
- Provincial variations (ON, BC, QC, AB, etc.)
- PIPEDA compliance for data handling

### 2.3 Spending Audit & Analysis Engine
**Objective:** Provide insights into spending patterns and identify optimization opportunities

**Features:**
- Automated transaction categorization (merchant category codes + ML refinement)
- Spending heatmaps by category, vendor, and time period
- Year-over-year and month-over-month comparisons
- Anomaly detection (unusual spending spikes)
- Vendor price comparison (where applicable)
- Spending vs. budget tracking
- "Opportunity reports" identifying savings potential
- Recurring spending identification

**AI/ML Components:**
- Transaction classification model
- Spending pattern recognition
- Vendor clustering for duplicate/similar services
- Predictive spending forecasts

### 2.4 Budget Tracking & Categorization Tool
**Objective:** Help users set and monitor spending budgets

**Features:**
- Flexible budget creation (by category, vendor, or custom)
- Drag-and-drop budget allocation
- Real-time budget progress tracking
- Alert system (80%, 90%, 100% thresholds)
- Historical budget performance analysis
- Budget templates for common scenarios (single income, household, student, etc.)
- Savings rate tracking
- Custom category creation

### 2.5 Refund Pursuit System
**Objective:** Automate and track refund claims

**Features:**
- Automated refund eligibility detection (30/60/90 day policies, provincial rules)
- Refund request template generator
- Chargeback guidance and support
- Refund status tracking dashboard
- Integration with payment processors (Stripe, PayPal data)
- Escalation workflows for unresponsive vendors
- Refund success rate metrics

### 2.6 Personal Financial Advocate Dashboard
**Objective:** Central hub showing user's financial health and advocacy actions

**Features:**
- Net worth dashboard
- Spending overview and key metrics
- Subscription summary
- Active cancellations/refunds in progress
- Recommended actions (priority-ordered)
- Savings tracker (cumulative savings from app usage)
- Goal tracker (savings goals, debt reduction, etc.)
- Notifications for upcoming action deadlines

### 2.7 Canadian Bank Integration
**Objective:** Securely connect to Canadian banking institutions

**Supported Integration Paths:**
1. **Plaid Integration** (preferred - covers 95% of Canadian banks)
   - Royal Bank (RBC)
   - Toronto-Dominion (TD)
   - Bank of Nova Scotia (Scotiabank)
   - Bank of Montreal (BMO)
   - Canadian Imperial Bank of Commerce (CIBC)
   - Tangerine, EQ Bank, etc.
   
2. **Open Banking APIs** (future)
   - Payment Initiation Service Provider (PISP) compliance
   - Account Information Service Provider (AISP) compliance
   - Sandbox environments for testing

3. **Manual CSV Upload** (fallback)
   - For banks not covered by integrations
   - Secure file handling

**Security Requirements:**
- OAuth 2.0 for bank connections
- PCI DSS compliance (if handling payment data)
- Encryption at rest and in transit
- No storage of login credentials
- Multi-factor authentication for app

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Frontend Stack
- **Framework:** React 18+ or React Native (for cross-platform mobile)
- **Mobile:** React Native or Flutter (for iOS/Android)
- **Web:** Next.js for server-side rendering and SEO
- **UI Component Library:** Custom or Shadcn/ui
- **State Management:** Redux Toolkit or Zustand
- **Styling:** Tailwind CSS
- **Charts:** Recharts or Chart.js
- **Forms:** React Hook Form + Zod validation
- **Email Client:** SMTP integration (nodemailer) or SendGrid

### 3.2 Backend Stack
- **Language:** Node.js (TypeScript) or Python (FastAPI)
- **Framework:** Express.js or FastAPI
- **Database:** PostgreSQL (primary), Redis (caching)
- **Message Queue:** Bull (Node) or Celery (Python) for async jobs
- **Authentication:** JWT + OAuth 2.0
- **API Documentation:** Swagger/OpenAPI

### 3.3 External Integrations
- **Bank Connection:** Plaid API
- **Email/Communication:** SendGrid or Amazon SES
- **Payment Processing:** Stripe (for premium features, future)
- **Storage:** AWS S3 or similar (for documents, templates)
- **Analytics:** PostHog or Mixpanel
- **Logging:** Sentry or LogRocket
- **Search:** Elasticsearch (for transaction search)

### 3.4 Data Models (Core)

```
User
├── id, email, phone, country (CA)
├── bankAccounts[] (Plaid tokens)
├── subscriptions[]
├── budgets[]
├── goals[]
├── referralCode
└── premiumStatus

Subscription
├── id, userId
├── vendor, category, cost
├── billingCycle, nextBillingDate
├── status (active, pending_cancel, cancelled)
├── detectedBy (transaction_match, manual, etc.)
└── cancellationHistory[]

CancellationRequest
├── id, subscriptionId
├── templateUsed, letterContent
├── sentDate, responseDeadline
├── status (sent, responded, resolved)
├── refundAmount, refundStatus
└── communications[]

Transaction
├── id, userId, bankAccountId
├── amount, date, merchant
├── category (auto-classified)
├── subscriptionId (linked, if applicable)
└── flags (duplicate, unusual, etc.)

Budget
├── id, userId
├── category, limit, period
├── spent, remaining
└── alerts[]

Goal
├── id, userId
├── targetAmount, deadline
├── currentAmount, progress
└── category (savings, debt, etc.)
```

### 3.5 API Endpoints (Core)

```
Authentication
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh-token
- POST /auth/forgot-password

Bank Integration
- GET /banks
- POST /bank-link (Plaid integration)
- GET /bank-accounts
- DELETE /bank-account/:id
- GET /transactions (filtered, paginated)

Subscriptions
- GET /subscriptions
- GET /subscriptions/:id
- POST /subscriptions (manual add)
- DELETE /subscriptions/:id
- PATCH /subscriptions/:id
- POST /subscriptions/:id/cancel-request
- GET /subscriptions/:id/cancellation-status

Cancellations & Refunds
- POST /cancellation-requests
- GET /cancellation-requests
- GET /cancellation-requests/:id
- PATCH /cancellation-requests/:id
- GET /cancellation-templates
- POST /cancellation-templates/:id/generate-letter

Spending Analysis
- GET /spending-analysis/dashboard
- GET /spending-analysis/by-category
- GET /spending-analysis/trends
- GET /spending-analysis/anomalies
- GET /spending-analysis/opportunities

Budgets
- GET /budgets
- POST /budgets
- PATCH /budgets/:id
- DELETE /budgets/:id
- GET /budgets/:id/progress

Goals
- GET /goals
- POST /goals
- PATCH /goals/:id
- DELETE /goals/:id

User
- GET /user/profile
- PATCH /user/profile
- GET /user/settings
- PATCH /user/settings
- POST /user/preferences
```

---

## 4. DEVELOPMENT PHASES

### Phase 1: MVP (Months 1-3)
**Focus:** Core functionality, bank integration, subscription detection

**Deliverables:**
- User authentication system
- Plaid integration (read-only transactions)
- Subscription detection algorithm (MVP)
- Dashboard (basic overview)
- Transaction categorization (rule-based)
- Basic cancellation templates
- Database schema

**Success Criteria:**
- 500+ beta users
- 80%+ accurate subscription detection
- <100ms transaction load time
- Mobile-responsive web app

**Resources:** 2-3 full-stack engineers, 1 PM, 1 designer

---

### Phase 2: Advocate Features (Months 4-6)
**Focus:** Cancellation automation, refund tracking, legal templates

**Deliverables:**
- Refund eligibility detection
- Provincial legal template library
- Email integration for sending cancellation requests
- Cancellation request tracking system
- Refund pursuit dashboard
- User education content (blog, tooltips)
- Improved transaction categorization (ML-based)

**Success Criteria:**
- 1,000+ active users
- 50%+ cancellation completion rate
- <24 hour response time for customer support
- $500K+ identified savings for users

**Resources:** Add 1 backend engineer, 1 legal consultant, 1 content writer

---

### Phase 3: Intelligence Layer (Months 7-9)
**Focus:** AI-driven insights, spending audits, negotiation

**Deliverables:**
- Spending audit engine (anomalies, trends, opportunities)
- Vendor price comparison (negotiation opportunities)
- Budget recommendations (ML-based)
- Savings goal tracking
- Predictive spending forecasts
- Vendor-specific insights
- Mobile app (iOS/Android)

**Success Criteria:**
- 5,000+ active users
- Average $500+ savings per user identified
- 2+ features per user per month engaged
- App store rating 4.5+

**Resources:** Add 1 ML engineer, 1 mobile engineer, 1 data analyst

---

### Phase 4: Scale & Monetization (Months 10-12)
**Focus:** Premium features, partnerships, revenue

**Deliverables:**
- Premium tier (advanced features, priority support)
- Affiliate partnerships (discount offers, credit cards)
- API for third-party integrations
- Advanced analytics and reporting
- Household/family account support
- Vendor partnership program

**Success Criteria:**
- 20,000+ active users
- 10%+ premium conversion
- Vendor partnerships signed
- Break-even or profitable

**Resources:** Add 1 partnerships manager, 1 growth marketer

---

## 5. COMPLIANCE & REGULATORY

### 5.1 Data Privacy (PIPEDA)
- Privacy Policy (clear data usage)
- Consent management system
- Data minimization (collect only necessary)
- User data deletion on request
- Annual privacy audit

### 5.2 Financial Regulations
- Money Services Business (MSB) licensing check (provincial variations)
- Open Banking compliance (PISP/AISP if applicable)
- KYC/AML requirements (if handling financial transactions)
- PCI DSS compliance (if handling payment data)

### 5.3 Consumer Protection
- Canadian Consumer Protection Act compliance
- Provincial consumer protection laws
- Refund and cancellation policies (transparent)
- Terms of Service (clear liability limitations)
- Accessibility compliance (AODA, WCAG 2.1 AA)

### 5.4 Cybersecurity
- Penetration testing (quarterly)
- SSL/TLS encryption (all data in transit)
- 2FA for user accounts
- Rate limiting and DDoS protection
- Regular security audits
- Incident response plan

---

## 6. LAUNCH & GO-TO-MARKET

### 6.1 Pre-Launch (Month 1-2 before launch)
- Waitlist building (ProductHunt, Reddit, HackerNews)
- Press outreach (Canadian fintech publications)
- Influencer partnerships (personal finance YouTubers)
- Beta program (500-1000 testers)

### 6.2 Launch Strategy
- Soft launch: Canadian fintech communities
- Product Hunt launch
- Press release and media outreach
- TikTok/Instagram campaign (target young Canadians)
- Referral program (early incentive)
- Free trial period (14-30 days for premium)

### 6.3 Retention & Growth
- In-app education (onboarding, tooltips, blog)
- Email nurture sequences
- Community Discord/Slack
- Monthly product updates
- User testimonials and case studies

---

## 7. BUSINESS MODEL

### Revenue Streams
1. **Freemium Model** (Primary)
   - Free: Basic subscription tracking, limited cancellations
   - Premium ($9.99-14.99/month): Unlimited cancellations, refund pursuit, advanced analytics
   
2. **Affiliate Revenue** (Secondary)
   - Recommend better alternatives (cashback cards, banks, etc.)
   - Commission on referred products
   
3. **B2B (Future)**
   - API for financial advisors
   - White-label solution for banks

### Pricing Strategy
- Start at $9.99/month (below Rocket Money's usual tiers)
- Annual subscription discount (30% off)
- Family plan ($14.99/month, up to 4 accounts)
- Enterprise tiers (advisor/wealth management firms)

---

## 8. RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Bank integration failures | Fallback CSV upload, comprehensive testing, Plaid support |
| Low user adoption | Strong community, referral program, product-market fit validation |
| Regulatory changes | Legal monitoring, compliance team, flexible architecture |
| Vendor disputes | Clear T&Cs, user education, legal guidance (not legal advice) |
| Data breach | Security-first architecture, insurance, incident response |
| Churn (users hit their goal) | Continuous new features, family accounts, expanded use cases |

---

## 9. SUCCESS METRICS (KPIs)

### User Acquisition
- Monthly Active Users (MAU)
- Customer Acquisition Cost (CAC)
- Viral coefficient (referral rate)

### Engagement
- Session frequency
- Session duration
- Feature adoption rate
- Subscription cancellations completed

### Financial
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (LTV)
- LTV:CAC ratio (target >3:1)
- Churn rate (<5% monthly)

### Impact
- Total savings identified per user
- Refunds recovered
- User satisfaction (NPS, CSAT)
- Customer reviews/ratings

---

## 10. TECHNOLOGY STACK SUMMARY

| Component | Technology |
|-----------|-----------|
| **Frontend (Web)** | Next.js, React, Tailwind CSS, TypeScript |
| **Frontend (Mobile)** | React Native or Flutter |
| **Backend** | Node.js + Express or Python + FastAPI |
| **Database** | PostgreSQL + Redis |
| **Bank Integration** | Plaid API |
| **Authentication** | JWT + OAuth 2.0 |
| **Hosting** | AWS (EC2, RDS, S3) or DigitalOcean |
| **Email** | SendGrid or Amazon SES |
| **Analytics** | PostHog or Mixpanel |
| **Monitoring** | Sentry, Datadog |
| **CI/CD** | GitHub Actions or GitLab CI |
| **Infrastructure** | Docker, Kubernetes (for scale) |

---

## 11. AGENT BUILD GUIDANCE

This plan is designed for an AI agent (or development team) to execute:

1. **Start with Phase 1:** Core auth, bank integration, subscription detection
2. **Use the API endpoints** as your specification for backend development
3. **Reference data models** for database schema generation
4. **Follow regulatory sections** to ensure compliance from the start
5. **Iterate based on user feedback** (beta testing is critical)
6. **Expand features** following the Phase 2-4 roadmap

### Key Handoff Points for Agents/Teams
- **Backend Engineer:** API spec, data models, bank integration
- **Frontend Engineer:** Component library, design system, UI flows
- **ML Engineer:** Transaction categorization, anomaly detection, recommendations
- **DevOps:** Infrastructure, CI/CD, security, monitoring
- **Legal/Compliance:** Privacy policy, templates, regulatory check

---

## 12. ESTIMATED TIMELINE & BUDGET

| Phase | Duration | Estimated Cost |
|-------|----------|-----------------|
| MVP (Phase 1) | 3 months | $60K-80K |
| Advocate (Phase 2) | 3 months | $80K-100K |
| Intelligence (Phase 3) | 3 months | $100K-150K |
| Scale (Phase 4) | 3 months | $80K-120K |
| **Total Year 1** | **12 months** | **$320K-450K** |

*Costs include salaries, infrastructure, tools, legal, and marketing*

---

## 13. NEXT STEPS

1. **Week 1-2:** Finalize requirements, secure funding
2. **Week 3-4:** Set up development environment, infrastructure
3. **Week 5+:** Begin Phase 1 development
4. **Month 2:** Beta recruitment, security testing
5. **Month 3:** Public launch preparation

---

**Document Version:** 1.0  
**Last Updated:** August 2026  
**Owner:** Product Team  
**Status:** Ready for Development
