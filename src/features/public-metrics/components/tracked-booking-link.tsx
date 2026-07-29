"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps, ReactNode } from "react";

import { emitPublicMetricEvents } from "../public-metric-events.client";

type TrackedBookingLinkProps = Omit<
  ComponentProps<typeof Link>,
  "children" | "href" | "onClick"
> & {
  children: ReactNode;
  href: string;
  serviceId: string;
  sourceSurface?: "therapist_profile" | "therapist_search";
  therapistSlug: string;
};

export function TrackedBookingLink({
  children,
  href,
  serviceId,
  sourceSurface = "therapist_profile",
  therapistSlug,
  ...props
}: TrackedBookingLinkProps) {
  return (
    <Link
      {...props}
      href={href as Route}
      onClick={() => {
        emitPublicMetricEvents([
          {
            eventType: "booking_flow_started",
            serviceId,
            sourceSurface,
            therapistSlug,
          },
        ]);
      }}
    >
      {children}
    </Link>
  );
}
