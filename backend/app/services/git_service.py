"""Git repository monitoring."""
import os
from pathlib import Path


def get_repo_status(path: str) -> dict:
    try:
        import git
        repo = git.Repo(path, search_parent_directories=True)
        branch = repo.active_branch.name
        changed = [item.a_path for item in repo.index.diff(None)]
        untracked = repo.untracked_files
        ahead, behind = 0, 0
        try:
            tracking = repo.active_branch.tracking_branch()
            if tracking:
                ahead = sum(1 for _ in repo.iter_commits(f"{tracking}..HEAD"))
                behind = sum(1 for _ in repo.iter_commits(f"HEAD..{tracking}"))
        except Exception:
            pass
        last = repo.head.commit
        return {
            "branch": branch,
            "changed_files": changed,
            "untracked_files": list(untracked),
            "ahead": ahead,
            "behind": behind,
            "last_commit": {
                "hash": last.hexsha[:7],
                "message": last.message.strip(),
                "author": last.author.name,
            },
        }
    except Exception as e:
        return {"error": str(e)}
