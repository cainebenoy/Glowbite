# Start here

1. Create an empty repo (for example `glowbite-preorder`) and copy everything in this kit into its root:
   `CLAUDE.md`, `BUILD_PROMPT.md`, `reference/`.
2. Make sure the machine has Node 20+, pnpm, the Supabase CLI and Docker (for local Supabase), and that you're logged in to Vercel and Supabase.
3. Open Claude Code in the repo and send:

   > Read CLAUDE.md and BUILD_PROMPT.md, then open reference/prototype.html and the screens in reference/screens. Before writing code, reply with your implementation plan and any architecture changes you'd propose. Once I approve, build everything end to end in one run and finish with the full test suite green.

4. Review the plan it proposes, approve, and let it run.
5. When it reports done, test on a real phone and a desktop browser: scroll the whole story, submit a lead, check it in `/admin`, export CSV, flip a claim gate in settings and see the page update.

`reference/prototype.html` opens in any browser (needs internet for the 3D library and fonts).
