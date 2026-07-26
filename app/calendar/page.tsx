import type { Metadata } from "next";
import { CalendarApp } from "../../components/calendar/CalendarApp";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "A Today-first personal calendar for events, bills, priorities, routines, reminders, and quiet hours.",
  openGraph: {
    title: "Calendar | Nexus OS",
    description:
      "A Today-first personal calendar for seeing what matters now, what is next, and what needs attention.",
  },
  twitter: {
    title: "Calendar | Nexus OS",
    description:
      "A Today-first personal calendar for seeing what matters now, what is next, and what needs attention.",
  },
};

export default function CalendarPage() {
  return <CalendarApp />;
}
