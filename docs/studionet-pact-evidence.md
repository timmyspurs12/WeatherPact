# Studionet pact evidence runbook

This is a fixed-purpose demonstration for the existing WeatherPact deployment. It does not change the frontend, contract, deployment architecture, or production configuration.

## Verified deployment

- Network: Studionet, chain ID `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract: [`0x9417504a58C807E30bdbcb257a3a7B3EbB00FeAE`](https://explorer-studio.genlayer.com/contracts/0x9417504a58C807E30bdbcb257a3a7B3EbB00FeAE)
- Deployment: [`0xd799979e18fc7d7009e14c03345e3002a23b8f712e74b83fb939c8efbeb1640c`](https://explorer-studio.genlayer.com/tx/0xd799979e18fc7d7009e14c03345e3002a23b8f712e74b83fb939c8efbeb1640c)
- Contract source SHA-256: `f4e3ad9a0ae87c7c7654c6a070f9d395389c1a63d93d61725cac148e78b0b1a0`

## Fixed historical pact

| Field                  | Value                        |
| ---------------------- | ---------------------------- |
| Location               | Lagos, Lagos, Nigeria (`NG`) |
| Coordinates            | `6.5244`, `3.3792`           |
| Timezone               | `Africa/Lagos`               |
| Target date            | `2025-06-15`                 |
| Metric                 | `rain_sum`                   |
| Condition              | `gte 10 mm`                  |
| Prediction             | `YES`                        |
| Resolution eligibility | `2025-06-22T00:00:00Z`       |

The contract constructs this canonical Open-Meteo Historical Weather API request:

```text
https://archive-api.open-meteo.com/v1/archive?latitude=6.5244&longitude=3.3792&start_date=2025-06-15&end_date=2025-06-15&daily=rain_sum&timezone=Africa%2FLagos&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timeformat=iso8601
```

The archive reported `21.80 mm` when this input was selected. That is not substituted for validator resolution: the runner accepts only the outcome and evidence stored by the finalized contract transaction. Historical data may be model-derived or reanalysis-based rather than a direct local station measurement.

## Safety properties

`scripts/studionet-pact-evidence.mjs` uses the locked `genlayer-js@1.1.8` SDK and the encrypted-account decryption library already locked with CLI `0.39.2`. It preserves all 12 creation arguments as strings; the CLI scalar parser is not used because it would coerce numeric strings.

Before a new write, the runner checks the exact chain, canonical source digest, deployed source, schema, account address, balance, current contract state, and absence of a conflicting journal. It refuses to create a duplicate matching pact or resolve an already-resolved pact.

Immediately after each submission it writes the returned hash under ignored `.secrets/studionet-pact-evidence/`. Rerunning the same command resumes that hash. If a write throws or returns an invalid hash, it creates a `SUBMISSION_UNCERTAIN` lock with no transaction ID; rerunning is refused until the account and public history are reconciled, because the absence of a returned hash is not proof that nothing was submitted. Finalization requires successful GenVM execution, decoded exact method/arguments, and latest-final stored state. Passwords, decrypted keystores, and private keys are never written to the journal or evidence files.

## Owner-local execution

Use the existing stable clone and encrypted v2 account. Run `npm ci` after updating to the reviewed branch commit. Do not use the separate RC wallet or `$HOME/weatherpact-workflow-pr` checkout.

The default keystore path is `$HOME/.genlayer/keystores/weatherpact-deployer-v2.json`. Set `WEATHERPACT_KEYSTORE_PATH` only if the same encrypted v2 file is stored elsewhere.

Enter the password locally in Git Bash; do not put it in a command argument, file, chat, or `VITE_*` variable:

```bash
IFS= read -r -s -p "WeatherPact keystore password: " WEATHERPACT_KEYSTORE_PASSWORD
printf '\n'
export WEATHERPACT_KEYSTORE_PASSWORD
node scripts/studionet-pact-evidence.mjs create
status=$?
unset WEATHERPACT_KEYSTORE_PASSWORD
printf 'create exit status: %s\n' "$status"
```

Stop if the command fails before printing a transaction hash and inspect the error. A `SUBMISSION_UNCERTAIN` journal deliberately locks retries: do not rerun or delete it until the account and public history have been reconciled. If the command prints `Create Transaction Hash: 0x...`, retain that ID. If a hash is printed but `Same-hash journal:` does not follow, stop and do not rerun; preserve the output for manual same-hash recovery. If the journal is confirmed and tracking is interrupted, rerun exactly (a journal resume is read-only and does not need the password):

```bash
node scripts/studionet-pact-evidence.mjs create
```

Do not delete the journal, change the evidence directory, or attempt a replacement. Successful creation prints the stored pact and its `WP-...` ID.

Resolve the **printed** pact ID, replacing the example below if different:

```bash
IFS= read -r -s -p "WeatherPact keystore password: " WEATHERPACT_KEYSTORE_PASSWORD
printf '\n'
export WEATHERPACT_KEYSTORE_PASSWORD
node scripts/studionet-pact-evidence.mjs resolve WP-0000000001
status=$?
unset WEATHERPACT_KEYSTORE_PASSWORD
printf 'resolve exit status: %s\n' "$status"
```

If a resolution hash is printed but `Same-hash journal:` does not follow, stop and do not rerun; preserve the output for manual same-hash recovery. If the journal is confirmed and tracking was interrupted, rerun the same `resolve` command with the same pact ID. The journaled hash is resumed without decrypting the account or submitting another write.

For a subsequent read-only check:

```bash
node scripts/studionet-pact-evidence.mjs show WP-0000000001
```

Final public evidence is written to `.secrets/studionet-pact-evidence/resolve-evidence-<pact-id>.json`. It contains the creation/resolution hashes, stored pact and canonical evidence URL, activity, metadata, and creator reputation. The `.secrets/` location prevents accidental Git inclusion; the evidence itself contains no wallet secret.
