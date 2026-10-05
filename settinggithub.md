# Setting Up GitHub

## Set the repository destination

Replace `OWNER/REPOSITORY` with the GitHub account or organization and repository name:

```sh
git remote set-url origin https://github.com/OWNER/REPOSITORY.git
git remote -v
```

The fetch and push URLs should both point to the intended repository.

## Check authentication and access

```sh
gh auth status
gh repo view OWNER/REPOSITORY --json name,url,visibility
```

If you need to confirm the authenticated account's repository permissions:

```sh
gh api repos/OWNER/REPOSITORY --jq '.permissions'
```

The `push` permission must be `true`. A successful `gh repo view` only confirms that the repository is readable; it does not guarantee write access.

## Push the current branch

For a branch named `main`:

```sh
git push -u origin main
```

If Git returns HTTP `403` in Codespaces but `gh auth status` shows another saved GitHub login with repository access, the Codespaces `GITHUB_TOKEN` or Git credential helper may be supplying a restricted credential. In that case, use the saved GitHub CLI login for this push only:

```sh
env -u GITHUB_TOKEN git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin main
```

This bypasses the injected `GITHUB_TOKEN` and the configured Git credential helper for that command. It does not change Git configuration or store a token. GitHub CLI must already be logged in with an account that has write access to the repository.

After a successful push, verify the branch is tracking the remote:

```sh
git status --short --branch
```

The output should show `main...origin/main` without file changes.

Never paste or commit access tokens. If no available account has `push: true`, request write access or configure an authorized GitHub login before retrying.