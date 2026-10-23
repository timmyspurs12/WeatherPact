# WeatherPact Builder contribution packet

Prepared 2026-10-23. **No Portal submission has been made.** This packet uses the documented pre-deployment **Builder → GitHub Repository** contribution path. It is not a Contract Deployed submission or a claim that WeatherPact is deployed on Bradbury Phase 2.

## Documented basis

The published GenLayer Points documentation distinguishes repository contributions from deployment contributions:

- [Builders Guide](https://mintlify.wiki/genlayer-foundation/points/guides/builders): a GitHub Repository contribution requires a public GenLayer-related repository, substantial code (>100 lines), a clear README, and GitHub account linking. Contract Deployed is a separate type with separate deployment evidence.
- [Contribution Types](https://mintlify.wiki/genlayer-foundation/points/guides/contribution-types): GitHub Repository requires the repository URL, README, and commit history; Contract Deployed requires an actual GenLayer testnet deployment plus a contract address or transaction hash.
- [Evidence Guidelines](https://mintlify.wiki/genlayer-foundation/points/guides/evidence-guidelines): the repository URL is required; specific files, documentation, and a live demo are recommended. A live demo is not a substitute for deployment evidence.
- [Submitting Contributions](https://mintlify.wiki/genlayer-foundation/points/guides/submitting-contributions): a complete profile, contribution type, actual completion date, URL evidence, and steward review are required. Notes are optional and limited to 1,000 characters.

## Submission path for the account owner

1. Open [GenLayer Portal → Builders](https://portal.genlayer.foundation/builders/) and choose **Become a Builder**. The current Portal asks for a wallet sign-in signature; the account owner must approve it. No signature was requested or approved during this preparation.
2. Complete the Builder Welcome/profile steps, including display name and email. Link the account owner's GitHub profile as required for repository contributions.
3. Open **Submit Contribution**, choose **Builder → GitHub Repository**, and enter the actual date the repository work was completed. Do not use a future date or automatically substitute the submission date.
4. Add the notes and public URL evidence below. Complete the new-submission reCAPTCHA and submit for steward review only after checking every statement.
5. Do not select **Contract Deployed**, and do not enter an invented address, transaction, explorer link, fee profile, deployment status, or consensus result.

## Ready-to-check fields

**Contribution type:** Builder → GitHub Repository  
**Repository:** https://github.com/timmyspurs12/WeatherPact  
**Public website:** https://weatherpact.vercel.app  
**Website status:** static frontend in conspicuously labelled preview mode; not connected to a deployed WeatherPact contract and not evidence of on-chain activity.

### Notes (991 characters, within the documented 1,000-character limit)

> WeatherPact is a React + TypeScript DApp and Python Intelligent Contract for public, measurable weather pacts. The contract builds fixed Open-Meteo Historical Weather API requests from validated fields and resolves numerical YES/NO outcomes through GenLayer's non-deterministic equivalence flow. It has no payments, stakes, payouts, tokens, API backend, or off-chain outcome database. The repository includes the contract, accessible static frontend, real/preview adapter boundary, transaction journal, network/deployment guards, tests, and documentation. Local checks pass: 38 Direct Mode tests, 3 GenVM lint checks, 5 journal tests, 7 network fixtures, and the strict TypeScript/Vite build. Not deployed: no contract address, transaction, fee profile, or live consensus result is claimed. The website is labelled preview mode with genuine writes disabled. Historical weather data may be model-derived or reanalysis-based; validator agreement is not independent multi-provider verification.

### URL evidence

| Description                                                                                                         | URL                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Public WeatherPact repository containing the Intelligent Contract, static DApp, tests, and documentation.           | https://github.com/timmyspurs12/WeatherPact                                                                                |
| README describing architecture, local validation, preview limitations, and the missing qualified GenLayer node RPC. | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/README.md                        |
| Authoritative Python Intelligent Contract with fixed Open-Meteo evidence requests and strict outcome validation.    | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/contracts/weatherpact.py         |
| Direct Mode contract tests; local validation only, not deployment or live consensus evidence.                       | https://github.com/timmyspurs12/WeatherPact/blob/cde3ec2e2637accaf8db1656237721820ef1b564/tests/direct/test_weatherpact.py |
| Static production website in preview mode; genuine writes are disabled and no on-chain records are claimed.         | https://weatherpact.vercel.app                                                                                             |

## Evidence not available and not claimed

- A qualified official Bradbury Phase 2 GenLayer node RPC with the required `gen_*` methods.
- A WeatherPact contract address, deployment transaction, explorer link, or deployed-source verification.
- A measured/validated live WeatherPact fee profile, successful execution result, finalized transaction, or live consensus/weather-resolution record.
- A connected on-chain frontend demonstration. The public website is preview-only.

After an official endpoint becomes available, configure only its public URL and run `npm run verify:network`. Do not sign or deploy unless the unchanged guard passes. A later genuine deployment can support a separate, non-duplicate Contract Deployed contribution with its actual transaction/address evidence.

## Review and later changes

The published submission guide permits editing only while a submission is **Pending Review** or **More Information Needed**. Notes, dates, and evidence can then be changed; the contribution type can be changed only while pending. Editing returns it to Pending Review and does not require reCAPTCHA. Accepted contributions are permanent and cannot be edited or deleted through that flow. A rejected submission requires a new submission and a new reCAPTCHA. Do not submit the same repository contribution twice.

## Portal inspection record

Read-only browser inspections in GitHub Actions runs [40000484631](https://github.com/timmyspurs12/WeatherPact/actions/runs/40000484631) and [40001039453](https://github.com/timmyspurs12/WeatherPact/actions/runs/40001039453) checked the current public Builders, Contribute, and Project Explorer navigation. **Become a Builder** opened the Portal's sign-in dialog, which states that sign-in asks for a signature; public navigation exposed no application form fields. No wallet connection, authentication, signature, form submission, deployment, or production change occurred. The field rules above therefore come from the published GenLayer Points guides, not from assumptions about the signature-gated form.
