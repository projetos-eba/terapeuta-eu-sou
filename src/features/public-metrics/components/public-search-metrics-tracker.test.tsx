import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emitPublicMetricEvents = vi.hoisted(() => vi.fn());

vi.mock("../public-metric-events.client", () => ({
  emitPublicMetricEvents,
}));

import { PublicSearchMetricsTracker } from "./public-search-metrics-tracker";

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];

  constructor(
    readonly callback: IntersectionObserverCallback,
  ) {
    IntersectionObserverMock.instances.push(this);
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

beforeEach(() => {
  emitPublicMetricEvents.mockReset();
  IntersectionObserverMock.instances = [];
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  document.body.innerHTML = `
    <article
      data-metric-result-position="1"
      data-metric-therapist-slug="ana-oliveira"
    ></article>
  `;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("PublicSearchMetricsTracker", () => {
  it("keeps the same search-set identifier across a remount so the server can deduplicate it", () => {
    const resultSetId = "15300000-0000-4000-8000-000000000001";
    const target = document.querySelector("article") as HTMLElement;
    const first = render(
      <PublicSearchMetricsTracker enabled resultSetId={resultSetId} />,
    );

    emitVisible(IntersectionObserverMock.instances[0], target);
    first.unmount();

    render(<PublicSearchMetricsTracker enabled resultSetId={resultSetId} />);
    emitVisible(IntersectionObserverMock.instances[1], target);

    expect(emitPublicMetricEvents).toHaveBeenCalledTimes(2);
    expect(emitPublicMetricEvents).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ resultSetId }),
    ]);
    expect(emitPublicMetricEvents).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ resultSetId }),
    ]);
  });
});

function emitVisible(observer: IntersectionObserverMock, target: HTMLElement) {
  act(() => {
    observer.callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  });
}
