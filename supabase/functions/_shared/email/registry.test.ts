import { assert, assertEquals } from "jsr:@std/assert";
import {
  emailActionRegistry,
  getAdminConfigurableEmailActions,
} from "./registry.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test(
  "booking reminders are available in administrative email settings",
  () => {
    const reminderKeys = [
      "booking_reminder_24h_patient",
      "booking_reminder_1h_patient",
    ] as const;
    const configurableKeys = new Set(
      getAdminConfigurableEmailActions().map((entry) => entry.actionKey),
    );

    for (const actionKey of reminderKeys) {
      const entry = emailActionRegistry[actionKey];
      assert(entry);
      assertEquals(entry.category, "Encontros");
      assertEquals(entry.adminConfigurable, true);
      assertEquals(entry.supportsAutomaticDispatch, true);
      assert(configurableKeys.has(actionKey));
    }
  },
);
