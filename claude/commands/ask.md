Review the code/solutions discussed above by consulting multiple AI models in parallel.

Parse the arguments to determine which models to use: $ARGUMENTS

For each model mentioned (common aliases):
- "linus" → Use Task tool with subagent_type="linus-code-reviewer"
- "codex" → Use mcp__pal__clink with cli_name="codex", role="codereviewer"
- "gemini" → Use mcp__pal__clink with cli_name="gemini", role="codereviewer"
- "claude" → Use mcp__pal__clink with cli_name="claude", role="codereviewer"
- "gpt" or "openai" → Use mcp__pal__chat with model="gpt-5.1"

IMPORTANT: Launch ALL the specified reviewers in PARALLEL (single message with multiple tool calls).

For each reviewer, construct the prompt with these CRITICAL instructions:

```
You are acting as a CODE REVIEWER only. Your task is to ANALYZE and DISCUSS, NOT to implement.

STRICT RULES:
1. DO NOT write any code implementations
2. DO NOT create files or make changes
3. DO NOT start coding "to show how it would work"
4. ONLY provide analysis, critique, and recommendations

Your response should include:
1. Analysis of the approaches/solutions discussed
2. Strengths and weaknesses of each approach
3. Potential issues or edge cases to consider
4. A clear recommendation with reasoning

If you feel the urge to write code, STOP and describe what you would do instead.
```

After all responses are collected, synthesize a final summary comparing the different perspectives and provide a conclusive recommendation.
