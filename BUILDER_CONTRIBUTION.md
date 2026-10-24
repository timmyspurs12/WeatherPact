# WeatherPact Project review and evidence plan

Prepared 2026-10-23 from the account owner's Project form and updated after the account owner supplied the reviewer response. The account owner made the Portal submission; the agent did not.

## Outcome and boundary

**C:** the reviewer explicitly requires deployment to a supported public GenLayer network and a reproducible runtime transaction sequence. The reviewer states that source and Direct Mode tests do not independently establish successful runtime execution. Optional contract links on the initial form therefore did not establish acceptance of a pre-deployment Project.

The review says “supported public GenLayer network,” not Bradbury specifically. The account owner initially required Bradbury, then explicitly authorized a **Studionet** pivot on 2026-10-24 because the Bradbury faucet's 0.01 ETH eligibility requirement was unavailable. This supersedes the earlier Bradbury-only restriction. Studio Dev, local networks, rejected endpoints, and relabeled networks remain unauthorized.

The active target is stable hosted **Studionet**, chain ID `61999`, using its official `https://studio.genlayer.com/api` RPC. A separate strict profile preserves Bradbury's checks rather than weakening them. Studionet state may reset, reviewer acceptance of this substitute has not been guaranteed, and every resulting record must be labelled Studionet.

After stable Studio rejected the Phase 2 RC source with `invalid_contract`, the account owner explicitly authorized a stable-Studionet port. The working source now declares GenVM `v0.2.16` and the stable Studio `v0.121.6` runner dependency, with `genlayer-py==0.9.0`, `genlayer-test==0.24.0`, `genvm-linter==0.7.1`, `genlayer-js==1.1.8`, and CLI `0.39.2`. Stable JavaScript fixtures and the strict build pass locally; stable Python lint/Direct Mode and hosted source-schema qualification remain pending. No successful hosted qualification of the migrated source, deployment, or runtime result is claimed in this revision.

The application fields below are preserved as the truthful pre-deployment record. Do not resubmit them as runtime evidence or claim that the live contract-call quality bar has been demonstrated.

## Project form requirements established

- Contract links are optional; blank is truthful when no deployment exists.
- Website is required before review.
- Evidence requires at least the supported **GitHub Repository** type.
- Demo video is optional and must be a direct YouTube video or X post URL.
- The available Project kinds are a standalone reusable **Intelligent Contract** or a **Milestone**. Milestones require an already accepted Project Explorer project.
- The quality bar requires a real trust problem, live or authoritative data where applicable, complete source and accurate docs, a frontend genuinely calling the contract with full transaction lifecycle handling, and meaningful difference from boilerplate.
- More-information requests update the existing submission without another slot. Fixes or new evidence after rejection require a new submission and another slot. An appeal challenges only the original decision and does not use a slot.
- Reviews take one to two weeks. The form warns that new contributions may miss the Season 1 snapshot and instead count toward Season 2.

At initial form capture, the account owner's pasted form showed **1 of 2 Project slots used**, resetting Monday at 00:00 UTC. The subsequent submission may have consumed another slot; check the current account rather than assuming one remains.

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

## Reviewer-required public-network sequence

This is a future evidence plan, not a claim that any step has run. Do not begin signing or deployment until the read-only guard passes and the account owner explicitly authorizes the signer, funds, and fee path.

1. **Qualify the exact source and selected network.** For the active pivot, select `GENLAYER_NETWORK=studionet` and the official `https://studio.genlayer.com/api` RPC in the ignored `.env`; do not configure Bradbury's chain RPC for it. Run `npm run verify:network`. Record the repository commit and `sha256sum contracts/weatherpact.py`. Stop on any identity, schema, deployed-code, or `gen_call` failure. Bradbury retains its separate chain-RPC, genesis, and AddressManager checks if selected later.

2. **Deploy the exact reviewed contract.** After explicit authorization, use the existing guarded deployment wrapper and pinned release family. Record the returned GenLayer transaction ID immediately. Resume tracking that same transaction after uncertainty; never blindly deploy twice. Wait for `FINALIZED` and require `FINISHED_WITH_RETURN` through the stable SDK. Record the actual contract address only after successful execution.

3. **Verify the deployment before writes.** Configure that actual address and run `npm run verify:network -- --require-contract`. Preserve deployed code/schema evidence, the `get_metadata` read, transaction ID, contract address, and supported explorer links. Accepted or finalized status alone is not successful execution.

4. **Record a reproducible historical pact and baseline.** Choose a place, local target date more than seven days in the past, metric, operator, threshold, and YES/NO prediction. Record every input and the creator's public address; never supply an observed value or provider response as authoritative input. Read and save `get_reputation(creator)` and `get_metadata` before the writes.

