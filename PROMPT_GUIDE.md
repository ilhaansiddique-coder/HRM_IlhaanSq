# Prompt Guide

Use these templates when asking Codex for work in this repository. They are optimized for the current stack:

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Optional backend work under `apps/api`

## Core Rule

The best prompts are specific about:

- what you want done
- where the work should happen
- what must not change
- how the answer should be returned

## Coding Prompt Template

```md
Task:
[Fix / build / refactor / review / explain the feature or bug in one sentence]

Project Context:
- Stack: Next.js 15, React 18, TypeScript, Tailwind, Supabase
- Area: [frontend / backend / auth / dashboard / landing page / API / database]
- Files: [list exact paths]
- Current behavior: [what happens now]
- Desired behavior: [what should happen instead]

Technical Details:
- Errors: [paste exact error, console output, or failing behavior]
- Relevant code: [paste small snippet if useful]
- Data flow: [API, component, hook, table, route, etc.]

Constraints:
- Keep existing UI/design system
- Do not change unrelated files
- Prefer minimal safe changes
- Do not add new libraries unless necessary
- Preserve existing behavior outside this fix
- [add any project-specific constraint]

Return:
- Implement the change
- Summarize what changed
- Mention risks, assumptions, and anything I should test

Success Criteria:
- `npm run build` should pass
- `npm run lint` should stay clean or not get worse
- No TypeScript errors
- Behavior matches the desired outcome
```

## Coding Prompt Example

```md
Task:
Fix the demo request form validation.

Project Context:
- Stack: Next.js 15, React 18, TypeScript, Tailwind, Supabase
- Area: frontend
- Files: `src/views/DemoRequestPage.tsx`
- Current behavior: the form submits even when required fields are empty
- Desired behavior: required fields should show inline validation and block submission

Technical Details:
- Errors: no runtime error, just incorrect behavior
- Relevant code: uses React Hook Form

Constraints:
- Keep the current layout and styling
- Do not add a new validation library
- Prefer minimal changes

Return:
- Implement the fix
- Summarize the code changes
- Mention what I should verify manually

Success Criteria:
- Empty required fields cannot be submitted
- Validation messages are visible and clear
- No regression in the success flow
```

## Review Prompt Template

Use this when you want findings first instead of implementation.

```md
Review this change for bugs, regressions, and missing tests.

Scope:
- Files: [exact paths or PR diff]
- Focus: [logic / security / performance / UX / TypeScript / Supabase]

Return:
- Findings only, ordered by severity
- Include file references
- Mention open questions separately
```

## Business/Content Writing Prompt Template

```md
Task:
[Write / rewrite / improve / summarize the content]

Business Context:
- Company/product: RaheDeen Inventory SaaS
- Audience: [store owners / internal team / investors / demo leads / admins]
- Goal: [sell / educate / onboard / announce / request action]
- Channel: [landing page / email / proposal / WhatsApp / docs / pitch]

Content Inputs:
- Key points to include: [bullet list]
- Facts that must stay accurate: [pricing, features, timelines, claims]
- References or existing draft: [paste text if available]

Tone and Style:
- Tone: [professional / persuasive / direct / warm / premium / simple]
- Length: [short / medium / long]
- Reading level: [simple / business / technical]
- CTA: [book demo / sign up / reply / approve / contact us]

Constraints:
- Avoid hype and vague claims
- Keep wording clear and credible
- Do not invent facts
- Use plain English
- [brand or compliance rule]

Return:
- Final copy
- 2-3 headline or CTA alternatives if relevant
- Optional short note on why this version is stronger

Success Criteria:
- Clear to the target audience
- Matches the intended tone
- Supports the business goal
- Factually aligned with the product
```

## Business/Content Prompt Example

```md
Task:
Rewrite the landing page hero copy.

Business Context:
- Company/product: RaheDeen Inventory SaaS
- Audience: small and mid-sized retail businesses
- Goal: increase demo requests
- Channel: website landing page

Content Inputs:
- Key points to include:
  - inventory tracking
  - sales monitoring
  - invoice workflow
  - role-based access
- Facts that must stay accurate:
  - web-based SaaS
  - supports business operations and reporting

Tone and Style:
- Tone: confident, modern, clear
- Length: short
- Reading level: simple
- CTA: request a demo

Constraints:
- Avoid generic SaaS buzzwords
- Keep it conversion-focused
- Do not overpromise automation features

Return:
- Hero headline
- Supporting paragraph
- CTA button text options

Success Criteria:
- Clear in under 10 seconds
- Stronger differentiation
- Better suited for conversion
```

## Fast Prompt Format

Use this when you want a shorter prompt but still want good output.

```md
Help me with:
[task]

Context:
[important background, file paths, errors]

Constraints:
[what must not change]

Return:
[exact output format]

Success looks like:
[result]
```

## Repo-Specific Prompt Tips

- Name exact files whenever possible, such as `src/views/Landing.tsx` or `src/views/Auth.tsx`.
- Paste the exact error instead of paraphrasing it.
- If the task touches Supabase, mention the table, function, policy, or auth flow.
- If the task touches the API, say whether it is under `apps/api`.
- If you want implementation, say `implement the change`.
- If you only want analysis, say `do not edit files`.
- If you want a review, say `findings first`.
- If build safety matters, say `keep npm run build and npm run lint passing`.

## Copy/Paste Starter

```md
Task:

Project Context:
- Files:
- Current behavior:
- Desired behavior:

Technical Details:
- Error:
- Relevant code:

Constraints:

Return:

Success Criteria:
```
