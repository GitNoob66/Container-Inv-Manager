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
- Working role (Master User / Centre User) is a local operating mode in `src/lib/role.ts`, not a security boundary: the app has no login by design.
- The packaged Windows app stores data in a `data` folder beside the EXE (`app.setPath("userData")` in electron/main.cjs) so the extracted folder is portable; ship it as a ZIP, not a temp-extracting SFX.
