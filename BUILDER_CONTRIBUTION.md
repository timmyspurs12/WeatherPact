# WeatherPact Project contribution packet

Prepared 2026-10-23 from the account owner's current **Project** form. **No Portal submission has been made.**

## Outcome and boundary

**B at the form/evidence level:** the Project form does not require a contract link and does not state a Bradbury-only deployment requirement. A truthful pre-deployment Project submission can therefore be prepared with the required website and GitHub evidence. This is not a guarantee of steward acceptance.

The same form sets a strict quality bar: **“Frontend genuinely calls the contract and handles the full transaction lifecycle.”** WeatherPact contains a real adapter and lifecycle implementation, but the current public website is preview-only and does not prove a live contract call. Do not claim that this quality-bar item has been demonstrated. Submitting now carries the form's stated rejection and weekly-slot consequences.

This Project-specific packet supersedes the earlier general repository-only packet. It does not use the closed hackathon rules or treat optional contract links as proof of deployment.

## Project form requirements established

- Contract links are optional; blank is truthful when no deployment exists.
- Website is required before review.
- Evidence requires at least the supported **GitHub Repository** type.
- Demo video is optional and must be a direct YouTube video or X post URL.
- The available Project kinds are a standalone reusable **Intelligent Contract** or a **Milestone**. Milestones require an already accepted Project Explorer project.
- The quality bar requires a real trust problem, live or authoritative data where applicable, complete source and accurate docs, a frontend genuinely calling the contract with full transaction lifecycle handling, and meaningful difference from boilerplate.
- More-information requests update the existing submission without another slot. Fixes or new evidence after rejection require a new submission and another slot. An appeal challenges only the original decision and does not use a slot.
- Reviews take one to two weeks. The form warns that new contributions may miss the Season 1 snapshot and instead count toward Season 2.

The account owner's pasted form showed **1 of 2 Project slots used**, resetting Monday at 00:00 UTC. Do not spend the remaining slot on an overstated application.

Full-guideline link supplied by the form: https://portal.genlayer.foundation/contribution-type/41. An unauthenticated fetch redirected to the Portal home, so this packet asserts only the field rules visible in the account owner's supplied form, not unseen guideline text.

## 01 — Identity

- **Project name:** WeatherPact
- **Project kind:** Standalone reusable **Intelligent Contract**, not Milestone
- **Primary tag:** **Other** — the least misleading available primary category for a non-financial weather-evidence DApp. Do not select Prediction Markets merely because a pact has a YES/NO prediction; there are no stakes or payouts.
- **Tag 1 / Tag 2:** choose only precise topics actually offered after selecting Other. The supplied form did not include those dependent options, so no option names are invented here.

**Logo:** [`submission/weatherpact-logo.png`](submission/weatherpact-logo.png)

- Existing custom contour artwork exported unchanged from `public/favicon.svg`.
- PNG, 512 × 512 px, 21,862 bytes.
- Meets the stated 128–2048 px and maximum 2 MB upload limits.

## 02 — Project summary

**One-liner — 172/180 characters**

> WeatherPact is a preview-stage GenLayer DApp for measurable daily weather pacts, using fixed Open-Meteo evidence and validator consensus without stakes, payouts, or tokens.

## 03 — Project overview

**Description — 988/1000 characters**

> WeatherPact is a preview-stage DApp for measurable daily weather pacts. A creator chooses a place, local date, metric, threshold, and YES/NO prediction. The Python Intelligent Contract stores pacts, resolves outcomes, and tracks non-financial reputation. It constructs a fixed Open-Meteo Historical Weather API request from validated fields; validators independently fetch and normalize evidence before numerical comparison. The React frontend has real wallet/contract and isolated preview adapters with finality, execution, and recovery checks. The website is preview-only: no deployed contract, transaction, on-chain record, or live consensus result is claimed, and genuine writes are disabled. There are no stakes, payments, payouts, tokens, insurance, or off-chain outcome database. Historical weather data may be model-derived or reanalysis-based, not necessarily a direct local station measurement. Validator agreement on one provider is not independent multi-provider verification.

## 04 — Demo video

**Demo URL:** leave blank. No public demo video is claimed or supplied.

## 05 — How-to

