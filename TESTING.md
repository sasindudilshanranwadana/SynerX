# Testing Guide

This document provides information about the test suite for the frontend application.

## Test Framework

This project uses **Vitest** as the testing framework, along with **React Testing Library** for component testing.

### Key Dependencies

- `vitest` - Fast unit test framework
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom matchers for DOM assertions
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM implementation for Node.js

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Structure

```
src/
├── __tests__/              # App-level integration tests
├── components/
│   └── __tests__/         # Component unit tests
├── lib/
│   └── __tests__/         # Library/utility tests
├── pages/
│   └── __tests__/         # Page component tests
└── test/
    ├── fixtures/          # Test data and mocks
    ├── mocks/            # Mock implementations
    └── utils/            # Test utilities and helpers
```

## Test Coverage

The project targets the following coverage thresholds:

- **Statements**: 70%
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`.

## Writing Tests

### Component Tests

Component tests should verify:
- Rendering with different props
- User interactions
- State changes
- Integration with routing and context

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils/testUtils';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly and interact properly with the backend services.

Example:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { mockFetch, render, screen, waitFor } from '../../test/utils/testUtils';
import Dashboard from '../Dashboard';

describe('Dashboard Integration', () => {
  it('loads and displays data', async () => {
    mockFetch({ stats: { videosProcessed: 10 } });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
});
```

## Mocking

### Supabase Client

The Supabase client is mocked globally in `src/test/mocks/supabase.ts`. This mock provides default implementations for:

- Authentication methods (`signInWithPassword`, `signUp`, `signOut`)
- Database queries (`from`, `select`, `insert`, `update`, `delete`)
- Real-time subscriptions (`channel`)

### WebSocket Connections

WebSocket connections can be mocked using the `mockWebSocket` utility from `src/test/utils/testUtils.tsx`.

### Fetch API

HTTP requests can be mocked using the `mockFetch` utility:

```typescript
import { mockFetch } from '../../test/utils/testUtils';

mockFetch({ success: true, data: [] }, true, 200);
```

## Test Data

Test fixtures are located in `src/test/fixtures/mockData.ts` and provide:

- `mockVideo` - Sample video record
- `mockVideos` - Array of video records
- `mockTrackingResult` - Sample tracking result
- `mockTrackingResults` - Array of tracking results
- `mockVehicleCount` - Sample vehicle count
- `mockProcessingJob` - Sample processing job

## Best Practices

1. **Test behavior, not implementation** - Focus on what the component does, not how it does it
2. **Use semantic queries** - Prefer `getByRole`, `getByLabelText`, `getByText` over `getByTestId`
3. **Clean up after tests** - Use `beforeEach` and `afterEach` hooks to reset state
4. **Mock external dependencies** - Keep tests isolated and fast
5. **Write descriptive test names** - Test names should clearly describe what is being tested
6. **Test edge cases** - Include tests for error states, loading states, and empty states

## Troubleshooting

### Tests failing due to async operations

Use `waitFor` from Testing Library to wait for async operations:

```typescript
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Mock not being called

Ensure mocks are cleared between tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### DOM cleanup warnings

The test setup automatically cleans up after each test. If you still see warnings, ensure you're using the custom `render` function from `testUtils`.

## Continuous Integration

Tests should be run in CI/CD pipelines before deploying. The test suite is designed to:

- Run quickly (< 30 seconds for full suite)
- Provide clear failure messages
- Generate coverage reports
- Exit with appropriate status codes

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Guide](https://testing-library.com/docs/user-event/intro)
