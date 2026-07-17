# Contributing to SoulSync

Thank you for your interest in contributing to SoulSync! We welcome all contributions, including bug reports, feature requests, documentation improvements, and pull requests.

By participating in this project, you agree to abide by our code of conduct and community standards.

---

## Getting Started

### 1. Fork and Clone
Fork the repository on GitHub and clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/SoulSync.git
cd SoulSync
```

### 2. Configure Your Environment
Set up your local configuration by creating your environment files:
```bash
# Install workspace dependencies
npm run install:all

# Configure environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example  backend/.env
```
Ensure you set up your database endpoints and necessary keys (such as MongoDB, Upstash Redis, and Groq).

### 3. Start the Dev Servers
Verify that the application runs locally:
```bash
# Start backend and frontend (separate terminals)
npm run dev:backend
npm run dev:frontend
```

---

## Development Workflow

### 1. Create a Branch
Always create a descriptive feature branch for your changes:
```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
```

### 2. Style and Standards
- **TypeScript**: Ensure TypeScript types are correctly defined. Do not use `any` unless absolutely necessary.
- **Code Quality**: Ensure there are no runtime warnings or lint errors.
- **Verification**: Run local validation scripts to ensure everything passes:
  ```bash
  npm run typecheck
  ```

### 3. Commit Guidelines
We follow [Conventional Commits](https://www.conventionalcommits.org/) format. Please prefix your commit messages:

- `feat:` for new features (e.g., `feat: add sleep timer to player`)
- `fix:` for bug fixes (e.g., `fix: resolve memory leak in websocket listener`)
- `docs:` for documentation updates (e.g., `docs: add environment variable guide`)
- `style:` for changes that do not affect code logic (formatting, semi-colons, etc.)
- `refactor:` for code changes that neither fix a bug nor add a feature
- `perf:` for performance optimizations
- `chore:` for general build tasks or dependencies maintenance

---

## Pull Request Guidelines

Before submitting your Pull Request, please ensure:

- [ ] All code builds successfully with `npm run build:frontend` and `npm run build:backend`.
- [ ] TypeScript checks pass with `npm run typecheck`.
- [ ] The app has been verified across multiple browsers (Chrome, Firefox, and Safari) and mobile viewports.
- [ ] If changes affect the Android client, you have compiled and verified the APK.
- [ ] Your branch is rebased onto the latest `main` branch.

### Submitting a PR
1. Push your changes to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request on the main repository.
3. Provide a clear description of the problem solved, the implementation details, and any screenshots/videos illustrating the changes.
