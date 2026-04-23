Task:
[What you want done in one sentence]

Goal:
[What a good result should achieve]

Context:
[Project/app/background information]
[Relevant files, code, errors, links, or pasted content]

Constraints:
[Tech stack, libraries, deadlines, style rules, things to avoid]
[If coding: do not break existing behavior, preserve style, etc.]

Expected Output:
[What you want back]
Examples:
- code change
- explanation
- step-by-step fix
- review findings only
- refactor
- prompt rewrite

Output Format:
[How I should respond]
Examples:
- concise
- bullet points
- full implementation
- patch only
- summary + next steps

Success Criteria:
[How to judge the answer]
Examples:
- builds successfully
- no TypeScript errors
- mobile responsive
- production-safe


Best compact version:

Help me with: [task]

Context:
[important background]

Constraints:
[limits / requirements]

Return:
[exact format you want]

Success looks like:
[result]

Best format for coding requests to me specifically:

Task:
Fix / build / refactor / review [feature or file]

Code Context:
- Stack: [React / TypeScript / Node / etc.]
- Files: [paths]
- Current issue: [bug/error]
- Desired behavior: [what should happen]

Constraints:
- Keep existing design/system
- Do not change unrelated files
- Prefer minimal changes
- Add tests if needed
- Explain tradeoffs briefly

Return:
- Implement the change
- Summarize what changed
- Mention any risks or follow-up


Example:

Task:
Fix the login form validation in `src/views/Auth.tsx`

Code Context:
- React + TypeScript
- The form submits even when email is empty
- I want inline validation messages

Constraints:
- Minimal UI changes
- Keep current component structure
- Do not add new libraries

Return:
- Make the code change
- Briefly explain what changed
- Mention anything I should test




