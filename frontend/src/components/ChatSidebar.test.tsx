import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

const testBoard = (): BoardData => ({
  columns: [{ id: "1", title: "Backlog", cardIds: [] }],
  cards: {},
});

describe("ChatSidebar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an empty state before any messages", () => {
    render(
      <ChatSidebar
        onBoardUpdate={() => {}}
        onUnauthorized={() => {}}
        onClose={() => {}}
      />
    );
    expect(
      screen.getByText(/ask me to create, edit, move/i)
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ChatSidebar
        onBoardUpdate={() => {}}
        onUnauthorized={() => {}}
        onClose={onClose}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends a message and displays the reply", async () => {
    vi.spyOn(api, "sendChatMessage").mockResolvedValue({
      reply: "Done!",
      board: testBoard(),
    });
    const onBoardUpdate = vi.fn();

    render(
      <ChatSidebar
        onBoardUpdate={onBoardUpdate}
        onUnauthorized={() => {}}
        onClose={() => {}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/ask the assistant/i),
      "Move card 1 to Done"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Done!")).toBeInTheDocument();
    expect(screen.getByText("Move card 1 to Done")).toBeInTheDocument();
    expect(onBoardUpdate).toHaveBeenCalledWith(testBoard());
  });

  it("calls onUnauthorized on a 401 response", async () => {
    vi.spyOn(api, "sendChatMessage").mockRejectedValue(new api.ApiError(401));
    const onUnauthorized = vi.fn();

    render(
      <ChatSidebar
        onBoardUpdate={() => {}}
        onUnauthorized={onUnauthorized}
        onClose={() => {}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/ask the assistant/i),
      "Hello"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows an error message when the request fails", async () => {
    vi.spyOn(api, "sendChatMessage").mockRejectedValue(new Error("network"));

    render(
      <ChatSidebar
        onBoardUpdate={() => {}}
        onUnauthorized={() => {}}
        onClose={() => {}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/ask the assistant/i),
      "Hello"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again."
    );
  });
});