### Step 1 — Open the preview

Open https://weatherpact.vercel.app. Confirm the **Preview mode** banner, “Illustrative records only. No on-chain writes,” and **Contract not connected** status.

### Step 2 — Inspect illustrative records

Open **Pact Explorer**. Try the search and status/metric/date filters, then open a pact and expand **Evidence details**. Treat every displayed record as illustrative, not chain evidence.

### Step 3 — Review the creation flow

Open **Create a Pact**. Complete **Place & date**, **Condition**, and **Prediction**; confirm the dataset and transaction notes, then choose **Review transaction**. Confirm that **Contract not connected** appears and **Create on GenLayer** is disabled. Do not connect a wallet or sign.

### Step 4 — Inspect the real integration boundary

In the repository, inspect `src/client/genlayer-client.ts`, `src/client/network.ts`, `src/client/preview-client.ts`, and `contracts/weatherpact.py`. Confirm that the real GenLayer adapter and network guard are separate from the isolated preview adapter.

### Step 5 — Run local verification

Follow the README's **Contract setup and checks** section for the pinned Python environment and GenVM checks. For the JavaScript side, run:

```bash
npm ci
npm run test:client
npm run test:network
npm run build
```

These checks validate source and local behavior; they do not create a deployment or live consensus evidence.

## 06 — Review verification

**Expected verification outcome — 464/500 characters**

> The site shows "Preview mode," "Contract not connected," illustrative records, and disabled genuine writes. The repository contains the real adapter, guard, contract, and tests. Local checks yield 38 Direct Mode passes, 3 GenVM lint passes, 5 journal and 7 network test passes, and a strict TypeScript/Vite build. This verifies source and preview behavior only, not a live deployment, transaction, consensus result, or the form's genuine contract-call quality bar.

- **Contract link 1:** leave blank.
- **Additional deployments:** do not add any.

## 07 — Project links and evidence

- **Website — required:** https://weatherpact.vercel.app
- **GitHub:** https://github.com/timmyspurs12/WeatherPact

Add the repository as the required evidence item and allow the Portal to auto-detect **GitHub Repository**. The following supporting items use stable commit-pinned source URLs:

| Evidence type     | What it proves — and does not prove                                                                | URL                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GitHub Repository | Public source, documentation, and commit history; not a deployment.                                | https://github.com/timmyspurs12/WeatherPact                                                                                |
| GitHub File       | README architecture, local validation, limitations, and missing node RPC.                          | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/README.md                        |
| GitHub File       | Python Intelligent Contract and fixed Open-Meteo request logic.                                    | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/contracts/weatherpact.py         |
| GitHub File       | Real wallet/contract adapter and transaction lifecycle implementation; not a live execution proof. | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/src/client/genlayer-client.ts    |
| GitHub File       | Direct Mode tests; local validation only.                                                          | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/tests/direct/test_weatherpact.py |

## Quality-bar warning and missing evidence

The following must remain explicit in any reviewer discussion:

- No qualified official Bradbury Phase 2 GenLayer node RPC with required `gen_*` methods has been found.
- There is no WeatherPact contract address, deployment transaction, explorer link, or deployed-source verification.
- There is no measured/validated live WeatherPact fee profile, successful execution result, finalized transaction, or live consensus/weather-resolution record.
- The public website does not currently demonstrate the form's genuine contract-call quality-bar item. Its real adapter is source evidence, not live proof.
- Historical weather evidence may be model-derived or reanalysis-based. Validator agreement on one Open-Meteo response is not independent multi-provider verification.

After an official endpoint becomes available, configure only its public URL and run `npm run verify:network`. Do not sign or deploy unless the unchanged guard passes. Update this packet with the actual deployment and verification evidence only after those facts exist.

## Review and later evidence

Use the Project form's rules, not the older general contribution workflow:

- **More information:** update the existing submission; no additional slot.
- **Rejection:** fixes or new evidence require a new submission and another weekly slot.
- **Appeal:** challenges the original decision with the work as submitted; no additional slot.
- **Milestone:** only after a project has been accepted for Project Explorer; cosmetic changes do not qualify.

No wallet connection, authentication, signature, Portal submission, deployment, or production change was performed while preparing this packet.
