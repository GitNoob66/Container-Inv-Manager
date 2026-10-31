<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## TypeScript config
- `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off: grid and Excel rows are dynamic `Record<string, string>` maps, so those flags add ceremony without safety.

## Offline edition
- The web build uses Lovable Cloud, while the portable Windows build selects IndexedDB through `VITE_OFFLINE_MODE=true`, preserving one UI and data contract for both editions.
- Container fields added to the cloud schema must also be represented in the IndexedDB model so online and portable reports remain compatible.
- Login (Admin or one centre user) is checked by `api.verifyLogin`: cloud uses the security-definer `verify_access` RPC over a hidden `access_passwords` table, offline uses salted SHA-256 in IndexedDB; the session lives in sessionStorage (`src/lib/role.ts`) so closing the window logs out. Data tables stay open to anon, so this gates the UI rather than the database.
- Per-centre columns live in `custom_columns`: `builtin=true` rows rename/hide a standard field, others are extra fields stored in `containers.custom_fields` (grid keys prefixed `cf_`).
- Wagon lists for rail movements are session-only memory (`src/lib/wagon-session.ts`); loading rules live in `src/lib/wagons.ts` with tests.
- The packaged Windows app stores data in a `data` folder beside the EXE (`app.setPath("userData")` in electron/main.cjs) so the extracted folder is portable; ship it as a ZIP, not a temp-extracting SFX.

## Modules
- `/` is a module picker; Container Inventory lives under `/inventory` (plus its existing routes) behind the login gate, while the Haulage & Train Summary module (`src/haulage/`, route `/haulage`) skips login, so the two tools share one app and build.
- Haulage styling is scoped by the `haulage-theme` class on `<html>` (added while `/haulage` is mounted) so its tokens never change the inventory screens, including portalled dialogs.
- Grid transport columns follow the mode chosen above the grid (`mode` option to `inwardColumns`/`outwardColumns`) rather than row values, so switching Road/Rail immediately swaps truck vs. rake/wagon columns.
