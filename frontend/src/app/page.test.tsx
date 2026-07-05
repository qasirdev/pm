import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

const emptyBoard = {
  columns: [
    { id: "1", title: "Backlog", cardIds: [] },
    { id: "2", title: "Discovery", cardIds: [] },
    { id: "3", title: "In Progress", cardIds: [] },
    { id: "4", title: "Review", cardIds: [] },
    { id: "5", title: "Done", cardIds: [] },
  ],
  cards: {},
};

describe("Home", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form when there is no session", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false } as Response);

    render(<Home />);

    expect(
      await screen.findByRole("heading", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("shows the kanban board when a session exists", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/session") {
        return { ok: true, json: async () => ({ username: "user" }) } as Response;
      }
      if (url === "/api/board") {
        return { ok: true, json: async () => emptyBoard } as Response;
      }
      return { ok: false } as Response;
    });

    render(<Home />);

    expect(await screen.findByText("Kanban Studio")).toBeInTheDocument();
  });
});
