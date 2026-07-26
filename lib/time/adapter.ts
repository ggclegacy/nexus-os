import type { CalendarAdapter } from "./types";

export const unavailableCalendarAdapter: CalendarAdapter = {
  async listCalendars() {
    return [];
  },
  async pullChanges() {
    return { cursor: null };
  },
  async createRemoteEvent() {
    throw new Error("No external calendar is connected.");
  },
  async updateRemoteEvent() {
    throw new Error("No external calendar is connected.");
  },
  async deleteRemoteEvent() {
    throw new Error("No external calendar is connected.");
  },
  async health() {
    return {
      available: false,
      permission: "not-connected",
      lastSuccessfulSync: null,
    };
  },
};
