// src/pages/Analytics.test.tsx

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Analytics from './Analytics';
import { TrackingResult } from '../lib/types';

// --- Mocks ---

const { mockGetAllTrackingResults, mockGeneratePDFReport, mockJsPDFSave } = vi.hoisted(() => {
  const mockJsPDFSave = vi.fn();
  return {
    mockGetAllTrackingResults: vi.fn(),
    // THE FIX: The mock must return a Promise to match the async function signature in the component.
    mockGeneratePDFReport: vi.fn(async () => ({ save: mockJsPDFSave })),
    mockJsPDFSave: mockJsPDFSave,
  };
});

vi.mock('../components/Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('../components/ServerStatusIndicator', () => ({ default: () => <div data-testid="server-status" /> }));

vi.mock('./Analytics', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        ChartRenderer: vi.fn(() => <div data-testid="chart-renderer" />),
    };
});

vi.mock('../lib/theme', () => ({ getStoredTheme: vi.fn(() => 'dark') }));

vi.mock('../lib/database', () => ({
  getAllTrackingResults: mockGetAllTrackingResults,
}));

vi.mock('../lib/api', () => ({
  generatePDFReport: mockGeneratePDFReport,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock data
const mockTrackingData: TrackingResult[] = [
  { tracker_id: 1, vehicle_type: 'car', compliance: 1, reaction_time: 1.5, weather_condition: 'clear', date: new Date().toISOString(), status: 'tracked', temperature: 20 },
  { tracker_id: 2, vehicle_type: 'truck', compliance: 0, reaction_time: null, weather_condition: 'rainy', date: new Date().toISOString(), status: 'tracked', temperature: 15 },
  { tracker_id: 3, vehicle_type: 'car', compliance: 1, reaction_time: 2.0, weather_condition: 'clear', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), status: 'tracked', temperature: 22 },
];

const mockAnalysisData = {
  weather_analysis: { weather_compliance: { clear: { mean: 1, count: 2 }, rainy: { mean: 0, count: 1 } }, weather_reaction_time: {} },
  basic_correlations: { vehicle_type_compliance: { car: { mean: 1, count: 2 }, truck: { mean: 0, count: 1 } }, hour_compliance: {} },
  recommendations: [{ category: 'weather', type: 'warning', message: 'Rainy weather shows low compliance', suggestion: 'Be careful in rain' }],
};

// --- Test Suite ---

describe('Analytics component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const assertStatsCardValue = (cardLabel: RegExp, value: string) => {
    const labelElement = screen.getByText(cardLabel);
    const cardElement = labelElement.parentElement;
    expect(cardElement).not.toBeNull();
    expect(within(cardElement!).getByText(value)).toBeInTheDocument();
  };
  
  it('loads and displays data successfully from the backend', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success', tracking_results: mockTrackingData }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success', analysis: mockAnalysisData }) });
    
    render(<Analytics />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    // THE FIX: Use a helper to make the query specific to the stats card, avoiding ambiguity.
    assertStatsCardValue(/Total Vehicles/i, '3');
    assertStatsCardValue(/Overall Compliance/i, '66.7%');
    expect(mockGetAllTrackingResults).not.toHaveBeenCalled();
  });

  it('falls back to database if backend fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Backend down'));
    mockGetAllTrackingResults.mockResolvedValue(mockTrackingData);

    render(<Analytics />);
    
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    // THE FIX: Make the query specific to the stats card.
    assertStatsCardValue(/Total Vehicles/i, '3');
    expect(mockGetAllTrackingResults).toHaveBeenCalledTimes(1);
  });

  it('generates a PDF report when the button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success', tracking_results: mockTrackingData }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success', analysis: mockAnalysisData }) });
      
    render(<Analytics />);
    
    // Wait for initial data load to complete.
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const generateReportButton = screen.getByRole('button', { name: /Generate Report/i });
    
    // THE FIX: Wrap the click event and subsequent promise resolution in `act` to wait for all state updates.
    await act(async () => {
        fireEvent.click(generateReportButton);
        // Ensure all microtasks (like the async generatePDFReport) have run.
        await Promise.resolve();
    });

    expect(mockGeneratePDFReport).toHaveBeenCalled();
    expect(mockJsPDFSave).toHaveBeenCalledWith(expect.stringContaining('Project49_Traffic_Analysis_Report_'));
  });
});