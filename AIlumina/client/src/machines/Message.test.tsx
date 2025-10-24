import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message as MessageType } from "./AIServiceTypes";
import Message from "./Message";

describe("<Message />", () => {
  it("renders markdown content as text", () => {
    const message: MessageType = {
      role: "assistant",
      content: "Hello **world**",
    };
    const { container } = render(<Message message={message} />);
    // Check that the paragraph contains the expected text structure
    const paragraph = container.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBe("Hello world");
    // Verify the strong tag is rendered for the markdown bold syntax
    expect(paragraph?.querySelector("strong")).toBeInTheDocument();
    expect(paragraph?.querySelector("strong")?.textContent).toBe("world");
  });

  it("sanitizes HTML and strips scripts", () => {
    const message: MessageType = {
      role: "assistant",
      content: "Hi <script>window.__xss='bad'</script> there",
    } as any;
    const { container, getByText } = render(<Message message={message} />);
    expect(getByText("Hi there")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