5. **Create the pact from the actual sender.** Record the creation transaction ID, wait for finalization, and verify successful execution. Identify the unambiguous pact ID and read it with `get_pact` at latest-final. Verify the creator, all inputs, fixed Open-Meteo request, `readyAt`, and initial status. Save the creation activity and before/after metadata counts.

6. **Resolve through the contract.** Once chain time is at or after `readyAt`, call `resolve_pact` with only the pact ID. Record the resolution transaction ID, wait for finalization, and verify successful execution. Read `get_pact` again and verify the actual `RESOLVED_YES` or `RESOLVED_NO` status, observed value and unit, source URL, resolution timestamp/resolver, provider coordinates, and threshold comparison. Do not predeclare the observed value or outcome.

7. **Verify method-specific state effects.** Read `get_reputation(creator)` and `get_activity` at latest-final. Confirm that `finalizedPacts` increased exactly once from the baseline and that `correctPredictions` and `currentStreak` changed consistently with the creator's recorded prediction and actual outcome. Confirm that the same pact has matching creation and resolution activity. Do not infer success from the transaction status alone.

8. **Publish the evidence package.** Include the repository commit, contract source digest, exact inputs, public creator address, deployment/creation/resolution transaction IDs, supported explorer links, final `get_pact`, `get_reputation`, `get_activity`, and `get_metadata` responses, plus the commands needed to reproduce the reads. Add these facts to the Portal only after they exist.

## Former Bradbury blocker and documented self-hosted alternative

The official [network documentation](https://docs.genlayer.com/developers/networks) permits either a Phase 2 node RPC published in the release announcement or **your own qualified node**. It explicitly distinguishes the GenLayer node RPC from the Conduit chain RPC.

The documented [validator setup guide](https://docs.genlayer.com/validators/setup-guide) is the self-hosted route. Its published requirements are 64-bit Linux, AMD64, 16 GB RAM, 8 cores, 128 GB SSD/NVMe, 100 Mbps network, Docker, and Python 3.10+. A compatible deployment must use the current sealed protocol artifacts and preserve chain ID `4221`, genesis `0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4`, and AddressManager `0x3F71AE080BD6270A91dBcc7960d88797828538E0`.

Configure chain infrastructure as documented. In particular, a Conduit WebSocket key belongs only in `GENLAYERNODE_ROLLUP_GENLAYERCHAINRPCKEY` in the node environment, never in a URL, `config.yaml`, browser bundle, or Git. The official node configuration exposes GenLayer node RPC on port `9151`; any remote verification or browser use needs an appropriately secured HTTPS/CORS path without credentialed public URLs.

This workspace does not provide that external node host or Docker-based public infrastructure. Once a self-hosted or officially assigned node is available, the next safe command remains the unchanged read-only guard:

```bash
npm run verify:network
```

## Optional reviewer recommendations not yet implemented

The reviewer also recommended the following improvements. They are not claimed complete:

- Publish the existing tests through dedicated main-branch CI.
- Add a canonical evidence digest to resolved records.
- Strengthen frontend verification of method-specific state changes.

These changes require their own implementation and local validation before a future deployment uses a different source digest.

## Quality-bar warning and missing evidence

The following must remain explicit in any reviewer discussion:

- No qualified official Bradbury Phase 2 GenLayer node RPC with required `gen_*` methods has been found.
- There is no WeatherPact contract address, deployment transaction, explorer link, or deployed-source verification.
- There is no measured/validated live WeatherPact fee profile, successful execution result, finalized transaction, or live consensus/weather-resolution record.
- The public website does not currently demonstrate the form's genuine contract-call quality-bar item. Its real adapter is source evidence, not live proof.
- Historical weather evidence may be model-derived or reanalysis-based. Validator agreement on one Open-Meteo response is not independent multi-provider verification.

After an officially assigned or self-hosted qualified endpoint becomes available, configure only its public URL and run `npm run verify:network`. Do not sign or deploy unless the unchanged guard passes. Update this packet with the actual deployment and verification evidence only after those facts exist.

## Review and later evidence

Use the Project form's rules, not the older general contribution workflow. The pasted reviewer text does not identify the Portal status label, so apply the matching rule shown in the account:

- **More information:** update the existing submission after the required evidence exists; no additional slot.
- **Rejection:** fixes or new evidence require a new submission and another weekly slot.
- **Appeal:** challenges the original decision with the work as submitted; it cannot introduce the new deployment evidence and uses no additional slot.
- **Milestone:** only after a project has been accepted for Project Explorer; cosmetic changes do not qualify.

No wallet connection, authentication, signature, Portal submission, deployment, or production change was performed by the agent while preparing or updating this packet.
