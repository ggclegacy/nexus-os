import type { Metadata } from "next";
import { CalendarApp } from "../../components/calendar/CalendarApp";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Personal events, priorities, routines, reminders, and quiet hours.",
};

export default function CalendarPage() {
  return <CalendarApp />;
}
