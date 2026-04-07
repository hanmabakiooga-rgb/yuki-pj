# Apps Script Troubleshooting

## `SyntaxError: Unexpected identifier 'git'` (line 1)

This error means the script file contains non-JavaScript text at the top, typically pasted from a diff/markdown block, for example:

- `git diff ...`
- `diff --git ...`
- code fence lines like ```` ```git ````

### Fix

1. Open `LineBot_Part1_Main.gs` in Apps Script editor.
2. Delete any non-code lines at the top (`git`, `diff --git`, code fences).
3. Ensure the first line starts with normal JS/Apps Script content.
   - In this repo, line 1 should be:
     - `// ==========================================`
4. Save and redeploy webhook version.

### Verification

If the file is clean, parsing should proceed and the line-1 `git` syntax error disappears.
