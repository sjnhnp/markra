import {
  createDefaultAiAgentSessionState,
  normalizeStoredAiAgentSessionState
} from "./session-state";

describe("AI agent session state", () => {
  it("stores the last agent model selection with the session", () => {
    expect(createDefaultAiAgentSessionState({
      agentModelId: "deepseek-v4-flash",
      agentProviderId: "deepseek",
      thinkingEnabled: true,
      webSearchEnabled: true
    })).toMatchObject({
      agentModelId: "deepseek-v4-flash",
      agentProviderId: "deepseek",
      thinkingEnabled: true,
      webSearchEnabled: true
    });

    expect(normalizeStoredAiAgentSessionState({
      agentModelId: " gpt-5.5 ",
      agentProviderId: " openai ",
      draft: "",
      messages: [],
      panelOpen: false,
      panelWidth: null,
      thinkingEnabled: true,
      webSearchEnabled: false
    })).toMatchObject({
      agentModelId: "gpt-5.5",
      agentProviderId: "openai",
      thinkingEnabled: true,
      webSearchEnabled: false
    });
  });
});
