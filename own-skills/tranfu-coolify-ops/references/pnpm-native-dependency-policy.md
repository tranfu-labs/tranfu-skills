# pnpm native dependency build policy

Session-derived deployment note from `tranfu-labs/agentreach-app`. Keep this file intentionally narrow: only record the repeatable pnpm/native-dependency fix, not the whole incident timeline.

## When to apply

Apply this during Coolify four-file/GHA deployment preparation when all are true:

1. The repo uses pnpm:
   - `pnpm-lock.yaml` exists, or
   - `package.json` has `"packageManager": "pnpm@..."`.
2. `package.json` uses native dependencies such as:
   - `better-sqlite3`
   - `esbuild`
   - `sharp`
   - `bcrypt`
   - `sqlite3`
3. One of these symptoms appears, or is likely to appear in CI:
   - `pnpm install` reports `Ignored build scripts`.
   - tests/runtime fail with `Could not locate the bindings file`.
   - a native `.node` binding artifact is missing under `node_modules`.

## Modification rule

1. Ensure `package.json` has one authoritative pnpm version, for example:

   ```json
   "packageManager": "pnpm@9.15.9"
   ```

2. Ensure `pnpm-workspace.yaml` exists and explicitly allows only the native packages actually needed by this repo. Use `onlyBuiltDependencies`; do **not** rely on the older `allowBuilds` map, which can still fail under newer pnpm/Corepack with `ERR_PNPM_IGNORED_BUILDS`.

   ```yaml
   packages:
     - .

   onlyBuiltDependencies:
     - better-sqlite3
     - esbuild
     - sharp
   ```

3. If the repo contains unrelated subpackages such as `site/`, only add them to `packages:` when their package specs are represented in the root lockfile. Otherwise `pnpm install --frozen-lockfile` fails in CI.

4. In GitHub Actions, if `packageManager` is present, use `pnpm/action-setup@v4` without `with.version`; do not specify pnpm twice.

## Verification rule

```bash
pnpm install --frozen-lockfile
pnpm typecheck   # if script exists
pnpm test        # if script exists
```

For `better-sqlite3`, a quick targeted smoke check is:

```bash
node -e "import('better-sqlite3').then(({default: Database}) => { const db = new Database(':memory:'); db.prepare('select 1').get(); db.close(); console.log('better-sqlite3 ok') })"
```
