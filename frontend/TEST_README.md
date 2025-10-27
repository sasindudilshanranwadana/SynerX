# Frontend Testing Documentation

This document outlines the testing strategy and existing test coverage for the **SynerX Frontend Application**. The test suite is written using **Vitest** and **React Testing Library**, focusing on component behavior, UI state, and interactions.

---

## 1. Prerequisites

Before running tests, ensure your environment is set up correctly:

-   **Node.js v16+**
-   **npm** or **yarn**

Install all dependencies from the `frontend/` directory:

```bash
cd frontend
npm install
```

---

## 2. Configuration

Vitest is used as the test runner, complemented by React Testing Library for UI assertions. Tests are co-located with the source files they cover, using the `*.test.tsx` file extension.

-   **Configuration**: Managed in `vite.config.ts` and Vitest setup files.
-   **Test File Naming**: `[ComponentName]UT.test.tsx` or `[PageName]UT.test.tsx`.
-   **Example Locations**:
    -   `src/pages/DashboardUT.test.tsx`
    -   `src/components/HeaderUT.test.tsx`

---

## 3. Running the Tests

To execute all frontend tests from the command line, run:

```bash
npm run test
```

To run the tests using the interactive Vitest UI, run:

```bash
npm run testui
```

To enable watch mode for live test reloading during development:

```bash
npx vitest --watch
```

To generate a test coverage report (if configured):

```bash
npx vitest run --coverage
```

---

## 4. Test Suite Breakdown

The test suite is organized into tests for individual pages and shared UI components.

### 4.1 Pages

-   **`AnalyticsUT.test.tsx`**
    -   Tests the main analytics dashboard.
    -   Verifies that data fetching falls back to a secondary source (`database`) if the primary API (`fetch`) fails.
    -   Ensures that PDF report generation is triggered correctly on button click.

-   **`ConfirmationSuccessUT.test.tsx`**
    -   Covers the email confirmation success page.
    -   Validates the initial render, the countdown timer's functionality (updating every second), and correct pluralization.
    -   Tests both automatic navigation after the countdown and manual navigation via button click.
    -   Ensures timers are cleaned up on unmount.

-   **`DashboardUT.test.tsx`**
    -   Tests the main dashboard's layout and initial state.
    -   Verifies that loading skeletons are displayed while data is being fetched.
    -   Ensures all primary sections like Header, Sidebar, and System Status are rendered correctly.

-   **`PlaybackUT.test.tsx`**
    -   Covers the video playback and analysis page.
    -   Tests loading and filtering of videos, including error handling.
    -   Validates the functionality of the video summary modal (opening, data fetching, chart rendering, and cleanup).
    -   Tests the video deletion flow, including the confirmation modal.

-   **`SettingsUT.test.tsx`**
    -   Tests the user settings page.
    -   Verifies that user data is loaded into form fields.
    -   Simulates user profile updates and confirms that the correct API calls are made.
    -   Checks for proper handling of authentication state changes and subscription cleanup.

-   **`StorageUT.test.tsx`**
    -   Covers the storage management page.
    -   Ensures storage statistics (total, used, free) and video lists are rendered correctly.
    -   Tests the user flow for selecting and deleting videos.
    -   Validates the display of loading/error states and the functionality of the temporary file cleanup.

### 4.2 UI Components

-   **`HeaderUT.test.tsx`**
    -   Tests the main application header.
    -   Verifies correct title rendering and that the sidebar toggle icon changes based on state (`Menu` vs. `X`).
    -   Ensures user avatar displays correctly for both logged-in and guest users.
    -   Checks for proper theme application (light/dark mode) and event listener cleanup.

-   **`LoadingScreenUT.test.tsx`**
    -   A simple test to ensure the loading overlay renders with the correct text and full-screen CSS classes.

-   **`NavigationUT.test.tsx`**
    -   Tests the navigation panel within the sidebar.
    -   Verifies all navigation links are rendered and the `activePath` is highlighted correctly.
    -   Tests the display of user profile information and the sign-out functionality.

-   **`ServerStatusIndicatorUT.test.tsx`**
    -   Covers the real-time server status component.
    -   Tests the component's state transitions: `Connecting...` -> `RunPod Connected` (on success) or `RunPod Disconnected` (on failure).
    -   Verifies that the status check is performed periodically and that timers are cleaned up on unmount.

-   **`SidebarUT.test.tsx`**
    -   Tests the main sidebar container.
    -   Verifies visibility and CSS classes based on the `isOpen` prop.
    -   Ensures the child `Navigation` component receives the correct props.
    -   Tests that the `onClose` callback is triggered when the overlay is clicked.

---

## 5. Mocking Strategy

-   **Module Mocking**: External dependencies are mocked at the module level using `vi.mock()`. This includes libraries like `react-router-dom`, `chart.js`, and local modules for API calls (`lib/api`), database interactions (`lib/database`), and authentication (`lib/supabase`).
-   **Hoisting**: `vi.hoisted()` is used to create mock functions that can be referenced inside the `vi.mock()` factory, allowing for fine-grained control over mocked implementations within tests.
-   **Global Mocks**: Global APIs like `fetch` and browser features like `HTMLCanvasElement` are mocked to provide a consistent test environment.
-   **Timers**: `vi.useFakeTimers()` is used extensively to control `setTimeout` and `setInterval`, allowing tests to deterministically advance time and test time-based logic without waiting.

---

## 6. Summary

This comprehensive test suite ensures that all major pages and UI components function as expected across various user flows and states. By co-locating tests and heavily utilizing mocking, the suite remains maintainable and provides fast, reliable feedback during development.

Remember to add a new `*.test.tsx` file when introducing new components or pages to maintain coverage.
