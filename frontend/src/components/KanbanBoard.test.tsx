import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

const testBoard = (): BoardData => ({
  columns: [
    { id: "1", title: "Backlog", cardIds: ["1"] },
    { id: "2", title: "Discovery", cardIds: [] },
    { id: "3", title: "In Progress", cardIds: [] },
    { id: "4", title: "Review", cardIds: [] },
    { id: "5", title: "Done", cardIds: [] },
  ],
  cards: {
    "1": { id: "1", title: "Existing card", details: "Some details" },
  },
});

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "fetchBoard").mockResolvedValue(testBoard());
    vi.spyOn(api, "renameColumn").mockResolvedValue(
      testBoard().columns[0]
    );
    vi.spyOn(api, "createCard").mockResolvedValue({
      id: "2",
      title: "New card",
      details: "Notes",
    });
    vi.spyOn(api, "deleteCardApi").mockResolvedValue(undefined);
    vi.spyOn(api, "moveCardApi").mockResolvedValue({
      id: "1",
      title: "Existing card",
      details: "Some details",
    });
  });

  it("renders five columns after loading the board", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(api.renameColumn).toHaveBeenCalledWith("1", "New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete existing card/i,
    });
    await userEvent.click(deleteButton);

    expect(
      within(column).queryByText("Existing card")
    ).not.toBeInTheDocument();
    expect(api.deleteCardApi).toHaveBeenCalledWith("1");
  });

  it("redirects to login on a 401 while fetching the board", async () => {
    vi.spyOn(api, "fetchBoard").mockRejectedValue(
      new api.ApiError(401)
    );
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);

    await vi.waitFor(() => expect(onLogout).toHaveBeenCalled());
  });
});
