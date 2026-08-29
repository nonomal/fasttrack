# Uploading the complete FastTrack v2.2 repository to GitHub

This archive is the complete repository, not an update/overlay.

## Recommended: replace the repository from Git

1. Extract the ZIP.
2. Open a terminal inside the extracted `fasttrack-v2.2-complete` folder.
3. Initialise or connect it to the existing repository.

To replace the existing `main` branch contents while keeping GitHub history available remotely:

```bash
git clone https://github.com/theqldcoalminer/fasttrack.git fasttrack-upload
cd fasttrack-upload
```

Remove the old working-tree files without deleting `.git`:

```bash
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
```

Copy every file from the extracted complete package into this folder, then:

```bash
git add -A
git status
git commit -m "FastTrack v2.2 complete application"
git push origin main
```

Tag the release:

```bash
git tag -a v2.2.0 -m "FastTrack v2.2.0"
git push origin v2.2.0
```

## GitHub web upload

GitHub does not automatically unpack a ZIP into a repository.

If using the website:

1. Extract the ZIP locally.
2. Open the repository on GitHub.
3. Choose **Add file → Upload files**.
4. Upload the extracted repository files/folders, not the ZIP itself.
5. Commit the changes to `main`.

For replacing a project with many removed files, the Git command-line method above is cleaner because `git add -A` records both additions and deletions.

## After upload

The included GitHub Actions workflow builds the Docker image for amd64 and arm64 and publishes it to GitHub Container Registry on pushes/tags where package publishing is permitted.
