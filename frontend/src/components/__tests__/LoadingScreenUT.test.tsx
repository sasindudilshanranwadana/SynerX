// src/components/LoadingScreen.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingScreen from './LoadingScreen'; // Make sure the path is correct

describe('LoadingScreen component', () => {
  it('should render the loading text', () => {
    // 1. Render the component into the virtual DOM
    render(<LoadingScreen />);

    // 2. Find an element with the text "Loading...".
    // The `i` flag makes the text match case-insensitive, which is a good practice.
    const loadingTextElement = screen.getByText(/Loading.../i);

    // 3. Assert that the element was found in the document
    expect(loadingTextElement).toBeInTheDocument();
  });

  it('should have the correct classes for a full-screen overlay', () => {
    // The `render` function returns a number of utilities, including a `container`
    // which is the top-level DOM node your component is rendered in.
    const { container } = render(<LoadingScreen />);

    // We expect the first child of the container to be our main div.
    const mainDiv = container.firstChild;

    // Assert that this div has the necessary classes to make it a fixed overlay.
    expect(mainDiv).toHaveClass('fixed inset-0 bg-[#0B1121] flex items-center justify-center z-50');
  });
});