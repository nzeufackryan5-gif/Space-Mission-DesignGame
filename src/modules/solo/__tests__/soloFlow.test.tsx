import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("solo mission flow", () => {
  it("opens the catalogue from the solo start button", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /commencer une partie solo/i }));
    expect(screen.getByRole("heading", { name: /votre prochaine frontière/i })).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("opens the selected mission briefing and confirms it", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /explorer les missions/i }));
    fireEvent.click(screen.getByRole("link", { name: /consulter le briefing : lunar relay/i }));
    expect(screen.getByRole("heading", { name: "Lunar Relay" })).toBeTruthy();
    expect(screen.getByText(/placer le relais sur une orbite lunaire stable/i)).toBeTruthy();
    expect(screen.getByText(/budget maximal : 180 crédits/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /valider le briefing/i }));
    expect(screen.getAllByText("Briefing validé")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /briefing validé/i })).toHaveProperty("disabled", true);
  });

  it("switches the interface language to English", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: "Langue" }), { target: { value: "en" } });
    expect(screen.getByRole("heading", { name: "Space is not conquered by chance." })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Explore missions" }));
    expect(screen.getByRole("heading", { name: "Your next frontier." })).toBeTruthy();
    expect(screen.getByText(/send an autonomous weather probe/i)).toBeTruthy();
  });
});
