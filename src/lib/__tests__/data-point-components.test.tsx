import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as civicClient from '@/lib/queries/civic-client';

describe('useDataPoints and Edge API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data points via Edge API function', async () => {
    const mockGetDataPoints = vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {
        'about.hero.headline': 'Grassroots Resistance for Democracy',
      },
      rows: [
        {
          key: 'about.hero.headline',
          value: 'Grassroots Resistance for Democracy',
          group_name: 'about',
          label: 'About Hero Headline',
        },
      ],
    });

    const res = await civicClient.getDataPoints('about');
    expect(mockGetDataPoints).toHaveBeenCalledWith('about');
    expect(res.dataPoints['about.hero.headline']).toBe('Grassroots Resistance for Democracy');
    expect(res.rows).toHaveLength(1);
  });

  it('saves data point via Edge API function and dispatches custom event', async () => {
    const mockSaveDataPoint = vi.spyOn(civicClient, 'saveDataPoint').mockResolvedValue({
      success: true,
      dataPoint: {
        key: 'home.hero.headline',
        value: 'Updated Headline Value',
        group_name: 'home',
        label: 'home.hero.headline',
      },
    });

    const eventSpy = vi.fn();
    window.addEventListener('data-point-saved', eventSpy);

    const payload = {
      key: 'home.hero.headline',
      value: 'Updated Headline Value',
      group_name: 'home',
      label: 'home.hero.headline',
    };

    const res = await civicClient.saveDataPoint(payload);
    expect(mockSaveDataPoint).toHaveBeenCalledWith(payload);
    expect(res.success).toBe(true);

    // Simulate event dispatch
    window.dispatchEvent(
      new CustomEvent('data-point-saved', {
        detail: { key: payload.key, value: payload.value },
      })
    );

    expect(eventSpy).toHaveBeenCalled();
    const eventDetail = eventSpy.mock.calls[0][0].detail;
    expect(eventDetail.key).toBe('home.hero.headline');
    expect(eventDetail.value).toBe('Updated Headline Value');

    window.removeEventListener('data-point-saved', eventSpy);
  });
});
