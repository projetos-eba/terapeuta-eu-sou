export type BookingPrimaryAction =
  | {
      disabled?: false;
      href: string;
      label: string;
      kind: "link";
    }
  | {
      disabled: true;
      label: string;
      reason: string;
      kind: "button";
    };
