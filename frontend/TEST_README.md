# Frontend Testing Documentation

This document outlines the testing strategy and existing test coverage for the **SynerX Frontend Application**. The test suite is written using **Vitest** and **React Testing Library**, focusing on component behavior, UI state, and interactions.

---

## 1. Prerequisites

Before running tests, ensure your environment is set up correctly:

- **Node.js v16+**
- **npm** or **yarn**

Install all dependencies from the `frontend/` directory:

```bash
cd frontend
npm install
```

---

## 2. Configuration

Vitest is used as the test runner and React Testing Library for UI assertions. Tests are colocated with components and use the `.test.tsx` file extension.

- Configured via `vite.config.ts` and Vitest setup files
- Example test locations:
  - `src/components/UploadForm.test.tsx`
  - `src/components/Sidebar.test.tsx`

---

## 3. Running the Tests

To execute all frontend tests, run:

```bash
npm run test
```

To enable watch mode for live test reloading:

```bash
npx vitest --watch
```

If coverage is configured:

```bash
npx vitest run --coverage
```

Output will appear in the `/coverage` folder.

---

## 4. Test Suite Breakdown

### 4.1 UI Components

- **`UploadForm.test.tsx`**
  - Renders file upload form and simulates user interaction
  - Validates button states and upload event firing

- **`Sidebar.test.tsx`**
  - Tests sidebar toggle functionality and navigation link activation

- **`VideoPlayer.test.tsx`**
  - Simulates video load/playback, checks fallback behavior on error

- **`Header.test.tsx`**
  - Verifies branding, link rendering, and responsive layout

### 4.2  API Mocking

- Mock service modules using `vi.mock()` to simulate API calls (if applicable)
- Check loading states, error messages, and conditional renders

### 4.3 Utility & Hook Testing

> *(If custom hooks or utility functions exist, they should be tested in isolation)*

---

## 5. Test Utilities & Setup

- **`setupTests.ts`**: Initializes the testing environment with `jsdom` and Testing Library config.
- Use `@testing-library/react` methods like `render()`, `fireEvent()`, `screen.getByText()`, etc.

---

## 6. Summary

This test suite helps ensure that all major UI components work as expected under different user flows. Keep tests isolated, declarative, and reflective of user behavior.

Remember to add new `.test.tsx` files when introducing new components.
